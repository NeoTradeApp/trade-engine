const { logger } = require("winston");
const { sequelize, Position, Order } = require("@models");
const { redisService } = require("@services");
const { appEvents } = require("@events")
const { REDIS, EVENT, STRATEGY } = require("@constants")
const { generateRandomId, isMarketOpen, isEmpty, selectKeys, todayTimeIst } = require("@utils");

const { INITIATED, STARTED, ENTERED, PAUSED, STOPPED, EXITED } = STRATEGY.STATUS;
const MARKET_TICK_INTERVAL_MS = 1000;

function BaseStrategy(strategyId, userId) {
  this.strategyId = strategyId || generateRandomId(5);
  this.userId = userId;

  (async () => {
    const userDetails = await redisService.get(REDIS.KEY.USER_INFO(this.userId));
    this.serverId = userDetails?.serverId;
  })();

  this.pnl = 0;
  this.position = {};
  this.positionInDb = [];

  let marketFeedTimer = null;

  this.processMarketTick = () => {
    try {

      // TODO: REMOVE
      // if (!isMarketOpen()) {
      //   stopMarketFeed();
      //   return;
      // }

      if (this.isEntered()) {
        this.updatePnL();
        this.checkExit();
      } else {
        this.checkEntry();
      }
      this.publishPnlToRedis();
    } catch (error) {
      logger.error("Strategy Error:", this.constructor.name, error);
    }
  };

  const listenMarketFeed = () => {
    marketFeedTimer = setInterval(this.processMarketTick, MARKET_TICK_INTERVAL_MS);
  };

  const stopMarketFeed = () => {
    if (!marketFeedTimer) return;

    clearInterval(marketFeedTimer);
    marketFeedTimer = null;
  };

  this.isActive = () => !!marketFeedTimer;
  this.start = () => {
    listenMarketFeed();
  };

  this.stop = () => {
    stopMarketFeed();
  };

  this.isEntered = () => !isEmpty(this.position);
  this.checkEntry = () => { };
  this.checkExit = () => { };
  this.updatePnL = () => { };

  this.enterPosition = async (position) => {
    const transaction = await sequelize.transaction();
    try {
      const positionInDb = await createPosition(position);
      this.position = { ...positionInDb, ...position };
      redisService.set(REDIS.KEY.POSITIONS(this.strategyId, this.userId), this.position, "8h");

      const { orders } = position || {};
      const ordersInDb = await createOrders(positionInDb?.id, orders, transaction);
      transaction.commit();

      return positionInDb;
    } catch (error) {
      transaction.rollback();
      logger.error("Strategy Error:", this.constructor.name, "enterPosition", error);
      // throw error;
    }
  };

  this.publishPnlToRedis = () => {
    if (this.serverId) {
      redisService.publish(REDIS.CHANNEL.POSITION_UPDATE(this.serverId), {
        userId: this.userId,
        position: this.position,
      });
    }
  };

  this.exitPosition = (position) => {
    // exitTime: todayTimeIst().format("yyyy-mm-dd HH:mm:ss"),
  };

  const createPosition = async (position, transaction) => {
    const now = todayTimeIst().format("yyyy-mm-dd HH:mm:ss");
    const positionInDb = await Position.create(
      {
        strategyId: this.strategyId,
        status: "ACTIVE",
        entryTime: now,
        ...selectKeys(
          position,
          "name",
          "description",
          "entryPrice",
        ),
      },
      { transaction }
    );

    return positionInDb.toJSON();
  };

  const createOrders = async (positionId, orders, transaction) => {
    const orderPayloads = (orders || []).map((order) => ({
      ...order,
      positionId,
      parentOrderId: null, // entry orders
      status: "FILLED",
      // createdAt: now,
      // updatedAt: now,
    }));

    return await Order.bulkCreate(orderPayloads, { transaction });
  };
}

module.exports = BaseStrategy;

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

  this.position = {};

  let marketFeedTimer = null;

  this.processMarketTick = () => {
    try {
      if (!isMarketOpen()) {
        stopMarketFeed();
        return;
      }

      if (this.isEntered()) {
        this.updatePnL();
        this.checkExit();
      } else {
        this.checkEntry();
      }
      this.publishPositionToRedis();
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
      const positionInDb = await createPosition(position, transaction);
      this.position = { ...positionInDb, ...position };
      this.savePositionToRedis();

      const { orders } = position || {};
      const ordersInDb = await createOrders(positionInDb?.id, orders, transaction);
      transaction.commit();

      this.position.orders.forEach((order, index) => {
        order.id = ordersInDb[index]?.id
      });

      return positionInDb;
    } catch (error) {
      transaction.rollback();
      logger.error("Strategy Error:", this.constructor.name, "enterPosition", error);
      // throw error;
    }
  };

  this.exitPosition = async (position) => {
    if (!position || position.status !== "ACTIVE") {
      return null;
    }

    let pnl = 0;
    const exitOrders = [];
    for (const orderDetails of position.orders) {
      const { currentData, ...entryOrder } = orderDetails;

      const reverseSide = entryOrder.tnxType === "BUY" ? "SELL" : "BUY";
      const ltp = currentData?.currentCandle?.close || entryOrder.price;

      const exitOrder = {
        ...entryOrder,
        id: undefined,
        parentOrderId: entryOrder.id, // link to entry
        tnxType: reverseSide,
        price: ltp,
        orderId: `exit paper trade`,
      };

      exitOrders.push(exitOrder);

      if (entryOrder.tnxType === "BUY") {
        pnl += (exitOrder.price - entryOrder.price) * entryOrder.quantity;
      } else {
        pnl += (entryOrder.price - exitOrder.price) * entryOrder.quantity;
      }
    }

    const closedPosition = {
      status: "CLOSED",
      pnl,
      exitTime: todayTimeIst(),
      exitPrice: position.exitPrice,
    };

    const transaction = await sequelize.transaction();
    try {
      await updatePosition(position.id, closedPosition, transaction);
      const exitOrdersInDb = await createOrders(position?.id, exitOrders, transaction);
      transaction.commit();

      await redisService.delete(REDIS.KEY.POSITIONS(this.strategyId, this.userId));
      this.position = {};
    } catch (error) {
      transaction.rollback();
      logger.error("Strategy Error:", this.constructor.name, "exitPosition", error);
      // throw error;
    }
  };

  this.savePositionToRedis = () =>
    redisService.set(REDIS.KEY.POSITIONS(this.strategyId, this.userId), this.position, "8h");

  this.publishPositionToRedis = () => {
    if (this.serverId) {
      redisService.publish(REDIS.CHANNEL.POSITION_UPDATE(this.serverId), {
        userId: this.userId,
        position: this.position,
      });
    }
  };

  const createPosition = async (position, transaction) => {
    const positionInDb = await Position.create(
      {
        strategyId: this.strategyId,
        status: "ACTIVE",
        entryTime: todayTimeIst(),
        ...selectKeys(
          position,
          "name",
          "description",
          "entryPrice",
          "target",
          "stoploss",
          "trailingStoploss",
          "trailStoplossAt",
        ),
      },
      { transaction }
    );

    return positionInDb.toJSON();
  };

  const updatePosition = async (positionId, update, transaction) => {
    return await Position.update(
      update,
      {
        where: { id: positionId },
        transaction,
      }
    );
  };

  const createOrders = async (positionId, orders, transaction) => {
    const orderPayloads = (orders || []).map((order) => ({
      positionId,
      parentOrderId: null, // entry orders
      exchange: "nse",
      status: "FILLED",
      productType: "NRML",
      orderType: "MARKET",
      ...order,
    }));

    return await Order.bulkCreate(orderPayloads, { transaction, returning: true });
  };
}

module.exports = BaseStrategy;

const { logger } = require("winston");
const { sequelize, Position, Order } = require("@models");
const { redisService } = require("@services");
const { appEvents } = require("@events")
const { REDIS, EVENT, STRATEGY } = require("@constants")
const { generateRandomId, isMarketOpen, isEmpty, selectKeys, todayTimeIst } = require("@utils");
const { DEFAULT_SERVER_ID } = process.env;

const { INITIATED, STARTED, ENTERED, PAUSED, STOPPED, EXITED } = STRATEGY.STATUS;
const MARKET_TICK_INTERVAL_MS = 600;

function BaseStrategy(strategyId, userId) {
  this.strategyId = strategyId || generateRandomId(5);
  this.userId = userId;

  this.properties = {};

  let marketFeedTimer = null;

  this.initializeProperties = () => { };
  this.isEntered = () => !isEmpty(this.position);
  this.checkEntry = () => { };
  this.checkExit = () => { };
  this.updatePnL = () => { };
  this.onPropertiesLoad = () => { };

  const parseProperties = {
    entryTime: (time) => moment(time),
    exitTime: (time) => moment(time),
  }

  this.loadPropertiesFromRedis = async () => {
    const userDetails = await redisService.get(REDIS.KEY.USER_INFO(this.userId));
    this.serverId = userDetails?.serverId || DEFAULT_SERVER_ID;

    const propertiesFromRedis = await redisService.get(REDIS.KEY.STRATEGY_PROPERTIES(this.strategyId, this.userId));

    if (propertiesFromRedis) {
      this.properties = propertiesFromRedis;

      Object.entries(this.properties).forEach((key, value) => {
        this.properties[key] = parseProperties[key](value);
      });

      this.onPropertiesLoad(this.properties);
    } else {
      this.initializeProperties();
      this.savePropertiesToRedis();
    }

    this.position = this.properties.position || {};
  };

  this.updateProperties = (props) => {
    Object.assign(this.properties, props);
    this.position = this.properties.position;

    this.savePropertiesToRedis();
  };

  this.savePropertiesToRedis = () =>
    redisService.set(REDIS.KEY.STRATEGY_PROPERTIES(this.strategyId, this.userId), this.properties, "8h");

  this.processMarketTick = () => {
    try {
      if (!isMarketOpen()) {
        // stopMarketFeed();
        return;
      }

      if (this.isEntered()) {
        this.updatePnL();
        this.publishPositionToRedis();
        this.checkExit();
      } else {
        const { entryTime, exitTime } = this.properties;
        if (todayTimeIst().isBefore(entryTime) || todayTimeIst().isAfter(exitTime)) return;

        this.checkEntry();
      }
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

  this.enterPosition = async (pos) => {
    const transaction = await sequelize.transaction();
    try {
      const positionInDb = await createPosition(pos, transaction);
      const position = { ...positionInDb, ...pos };

      const { orders } = pos || {};
      const ordersInDb = await createOrders(positionInDb?.id, orders, transaction);
      transaction.commit();

      position.orders.forEach((order, index) => {
        order.id = ordersInDb[index]?.id
      });

      this.updateProperties({ position });

      redisService.publish(REDIS.CHANNEL.POSITION.NEW(this.serverId), {
        userId: this.userId,
        position: position,
      });

      return position;
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
        parentId: entryOrder.id, // link to entry
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

      exitOrders.forEach((order, index) => {
        order.id = exitOrdersInDb[index]?.id
      });
      position.orders.push(...exitOrders);

      this.position = { ...position, ...closedPosition };
      await this.publishPositionToRedis();

      this.updateProperties({ position: undefined });
    } catch (error) {
      transaction.rollback();
      logger.error("Strategy Error:", this.constructor.name, "exitPosition", error);
      // throw error;
    }
  };

  this.prepareOrder = (niftyOption, tnxType, quantity) => ({
    currentData: niftyOption,
    userId: this.userId,
    orderId: "paper trade",

    name: `${niftyOption.strikePrice} ${niftyOption.optionType} ${niftyOption.optionExpiry}`,
    symbol: niftyOption.scrip,

    type: niftyOption.optionType,
    scrip: niftyOption.scrip,
    tnxType,
    price: niftyOption.get("close"),
    brokerage: BROKERAGE,
    taxes: TAXES,

    quantity,
    filledQuantity: quantity,

    serviceProviderUserId: this.userId,
    serviceProviderName: "paper trade",
  });

  this.publishPositionToRedis = () => {
    if (this.serverId) {
      redisService.publish(REDIS.CHANNEL.POSITION.UPDATE(this.serverId), {
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
      parentId: null, // entry orders
      exchange: "nse",
      status: "FILLED",
      productType: "NRML",
      orderType: "MARKET",
      ...order,
    }));

    return await Order.bulkCreate(orderPayloads, { transaction, returning: true });
  };

  this.loadPropertiesFromRedis();
}

module.exports = BaseStrategy;

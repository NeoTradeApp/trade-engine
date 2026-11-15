const moment = require("moment");
const { logger } = require("winston");
const { sequelize, Position, Order } = require("@models");
const { redisService, kotakNeoOrdersService } = require("@services");
const { appEvents } = require("@events")
const { REDIS, EVENT, STRATEGY, SERVICE_PROVIDERS } = require("@constants")
const { generateRandomId, isMarketOpen, isEmpty, selectKeys, todayTimeIst, calculateCharges, calculateBrokerage } = require("@utils");
const { getProviderOrderService } = require("./provider_services");
const { DEFAULT_SERVER_ID } = process.env;

const MARKET_TICK_INTERVAL_MS = 600;

function BaseStrategy(strategyId, userId, options = {}) {
  this.strategyId = strategyId || generateRandomId(5);
  this.userId = userId;

  this.serviceProvider = getProviderOrderService(options.serviceProvider);

  this.properties = {};

  let marketFeedTimer = null;

  this.initializeProperties = () => { };
  this.isEntered = () => !isEmpty(this.position);
  this.checkEntry = () => { };
  this.checkExit = () => { };
  this.onPropertiesLoad = () => { };

  this.updatePnL = () => {
    let pnl = 0;
    this.position.orders.forEach((order) => {
      if (!order.currentData) return;

      if (order.tnxType === "BUY") {
        pnl += order.currentData.get("close") - order.price;
      } else if (order.tnxType === "SELL") {
        pnl += order.price - order.currentData.get("close");
      }
    })

    this.position.pnl = pointsToAmount(pnl);
  };

  const submitOrdersToProvider = async (orders = []) => {
    return await Promise.all(orders.map(async (order) => {
      const brokerOrder = await this.serviceProvider.placeMarketOrder(this.userId, order);

      return { ...order, ...brokerOrder };
    }));
  };

  // const recalculatePositionPnl = (position) => {
  //   const orders = position.orders || [];
  //   const entryOrders = orders.filter((order) => !order.parentId);

  //   return entryOrders.reduce((pnl, entryOrder) => {
  //     const exitOrder = orders.find((order) => order.parentId === entryOrder.id && order.status === "FILLED");
  //     if (!exitOrder) return pnl;

  //     const quantity = Number(exitOrder.filledQuantity || entryOrder.filledQuantity || entryOrder.quantity);
  //     const entryPrice = Number(entryOrder.price);
  //     const exitPrice = Number(exitOrder.price);
  //     const orderPnl = entryOrder.tnxType === "BUY"
  //       ? (exitPrice - entryPrice) * quantity
  //       : (entryPrice - exitPrice) * quantity;

  //     return pnl + orderPnl;
  //   }, 0);
  // };

  // const trackBrokerExecution = (position, order, isExitOrder = false) => {
  //   // if (!usesKotakNeo() || !order.orderId || order.orderId === "paper trade") return;

  //   this.serviceProvider.trackOrderExecution(this.userId, order.orderId, async (update) => {
  //     const status = toOrderStatus(update.ordSt);
  //     const executionPrice = Number(update.avgPrc);
  //     const filledQuantity = Number(update.fldQty);
  //     const orderUpdate = {
  //       status,
  //       filledQuantity: Number.isFinite(filledQuantity) ? filledQuantity : order.filledQuantity,
  //     };

  //     if (Number.isFinite(executionPrice) && executionPrice > 0) {
  //       orderUpdate.price = executionPrice;
  //       orderUpdate.taxes = calculateCharges(executionPrice, order.quantity, order.tnxType);
  //     }

  //     if (update.exOrdId) orderUpdate.remarks = `Exchange order: ${update.exOrdId}`;

  //     await Order.update(orderUpdate, { where: { id: order.id } });
  //     Object.assign(order, orderUpdate);

  //     if (isExitOrder && status === "FILLED") {
  //       const pnl = recalculatePositionPnl(position);
  //       position.pnl = pnl;
  //       await Position.update({ pnl }, { where: { id: position.id } });
  //     }

  //     this.position = position;
  //     this.publishPositionToRedis();
  //   }).catch((error) => {
  //     logger.error("Strategy broker order tracking error:", this.constructor.name, error);
  //   });
  // };

  const parseProperties = {
    entryTime: (time) => moment(time),
    exitTime: (time) => moment(time),
  };

  this.loadPropertiesFromRedis = async () => {
    const userDetails = await redisService.get(REDIS.KEY.USER_INFO(this.userId));
    this.serverId = userDetails?.serverId || DEFAULT_SERVER_ID;

    const propertiesFromRedis = await redisService.get(REDIS.KEY.STRATEGY_PROPERTIES(this.strategyId, this.userId));

    if (propertiesFromRedis) {
      this.properties = propertiesFromRedis;

      Object.entries(parseProperties).forEach(([key, parseFn]) => {
        this.properties[key] = parseFn(this.properties[key]);
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
      const orders = await submitOrdersToProvider(pos.orders);
      const position = { ...positionInDb, ...pos, orders };

      const ordersInDb = await createOrders(positionInDb?.id, orders, transaction);
      await transaction.commit();

      position.orders.forEach((order, index) => {
        order.id = ordersInDb[index]?.id
      });

      // position.orders.forEach((order) => trackBrokerExecution(position, order));

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
        brokerage: calculateBrokerage(),
        taxes: calculateCharges(ltp, entryOrder.quantity, reverseSide),
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
      const submittedExitOrders = await submitOrdersToProvider(exitOrders);
      const exitOrdersInDb = await createOrders(position?.id, submittedExitOrders, transaction);
      await transaction.commit();

      submittedExitOrders.forEach((order, index) => {
        order.id = exitOrdersInDb[index]?.id
      });
      position.orders.push(...submittedExitOrders);

      // submittedExitOrders.forEach((order) => trackBrokerExecution(position, order, true));

      Object.assign(position, closedPosition);
      this.position = position;
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

    name: `${niftyOption.strikePrice} ${niftyOption.optionType} ${niftyOption.optionExpiry}`,
    symbol: niftyOption.get("tradingSymbol"),
    tradingSymbol: niftyOption.get("tradingSymbol"),
    exchangeSegment: niftyOption.get("exchangeSegment"),

    type: niftyOption.optionType,
    scrip: niftyOption.scrip,
    tnxType,
    price: niftyOption.get("close"),
    brokerage: calculateBrokerage(),
    taxes: calculateCharges(niftyOption.get("close"), quantity, tnxType),
    quantity,

    filledQuantity: quantity,
    orderId: "paper trade",
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

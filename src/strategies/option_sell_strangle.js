const moment = require("moment");
const { logger } = require("winston");
const { sequelize, Position, Order } = require("@models");
const { REDIS, STRATEGY } = require("@constants");
const {
  redisService,
  niftyIndexWatchService: niftyIndex,
  NiftyOptionsWatchService,
} = require("@services");
const {
  todayTimeIst,
  getDateOfNext,
  isMarketOpen,
  calculateCharges,
  calculateBrokerage,
} = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function OptionSellStrangle(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.OPTION_SELL_STRANGLE;

  const LOT_SIZE = 65;
  const NO_OF_LOTS = 1;
  const QUANTITY = LOT_SIZE * NO_OF_LOTS;

  const OTM_POINTS = 200;
  const TARGET_POINTS = 15;
  const STOPLOSS_POINTS = 15;
  const REENTRY_DELAY_MINUTES = 1;

  const OPTION_TYPES = ["CE", "PE"];

  const watchers = { CE: null, PE: null };
  const legs = { CE: null, PE: null };
  const nextEntryAt = { CE: null, PE: null };

  let processing = false;
  let startRequested = false;
  let resolveInitialization;
  const initializationPromise = new Promise((resolve) => {
    resolveInitialization = resolve;
  });

  const getExpiry = () =>
    getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");

  const getStrikePrice = (type, indexPrice) => {
    const atm = Math.round(indexPrice / 100) * 100;
    return type === "CE" ? atm + OTM_POINTS : atm - OTM_POINTS;
  };

  const getPremium = (watcher) => {
    const value = watcher?.get("close");
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  const destroyWatcher = (type) => {
    if (watchers[type]) {
      watchers[type].destroy();
      watchers[type] = null;
    }
  };

  const toPlainObject = (record) =>
    record && (record.toJSON ? record.toJSON() : record);

  const withoutCurrentData = (order) => {
    const { currentData, ...persistedOrder } = order || {};
    return persistedOrder;
  };

  const publishPosition = (channel, position) => {
    if (!this.serverId || !position) return;

    redisService.publish(channel(this.serverId), {
      userId: this.userId,
      position,
    });
  };

  const positionPayload = (leg, updates = {}) => ({
    ...leg.position,
    orders: [leg.entryOrder],
    ...updates,
  });

  const getWatcher = (type, strikePrice) => {
    if (
      watchers[type] &&
      watchers[type].strikePrice === strikePrice
    ) {
      return watchers[type];
    }

    destroyWatcher(type);

    watchers[type] = new NiftyOptionsWatchService(
      strikePrice,
      type,
      getExpiry()
    );

    return watchers[type];
  };

  const saveState = async () => {
    this.properties.strangle = {
      legs: Object.fromEntries(
        OPTION_TYPES.map((type) => {
          const leg = legs[type];

          return [
            type,
            leg
              ? {
                positionId: leg.positionId,
                position: leg.position,
                entryOrder: withoutCurrentData(leg.entryOrder),
                strikePrice: leg.strikePrice,
                entryPremium: leg.entryPremium,
                entryTime: leg.entryTime,
              }
              : null,
          ];
        })
      ),
      nextEntryAt: Object.fromEntries(
        OPTION_TYPES.map((type) => [
          type,
          nextEntryAt[type]
            ? nextEntryAt[type].toISOString()
            : null,
        ])
      ),
    };

    await this.savePropertiesToRedis();
  };

  this.initializeProperties = () => {
    this.properties = {
      entryTime: todayTimeIst({ hour: 9, minute: 20 }),
      exitTime: todayTimeIst({ hour: 15, minute: 14 }),
      strangle: {
        legs: { CE: null, PE: null },
        nextEntryAt: { CE: null, PE: null },
      },
    };

    resolveInitialization();
  };

  this.onPropertiesLoad = async (properties) => {
    const state = properties.strangle || {};

    try {
      for (const type of OPTION_TYPES) {
        const savedLeg = state.legs?.[type];

        if (savedLeg?.positionId) {
          const positionRecord = await Position.findOne({
            where: { id: savedLeg.positionId, status: "ACTIVE" },
          });

          if (!positionRecord) {
            nextEntryAt[type] = state.nextEntryAt?.[type]
              ? moment(state.nextEntryAt[type])
              : null;
            continue;
          }

          let entryOrder = savedLeg.entryOrder;
          if (!entryOrder) {
            const entryOrderRecord = await Order.findOne({
              where: {
                positionId: savedLeg.positionId,
                parentId: null,
                tnxType: "SELL",
              },
              order: [["createdAt", "ASC"]],
            });
            entryOrder = toPlainObject(entryOrderRecord);
          }

          if (!entryOrder) continue;
          const watcher = getWatcher(type, savedLeg.strikePrice);

          legs[type] = {
            ...savedLeg,
            positionId: positionRecord.id,
            position: toPlainObject(positionRecord),
            entryOrder: {
              ...entryOrder,
              currentData: watcher,
            },
            watcher,
          };

          publishPosition(
            REDIS.CHANNEL.POSITION.UPDATE,
            positionPayload(legs[type]),
          );
        }

        nextEntryAt[type] = state.nextEntryAt?.[type]
          ? moment(state.nextEntryAt[type])
          : null;
      }
    } catch (error) {
      logger.error("OptionSellStrangle state restore error:", error);
    } finally {
      resolveInitialization();
    }
  };

  const enterLeg = async (type, indexPrice) => {
    if (legs[type]) return;

    const strikePrice = getStrikePrice(type, indexPrice);
    const watcher = getWatcher(type, strikePrice);
    const premium = getPremium(watcher);

    if (premium === null) return;

    const now = todayTimeIst();

    const transaction = await sequelize.transaction();

    try {
      const positionRecord = await Position.create(
        {
          strategyId: this.strategyId,
          status: "ACTIVE",
          name: `OPTION SELL STRANGLE ${type}`,
          description: `SELL ${watcher.scrip}`,
          entryPrice: indexPrice,
          entryTime: now,
          target: TARGET_POINTS * QUANTITY,
          stoploss: -STOPLOSS_POINTS * QUANTITY,
        },
        { transaction }
      );

      const orderRecord = await Order.create(
        {
          positionId: positionRecord.id,
          parentId: null,
          exchange: "nse",
          status: "FILLED",
          productType: "NRML",
          orderType: "MARKET",
          userId: this.userId,
          orderId: "paper trade",
          name: `${strikePrice} ${type} ${watcher.optionExpiry}`,
          symbol: watcher.scrip,
          type,
          scrip: watcher.scrip,
          tnxType: "SELL",
          price: premium,
          brokerage: calculateBrokerage(),
          taxes: calculateCharges(premium, QUANTITY, "SELL"),
          quantity: QUANTITY,
          filledQuantity: QUANTITY,
          serviceProviderUserId: this.userId,
          serviceProviderName: "paper trade",
        },
        { transaction }
      );

      await transaction.commit();

      legs[type] = {
        positionId: positionRecord.id,
        position: toPlainObject(positionRecord),
        entryOrder: {
          ...orderRecord.toJSON(),
          currentData: watcher,
        },
        strikePrice,
        entryPremium: premium,
        entryTime: now.toISOString(),
        watcher,
      };

      nextEntryAt[type] = null;
      await saveState();
      publishPosition(
        REDIS.CHANNEL.POSITION.NEW,
        positionPayload(legs[type]),
      );

      logger.info(
        `OptionSellStrangle: Entered ${type} ${strikePrice} @ ${premium}`
      );
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      logger.error("OptionSellStrangle enterLeg error:", error);
      throw error;
    }
  };

  const exitLeg = async (
    type,
    indexPrice,
    premium,
    allowReentry = true
  ) => {
    const leg = legs[type];
    if (!leg) return;

    const entryOrder = leg.entryOrder;
    const grossPnl = (leg.entryPremium - premium) * QUANTITY;

    const transaction = await sequelize.transaction();

    try {
      // Explicit exit-order payload: no copied IDs or timestamps.
      const exitOrderRecord = await Order.create(
        {
          positionId: leg.positionId,
          parentId: entryOrder.id,
          exchange: entryOrder.exchange || "nse",
          status: "FILLED",
          productType: entryOrder.productType || "NRML",
          orderType: entryOrder.orderType || "MARKET",
          userId: this.userId,
          orderId: "exit paper trade",
          name: entryOrder.name,
          symbol: entryOrder.symbol,
          type: entryOrder.type,
          scrip: entryOrder.scrip,
          tnxType: "BUY",
          price: premium,
          brokerage: calculateBrokerage(),
          taxes: calculateCharges(premium, QUANTITY, "BUY"),
          quantity: QUANTITY,
          filledQuantity: QUANTITY,
          serviceProviderUserId: this.userId,
          serviceProviderName: "paper trade",
        },
        { transaction }
      );

      await Position.update(
        {
          status: "CLOSED",
          pnl: grossPnl,
          exitTime: todayTimeIst(),
          exitPrice: indexPrice,
        },
        {
          where: {
            id: leg.positionId,
            status: "ACTIVE",
          },
          transaction,
        }
      );

      await transaction.commit();

      const closedPosition = positionPayload(leg, {
        status: "CLOSED",
        pnl: grossPnl,
        exitTime: todayTimeIst(),
        exitPrice: indexPrice,
        orders: [
          entryOrder,
          {
            ...toPlainObject(exitOrderRecord),
            currentData: leg.watcher,
          },
        ],
      });

      legs[type] = null;
      destroyWatcher(type);

      nextEntryAt[type] = allowReentry
        ? todayTimeIst().add(REENTRY_DELAY_MINUTES, "minutes")
        : null;

      await saveState();
      publishPosition(REDIS.CHANNEL.POSITION.UPDATE, closedPosition);

      logger.info(
        `OptionSellStrangle: Exited ${type}, ` +
        `position=${leg.positionId}, pnl=${grossPnl.toFixed(2)}`
      );
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }

      logger.error("OptionSellStrangle exitLeg error:", error);
      throw error;
    }
  };

  const processLeg = async (type, indexPrice, now) => {
    const leg = legs[type];

    if (leg) {
      const premium = getPremium(leg.watcher);
      if (premium === null) return;

      const pnlPoints = leg.entryPremium - premium;

      publishPosition(
        REDIS.CHANNEL.POSITION.UPDATE,
        positionPayload(leg, {
          pnl: pnlPoints * QUANTITY,
          exitPrice: indexPrice,
          currentPrice: premium,
        }),
      );

      if (
        pnlPoints >= TARGET_POINTS ||
        pnlPoints <= -STOPLOSS_POINTS
      ) {
        await exitLeg(type, indexPrice, premium);
      }

      return;
    }

    const { entryTime, exitTime } = this.properties;

    if (now.isBefore(entryTime) || now.isAfter(exitTime)) {
      return;
    }

    if (nextEntryAt[type] && now.isBefore(nextEntryAt[type])) {
      return;
    }

    await enterLeg(type, indexPrice);
  };

  const closeAllLegs = async (indexPrice) => {
    for (const type of OPTION_TYPES) {
      const leg = legs[type];
      if (!leg) continue;

      // Do not fabricate an exit price when a quote is unavailable.
      const premium = getPremium(leg.watcher);
      if (premium === null) continue;

      await exitLeg(type, indexPrice, premium, false);
    }
  };

  this.processMarketTick = async () => {
    if (processing) return;
    processing = true;

    try {
      if (!isMarketOpen()) return;

      const indexPrice = niftyIndex.get("close");
      if (!Number.isFinite(indexPrice) || indexPrice <= 0) return;

      const now = todayTimeIst();

      if (now.isAfter(this.properties.exitTime)) {
        await closeAllLegs(indexPrice);
        return;
      }

      for (const type of OPTION_TYPES) {
        await processLeg(type, indexPrice, now);
      }
    } catch (error) {
      logger.error("OptionSellStrangle strategy error:", error);
    } finally {
      processing = false;
    }
  };

  const baseStart = this.start;
  this.start = () => {
    if (startRequested) return;
    startRequested = true;

    initializationPromise
      .then(baseStart)
      .catch((error) => {
        logger.error("OptionSellStrangle initialization error:", error);
      });
  };

  const baseStop = this.stop;

  this.stop = () => {
    baseStop();

    for (const type of OPTION_TYPES) {
      destroyWatcher(type);
    }
  };
}

module.exports = OptionSellStrangle;

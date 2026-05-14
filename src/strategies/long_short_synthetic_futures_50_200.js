const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyFuturesWatchService: niftyFutures, NiftyOptionsWatchService } = require("@services");
const { todayTimeIst, getDateOfNext } = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function LongShortSyntheticFutures50200(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES;

  const LONG_POSITION = "LONG";
  const SHORT_POSITION = "SHORT";
  const LOT_SIZE = 65;
  const noOfLots = 1;
  const TARGET = 200;
  const STOPLOSS = -50;
  const TRAILING_STOPLOSS = 75;
  const TRAIL_STOPLOSS_AT = 25;
  const TRADE_INTERVAL_IN_MINUTES = 5;

  const pointsToAmount = (point) => point * noOfLots * LOT_SIZE;

  let entryTime = todayTimeIst({ hour: 9, minute: 45 });
  let exitTime = todayTimeIst({ hour: 15, minute: 25 });

  const isCurrentTimeBefore = (time) => todayTimeIst().isBefore(time);
  const isCurrentTimeAfter = (time) => todayTimeIst().isAfter(time);

  let niftyOptionCE2 = niftyOptionPE2 = null;

  redisService.get(REDIS.KEY.POSITIONS(this.strategyId, this.userId)).then((position) => {
    if (position) {
      this.position = position;
      selectATMOptions(this.position.strikePrice);

      this.position.orders.forEach((order) => {
        const niftyOption = [niftyOptionCE2, niftyOptionPE2].find((niftyOption) =>
          niftyOption && order.scrip === niftyOption.scrip
        );
        if (niftyOption) {
          order.currentData = niftyOption;
        }
      })
    }
  });

  const selectATMOptions = (strikePrice) => {
    if (!strikePrice) return;

    const niftyWeeklyExpiry = getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");
    if (!niftyOptionCE2) {
      niftyOptionCE2 = new NiftyOptionsWatchService(strikePrice, "CE", niftyWeeklyExpiry);
    }

    if (!niftyOptionPE2) {
      niftyOptionPE2 = new NiftyOptionsWatchService(strikePrice, "PE", niftyWeeklyExpiry);
    }
  };

  this.checkEntry = () => {
    if (isCurrentTimeBefore(entryTime) || isCurrentTimeAfter(exitTime)) return;

    const price = niftyFutures.get("close");
    if (!price) return;

    const atmStrikePrice = Math.round(price / 100) * 100;
    selectATMOptions(atmStrikePrice);

    if (!niftyOptionCE2.get("close") || !niftyOptionPE2.get("close")) return;

    const { ema, trend } = niftyFutures.get("indicators") || {};

    // Reverse the position direction based on previous trade else follow the trend.
    if (this.previousTradeDirection === LONG_POSITION) {
      enterShort();
    } else if (this.previousTradeDirection === SHORT_POSITION) {
      enterLong();
    } else if (trend === STRATEGY.TREND.UPTREND) {
      enterLong();
    } else if (trend === STRATEGY.TREND.DOWNTREND) {
      enterShort();
    }
  };

  this.checkExit = () => {
    const { pnl, target, stoploss, trailStoplossAt, trailingStoploss } = this.position;

    if (pnl <= stoploss || pnl >= target || isCurrentTimeAfter(exitTime)) {
      this.previousTradeDirection = this.position.direction;
      this.exitPosition({
        ...this.position,
        exitPrice: niftyFutures.get("close"),
      });

      niftyOptionCE2.destroy();
      niftyOptionPE2.destroy();
      niftyOptionCE2 = null;
      niftyOptionPE2 = null;

      entryTime = todayTimeIst().add(TRADE_INTERVAL_IN_MINUTES, "minutes");

      return;
    }

    if (pnl >= trailStoplossAt) {
      Object.assign(this.position, {
        stoploss: trailStoplossAt - trailingStoploss,
        trailStoplossAt: trailStoplossAt + pointsToAmount(TRAIL_STOPLOSS_AT),
      });
      this.savePositionToRedis();
    }
  };

  this.updatePnL = () => {
    const cePrice = niftyOptionCE2.get("close");
    const pePrice = niftyOptionPE2.get("close");

    let pnl = 0;

    if (this.position.direction === LONG_POSITION) {
      pnl =
        (cePrice - this.position.ceEntry) -
        (pePrice - this.position.peEntry);
    } else {
      pnl =
        -(cePrice - this.position.ceEntry) +
        (pePrice - this.position.peEntry);
    }

    this.position.pnl = pointsToAmount(pnl);
  };

  const enterLong = () => {
    // BUY CE + SELL PE
    this.enterPosition({
      ...preparePosition(),
      direction: LONG_POSITION,
      name: `NIFTY SYNTH FUT (${LONG_POSITION})`,
      description: `Buy ${niftyOptionCE2.scrip} | Sell ${niftyOptionPE2.scrip}`,
      orders: [
        prepareOrder(niftyOptionCE2, "BUY", noOfLots * LOT_SIZE),
        prepareOrder(niftyOptionPE2, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  const enterShort = () => {
    // SELL CE + BUY PE
    this.enterPosition({
      ...preparePosition(),
      direction: SHORT_POSITION,
      name: `NIFTY SYNTH FUT (${SHORT_POSITION})`,
      description: `BUY ${niftyOptionPE2.scrip} | SELL ${niftyOptionCE2.scrip}`,
      orders: [
        prepareOrder(niftyOptionPE2, "BUY", noOfLots * LOT_SIZE),
        prepareOrder(niftyOptionCE2, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  const preparePosition = () => {
    const cePrice = niftyOptionCE2.get("close");
    const pePrice = niftyOptionPE2.get("close");

    return {
      ceEntry: cePrice,
      peEntry: pePrice,
      strikePrice: niftyOptionCE2?.strikePrice || niftyOptionPE2?.strikePrice,
      entryPrice: niftyFutures.get("close"),

      target: pointsToAmount(TARGET),
      stoploss: pointsToAmount(STOPLOSS),
      trailingStoploss: pointsToAmount(TRAILING_STOPLOSS),
      trailStoplossAt: pointsToAmount(TRAIL_STOPLOSS_AT),
    };
  };

  const prepareOrder = (niftyOption, direction, quantity) => ({
    currentData: niftyOption,
    userId: this.userId,
    orderId: "paper trade",

    name: `${niftyOption.strikePrice} ${niftyOption.optionType} ${niftyOption.optionExpiry}`,
    symbol: niftyOption.scrip,

    type: niftyOption.optionType,
    scrip: niftyOption.scrip,
    tnxType: direction,
    price: niftyOption.get("close"),
    brokerage: 10,
    taxes: 6,

    quantity,
    filledQuantity: quantity,

    serviceProviderUserId: this.userId,
    serviceProviderName: "paper trade",
  });

  const baseStop = this.stop;
  this.stop = () => {
    baseStop();
    // niftyFutures.destroy();
    niftyOptionCE2.destroy();
    niftyOptionPE2.destroy();
  };
}

module.exports = LongShortSyntheticFutures50200;

const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyFuturesWatchService: niftyFutures, NiftyOptionsWatchService } = require("@services");
const { todayTimeIst, getDateOfNext } = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function OptionSellScalping(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES;

  const LONG_POSITION = "LONG";
  const SHORT_POSITION = "SHORT";
  const LOT_SIZE = 65;
  const noOfLots = 2;
  const TARGET = 15;
  const STOPLOSS = -15;
  const EMA_DISTANCE_THRESHOLD = 5;
  const TRADE_INTERVAL_IN_MINUTES = 10;
  const TRAILING_STOPLOSS = 15;
  const TRAIL_STOPLOSS_AT = 15;

  const pointsToAmount = (point) => point * noOfLots * LOT_SIZE;

  let entryTime = todayTimeIst({ hour: 9, minute: 30 });
  let exitTime = todayTimeIst({ hour: 15, minute: 25 });

  const isCurrentTimeBefore = (time) => todayTimeIst().isBefore(time);
  const isCurrentTimeAfter = (time) => todayTimeIst().isAfter(time);

  let niftyOption2 = null;

  redisService.get(REDIS.KEY.POSITIONS(this.strategyId, this.userId)).then((position) => {
    if (position) {
      this.position = position;

      if (!niftyOption2) {
        const optionType = this.position.direction === LONG_POSITION ? "PE" : "CE";
        const niftyWeeklyExpiry = getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");
        niftyOption2 = new NiftyOptionsWatchService(this.position.strikePrice, optionType, niftyWeeklyExpiry);
      }

      this.position.orders.forEach((order) => {
        if (niftyOption2) {
          order.currentData = niftyOption2;
        }
      });
    }
  });

  const selectITMOption = (strikePrice, direction) => {
    if (!strikePrice) return;

    if (!niftyOption2) {
      const niftyWeeklyExpiry = getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");
      if (direction === LONG_POSITION) {
        niftyOption2 = new NiftyOptionsWatchService(strikePrice + 100, "PE", niftyWeeklyExpiry);
      } else {
        niftyOption2 = new NiftyOptionsWatchService(strikePrice - 100, "CE", niftyWeeklyExpiry);
      }
    }
  };

  this.checkEntry = () => {
    if (isCurrentTimeBefore(entryTime) || isCurrentTimeAfter(exitTime)) return;

    const price = niftyFutures.get("close");
    if (!price) return;

    const { ema, trend } = niftyFutures.get("indicators") || {};
    const distance = Math.abs(price - ema);

    if (distance > EMA_DISTANCE_THRESHOLD) return;

    const atmStrikePrice = Math.round(price / 100) * 100;

    let direction;
    if (trend === STRATEGY.TREND.UPTREND) {
      direction = LONG_POSITION;
    } else if (trend === STRATEGY.TREND.DOWNTREND) {
      direction = SHORT_POSITION;
    }

    if (!direction) return;

    selectITMOption(atmStrikePrice, direction);
    if (!niftyOption2.get("close")) return;

    this.enterPosition({
      ...preparePosition(),
      direction: direction,
      name: `SCALPING (${direction})`,
      description: `Sell ${niftyOption2.scrip}`,
      orders: [
        prepareOrder(niftyOption2, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  this.checkExit = () => {
    const { pnl, target, stoploss, trailStoplossAt, trailingStoploss } = this.position;

    if (pnl <= stoploss || pnl >= target || isCurrentTimeAfter(exitTime)) {
      this.exitPosition({
        ...this.position,
        exitPrice: niftyFutures.get("close"),
      });

      niftyOption2.destroy();
      niftyOption2 = null;

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
    const optionPrice = niftyOption2.get("close");
    this.position.pnl = pointsToAmount(this.position.optionPrice - optionPrice);
  };

  const preparePosition = () => {
    const optionPrice = niftyOption2.get("close");

    return {
      optionPrice,
      strikePrice: niftyOption2?.strikePrice,
      entryPrice: niftyFutures.get("close"),

      target: pointsToAmount(TARGET),
      stoploss: pointsToAmount(STOPLOSS),
      trailingStoploss: pointsToAmount(TRAILING_STOPLOSS),
      trailStoplossAt: pointsToAmount(TRAIL_STOPLOSS_AT),
    };
  };

  const prepareOrder = (niftyOption2, tnxType, quantity) => ({
    currentData: niftyOption2,
    userId: this.userId,
    orderId: "paper trade",

    name: `${niftyOption2.strikePrice} ${niftyOption2.optionType} ${niftyOption2.optionExpiry}`,
    symbol: niftyOption2.scrip,

    type: niftyOption2.optionType,
    scrip: niftyOption2.scrip,
    tnxType,
    price: niftyOption2.get("close"),
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
    niftyOption2.destroy();
    niftyOption2.destroy();
  };
}

module.exports = OptionSellScalping;

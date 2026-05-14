const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyFuturesWatchService: niftyFutures, NiftyOptionsWatchService } = require("@services");
const { todayTimeIst, getDateOfNext } = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function OptionBuyScalping(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES;

  const LONG_POSITION = "LONG";
  const SHORT_POSITION = "SHORT";
  const LOT_SIZE = 65;
  const noOfLots = 2;
  const TARGET = 30;
  const STOPLOSS = -15;
  const EMA_DISTANCE_THRESHOLD = 5;
  const TRADE_INTERVAL_IN_MINUTES = 1;
  const TRAILING_STOPLOSS = 15;
  const TRAIL_STOPLOSS_AT = 15;

  const pointsToAmount = (point) => point * noOfLots * LOT_SIZE;

  let entryTime = todayTimeIst({ hour: 9, minute: 30 });
  let exitTime = todayTimeIst({ hour: 15, minute: 25 });

  const isCurrentTimeBefore = (time) => todayTimeIst().isBefore(time);
  const isCurrentTimeAfter = (time) => todayTimeIst().isAfter(time);

  let niftyOption = null;

  redisService.get(REDIS.KEY.POSITIONS(this.strategyId, this.userId)).then((position) => {
    if (position) {
      this.position = position;

      if (!niftyOption) {
        const optionType = this.position.direction === LONG_POSITION ? "CE" : "PE";
        const niftyWeeklyExpiry = getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");
        niftyOption = new NiftyOptionsWatchService(this.position.strikePrice, optionType, niftyWeeklyExpiry);
      }

      this.position.orders.forEach((order) => {
        if (niftyOption) {
          order.currentData = niftyOption;
        }
      });
    }
  });

  const selectITMOption = (strikePrice, direction) => {
    if (!strikePrice) return;

    if (!niftyOption) {
      const niftyWeeklyExpiry = getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");
      if (direction === LONG_POSITION) {
        niftyOption = new NiftyOptionsWatchService(strikePrice - 200, "CE", niftyWeeklyExpiry);
      } else {
        niftyOption = new NiftyOptionsWatchService(strikePrice + 200, "PE", niftyWeeklyExpiry);
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
    if (!niftyOption.get("close")) return;

    this.enterPosition({
      ...preparePosition(),
      direction: direction,
      name: `SCALPING (${direction})`,
      description: `Buy ${niftyOption.scrip}`,
      orders: [
        prepareOrder(niftyOption, "BUY", noOfLots * LOT_SIZE),
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

      niftyOption.destroy();
      niftyOption = null;

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
    const optionPrice = niftyOption.get("close");
    this.position.pnl = pointsToAmount(optionPrice - this.position.optionPrice);
  };

  const preparePosition = () => {
    const optionPrice = niftyOption.get("close");

    return {
      optionPrice,
      strikePrice: niftyOption?.strikePrice,
      entryPrice: niftyFutures.get("close"),

      target: pointsToAmount(TARGET),
      stoploss: pointsToAmount(STOPLOSS),
      trailingStoploss: pointsToAmount(TRAILING_STOPLOSS),
      trailStoplossAt: pointsToAmount(TRAIL_STOPLOSS_AT),
    };
  };

  const prepareOrder = (niftyOption, tnxType, quantity) => ({
    currentData: niftyOption,
    userId: this.userId,
    orderId: "paper trade",

    name: `${niftyOption.strikePrice} ${niftyOption.optionType} ${niftyOption.optionExpiry}`,
    symbol: niftyOption.scrip,

    type: niftyOption.optionType,
    scrip: niftyOption.scrip,
    tnxType,
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
    niftyOptionCE.destroy();
    niftyOptionPE.destroy();
  };
}

module.exports = OptionBuyScalping;

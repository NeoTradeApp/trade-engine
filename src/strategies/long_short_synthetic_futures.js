const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyFuturesWatchService: niftyFutures, NiftyOptionsWatchService } = require("@services");
const { isCurrenTimeBefore, isCurrenTimeAfter, getDateOfNext } = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function LongShortSyntheticFutures(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES;

  const LONG_POSITION = "LONG";
  const SHORT_POSITION = "SHORT";
  const LOT_SIZE = 65;
  const noOfLots = 1;
  const TARGET = 200;
  const STOPLOSS = -30;
  const TRAILING_STOPLOSS = 30;
  const TRAIL_STOPLOSS_AT = 30;

  const ENTRY_TIME = { hour: 9, minute: 45 };
  const EXIT_TIME = { hour: 15, minute: 25 };

  const pointsToAmount = (point) => point * noOfLots * LOT_SIZE;

  const EMA_DISTANCE_THRESHOLD = 300;
  let niftyOptionCE = niftyOptionPE = null;

  redisService.get(REDIS.KEY.POSITIONS(this.strategyId, this.userId)).then((position) => {
    if (position) {
      this.position = position;
      selectATMOptions(this.position.strikePrice);

      this.position.orders.forEach((order) => {
        const niftyOption = [niftyOptionCE, niftyOptionPE].find((niftyOption) =>
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
    if (!niftyOptionCE) {
      niftyOptionCE = new NiftyOptionsWatchService(strikePrice, "CE", niftyWeeklyExpiry);
    }

    if (!niftyOptionPE) {
      niftyOptionPE = new NiftyOptionsWatchService(strikePrice, "PE", niftyWeeklyExpiry);
    }
  };

  this.checkEntry = () => {
    if (isCurrenTimeBefore(ENTRY_TIME) || isCurrenTimeAfter(EXIT_TIME)) return;

    const price = niftyFutures.get("close");
    if (!price) return;

    const atmStrikePrice = Math.round(price / 100) * 100;
    selectATMOptions(atmStrikePrice);

    if (!niftyOptionCE.get("close") || !niftyOptionPE.get("close")) return;

    const { ema, trend } = niftyFutures.get("indicators") || {};
    const distance = Math.abs(price - ema);

    if (distance > EMA_DISTANCE_THRESHOLD) return;

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

    if (pnl <= stoploss || pnl >= target || isCurrenTimeAfter(EXIT_TIME)) {
      this.previousTradeDirection = this.position.direction;
      this.exitPosition({
        ...this.position,
        exitPrice: niftyFutures.get("close"),
      });

      niftyOptionCE.destroy();
      niftyOptionPE.destroy();
      niftyOptionCE = null;
      niftyOptionPE = null;

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
    const cePrice = niftyOptionCE.get("close");
    const pePrice = niftyOptionPE.get("close");

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
      description: `Buy ${niftyOptionCE.scrip} | Sell ${niftyOptionPE.scrip}`,
      orders: [
        prepareOrder(niftyOptionCE, "BUY", noOfLots * LOT_SIZE),
        prepareOrder(niftyOptionPE, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  const enterShort = () => {
    // SELL CE + BUY PE
    this.enterPosition({
      ...preparePosition(),
      direction: SHORT_POSITION,
      name: `NIFTY SYNTH FUT (${SHORT_POSITION})`,
      description: `BUY ${niftyOptionPE.scrip} | SELL ${niftyOptionCE.scrip}`,
      orders: [
        prepareOrder(niftyOptionPE, "BUY", noOfLots * LOT_SIZE),
        prepareOrder(niftyOptionCE, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  const preparePosition = () => {
    const cePrice = niftyOptionCE.get("close");
    const pePrice = niftyOptionPE.get("close");

    return {
      ceEntry: cePrice,
      peEntry: pePrice,
      strikePrice: niftyOptionCE?.strikePrice || niftyOptionPE?.strikePrice,
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
    niftyOptionCE.destroy();
    niftyOptionPE.destroy();
  };
}

module.exports = LongShortSyntheticFutures;

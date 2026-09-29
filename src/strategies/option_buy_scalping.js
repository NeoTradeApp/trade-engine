const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyIndexWatchService: niftyIndex, NiftyOptionsWatchService } = require("@services");
const { todayTimeIst, getDateOfNext } = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function OptionBuyScalping(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.OPTION_BUY_SCALPING;

  const LONG_POSITION = "LONG";
  const SHORT_POSITION = "SHORT";
  const LOT_SIZE = 65;
  const noOfLots = 2;
  const TARGET = 30;
  const STOPLOSS = -15;
  const EMA_DISTANCE_THRESHOLD = 5;
  const TRADE_INTERVAL_IN_MINUTES = 10;
  const TRAILING_STOPLOSS = 15;
  const TRAIL_STOPLOSS_AT = 15;
  const BROKERAGE = 10;
  const TAXES = 15;

  let niftyOption = null;

  const pointsToAmount = (point) => point * noOfLots * LOT_SIZE;

  this.initializeProperties = () => {
    this.properties = {
      entryTime: todayTimeIst({ hour: 9, minute: 30 }),
      exitTime: todayTimeIst({ hour: 15, minute: 14 }),
    };
  };

  this.onPropertiesLoad = (properties) => {
    const position = properties.position;

    if (position) {
      if (!niftyOption) {
        const optionType = position.direction === LONG_POSITION ? "CE" : "PE";
        const niftyWeeklyExpiry = getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");
        niftyOption = new NiftyOptionsWatchService(position.strikePrice, optionType, niftyWeeklyExpiry);
      }

      position.orders.forEach((order) => {
        if (niftyOption) {
          order.currentData = niftyOption;
        }
      });
    }
  };

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
    const price = niftyIndex.get("close");
    if (!price) return;

    const { ema, trend } = niftyIndex.get("indicators") || {};
    const distance = Math.abs(price - ema);

    if (distance > EMA_DISTANCE_THRESHOLD) return;

    let direction;
    if (trend === STRATEGY.TREND.UPTREND) {
      direction = LONG_POSITION;
    } else if (trend === STRATEGY.TREND.DOWNTREND) {
      direction = SHORT_POSITION;
    }

    if (!direction) return;

    const atmStrikePrice = Math.round(price / 100) * 100;
    selectITMOption(atmStrikePrice, direction);

    if (!niftyOption.get("close")) return;

    this.enterPosition({
      ...preparePosition(),
      direction: direction,
      name: `SCALPING (${direction})`,
      description: `Buy ${niftyOption.scrip}`,
      orders: [
        this.prepareOrder(niftyOption, "BUY", noOfLots * LOT_SIZE),
      ],
    });
  };

  this.checkExit = () => {
    const { exitTime } = this.properties;
    const { pnl, target, stoploss, trailStoplossAt, trailingStoploss } = this.position;

    if (pnl <= stoploss || pnl >= target || todayTimeIst().isAfter(exitTime)) {
      this.exitPosition({
        ...this.position,
        exitPrice: niftyIndex.get("close"),
      });

      niftyOption.destroy();
      niftyOption = null;

      this.updateProperties({
        entryTime: todayTimeIst().add(TRADE_INTERVAL_IN_MINUTES, "minutes")
      });

      return;
    }

    if (pnl >= trailStoplossAt) {
      Object.assign(this.position, {
        stoploss: trailStoplossAt - trailingStoploss,
        trailStoplossAt: trailStoplossAt + pointsToAmount(TRAIL_STOPLOSS_AT),
      });

      this.updateProperties({ position: this.position });
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
      entryPrice: niftyIndex.get("close"),

      target: pointsToAmount(TARGET),
      stoploss: pointsToAmount(STOPLOSS),
      trailingStoploss: pointsToAmount(TRAILING_STOPLOSS),
      trailStoplossAt: pointsToAmount(TRAIL_STOPLOSS_AT),
    };
  };

  const baseStop = this.stop;
  this.stop = () => {
    baseStop();
    // niftyIndex.destroy();
    niftyOption.destroy();
    niftyOption.destroy();
  };
}

module.exports = OptionBuyScalping;

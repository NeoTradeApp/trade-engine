const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyIndexWatchService: niftyIndex, NiftyOptionsWatchService } = require("@services");
const { todayTimeIst, getDateOfNext } = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function OptionSellScalpingHft(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.OPTION_SELL_SCALPING_HFT;

  const LONG_POSITION = "LONG";
  const SHORT_POSITION = "SHORT";
  const LOT_SIZE = 65;
  const noOfLots = 2;
  const TARGET = 15;
  const STOPLOSS = -15;
  const EMA_DISTANCE_THRESHOLD = 5;
  const TRADE_INTERVAL_IN_MINUTES = 1;
  const BROKERAGE = 10;
  const TAXES = 40;

  let niftyOption = null;

  const pointsToAmount = (point) => point * noOfLots * LOT_SIZE;

  this.initializeProperties = () => {
    this.properties = {
      entryTime: todayTimeIst({ hour: 9, minute: 30 }),
      exitTime: todayTimeIst({ hour: 15, minute: 14 }),
      previousTradeDirection: "",
    };
  };

  this.onPropertiesLoad = (properties) => {
    const position = properties.position;

    if (position) {
      if (!niftyOption) {
        const optionType = position.direction === LONG_POSITION ? "PE" : "CE";
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

  const selectOTMOption = (strikePrice, direction) => {
    if (!strikePrice) return;

    if (!niftyOption) {
      const niftyWeeklyExpiry = getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");
      if (direction === LONG_POSITION) {
        niftyOption = new NiftyOptionsWatchService(strikePrice - 100, "PE", niftyWeeklyExpiry);
      } else {
        niftyOption = new NiftyOptionsWatchService(strikePrice + 100, "CE", niftyWeeklyExpiry);
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
    // Reverse the position direction based on previous trade else follow the trend.
    if (this.properties.previousTradeDirection === LONG_POSITION) {
      direction = SHORT_POSITION;
    } else if (this.properties.previousTradeDirection === SHORT_POSITION) {
      direction = LONG_POSITION;
    } else if (trend === STRATEGY.TREND.UPTREND) {
      direction = LONG_POSITION;
    } else if (trend === STRATEGY.TREND.DOWNTREND) {
      direction = SHORT_POSITION;
    }

    if (!direction) return;

    const atmStrikePrice = Math.round(price / 100) * 100;
    selectOTMOption(atmStrikePrice, direction);

    if (!niftyOption.get("close")) return;

    this.enterPosition({
      ...preparePosition(),
      direction: direction,
      name: `SCALPING (${direction})`,
      description: `Sell ${niftyOption.scrip}`,
      orders: [
        this.prepareOrder(niftyOption, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  this.checkExit = () => {
    const { exitTime } = this.properties;
    const { pnl, target, stoploss } = this.position;

    if (pnl <= stoploss || pnl >= target || todayTimeIst().isAfter(exitTime)) {
      const previousTradeDirection = this.position.direction;

      this.exitPosition({
        ...this.position,
        exitPrice: niftyIndex.get("close"),
      });

      niftyOption.destroy();
      niftyOption = null;

      this.updateProperties({
        previousTradeDirection,
        entryTime: todayTimeIst().add(TRADE_INTERVAL_IN_MINUTES, "minutes"),
      });
    }
  };

  this.updatePnL = () => {
    const optionPrice = niftyOption.get("close");
    this.position.pnl = pointsToAmount(this.position.optionPrice - optionPrice);
  };

  const preparePosition = () => {
    const optionPrice = niftyOption.get("close");

    return {
      optionPrice,
      strikePrice: niftyOption?.strikePrice,
      entryPrice: niftyIndex.get("close"),

      target: pointsToAmount(TARGET),
      stoploss: pointsToAmount(STOPLOSS),
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
    brokerage: BROKERAGE,
    taxes: TAXES,

    quantity,
    filledQuantity: quantity,

    serviceProviderUserId: this.userId,
    serviceProviderName: "paper trade",
  });

  const baseStop = this.stop;
  this.stop = () => {
    baseStop();
    // niftyIndex.destroy();
    niftyOption.destroy();
  };
}

module.exports = OptionSellScalpingHft;

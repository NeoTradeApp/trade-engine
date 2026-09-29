const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyIndexWatchService: niftyIndex, NiftyOptionsWatchService } = require("@services");
const { todayTimeIst, getDateOfNext } = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function OptionSellStraddle(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.OPTION_SELL_STRADDLE;

  const NEUTRAL_POSITION = "NEUTRAL";
  const LOT_SIZE = 65;
  const noOfLots = 1;
  const TARGET = 30;
  const STOPLOSS = -30;
  const EACH_LEG_STOPLOSS_PERCENT = 20;
  const BROKERAGE = 10;
  const TAXES = 40;
  const TRADE_INTERVAL_IN_MINUTES = 60;

  const pointsToAmount = (point) => point * noOfLots * LOT_SIZE;

  let entryTime = todayTimeIst({ hour: 9, minute: 20 });
  let exitTime = todayTimeIst({ hour: 15, minute: 14 });

  const isCurrentTimeBefore = (time) => todayTimeIst().isBefore(time);
  const isCurrentTimeAfter = (time) => todayTimeIst().isAfter(time);

  let niftyOptionCE = null;
  let niftyOptionPE = null;

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
      });
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
    if (isCurrentTimeBefore(entryTime) || isCurrentTimeAfter(exitTime)) return;

    const price = niftyIndex.get("close");
    if (!price) return;

    const atmStrikePrice = Math.round(price / 100) * 100;

    selectATMOptions(atmStrikePrice);
    if (!niftyOptionCE.get("close") || !niftyOptionPE.get("close")) return;

    this.enterPosition({
      ...preparePosition(),
      name: `OPTION SELL STRADDLE`,
      direction: NEUTRAL_POSITION,
      description: `SELL ${niftyOptionCE.scrip} | SELL ${niftyOptionPE.scrip}`,
      orders: [
        prepareOrder(niftyOptionPE, "SELL", noOfLots * LOT_SIZE),
        prepareOrder(niftyOptionCE, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  this.checkExit = () => {
    const { pnl, target, stoploss } = this.position;

    if (pnl <= stoploss || pnl >= target || isCurrentTimeAfter(exitTime)) {
      this.exitPosition({
        ...this.position,
        exitPrice: niftyIndex.get("close"),
      });

      niftyOptionCE.destroy();
      niftyOptionPE.destroy();
      niftyOptionCE = null;
      niftyOptionPE = null;

      entryTime = todayTimeIst().add(TRADE_INTERVAL_IN_MINUTES, "minutes");
      // entryTime = todayTimeIst({ hour: 15, minute: 15 });

      return;
    }
  };

  this.updatePnL = () => {
    const cePrice = niftyOptionCE.get("close");
    const pePrice = niftyOptionPE.get("close");

    const pnl =
      (this.position.ceEntry - cePrice) +
      (this.position.peEntry - pePrice);

    this.position.pnl = pointsToAmount(pnl);
  };

  const preparePosition = () => {
    const cePrice = niftyOptionCE.get("close");
    const pePrice = niftyOptionPE.get("close");

    return {
      ceEntry: cePrice,
      peEntry: pePrice,
      strikePrice: niftyOptionCE?.strikePrice || niftyOptionPE?.strikePrice,
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

module.exports = OptionSellStraddle;

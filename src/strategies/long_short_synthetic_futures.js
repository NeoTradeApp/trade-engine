const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyFuturesWatchService: niftyFutures, NiftyOptionsWatchService } = require("@services");
const { isCurrenTimeAfter } = require("@utils");
const BaseStrategy = require("./base_strategy");

function LongShortSyntheticFutures(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES;

  const LONG_POSITION = "LONG";
  const SHORT_POSITION = "SHORT";
  const LOT_SIZE = 65;
  const noOfLots = 1;

  const EMA_DISTANCE_THRESHOLD = 300;
  let niftyOptionCE = niftyOptionPE = null;

  (async () => {
    const position = await redisService.get(REDIS.KEY.POSITIONS(this.strategyId, this.userId));
    if (position) {
      this.position = position;
      selectATMOptions(this.position.strikePrice);
    }
  })();

  const selectATMOptions = (strikePrice) => {
    if (!strikePrice) return;

    if (!niftyOptionCE) {
      niftyOptionCE = new NiftyOptionsWatchService(strikePrice, "CE");
    }

    if (!niftyOptionPE) {
      niftyOptionPE = new NiftyOptionsWatchService(strikePrice, "PE");
    }
  };

  this.checkEntry = () => {
    // TODO: REMOVE
    // if (!isCurrenTimeAfter({ hour: 9, minute: 45 })) return;

    const price = niftyFutures.get("close");
    if (!price) return;

    const atmStrikePrice = Math.round(price / 100) * 100;
    selectATMOptions(atmStrikePrice);
    const cePrice = niftyOptionCE.get("close");
    const pePrice = niftyOptionPE.get("close");

    if (!cePrice || !pePrice) return;

    const { ema, trend } = niftyFutures.get("indicators") || {};
    const distance = Math.abs(price - ema);

    if (distance > EMA_DISTANCE_THRESHOLD) return;

    // Long Synthetic
    if (trend === STRATEGY.TREND.UPTREND) {
      enterLong(price, cePrice, pePrice);
    }

    // Short Synthetic
    if (trend === STRATEGY.TREND.DOWNTREND) {
      enterShort(price, cePrice, pePrice);
    }
  };

  this.checkExit = () => {
    if (isCurrenTimeAfter({ hour: 15, minute: 25 })) {
      // square off
    }
  };

  this.updatePnL = () => {
    const cePrice = niftyOptionCE.get("close");
    const pePrice = niftyOptionPE.get("close");

    let pnl = 0;

    if (this.position.type === "LONG") {
      pnl =
        (cePrice - this.position.ceEntry) -
        (pePrice - this.position.peEntry);
    } else {
      pnl =
        -(cePrice - this.position.ceEntry) +
        (pePrice - this.position.peEntry);
    }

    this.position.pnl = pnl;
  };

  const enterLong = (price, cePrice, pePrice) => {
    // BUY CE + SELL PE
    this.enterPosition({
      ...preparePosition(),
      direction: LONG_POSITION,
      name: `Nifty Synth FUT (${LONG_POSITION})`,
      description: `Buy ${niftyOptionCE.scrip} | Sell ${niftyOptionPE.scrip}`,
      orders: [
        prepareOrder(niftyOptionCE, "BUY", noOfLots * LOT_SIZE),
        prepareOrder(niftyOptionPE, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  const enterShort = (price, cePrice, pePrice) => {
    // SELL CE + BUY PE
    this.enterPosition({
      ...preparePosition(),
      direction: SHORT_POSITION,
      name: `Nifty Synth FUT (${SHORT_POSITION})`,
      description: `BUY ${niftyOptionPE.scrip} | SELL ${niftyOptionCE.scrip}`,
      orders: [
        prepareOrder(niftyOptionPE, "BUY", noOfLots * LOT_SIZE),
        prepareOrder(niftyOptionCE, "SELL", noOfLots * LOT_SIZE),
      ],
    });
  };

  const preparePosition = () => {
    const price = niftyFutures.get("close");
    const cePrice = niftyOptionCE.get("close");
    const pePrice = niftyOptionPE.get("close");

    return {
      ceEntry: cePrice,
      peEntry: pePrice,
      strikePrice: niftyOptionCE?.strikePrice || niftyOptionPE?.strikePrice,
      entryPrice: price,

      target: 120,
      stoploss: -30,
      trailing_stoploss: 60,
      trail_stoploss_at: 30,
    };
  };

  const prepareOrder = (niftyOption, direction, quantity) => ({
    candleData: niftyOption,
    userId: this.userId,
    orderId: "paper test",

    name: `${niftyOption.strikePrice} ${niftyOption.optionType}`,
    symbol: niftyOption.scrip,

    type: niftyOption.optionType,
    scrip: niftyOption.scrip,
    tnxType: direction,
    price: niftyOption.get("close"),
    brokerage: 10,
    taxes: 6,

    quantity,
    filledQuantity: quantity,

    exchange: "nse",
    status: "FILLED",
    productType: "NRML",
    orderType: "MARKET",

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

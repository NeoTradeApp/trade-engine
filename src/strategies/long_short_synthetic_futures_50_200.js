const { appEvents } = require("@events")
const { REDIS, SERVICE_PROVIDERS, STRATEGY } = require("@constants")
const { redisService, niftyFuturesWatchService: niftyFutures, NiftyOptionsWatchService } = require("@services");
const { todayTimeIst, getDateOfNext } = require("@utils");
const BaseStrategy = require("./base_strategy");

const { NIFTY_WEEKLY_EXPIRY } = process.env;

function LongShortSyntheticFutures50200(strategyId, userId) {
  BaseStrategy.call(this, strategyId, userId);

  this.strategyName = STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES_50_200;

  const LONG_POSITION = "LONG";
  const SHORT_POSITION = "SHORT";
  const LOT_SIZE = 65;
  const noOfLots = 1;
  const TARGET = 200;
  const STOPLOSS = -50;
  const TRAILING_STOPLOSS = 75;
  const TRAIL_STOPLOSS_AT = 25;
  const TRADE_INTERVAL_IN_MINUTES = 11;
  const BROKERAGE = 10;
  const TAXES = 15;

  let niftyOptionCE = null;
  let niftyOptionPE = null;

  const pointsToAmount = (point) => point * noOfLots * LOT_SIZE;

  this.initializeProperties = () => {
    this.properties = {
      entryTime: todayTimeIst({ hour: 9, minute: 45 }),
      exitTime: todayTimeIst({ hour: 15, minute: 14 }),
      previousTradeDirection: "",
    };
  };

  this.onPropertiesLoad = (properties) => {
    const position = properties.position;

    if (position) {
      selectATMOptions(position.strikePrice);

      position.orders.forEach((order) => {
        const niftyOption = [niftyOptionCE, niftyOptionPE].find((niftyOption) =>
          niftyOption && order.scrip === niftyOption.scrip
        );
        if (niftyOption) {
          order.currentData = niftyOption;
        }
      })
    }
  };

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
    const price = niftyFutures.get("close");
    if (!price) return;

    const atmStrikePrice = Math.round(price / 100) * 100;
    selectATMOptions(atmStrikePrice);

    if (!niftyOptionCE.get("close") || !niftyOptionPE.get("close")) return;

    const { ema, trend } = niftyFutures.get("indicators") || {};

    // Reverse the position direction based on previous trade else follow the trend.
    if (this.properties.previousTradeDirection === LONG_POSITION) {
      enterShort();
    } else if (this.properties.previousTradeDirection === SHORT_POSITION) {
      enterLong();
    } else if (trend === STRATEGY.TREND.UPTREND) {
      enterLong();
    } else if (trend === STRATEGY.TREND.DOWNTREND) {
      enterShort();
    }
  };

  this.checkExit = () => {
    const { exitTime } = this.properties;
    const { pnl, target, stoploss, trailStoplossAt, trailingStoploss } = this.position;

    if (pnl <= stoploss || pnl >= target || todayTimeIst().isAfter(exitTime)) {
      const previousTradeDirection = this.position.direction;

      this.exitPosition({
        ...this.position,
        exitPrice: niftyFutures.get("close"),
      });

      niftyOptionCE.destroy();
      niftyOptionPE.destroy();
      niftyOptionCE = null;
      niftyOptionPE = null;

      this.updateProperties({
        previousTradeDirection,
        entryTime: todayTimeIst().add(TRADE_INTERVAL_IN_MINUTES, "minutes"),
      });

      return;
    }

    if (pnl >= trailStoplossAt) {
      Object.assign(this.position, {
        stoploss: trailStoplossAt - trailingStoploss,
        trailStoplossAt: trailStoplossAt + pointsToAmount(TRAIL_STOPLOSS_AT),
      });

      this.updateProperties({ position: this.position  });
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
        this.prepareOrder(niftyOptionCE, "BUY", noOfLots * LOT_SIZE),
        this.prepareOrder(niftyOptionPE, "SELL", noOfLots * LOT_SIZE),
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
        this.prepareOrder(niftyOptionPE, "BUY", noOfLots * LOT_SIZE),
        this.prepareOrder(niftyOptionCE, "SELL", noOfLots * LOT_SIZE),
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

  const baseStop = this.stop;
  this.stop = () => {
    baseStop();
    // niftyFutures.destroy();
    niftyOptionCE.destroy();
    niftyOptionPE.destroy();
  };
}

module.exports = LongShortSyntheticFutures50200;

const dummyData = require("../../dummy-data3.json");
const { appEvents } = require("@events");
const { EVENT, SCRIPS } = require("@constants")

const { NIFTY_INDEX, NIFTY_FUTURE, NIFTY_OPTION_CHAIN } = SCRIPS.SCRIP_TYPE;

function MarketSimulator() {
  let timer = null;

  const variance = (value, variance = 1) =>
    (parseFloat(value) + (Math.random() * variance * (Math.random() > 0.5 ? 1 : -1))).toFixed(2);

  const fluctuate = (candle) => {
    candle.currentPrice = variance(candle.currentPrice);
    candle.changePercentage = variance(candle.changePercentage);
    candle.change = variance(candle.change);

    return candle;
  };

  const sendMarketData = () => {
    const niftyIndex = dummyData[NIFTY_INDEX];
    const niftyFutures = dummyData[NIFTY_FUTURE];
    const niftyOptionChain = dummyData[NIFTY_OPTION_CHAIN];

    fluctuate(niftyFutures);
    fluctuate(niftyIndex);
    Object.keys(niftyOptionChain).forEach((strike) => {
      fluctuate(niftyOptionChain[strike].CE);
      fluctuate(niftyOptionChain[strike].PE);
    });

    appEvents.emit(EVENT.HS_WEB_SOCKET.MARKET_FEED, {
      [NIFTY_INDEX]: niftyIndex,
      [NIFTY_FUTURE]: niftyFutures,
      [NIFTY_OPTION_CHAIN]: niftyOptionChain,
    });
  };

  this.start = () => {
    timer = setInterval(sendMarketData, 1000);
  };

  this.stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const marketSimulator = new MarketSimulator();
marketSimulator.start();

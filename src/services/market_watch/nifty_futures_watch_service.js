const { SCRIPS } = require("@constants")
const { ExponentialMovingAverage } = require("./indicators");
const BaseMarketWatchService = require("./base_market_watch_service");

function NiftyFuturesWatchService(scrip, intervalInMinutes, bufferSize) {
  BaseMarketWatchService.call(this, scrip, intervalInMinutes, bufferSize);

  this.storeCandlesToDatabase = true;

  const emaIndicator = new ExponentialMovingAverage(this.bufferSize, this.bufferSize);

  this.currentCandleClosed = (currendCandle) => {
    this.currentCandle.indicators.ema = emaIndicator.push(currendCandle.currentPrice);
  };

  this.fetchMarketData = (marketData) => marketData[this.scrip];

  this.calculateIndicators = (currentCandle) => ({
    ema: emaIndicator.calculate(currentCandle.currentPrice),
  });
}

const NIFTY_FUTURE_BUFFER_SIZE = 10;
const NIFTY_FUTURE_TIME_INTERVAL_IN_MINUTES = 1;

module.exports = {
  niftyFuturesWatchService: new NiftyFuturesWatchService(
    SCRIPS.SCRIP_TYPE.NIFTY_FUTURE,
    NIFTY_FUTURE_TIME_INTERVAL_IN_MINUTES,
    NIFTY_FUTURE_BUFFER_SIZE
  ),
};

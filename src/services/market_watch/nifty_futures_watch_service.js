const { isMarketOpen, getMonthEndDateOf } = require("@utils");
const { SCRIPS } = require("@constants");
const { ExponentialMovingAverage } = require("./indicators");
const BaseMarketWatchService = require("./base_market_watch_service");

const { NIFTY_MONTHLY_EXPIRY } = process.env;

function NiftyFuturesWatchService(expiry, intervalInMinutes, bufferSize) {
  BaseMarketWatchService.call(this, SCRIPS.SCRIP_TYPE.NIFTY_FUTURE, intervalInMinutes, bufferSize);

  this.publishCandlesToRedis = isMarketOpen();

  const emaIndicator = new ExponentialMovingAverage(this.bufferSize, this.bufferSize);
  this.onHistoryLoad = () => {
    emaIndicator.loadHistory(this.candlesData.map((_) => _?.indicators?.ema || _?.close));
  };

  this.currentCandleClosed = (currendCandle) => {
    this.currentCandle.indicators.ema = emaIndicator.push(currendCandle.close);
    this.currentCandle.indicators.trend = emaIndicator.getTrend();
  };

  this.fetchMarketData = (marketData) => marketData[this.scrip];

  this.calculateIndicators = (currentCandle) => ({
    ema: emaIndicator.calculate(currentCandle.close),
    trend: emaIndicator.getTrend(),
  });

  this.start();
}

const niftyMonthlyExpiry = getMonthEndDateOf(NIFTY_MONTHLY_EXPIRY || "Tuesday");
const niftyFuturesWatchService = new NiftyFuturesWatchService(niftyMonthlyExpiry, 1, 50);

module.exports = { niftyFuturesWatchService };

const { STRATEGY } = require("@constants");
const EMA_TREND_MIN_SLOPE = 0.02;
const EMA_TREND_CONSISTENCY_RATIO = 0.8;

function ExponentialMovingAverage(period, trendCandleCount) {
  this.emaArray = [];
  this.period = period || 9;
  this.trendCandleCount = trendCandleCount || 9;

  this.loadHistory = (data) => {
    this.emaArray = data || [];
  };

  const periodicPush = (ema) => {
    this.emaArray.push(ema);

    if (this.emaArray.length > Math.max(this.period, this.trendCandleCount)) {
      // this.emaArray.shift();
      this.emaArray.splice(0, 1);
    }

    return this.emaArray;
  };

  this.calculate = (price) => {
    if (!this.emaArray.length) {
      return price;
    }

    const k = 2 / (this.period + 1);
    const emaPrevious = this.emaArray[this.emaArray.length - 1];
    const emaNow = price * k + emaPrevious * (1 - k);

    return emaNow;
  };

  this.push = (price) => {
    const ema = this.calculate(price);

    periodicPush(ema);

    return ema
  };

  this.getTrend = () => {
    if (!this.emaArray.length) return 0;

    const firstEmaIndex = this.emaArray.length - this.trendCandleCount;
    const firstEma = firstEmaIndex > 0 ? this.emaArray[firstEmaIndex] : this.emaArray[0];
    const latestEma = this.emaArray[this.emaArray.length - 1];

    return latestEma >= firstEma ? STRATEGY.TREND.UPTREND : STRATEGY.TREND.DOWNTREND;
  };

  const getTrendFromEma = () => {
    const minSlope = EMA_TREND_MIN_SLOPE;
    const consistencyRatio = EMA_TREND_CONSISTENCY_RATIO;

    if (!this.emaArray || this.emaArray.length < 3) return STRATEGY.TREND.SIDEWAYS;

    const n = this.emaArray.length;

    let upMoves = 0;
    let downMoves = 0;

    // 1. Count direction consistency
    for (let i = 1; i < n; i++) {
      if (this.emaArray[i] > this.emaArray[i - 1]) upMoves++;
      else if (this.emaArray[i] < this.emaArray[i - 1]) downMoves++;
    }

    const upRatio = upMoves / (n - 1);
    const downRatio = downMoves / (n - 1);

    // 2. Calculate slope (overall movement)
    const slope = (this.emaArray[n - 1] - this.emaArray[0]) / n;

    // 3. Normalize slope (percentage-based)
    const avg = this.emaArray.reduce((a, b) => a + b, 0) / n;
    const normalizedSlope = (slope / avg) * 100;

    // 4. Decision logic
    if (upRatio >= consistencyRatio) {
      return STRATEGY.TREND.UPTREND;
    }

    if (downRatio >= consistencyRatio) {
      return STRATEGY.TREND.DOWNTREND;
    }

    return STRATEGY.TREND.SIDEWAYS;
  };

  this.resetEMovingAverage = () => {
    this.emaArray.length = 0;
  };
}

module.exports = ExponentialMovingAverage;

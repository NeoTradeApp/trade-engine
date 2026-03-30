function ExponentialMovingAverage(period, trendCandleCount) {
  this.emaArray = [];
  this.period = period || 9;
  this.trendCandleCount = trendCandleCount || 9;

  const periodicPush = (ema) => {
    this.emaArray.push(ema);

    if (this.emaArray.length > Math.max(this.period, this.trendCandleCount)) {
      this.emaArray.shift();
    }

    return this.emaArray;
  };

  this.calculate = (price) =>{
    if (!this.emaArray.length) {
      return price;
    }

    const k = 2 / (this.period + 1);
    const emaYesterday = this.emaArray[this.emaArray.length - 1];
    const emaToday = price * k + emaYesterday * (1 - k);

    return emaToday;
  }

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

    return latestEma >= firstEma ? "uptrend" : "downtrend";
  }

  this.resetEMovingAverage = () => {
    this.emaArray.length = 0;
  }
}

module.exports = ExponentialMovingAverage;

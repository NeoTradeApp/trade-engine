const moment = require("moment");
const { redisService } = require("../redis");
const { appEvents } = require("@events");
const { EVENT, REDIS } = require("@constants");
const { debounce, isEmpty } = require("@utils");

function BaseMarketWatchService(scrip, intervalInMinutes, bufferSize) {
  this.candlesData = [];
  this.intervalInMinutes = intervalInMinutes || 1;
  this.bufferSize = bufferSize || 10;
  this.scrip = scrip;

  this.currentCandle = {};
  let removeMarketFeedEvent;
  let currentBucket = null;

  let candlesBufferToPublish = [];

  this.publishCandlesToRedis = false;

  this.onHistoryLoad = () => { };
  this.loadHistory = async () => {
    this.candlesData = await redisService.get(REDIS.KEY.MARKET_WATCH.SCRIP(this.scrip)) || [];
    this.onHistoryLoad();
  };

  this.get = (param) => this.currentCandle?.[param];

  const bufferCandlesAndPublish = async (candle) => {
    candle && candlesBufferToPublish.push(candle);

    // if (candlesBufferToPublish.length < this.bufferSize) return;
    if (candlesBufferToPublish.length < 1) return;

    await redisService.publish(REDIS.CHANNEL.STORE_MARKET_FEED(this.scrip), candlesBufferToPublish);

    // Clear buffer after publish
    candlesBufferToPublish = [];
  };

  const periodicPushCandlesData = (candle) => {
    this.candlesData.push(candle);

    if (this.candlesData.length > this.bufferSize) {
      // this.candlesData.shift();
      this.candlesData.splice(0, 1);
    }

    redisService.set(REDIS.KEY.MARKET_WATCH.SCRIP(this.scrip), this.candlesData, "12h");
    this.publishCandlesToRedis && bufferCandlesAndPublish(candle);

    return this.candlesData;
  };

  const getTimeBucket = (intervalInMinutes) => {
    const now = moment();
    const minutes = Math.floor(now.minutes() / intervalInMinutes) * intervalInMinutes;

    return now.minutes(minutes).seconds(0).milliseconds(0).valueOf();
  };

  const updateCurrentCandle = (marketData) => {
    const { currentPrice: priceInStr, volume, expiry, openInterest } = marketData || {};
    if (!priceInStr) return;

    const currentPrice = parseFloat(priceInStr);
    if (Number.isNaN(currentPrice)) return;

    const bucket = getTimeBucket(this.intervalInMinutes);

    if (bucket !== currentBucket) {
      if (currentBucket) {
        this.currentCandleClosed(this.currentCandle);
        periodicPushCandlesData(this.currentCandle);
      }

      currentBucket = bucket;
      this.currentCandle = {
        time: bucket,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: parseInt(volume) || 0,
        openInterest,
        expiry,
      };
    } else {
      Object.assign(this.currentCandle, {
        high: Math.max(this.currentCandle.high, currentPrice),
        low: Math.min(this.currentCandle.low, currentPrice),
        close: currentPrice,
        volume: this.currentCandle.volume + (parseInt(volume) || 0),
        expiry,
      });
    }

    this.currentCandle.indicators ||= {};
    Object.assign(this.currentCandle.indicators, this.calculateIndicators(this.currentCandle));
    this.emitCurrentCandle(this.currentCandle);
  };

  this.previousCandles = (candlesCount = 1) =>
    this.candlesData.slice(this.candlesData.length - candlesCount);

  this.emitCurrentCandle = (currentCandleData) =>
    appEvents.emit(EVENT.MARKET_WATCH.SCRIP(this.scrip), currentCandleData);

  this.fetchMarketData = (marketData) => marketData[this.scrip];

  this.calculateIndicators = () => ({});
  this.currentCandleClosed = () => { };

  this.start = () => {
    if (removeMarketFeedEvent) return;

    const updateLastCandle = debounce((currentCandleData) => updateCurrentCandle({ ...currentCandleData, volume: 0 }), "1m");

    removeMarketFeedEvent = appEvents.onEvent(EVENT.HS_WEB_SOCKET.MARKET_FEED, (marketData) => {
      const scripData = this.fetchMarketData(marketData);
      if (isEmpty(scripData)) return;

      updateCurrentCandle(scripData);

      // debounce to update the last candle data (complete of incomplete) if market data is paused
      updateLastCandle(this.currentCandle);
    });
  };

  this.destroy = () => {
    redisService.delete(REDIS.KEY.MARKET_WATCH.SCRIP(this.scrip));

    if (removeMarketFeedEvent) {
      removeMarketFeedEvent();
      removeMarketFeedEvent = null;
    }
  };
}

module.exports = BaseMarketWatchService;

const moment = require("moment");
const { redisService } = require("../redis");
const { appEvents } = require("@events");
const { EVENT, REDIS } = require("@constants");
const { parseTimeToSeconds } = require("@utils");

function BaseMarketWatchService(scrip, intervalInMinutes, bufferSize) {
  this.candlesData = [];
  this.intervalInMinutes = intervalInMinutes || 1;
  this.bufferSize = bufferSize || 10;
  this.scrip = scrip;

  this.currentCandle = {};
  let removeMarketFeedEvent;
  let currentBucket = null;

  let candlesBufferToPublish = [];
  let candleUpdateTimer = null;

  this.storeCandlesToDatabase = false;

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
      this.candlesData.shift();
    }

    this.storeCandlesToDatabase && bufferCandlesAndPublish(candle);

    return this.candlesData;
  };

  const getTimeBucket = (intervalInMinutes) => {
    const now = moment();
    const minutes = Math.floor(now.minutes() / intervalInMinutes) * intervalInMinutes;

    return now.minutes(minutes).seconds(0).milliseconds(0).valueOf();
  };

  const updateCurrentCandle = (marketData) => {
    const { currentPrice, volume, expiry, openInterest } = marketData || {};
    if (!currentPrice) return;

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

  this.emitCurrentCandle = (currentCandleData) =>
    appEvents.emit(EVENT.MARKET_WATCH.SCRIP(this.scrip), currentCandleData);

  this.fetchMarketData = (marketData) => marketData[this.scrip];

  this.start = () => {
    if (removeMarketFeedEvent) return;

    removeMarketFeedEvent = appEvents.onEvent(EVENT.HS_WEB_SOCKET.MARKET_FEED, (marketData) => {
      updateCurrentCandle(this.fetchMarketData(marketData));

      // debounce to update the last candle data (complete of incomplete) if market data is paused
      candleUpdateTimer && clearTimeout(candleUpdateTimer);
      candleUpdateTimer = setTimeout(() => {
        updateCurrentCandle({ ...this.currentCandle, volume: 0 });
      }, parseTimeToSeconds("1m") * 1000); // 1 minute
    });
  };

  this.calculateIndicators = () => ({});

  this.stop = () => {
    if (!removeMarketFeedEvent) return;

    removeMarketFeedEvent();
    removeMarketFeedEvent = null;
  };
}

module.exports = BaseMarketWatchService;

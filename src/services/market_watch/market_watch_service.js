const moment = require("moment");
const { redisService } = require("@services");
const { appEvents } = require("@events")
const { EVENT, SCRIPS, REDIS } = require("@constants")

function MarketWatchService(scrip, intervalInMinutes, bufferSize) {
  this.candlesData = [];
  this.intervalInMinutes = intervalInMinutes || 1;
  this.bufferSize = bufferSize || 10;
  this.scrip = scrip;

  let removeMarketFeedEvent;
  let currentCandle = {};
  let currentBucket = null;

  let candlesBufferToPublish = [];

  const bufferCandlesAndPublish = async (candle) => {
    candlesBufferToPublish.push(candle);

    // if (candlesBufferToPublish.length < this.bufferSize) return;
    if (candlesBufferToPublish.length < 1) return;

    await redisService.publish(REDIS.CHANNEL.STORE_MARKET_FEED(scrip), candlesBufferToPublish);

    // Clear buffer after publish
    candlesBufferToPublish = [];
  };

  const periodicPushCandlesData = (candle) => {
    this.candlesData.push(candle);

    if (this.candlesData.length > this.bufferSize) {
      this.candlesData.shift();
    }

    bufferCandlesAndPublish(candle);

    return this.candlesData;
  };

  const getTimeBucket = (intervalInMinutes) => {
    const now = moment();
    const minutes = Math.floor(now.minutes() / intervalInMinutes) * intervalInMinutes;

    return now.minutes(minutes).seconds(0).milliseconds(0).valueOf();
  };

  this.start = () => {
    if (removeMarketFeedEvent) return;

    removeMarketFeedEvent = appEvents.onEvent(EVENT.HS_WEB_SOCKET.MARKET_FEED, (marketData) => {
      const { currentPrice: price, volume = 0, expiry } = marketData[this.scrip] || {};
      if (!price) return;

      const bucket = getTimeBucket(this.intervalInMinutes);

      if (bucket !== currentBucket) {
        currentCandle && periodicPushCandlesData(currentCandle);

        currentBucket = bucket;
        currentCandle = {
          time: bucket,
          open: price,
          high: price,
          low: price,
          close: price,
          volume,
          expiry,
        };
      } else {
        Object.assign(currentCandle, {
          high: Math.max(currentCandle.high, price),
          low: Math.min(currentCandle.low, price),
          close: price,
          volume: currentCandle.volume + volume,
          expiry,
        });
      }

      appEvents.emit(EVENT.MARKET_WATCH.SCRIP(this.scrip), currentCandle);
    });
  };

  this.stop = () => {
    if (!removeMarketFeedEvent) return;

    removeMarketFeedEvent();
    removeMarketFeedEvent = null;
  };
}

const NIFTY_FUTURE_BUFFER_SIZE = 10;

module.exports = { marketWatchService: new MarketWatchService(SCRIPS.SCRIP_TYPE.NIFTY_FUTURE, 1, NIFTY_FUTURE_BUFFER_SIZE) };

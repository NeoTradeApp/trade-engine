const { logger } = require("winston");
const { appEvents } = require("@events");
const { EVENT, REDIS } = require("@constants");

const keyExpiryEventListeners = {
  [REDIS.KOTAK_NEO.ACCESS_TOKEN]: (key) =>
    appEvents.emit(EVENT.KOTAK_NEO.ACCESS_TOKEN_EXPIRED, key),

  default: (key) => logger.warning("Redis: Unhandled key expiry event", key),
};

const keyExpiryListeners = (key) => {
  const match = Object.keys(keyExpiryEventListeners).find((_) => key.match(_));
  const listener = keyExpiryEventListeners[match || "default"];
  return listener && listener(key);
};

const marketFeedListeners = (data) =>
  appEvents.emit(EVENT.REDIS.MARKET_FEED, JSON.parse(data));

module.exports = {
  redisChannelListeners: {
    [REDIS.CHANNEL.KEY_EXPIRY]: keyExpiryListeners,
    [REDIS.CHANNEL.MARKET_FEED]: marketFeedListeners,

    default: (data, channel) =>
      logger.warning("Redis: Unhandled channel", channel),
  },
};

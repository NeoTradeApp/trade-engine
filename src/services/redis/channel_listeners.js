const { logger } = require("winston");
const { appEvents } = require("@events");
const { EVENT, REDIS } = require("@constants");

const keyExpiryListenerMappings = {
  // [REDIS.KEY.KOTAK_NEO.ACCESS_TOKEN]: (key) =>
  //   appEvents.emit(EVENT.KOTAK_NEO.ACCESS_TOKEN.EXPIRED, key),

  default: (key) => logger.warning("Redis: Unhandled key expiry event", key),
};

const keySetListenerMappings = {
  [REDIS.KEY.HS_WEB_SOCKET.CREDENTIALS]: () =>
    appEvents.emit(EVENT.HS_WEB_SOCKET.CREDENTIALS_UPDATED),
};

const unhandledKeyExpiryWarning = (key) => logger.warning("Redis: Unhandled key expiry event", key);
// const unhandledKeySetWarning = (key) => logger.warning("Redis: Unhandled key set event", key);
const unhandledKeySetWarning = () => {};

const keyListener = (listenerMappings, unhandledWarning) => (key) => {
  Object.entries(listenerMappings).forEach(([regex, handler]) => {
    const [firstMatch] = Array.from(key.matchAll(new RegExp(regex, "g")));
    if (!firstMatch) return unhandledWarning(key);

    const [patternIsMatching, ...keys] = firstMatch;
    if (patternIsMatching) {
      handler && handler(keys);
    } else {
      unhandledWarning(key);
    }
  });
};

module.exports = {
  redisChannelListeners: {
    [REDIS.CHANNEL.KEY_EXPIRY]: keyListener(keyExpiryListenerMappings, unhandledKeyExpiryWarning),
    [REDIS.CHANNEL.KEY_SET]: keyListener(keySetListenerMappings, unhandledKeySetWarning),
  },
};

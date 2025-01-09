const { logger } = require("winston");
const { appEvents } = require("@events");
const { EVENT, REDIS } = require("@constants");

const keyExpiryListenerMappings = {
  [REDIS.KEY.KOTAK_NEO.ACCESS_TOKEN]: (key) =>
    appEvents.emit(EVENT.KOTAK_NEO.ACCESS_TOKEN.EXPIRED, key),

  default: (key) => logger.warning("Redis: Unhandled key expiry event", key),
};

const keyExpiryListener = (key) => {
  const match = Object.keys(keyExpiryListenerMappings).find((_) =>
    key.match(_)
  );
  const listener = keyExpiryListenerMappings[match || "default"];
  return listener && listener(key);
};

const keySetListener = (key) => {
  if (key === REDIS.KEY.HS_WEB_SOCKET.CREDENTIALS) {
    appEvents.emit(EVENT.HS_WEB_SOCKET.CREDENTIALS_UPDATED);
  }
};

module.exports = {
  redisChannelListeners: {
    [REDIS.CHANNEL.KEY_EXPIRY]: keyExpiryListener,
    [REDIS.CHANNEL.KEY_SET]: keySetListener,
  },
};

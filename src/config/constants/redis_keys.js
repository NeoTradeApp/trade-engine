const KEY = {
  KOTAK_NEO: {
    MASTER_SCRIP: (exchange) => `REDIS/KEY/KOTAK_NEO/MASTER_SCRIP/${exchange}`,
    TRADE_BASE_URL: "REDIS/KEY/KOTAK_NEO/TRADE_BASE_URL",
  },
  HS_WEB_SOCKET: {
    CREDENTIALS: "REDIS/KEY/HS_WEB_SOCKET/CREDENTIALS",
  },
  MARKET_WATCH: {
    SCRIP: (scrip) => `REDIS/KEY/MARKET_WATCH/${scrip}`,
  },
  POSITIONS: (strategyId, userId) => `REDIS/KEY/POSITIONS/${strategyId}/${userId}`,
  USER_INFO: (userId) => `REDIS/KEY/USER_INFO/${userId}`,
};

const databaseIndex = 0;
const CHANNEL = {
  KEY_EXPIRY: `__keyevent@${databaseIndex}__:expired`,
  KEY_SET: `__keyevent@${databaseIndex}__:set`,
  MARKET_FEED: "REDIS/CHANNEL/MARKET_FEED",
  STORE_MARKET_FEED: (SCRIP) => `REDIS/CHANNEL/STORE_MARKET_FEED/${SCRIP}`,
  POSITION_UPDATE: (serverId) => `REDIS/CHANNEL/POSITION_UPDATE/${serverId}`,
};

module.exports = {
  REDIS: {
    KEY,
    CHANNEL,
  },
};

const KEY = {
  KOTAK_NEO: {
    MASTER_SCRIP: (exchange) => `REDIS/KEY/KOTAK_NEO/MASTER_SCRIP/${exchange}`,
  },
  HS_WEB_SOCKET: {
    CREDENTIALS: "REDIS/KEY/HS_WEB_SOCKET/CREDENTIALS",
  },
};

const databaseIndex = 0;
const CHANNEL = {
  KEY_EXPIRY: `__keyevent@${databaseIndex}__:expired`,
  KEY_SET: `__keyevent@${databaseIndex}__:set`,
  MARKET_FEED: "REDIS/CHANNEL/MARKET_FEED",
  STORE_MARKET_FEED: (SCRIP) => `REDIS/CHANNEL/STORE_MARKET_FEED/${SCRIP}`,
};

module.exports = {
  REDIS: {
    KEY,
    CHANNEL,
  },
};

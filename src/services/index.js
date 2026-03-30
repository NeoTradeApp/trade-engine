const KotakNeo = require("./kotak_neo");

const { redisService } = require("./redis");
const MarketWatchServices= require("./market_watch");

module.exports = {
  redisService,
  KotakNeo,
  ...MarketWatchServices,
};

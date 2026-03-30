const eventKeys = require("./event_keys");
const redisKeys = require("./redis_keys");
const scrips = require("./scrips");
const strategy_keys = require("./strategy_keys");

module.exports = {
  ...eventKeys,
  ...redisKeys,
  ...scrips,
  ...strategy_keys,
};

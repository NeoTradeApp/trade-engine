const eventKeys = require("./event_keys");
const redisKeys = require("./redis_keys");
const scrips = require("./scrips");
const strategyKeys = require("./strategy_keys");
const serviceProviders = require("./service_providers");

module.exports = {
  ...eventKeys,
  ...redisKeys,
  ...scrips,
  ...strategyKeys,
  ...serviceProviders,
};

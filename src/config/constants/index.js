const eventKeys = require("./event_keys");
const redisKeys = require("./redis_keys");
const scrips = require("./scrips");

module.exports = {
  ...eventKeys,
  ...redisKeys,
  ...scrips,
};

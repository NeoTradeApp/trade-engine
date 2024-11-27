const eventKeys = require("./event_keys");
const redisKeys = require("./redis_keys");
const scrips = require("./scrips");
const socketMessageKeys = require("./socket_message_keys");

module.exports = {
  ...eventKeys,
  ...redisKeys,
  ...scrips,
  ...socketMessageKeys,
};

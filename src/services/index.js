const { kotakNeoService } = require("./kotak_neo");
const { redisService } = require("./redis");
const { hsWebSocketService } = require("./hs_web_socket_service");
const HSIWebSocketService = require("./hs_web_socket_service");

module.exports = {
  kotakNeoService,
  redisService,
  hsWebSocketService,
  HSIWebSocketService,
};

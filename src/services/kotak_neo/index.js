const { kotakNeoService } = require("./kotak_neo_service");
const { webSocketService } = require("./web_socket_service");
// const { hsWebSocketService } = require("./hs_web_socket_service");
const { marketDataParser } = require("./market_data_parser");
const HSIWebSocketService = require("./hsi_web_socket_service");

module.exports = {
  kotakNeoService,
  // hsWebSocketService,
  webSocketService,
  marketDataParser,
  HSIWebSocketService,
};

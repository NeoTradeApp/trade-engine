const { kotakNeoService } = require("./kotak_neo_service");
const { kotakNeoOrdersService } = require("./kotak_neo_orders_service");
// const { orderStreamingService } = require("./order_streaming_service");
const { webSocketService } = require("./web_socket_service");
// const { hsWebSocketService } = require("./hs_web_socket_service");
const { marketDataParser } = require("./market_data_parser");
const HSIWebSocketService = require("./hsi_web_socket_service");

module.exports = {
  kotakNeoService,
  kotakNeoOrdersService,
  // orderStreamingService,
  // hsWebSocketService,
  webSocketService,
  marketDataParser,
  HSIWebSocketService,
};

const { KotakNeo } = require("@services");

const { SERVICE_PROVIDERS } = require("@constants")

const ORDER_SERVICES = {
  [SERVICE_PROVIDERS.KOTAKNEO]: KotakNeo.kotakNeoOrdersService,
};

function PaperTradingOrderService() {
  this.placeMarketOrder = (userId, order) => ({
    filledQuantity: order.quantity,
    orderId: "paper trade",
    serviceProviderUserId: userId,
    serviceProviderName: "paper trade",
  });

  this.trackOrderExecution = () => { };
}

const paperTradingOrderService = new PaperTradingOrderService();

const getProviderOrderService = (provider) => {
  const normalizeString = (str) => String(str || "").toLowerCase().replace(/[^a-z]/g, "");

  return ORDER_SERVICES[normalizeString(provider)] || paperTradingOrderService;
};

module.exports = {
  getProviderOrderService,
}

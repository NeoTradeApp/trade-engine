const { logger } = require("winston");
const { REDIS, EVENT, SERVICE_PROVIDERS } = require("@constants");
const { delay } = require("@utils");
const { redisService } = require("../redis");
const BaseService = require("../base_service");

const toKotakOrderType = (orderType = "MARKET") => ({
  MARKET: "MKT",
  LIMIT: "L",
  "SL-LMT": "SL",
  "SL-MKT": "SL-M",
}[orderType] || orderType);

const toKotakExchange = (order = {}) => {
  const exchange = String(order.exchangeSegment || order.exchange || "").toLowerCase();
  if (["nse_cm", "bse_cm", "nse_fo", "bse_fo", "cde_fo", "mcx_fo"].includes(exchange)) {
    return exchange;
  }

  return ["CE", "PE", "FUT"].includes(order.type) ? "nse_fo" : "nse_cm";
};

function KotakNeoOrdersService() {
  BaseService.call(this);

  this.getTradingSession = async (userId) => {
    const credentials = await redisService.get(REDIS.KEY.USER_INFO(userId));
    const baseUrl = credentials?.tradeApiBaseUrl;
    const token = credentials?.sessionToken;

    if (!baseUrl || !token || !credentials?.sid) {
      throw new Error("Kotak Neo trading session is missing or expired");
    }

    return { baseUrl, token, sid: credentials.sid };
  };

  this.callUserApi = async (method, path, data, session) => {
    const response = await this.callApi(
      method,
      path,
      data ? (new URLSearchParams({ jData: JSON.stringify(data) }).toString()) : {},
      {
        baseUrl: session.baseUrl,
        headers: {
          accept: "application/json",
          Auth: session.token,
          Sid: session.sid,
          "neo-fin-key": "neotradeapi",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.stat !== "Ok") {
      throw new Error(response.emsg);
    }

    return response;
  };

  this.getOrder = async (orderId, session) => {
    const response = await this.callUserApi(
      "GET",
      `/quick/user/orders/${orderId}`,
      {},
      session,
    );

    return response.data?.[0];
  };

  this.placeMarketOrder = async (userId, order) => {
    const session = await this.getTradingSession(userId);
    const tradingSymbol = order.tradingSymbol || order.symbol;

    if (!tradingSymbol) {
      throw new Error("Kotak Neo order requires a broker trading symbol");
    }

    const payload = {
      am: "NO",
      dq: "0",
      es: toKotakExchange(order),
      mp: "0",
      pc: order.productType || "NRML",
      pf: "N",
      pr: "0",
      pt: toKotakOrderType(order.orderType),
      qt: String(order.quantity),
      rt: order.validity || "DAY",
      tp: "0",
      ts: tradingSymbol,
      tt: String(order.tnxType).toUpperCase() === "BUY" ? "B" : "S",
    };

    const data = await this.callUserApi(
      "POST",
      "/quick/order/rule/ms/place",
      new URLSearchParams({ jData: JSON.stringify(payload) }).toString(),
      session,
    );

    if (!data.nOrdNo) {
      throw new Error("Kotak Neo rejected the order");
    }

    await delay(2000);

    const brokerOrder = await this.getOrder(data.nOrdNo);
    const brokerOrderStatus = String(brokerOrder?.stat || "").toUpperCase();
    const isOrderClosed = ["COMPLETE", "REJECTED", "CANCELLED"].includes(brokerOrderStatus);

    return {
      orderId: data.nOrdNo,
      exchange: payload.es,
      tradingSymbol,
      price: brokerOrder?.avgPrc || order.price,
      status: isOrderClosed ? brokerOrderStatus : "OPEN",
      filledQuantity: brokerOrder?.fldQty || 0,
      serviceProviderUserId: userId,
      serviceProviderName: SERVICE_PROVIDERS.KOTAKNEO,
    };
  };
}

module.exports = { kotakNeoOrdersService: new KotakNeoOrdersService() };

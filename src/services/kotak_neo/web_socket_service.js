const WebSocket = require("ws");
const { logger } = require("winston");
const { appEvents } = require("@events");
const { EVENT, REDIS } = require("@constants");
const { isEmpty, isMarketOpen } = require("@utils");
const { redisService } = require("../redis");
const { marketDataParser } = require("./market_data_parser");

const { KOTAK_NEO_WEB_SOCKET_BASE_URL } = process.env;

const HEALTHCHECK_INTERVAL = 15_000;
const RECONNECT_DELAY = 2_000;
const MAX_SUBSCRIPTIONS = 3_000;
const HEADER_LENGTH = 9;

const EXCHANGE_NAMES = {
  0: "none",
  1: "nse_cm",
  2: "nse_fo",
  3: "cde_fo",
  4: "nse_com",
  5: "bse_cm",
  6: "bse_fo",
  7: "bse_cd",
  8: "bse_co",
  9: "mcx_fo",
  10: "ncd_co",
};

const EXCHANGE_IDS = Object.entries(EXCHANGE_NAMES).reduce(
  (ids, [id, name]) => ({ ...ids, [name]: Number(id) }),
  {},
);

const SUBSCRIPTION_EVENTS = {
  subscribeIndices: "unsubscribeIndices",
  subscribeScrips: "unsubscribeScrips",
  subscribeScripsLite: "unsubscribeScripsLite",
  subscribeDepth: "unsubscribeDepth",
};

const toWebSocketUrl = (feedUrl) => {
  const url = new URL(feedUrl || KOTAK_NEO_WEB_SOCKET_BASE_URL);

  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";

  return url.toString();
};

const decodeString = (buffer, start, end) =>
  buffer.toString("utf8", start, end).split("\0", 1)[0].trim();

const toNumber = (value) => Number(value);

function WebSocketService() {
  this.userWS = null;
  this.authenticated = false;
  this.healthCheckStatus = false;
  this.dividersByExchange = new Map();
  this.symbolsByInstrument = new Map();
  this.subscriptions = new Map();

  this.isOpen = () =>
    this.userWS && this.userWS.readyState === WebSocket.OPEN;

  this.send = (message) => {
    if (!this.isOpen()) return false;

    try {
      this.userWS.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error("WebSocketService: unable to send message", error);
      return false;
    }
  };

  this.connect = async () => {
    if (this.isOpen()) return this.userWS;

    try {
      const credentials = await this.getCredentials();
      this.authenticated = false;
      this.userWS = new WebSocket(KOTAK_NEO_WEB_SOCKET_BASE_URL);

      this.userWS.on("open", () => {
        this.healthCheckStatus = true;

        this.send({
          user: credentials.ucc,
          auth: credentials.sid,
          format: "native_batch",
          source: "NEOTRADEAPI",
          sdk_version: 1.1,
          // sdk_date: process.env.KOTAK_NEO_SDK_DATE || "2026-10-05",
        });
        logger.socket("Kotak Neo native WebSocket: connected");
      });

      this.userWS.on("close", () => {
        this.authenticated = false;
        this.healthCheckStatus = false;
        // this.stopHealthCheck();

        logger.socket("Kotak Neo native WebSocket: disconnected");
        appEvents.emit(EVENT.HS_WEB_SOCKET.CONNECTION_CLOSED);
        this.tryReconnect();
      });

      this.userWS.on("error", (error) => {
        logger.error("WebSocketService: socket error", error);
      });

      this.userWS.on("pong", () => {
        this.healthCheckStatus = true;
      });

      this.userWS.on("message", (data, isBinary) => {
        this.handleMessage(data, isBinary);
      });

      return this.userWS;
    } catch (error) {
      logger.error("WebSocketService: unable to connect", error);
      this.tryReconnect();
      return null;
    }
  };

  this.disconnect = () => {
    this.stopHealthCheck();
    this.clearReconnectTimer();
    this.close();
  };

  this.close = () => {
    if (!this.userWS) return;

    try {
      this.userWS.close();
    } catch (error) {
      logger.error("WebSocketService: unable to close socket", error);
    }
  };

  this.ping = () => {
    if (!this.isOpen()) return false;

    try {
      this.userWS.ping();
      return true;
    } catch (error) {
      logger.error("WebSocketService: unable to ping socket", error);
      return false;
    }
  };

  this.startHealthCheck = () => {
    this.stopHealthCheck();
    this.healthCheckTimer = setInterval(() => {
      if (!this.healthCheckStatus) {
        this.tryReconnect();
        return;
      }

      this.healthCheckStatus = false;
      this.ping();
    }, HEALTHCHECK_INTERVAL);
  };

  this.stopHealthCheck = () => {
    if (!this.healthCheckTimer) return;

    clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = null;
  };

  this.clearReconnectTimer = () => {
    if (!this.reconnectTimer) return;

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  };

  this.tryReconnect = () => {
    if (this.reconnectTimer || !isMarketOpen()) return;

    this.userWS?.terminate();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY);
  };

  this.subscribeIndex = (inputtoken) =>
    this.subscribe("subscribeIndices", inputtoken, { ack_symbol: true });

  this.subscribeScrips = (inputtoken) =>
    this.subscribe("subscribeScrips", inputtoken, { ack_symbol: true });

  this.subscribeScripsLite = (inputtoken) =>
    this.subscribe("subscribeScripsLite", inputtoken, { ack_symbol: true });

  this.subscribeDepth = (inputtoken) =>
    this.subscribe("subscribeDepth", inputtoken, { ack_symbol: true });

  this.unsubscribeIndex = (inputtoken) =>
    this.unsubscribe("subscribeIndices", inputtoken);

  this.unsubscribeScrips = (inputtoken) =>
    this.unsubscribe("subscribeScrips", inputtoken);

  this.unsubscribeScripsLite = (inputtoken) =>
    this.unsubscribe("subscribeScripsLite", inputtoken);

  this.unsubscribeDepth = (inputtoken) =>
    this.unsubscribe("subscribeDepth", inputtoken);

  this.snapshotIndex = (inputtoken) =>
    this.send({ event: "snapshotIndices", inputtoken: this.normalizeTokens(inputtoken) });

  this.snapshotScrips = (inputtoken) =>
    this.send({ event: "snapshotScrips", inputtoken: this.normalizeTokens(inputtoken) });

  this.snapshotScripsLite = (inputtoken) =>
    this.send({ event: "snapshotScripsLite", inputtoken: this.normalizeTokens(inputtoken) });

  this.snapshotDepth = (inputtoken) =>
    this.send({ event: "snapshotDepth", inputtoken: this.normalizeTokens(inputtoken) });

  this.normalizeTokens = (inputtoken) => {
    if (Array.isArray(inputtoken)) return inputtoken.join(",");
    return inputtoken || "";
  };

  this.subscriptionTokens = (inputtoken) =>
    this.normalizeTokens(inputtoken)
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

  this.subscribe = (event, inputtoken, options = {}) => {
    const tokens = this.subscriptionTokens(inputtoken);
    const newTokens = tokens.filter((token) => !this.subscriptions.has(`${event}|${token}`));
    const registeredTokens = new Set(
      Array.from(this.subscriptions.values(), (subscription) => subscription.inputtoken),
    );
    const newUniqueTokenCount = new Set(
      newTokens.filter((token) => !registeredTokens.has(token)),
    ).size;

    if (!newTokens.length) return true;
    if (registeredTokens.size + newUniqueTokenCount > MAX_SUBSCRIPTIONS) {
      logger.error(`WebSocketService: subscription limit of ${MAX_SUBSCRIPTIONS} reached`);
      return false;
    }

    newTokens.forEach((token) => {
      this.subscriptions.set(`${event}|${token}`, { event, inputtoken: token, options });
    });

    return !this.authenticated || this.sendSubscription(event, newTokens, options);
  };

  this.unsubscribe = (subscribeEvent, inputtoken) => {
    const unsubscribeEvent = SUBSCRIPTION_EVENTS[subscribeEvent];
    const tokens = this.subscriptionTokens(inputtoken);

    if (!unsubscribeEvent || !tokens.length) return false;

    tokens.forEach((token) => this.subscriptions.delete(`${subscribeEvent}|${token}`));
    return this.send({ event: unsubscribeEvent, inputtoken: tokens.join(",") });
  };

  this.sendSubscription = (event, tokens, options = {}) =>
    this.send({ event, inputtoken: tokens.join(","), ...options });

  this.restoreSubscriptions = () => {
    const grouped = new Map();

    for (const subscription of this.subscriptions.values()) {
      const key = `${subscription.event}|${JSON.stringify(subscription.options)}`;
      const group = grouped.get(key) || { ...subscription, tokens: [] };
      group.tokens.push(subscription.inputtoken);
      grouped.set(key, group);
    }

    for (const { event, tokens, options } of grouped.values()) {
      this.sendSubscription(event, tokens, options);
    }
  };

  this.handleMessage = (data, isBinary) => {
    const binary = isBinary === true || (isBinary === undefined && Buffer.isBuffer(data));

    if (binary) {
      const messages = this.decodeBinaryFrame(data);
      if (!messages.length) return;

      appEvents.emit(EVENT.HS_WEB_SOCKET.MESSAGE, messages);
      const parsedData = marketDataParser.parseMarketData(
        messages.map((message) => this.toLegacyMarketData(message)).filter(Boolean),
      );

      if (!isEmpty(parsedData)) {
        appEvents.emit(EVENT.HS_WEB_SOCKET.MARKET_FEED, parsedData);
      }
      return;
    }

    const rawMessage = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
    let message;

    try {
      message = JSON.parse(rawMessage);
    } catch (error) {
      logger.error("WebSocketService: received malformed control message", error);
      return;
    }

    this.handleControlMessage(message);
  };

  this.handleControlMessage = (message) => {
    const messageCode = message.message_code;

    if (messageCode === 1117 || messageCode === 1119) {
      if (messageCode === 1117) this.dividersByExchange.clear();
      this.storeDividers(message.exchanges);
      if (message.format === "native_fallback") {
        logger.error("WebSocketService: server selected unsupported native_fallback format");
        this.close();
        return;
      }
    }

    if (messageCode === 1120) {
      // Retrying an invalid session cannot succeed. Wait for Redis to publish refreshed
      // credentials, which invokes tryReconnect and explicitly re-enables reconnects.
      logger.error(`WebSocketService: authentication failed: ${message.message || "unknown error"}`);
      this.close();
      return;
    }

    if (messageCode === 1109) this.storeSymbols(message.data);

    appEvents.emit(EVENT.HS_WEB_SOCKET.MESSAGE, message);

    if (messageCode !== 1117 || this.authenticated) return;

    this.authenticated = true;
    this.restoreSubscriptions();
    appEvents.emit(EVENT.HS_WEB_SOCKET.CONNECTION_OPEN);
  };

  this.storeDividers = (exchanges = {}) => {
    Object.entries(exchanges).forEach(([exchange, details]) => {
      const exchangeId = EXCHANGE_IDS[exchange];
      const divider = Number(details && details.divider);

      if (exchangeId !== undefined && Number.isFinite(divider) && divider > 0) {
        this.dividersByExchange.set(exchangeId, divider);
      }
    });
  };

  this.storeSymbols = (symbols = {}) => {
    Object.entries(symbols).forEach(([instrument, details]) => {
      if (details && details.trading_symbols) {
        this.symbolsByInstrument.set(instrument, details.trading_symbols);
      }
    });
  };

  this.getDivider = (exchangeId) => this.dividersByExchange.get(exchangeId) || 100;

  this.decodeBinaryFrame = (data) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const messages = [];
    let offset = 0;

    while (offset + 2 <= buffer.length) {
      const length = buffer.readUInt16LE(offset);

      if (length < HEADER_LENGTH || offset + length > buffer.length) break;

      const message = this.decodePacket(buffer.subarray(offset, offset + length));
      if (message) messages.push(message);
      offset += length;
    }

    return messages;
  };

  this.decodePacket = (packet) => {
    if (packet.length < HEADER_LENGTH) return null;

    const header = {
      messageLength: packet.readUInt16LE(0),
      messageCode: packet.readUInt16LE(2),
      exchangeId: packet.readInt8(4),
      level: packet.readUInt8(5),
      sequenceNumber: packet.readUInt8(7),
    };

    if (header.messageLength !== packet.length) return null;

    if (header.messageCode === 7207) return this.decodeIndex(packet, header);
    if (header.messageCode === 105) return this.decodeMarketStatus(packet, header);
    if (header.messageCode === 104) return this.decodeCasReference(packet, header);
    if (header.level === 1) return this.decodeMiniTouchLine(packet, header);
    if ([2, 4, 8].includes(header.level)) return this.decodeMarketPicture(packet, header);

    return null;
  };

  this.baseMessage = (header) => ({
    ...header,
    exchange: EXCHANGE_NAMES[header.exchangeId] || "unknown",
    divider: this.getDivider(header.exchangeId),
  });

  this.decodeIndex = (packet, header) => {
    if (packet.length < 87) return null;

    const message = this.baseMessage(header);
    const divider = message.divider;
    const close = packet.readInt32LE(17) / divider;
    const ltp = packet.readInt32LE(29) / divider;

    return {
      ...message,
      type: "index",
      isIndex: true,
      token: packet.readUInt32LE(9),
      open: packet.readInt32LE(13) / divider,
      close,
      high: packet.readInt32LE(21) / divider,
      low: packet.readInt32LE(25) / divider,
      ltp,
      lastTradeTime: toNumber(packet.readBigUInt64LE(33)),
      yearlyHigh: packet.readInt32LE(41) / divider,
      yearlyLow: packet.readInt32LE(45) / divider,
      netChange: ltp - close,
      netChangePercent: packet.readInt32LE(49) / 100,
      precision: packet.readUInt8(61),
      multiplier: packet.readInt32LE(62) / divider,
      name: decodeString(packet, 66, 87),
    };
  };

  this.decodeMarketPicture = (packet, header) => {
    if (packet.length < 144) return null;

    const message = this.baseMessage(header);
    const divider = message.divider;
    const token = packet.readUInt32LE(9);
    const symbol = this.symbolsByInstrument.get(`${message.exchange}|${token}`);
    const buyDepthCount = header.level === 4 ? 1 : packet.readUInt32LE(89);
    const sellDepthCount = header.level === 4 ? 1 : packet.readUInt32LE(93);
    const depth = this.decodeDepth(packet, buyDepthCount, sellDepthCount, divider);

    return {
      ...message,
      type: "market_picture",
      token,
      symbol,
      totalBuyQty: toNumber(packet.readBigInt64LE(13)),
      totalSellQty: toNumber(packet.readBigInt64LE(21)),
      volumeTradedToday: toNumber(packet.readBigInt64LE(29)),
      lastTradeTime: toNumber(packet.readBigInt64LE(37)),
      lastUpdateTime: toNumber(packet.readBigInt64LE(45)),
      open: packet.readUInt32LE(53) / divider,
      close: packet.readUInt32LE(57) / divider,
      high: packet.readUInt32LE(61) / divider,
      low: packet.readUInt32LE(65) / divider,
      ltp: packet.readUInt32LE(69) / divider,
      lastTradeQty: toNumber(packet.readBigInt64LE(73)),
      atp: packet.readUInt32LE(81) / divider,
      buyDepthCount,
      sellDepthCount,
      netChangePercent: packet.readInt32LE(99) / 100,
      openInterest: packet.readUInt32LE(103),
      tradedValue: packet.readDoubleLE(107) / divider,
      netChange: packet.readInt32LE(115) / divider,
      upperCircuit: packet.readUInt32LE(119) / divider,
      lowerCircuit: packet.readUInt32LE(123) / divider,
      yearlyHigh: packet.readUInt32LE(127) / divider,
      yearlyLow: packet.readUInt32LE(131) / divider,
      marketLot: packet.readUInt32LE(135),
      precision: packet.readUInt8(139),
      multiplier: packet.readUInt32LE(140),
      buy: depth.buy,
      sell: depth.sell,
    };
  };

  this.decodeDepth = (packet, buyDepthCount, sellDepthCount, divider) => {
    const buy = [];
    const sell = [];
    const totalDepth = buyDepthCount + sellDepthCount;
    let offset = 144;

    for (let index = 0; index < totalDepth && offset + 16 <= packet.length; index += 1) {
      const entry = {
        qty: toNumber(packet.readBigInt64LE(offset)),
        price: packet.readInt32LE(offset + 8) / divider,
        noOfOrders: packet.readInt32LE(offset + 12),
      };

      if (index < buyDepthCount) buy.push(entry);
      else sell.push(entry);
      offset += 16;
    }

    return { buy, sell };
  };

  this.decodeMiniTouchLine = (packet, header) => {
    if (packet.length < 54) return null;

    const message = this.baseMessage(header);
    const divider = message.divider;
    const token = packet.readUInt32LE(9);

    return {
      ...message,
      type: "mini_touch_line",
      token,
      symbol: this.symbolsByInstrument.get(`${message.exchange}|${token}`),
      lastTradeTime: toNumber(packet.readBigInt64LE(13)),
      ltp: packet.readUInt32LE(21) / divider,
      lastTradeQty: toNumber(packet.readBigInt64LE(25)),
      // The protocol's reference client exposes this field without applying the divider.
      close: packet.readUInt32LE(33),
      netChangePercent: packet.readInt32LE(37) / 100,
      netChange: packet.readInt32LE(41) / divider,
      marketLot: packet.readUInt32LE(45),
      precision: packet.readUInt8(49),
      multiplier: packet.readUInt32LE(50),
    };
  };

  this.decodeMarketStatus = (packet, header) => {
    if (packet.length < 16) return null;

    return {
      ...this.baseMessage(header),
      type: "market_status",
      statusCode: packet.readUInt16LE(9),
      status: decodeString(packet, 11, 16),
    };
  };

  this.decodeCasReference = (packet, header) => {
    if (packet.length < 48) return null;

    return {
      ...this.baseMessage(header),
      type: "cas_reference",
      token: packet.readInt32LE(9),
      referencePrice: packet.readInt32LE(13),
      imbalanceQty: toNumber(packet.readBigInt64LE(17)),
      imbalanceQtyAtMarket: toNumber(packet.readBigInt64LE(25)),
    };
  };

  this.toLegacyMarketData = (message) => {
    if (message.type === "index") {
      return {
        e: message.exchange,
        tk: message.name || String(message.token),
        iv: message.ltp,
        lowPrice: message.low,
        highPrice: message.high,
        openingPrice: message.open,
        ic: message.close,
        cng: message.netChange,
        nc: message.netChangePercent,
      };
    }

    if (!["market_picture", "mini_touch_line"].includes(message.type)) return null;

    return {
      e: message.exchange,
      tk: message.token,
      ltp: message.ltp,
      lo: message.low,
      h: message.high,
      op: message.open,
      c: message.close,
      oi: message.openInterest,
      cng: message.netChange,
      nc: message.netChangePercent,
      v: message.volumeTradedToday,
    };
  };

  this.getCredentials = async () => {
    const credentials = await redisService.get(REDIS.KEY.HS_WEB_SOCKET.CREDENTIALS);
    const { sid, ucc, feedUrl, tradeApiFeedUrl } = credentials || {};

    if (!sid || !ucc) throw new Error("Kotak Neo sid or UCC is missing");

    return { sid, ucc, feedUrl: feedUrl || tradeApiFeedUrl };
  };

  appEvents.on(EVENT.HS_WEB_SOCKET.CREDENTIALS_UPDATED, this.tryReconnect);
  this.startHealthCheck();
}

module.exports = {
  WebSocketService,
  webSocketService: new WebSocketService(),
};

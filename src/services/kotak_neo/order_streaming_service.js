const { logger } = require("winston");
const WebSocket = require("ws");
const { appEvents } = require("@events");
const { REDIS, EVENT } = require("@constants");
const { redisService } = require("../redis");

const ORDER_STREAM_CONNECT_TIMEOUT_MS = 10_000;
const RECONNECT_DELAY_MS = 2_000;

const toWebSocketUrl = (baseUrl) => {
  const url = new URL(/^https?:\/\//.test(baseUrl) ? baseUrl : `https://${baseUrl}`);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.pathname = "/realtime";
  url.search = "";

  return url.toString();
};

function OrderStreamingService() {
  const orderStreams = new Map();

  this.getTradingSession = async (userId) => {
    const credentials = await redisService.get(REDIS.KEY.USER_INFO(userId));
    const baseUrl = credentials?.tradeApiBaseUrl;
    const token = credentials?.sessionToken;

    if (!baseUrl || !token || !credentials?.sid) {
      throw new Error("Kotak Neo trading session is missing or expired");
    }

    return { baseUrl, token, sid: credentials.sid };
  };

  const isTerminalOrderStatus = (status) =>
    ["complete", "rejected", "cancelled"].includes(String(status || "").toLowerCase());

  this.connectOrderStream = async (userId) => {
    let stream = orderStreams.get(userId);
    if (!stream) {
      stream = {
        connected: false,
        latestOrderUpdates: new Map(),
        socket: null,
        connectionPromise: null,
        reconnectTimer: null,
        stopped: false,
      };
      orderStreams.set(userId, stream);
    }

    if (stream.connected && stream.socket?.readyState === WebSocket.OPEN) return stream;
    if (stream.connectionPromise) return stream.connectionPromise;

    stream.stopped = false;
    const connectionPromise = (async () => {
      const session = await this.getTradingSession(userId);

      return new Promise((resolve, reject) => {
        const socket = new WebSocket(toWebSocketUrl(session.baseUrl));
        let settled = false;
        const timeout = setTimeout(() => {
          socket.terminate();
          finishConnection(reject, new Error("Kotak Neo order stream connection timed out"));
        }, ORDER_STREAM_CONNECT_TIMEOUT_MS);

        const finishConnection = (callback, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          stream.connectionPromise = null;
          callback(value);
        };

        stream.socket = socket;

        socket.on("open", () => {
          const payload = `{type:cn,Authorization:${session.token},Sid:${session.sid},src:WEB}`;
          socket.send(payload, (error) => {
            if (!error) return;
            logger.error("OrderStreamingService: unable to send authentication", error);
            finishConnection(reject, error);
            socket.terminate();
          });
        });

        socket.on("message", (data) => {
          let message;
          try {
            message = JSON.parse(data.toString());
          } catch (error) {
            logger.error("OrderStreamingService: invalid stream message", error);
            return;
          }

          if (message.type === "cn") {
            if (String(message.ak).toLowerCase() === "ok") {
              stream.connected = true;
              finishConnection(resolve, stream);
            } else {
              finishConnection(
                reject,
                new Error(message.msg || "Kotak Neo order stream authentication failed")
              );
              socket.terminate();
            }
            return;
          }

          if (message.type === "order" && message.data?.nOrdNo) {
            const orderNumber = String(message.data.nOrdNo);
            stream.latestOrderUpdates.set(orderNumber, message.data);
            appEvents.emit(EVENT.KOTAK_NEO.ORDER_UPDATE, { userId, update: message.data });
          }

          if (message.type === "position" && message.data) {
            appEvents.emit(EVENT.KOTAK_NEO.POSITION_UPDATE, { userId, update: message.data });
          }
        });

        socket.on("close", () => {
          const wasConnected = stream.connected;
          stream.connected = false;
          if (stream.socket === socket) stream.socket = null;

          if (!settled) {
            finishConnection(reject, new Error("Kotak Neo order stream closed before connecting"));
          }
          if (wasConnected) scheduleReconnect(userId, stream);
        });

        socket.on("error", (error) => {
          if (!settled) finishConnection(reject, error);
          else {
            logger.error("OrderStreamingService: order stream error", error);
            socket.terminate();
          }
        });
      });
    })();

    stream.connectionPromise = connectionPromise;
    try {
      return await connectionPromise;
    } catch (error) {
      stream.connectionPromise = null;
      scheduleReconnect(userId, stream);
      throw error;
    }
  };

  const scheduleReconnect = (userId, stream) => {
    if (stream.stopped || stream.reconnectTimer) return;

    stream.reconnectTimer = setTimeout(() => {
      stream.reconnectTimer = null;
      this.connectOrderStream(userId).catch((error) => {
        logger.error("OrderStreamingService: unable to reconnect order stream", error);
      });
    }, RECONNECT_DELAY_MS);
  };

  this.trackOrderExecution = async (userId, orderNumber, listener) => {
    const stream = await this.connectOrderStream(userId);
    const orderKey = String(orderNumber);
    const existingUpdate = stream.latestOrderUpdates.get(orderKey);
    let removeListener;

    const handleOrderUpdate = (event = {}) => {
      if (event.userId !== userId || String(event.update?.nOrdNo) !== orderKey) return;

      Promise.resolve(listener(event.update)).catch((error) => {
        logger.error("OrderStreamingService: order update listener failed", error);
      });

      if (isTerminalOrderStatus(event.update?.ordSt)) removeListener();
    };

    removeListener = appEvents.onEvent(EVENT.KOTAK_NEO.ORDER_UPDATE, handleOrderUpdate);

    if (existingUpdate) {
      await listener(existingUpdate);
      if (isTerminalOrderStatus(existingUpdate.ordSt)) removeListener();
    }
  };

  this.disconnect = (userId) => {
    const streams = userId === undefined
      ? [...orderStreams.values()]
      : [orderStreams.get(userId)].filter(Boolean);

    streams.forEach((stream) => {
      stream.stopped = true;
      stream.connected = false;
      if (stream.reconnectTimer) clearTimeout(stream.reconnectTimer);
      stream.reconnectTimer = null;
      stream.socket?.close();
      stream.socket = null;
      stream.connectionPromise = null;
    });

    if (userId === undefined) orderStreams.clear();
    else orderStreams.delete(userId);
  };

  appEvents.on(EVENT.HS_WEB_SOCKET.CREDENTIALS_UPDATED, () => {
    orderStreams.forEach((stream, userId) => {
      if (stream.stopped) return;

      if (stream.reconnectTimer) clearTimeout(stream.reconnectTimer);
      stream.reconnectTimer = null;
      if (stream.socket) {
        stream.socket.close();
      } else if (!stream.connectionPromise) {
        this.connectOrderStream(userId).catch((error) => {
          logger.error("OrderStreamingService: unable to reconnect with refreshed credentials", error);
        });
      }
    });
  });
}

module.exports = { OrderStreamingService, orderStreamingService: new OrderStreamingService() };

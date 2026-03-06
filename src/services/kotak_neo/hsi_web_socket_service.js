const { logger } = require("winston");
const { HSIWebSocket } = require("@libs");
const { EVENT } = require("@constants");
const { appEvents } = require("@events");

function HSIWebSocketService(token, sid, serverId, chNo) {
  const url = `wss://mlhsi.kotaksecurities.com/realtime?sId=${serverId}`;

  this.channelNumber = chNo || 1;
  this.token = token;
  this.sid = sid;

  this.connect = () => {
    this.hsWs = new HSIWebSocket(url);

    this.send = (obj) => this.hsWs && this.hsWs.send(JSON.stringify(obj));

    this.hsWs.onopen = () => {
      this.send({
        type: "cn",
        Authorization: this.token,
        Sid: this.sid,
        source: "WEB",
      });

      logger.socket("HSIWeb Socket: connected");
    };

    this.hsWs.onclose = () => {
      logger.socket("HSIWeb Socket: disconnected");
    };

    this.hsWs.onerror = (error) => {
      logger.error("HSIWeb Socket Error:", error);
    };

    this.hsWs.onmessage = (msg) => {
      const result = JSON.parse(msg);
      logger.socket("HSIWeb Socket Message:", result);

      appEvents.emit(EVENT.HSI_WEB_SOCKET.MESSAGE, result);
    };
  };
}

module.exports = HSIWebSocketService;

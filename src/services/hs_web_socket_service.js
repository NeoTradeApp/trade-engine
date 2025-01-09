const { logger } = require("winston");
const { HSWebSocket } = require("@libs");
const { appEvents } = require("@events");
const { EVENT, SCRIPS, REDIS } = require("@constants");
const { redisService } = require("./redis");
const { isMarketOpen } = require("@utils");

const HEALTHCHECK_INTERVAL = 30000;

function HSWebSocketService() {
  const url = "wss://mlhsm.kotaksecurities.com";
  this.userWS = new HSWebSocket(url);
  this.channelNumber = 1;

  this.send = (obj) => this.isOpen() && this.userWS.send(JSON.stringify(obj));

  this.connect = async () => {
    try {
      /*
       * TODO: remove this condition and getCredentials
       * Used as one socket connection for market feed from HS Web socket,
       * instead of adding separate socket for each user login.
       */
      if (this.isOpen()) {
        return;
      }

      const { token, sid } = await getCredentials();

      this.userWS.open();

      this.userWS.onopen = () => {
        this.send({
          Authorization: token,
          Sid: sid,
          type: "cn",
        });

        logger.socket("HSWeb: connected");
        this.healthCheckStatus = true;
        this.subscribeIndex(SCRIPS.NIFTY_50);
      };

      this.userWS.onclose = () => {
        this.healthCheckStatus = false;
        logger.socket("HSWeb: disconnected");
      };

      this.userWS.onerror = (error) => {
        logger.error("HSWeb Error:", error);
      };

      this.userWS.onmessage = (rawData) => {
        const data = JSON.parse(rawData);
        const [{ e: exchange } = {}] = data || [];
        if (exchange === "nse_cm") {
          appEvents.emit(EVENT.HS_WEB_SOCKET.MARKET_FEED, data);
        }
      };

      this.userWS.onpong = () => {
        this.healthCheckStatus = true;
      };

      return this.userWS;
    } catch (error) {
      logger.error("HSWebSocketService: ", error.message);
    }
  };

  this.tryReconnect = () => {
    if (isMarketOpen()) {
      logger.error("HSWebSocketService: Retrying connection...");
      this.connect();
    }
  };

  this.isOpen = () => this.userWS && this.userWS.OPEN && this.userWS.readyState;
  this.close = () => this.isOpen() && this.userWS.close();
  this.ping = () => this.isOpen() && this.userWS.ping();

  const subscribe = (type, scrips) =>
    this.send({
      type,
      scrips,
      channelnum: this.channelNumber,
    });
  this.subscribeIndex = (scrips) => subscribe("ifs", scrips);
  this.subscribeScrips = (scrips) => subscribe("mws", scrips);

  const pauseOrResume = (type) =>
    this.send({
      type,
      channelnums: [this.channelNumber],
    });
  this.pause = () => pauseOrResume("cp");
  this.resume = () => pauseOrResume("cr");

  const getCredentials = async () => {
    const credentials = await redisService.get(REDIS.KEY.HS_WEB_SOCKET.CREDENTIALS);
    const { token, sid } = credentials || {};

    if (!token || !sid) {
      throw new Error("Token or sid is missing");
    }

    return { token, sid };
  };

  appEvents.on(EVENT.HS_WEB_SOCKET.CREDENTIALS_UPDATED, this.tryReconnect);

  this.healthCheckTimer = setInterval(() => {
    if (this.healthCheckStatus === false) {
      this.close();
      this.tryReconnect();
      return;
    }

    this.healthCheckStatus = false;
    this.ping();
  }, HEALTHCHECK_INTERVAL);
}

module.exports = { hsWebSocketService: new HSWebSocketService() };

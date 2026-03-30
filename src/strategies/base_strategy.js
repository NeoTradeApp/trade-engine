const { appEvents } = require("@events")
const { EVENT, STRATEGY } = require("@constants")
const { generateRandomId } = require("@utils");

const { INITIATED, ACTIVE, ENTERED, PAUSED, EXITED } = STRATEGY.STATUS;

function BaseStrategy(orders = []) {
  this.strategyId = generateRandomId(5);
  this.status = INITIATED;
  let prevStatus = this.status;

  this.pnl = 0;
  this.entryOrders = [...orders];
  this.exitOrders = [];

  this.processMarketTick = (data) => {
    // const {
    //   [SCRIPS.SCRIP_TYPE.NIFTY_FUTURE]: niftyFutures,
    //   [SCRIPS.SCRIP_TYPE.NIFTY_OPTIONS]: niftyOptions,
    // } = data;

    if (this.isEntered() && this.exitRules(data)) {
      this.exit();
    }

    if (this.isActive() && !this.isEntered() && this.entryRules(data)) {
      this.enter();
    }
  };

  this.executeEntryOrders = (orders) => {
    this.entryOrders = [...orders];
  };

  let removeMarketFeedEvent = null;
  const listenMarketFeed = () => {
    removeMarketFeedEvent = appEvents.onEvent(EVENT.HS_WEB_SOCKET.MARKET_FEED, this.processMarketTick);
  };

  const stopMarketFeed = () => {
    if (!removeMarketFeedEvent) return;

    removeMarketFeedEvent();
    removeMarketFeedEvent = null;
  };

  this.isActive = () => this.status === ACTIVE;
  this.activate = () => {
    listenMarketFeed();
    this.status = ACTIVE;
  };

  this.isEntered = () => this.status === ENTERED;
  this.enter = () => {
    this.status = ENTERED;
  };

  this.pause = () => {
    if (![ACTIVE, ENTERED].includes(this.status)) return;

    stopMarketFeed();
    prevStatus = this.status;
    this.status = PAUSED;
  };

  this.resume = () => {
    if (this.status !== PAUSED) return;

    listenMarketFeed();
    this.status = prevStatus;
  };

  this.isExited = () => this.status === EXITED;
  this.exit = () => {
    if (![ACTIVE, ENTERED, PAUSED].includes(this.status)) return;

    stopMarketFeed();
    this.status = EXITED;
  };
}

module.exports = BaseStrategy;

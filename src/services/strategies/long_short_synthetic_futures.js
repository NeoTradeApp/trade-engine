const { appEvents } = require("@events")
const { EVENT } = require("@constants")

function LongShortSyntheticFutures(entryRules, exitRules) {
  // ready, started, paused, exited
  this.status = "ready";
  this.pnl = 0;

  const processMarketTick = (data) => {
    const {
      [SCRIPS.SCRIP_TYPE.NIFTY_FUTURE]: niftyFutures,
      [SCRIPS.SCRIP_TYPE.NIFTY_OPTIONS]: niftyOptions,
    } = data;

    if (this.status === "started" && exitRules()) {
      this.exit();
    }

    if (entryRules()) {
      this.start()
    }
  };

  let removeMarketFeedEvent = null;
  const listenMarketFeed = () => {
    removeMarketFeedEvent = appEvents.onEvent(EVENT.HS_WEB_SOCKET.MARKET_FEED, processMarketTick);
  };

  const stopMarketFeed = () => {
    if (!removeMarketFeedEvent) return;

    removeMarketFeedEvent();
    removeMarketFeedEvent = null;
  }

  this.start = () => {
    this.status = "started";
  };

  this.resume = () => {
    if (this.status !== "paused") return;

    listenMarketFeed();
  }

  this.pause = () => {
    if (this.status !== "started") return;

    stopMarketFeed();
    this.status = "paused";
  }

  this.exit = () => {
    if (this.status === "ready") return;

    stopMarketFeed();
    this.status = "exited";
  }
}

module.export = LongShortSyntheticFutures;

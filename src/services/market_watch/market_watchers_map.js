const { appEvents } = require("@events");
const { EVENT } = require("@constants");

const watchersMap = new Map();

const registerWatcher = (scrip, watcher) => {
  if (!watchersMap.has(scrip)) {
    watchersMap.set(scrip, new Set());
  }

  watchersMap.get(scrip).add(watcher);
};

const unregisterWatcher = (scrip, watcher) => {
  if (!watchersMap.has(scrip)) return;

  const set = watchersMap.get(scrip);
  set.delete(watcher);

  if (set.size === 0) {
    watchersMap.delete(scrip);
  }
};

const removeMarketFeedEvent = appEvents.onEvent(EVENT.HS_WEB_SOCKET.MARKET_FEED, (marketData) => {
  Object.keys(marketData).forEach((scrip) => {
    const watchers = watchersMap.get(scrip);

    if (!watchers) return;

    for (const watcher of watchers) {
      watcher.onTick(tick);
    }
  });
});

module.exports = {
  registerWatcher,
  unregisterWatcher,
  removeMarketFeedEvent,
};

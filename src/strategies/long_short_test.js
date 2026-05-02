class LongShortSyntheticFutures {
  constructor({ spotWatcher, ceWatcher, peWatcher, threshold = 30 }) {
    this.spotWatcher = spotWatcher;
    this.ceWatcher = ceWatcher;
    this.peWatcher = peWatcher;

    this.threshold = threshold;

    this.position = null; // LONG | SHORT | null

    this.onEvent = this.onEvent.bind(this);

    // subscribe
    this.spotWatcher.on(this.onEvent);
    this.ceWatcher.on(this.onEvent);
    this.peWatcher.on(this.onEvent);
  }

  onEvent(event, data, watcher) {
    // --- ENTRY LOGIC ---
    if (watcher === this.spotWatcher && event === "CANDLE_CLOSE") {
      this.checkEntry(data);
    }

    // --- PnL / EXIT ---
    if (event === "TICK_UPDATE") {
      this.updatePnL();
      this.checkExit();
    }
  }

  // ENTRY CONDITION
  checkEntry({ candle, indicators }) {
    if (this.position) return;

    const price = candle.close;
    const ema = indicators.ema10;

    const trend = this.getTrend(indicators);

    const distance = Math.abs(price - ema);

    if (distance > this.threshold) return;

    // --- LONG SYNTHETIC ---
    if (trend === "UPTREND") {
      this.enterLong(price);
    }

    // --- SHORT SYNTHETIC ---
    if (trend === "DOWNTREND") {
      this.enterShort(price);
    }
  }

  getTrend(indicators) {
    const { ema10, emaHistory } = indicators;

    if (!emaHistory || emaHistory.length < 3) return "SIDEWAYS";

    const first = emaHistory[0];
    const last = emaHistory[emaHistory.length - 1];

    const slope = (last - first) / emaHistory.length;
    const avg = emaHistory.reduce((a, b) => a + b, 0) / emaHistory.length;

    const normalized = (slope / avg) * 100;

    if (normalized > 0.02) return "UPTREND";
    if (normalized < -0.02) return "DOWNTREND";

    return "SIDEWAYS";
  }

  // EXECUTION

  enterLong(price) {
    console.log("Entering LONG Synthetic");

    this.position = {
      type: "LONG",
      entryPrice: price,
      ceEntry: this.ceWatcher.lastPrice,
      peEntry: this.peWatcher.lastPrice,
    };

    // BUY CE + SELL PE
  }

  enterShort(price) {
    console.log("Entering SHORT Synthetic");

    this.position = {
      type: "SHORT",
      entryPrice: price,
      ceEntry: this.ceWatcher.lastPrice,
      peEntry: this.peWatcher.lastPrice,
    };

    // SELL CE + BUY PE
  }

  // PnL CALCULATION (tick-based)
  updatePnL() {
    if (!this.position) return;

    const cePrice = this.ceWatcher.lastPrice;
    const pePrice = this.peWatcher.lastPrice;

    let pnl = 0;

    if (this.position.type === "LONG") {
      pnl =
        (cePrice - this.position.ceEntry) -
        (pePrice - this.position.peEntry);
    } else {
      pnl =
        -(cePrice - this.position.ceEntry) +
        (pePrice - this.position.peEntry);
    }

    this.position.pnl = pnl;
    // console.log("PnL:", pnl);
  }

  // EXIT LOGIC (simple example)
  checkExit() {
    if (!this.position) return;

    const pnl = this.position.pnl;

    if (pnl > 50 || pnl < -30) {
      console.log("Exiting position");

      this.position = null;

      // square off orders here
    }
  }

  destroy() {
    this.spotWatcher.off(this.onEvent);
    this.ceWatcher.off(this.onEvent);
    this.peWatcher.off(this.onEvent);
  }
}

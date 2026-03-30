const { appEvents } = require("@events")
const { SCRIPS, EVENT } = require("@constants")
const BaseStrategy = require("./base_strategy");

function LongShortSyntheticFutures() {
  BaseStrategy.call(this, []);

  this.entryRules = (data) => {
    const {
      [SCRIPS.SCRIP_TYPE.NIFTY_FUTURE]: niftyFutures,
      [SCRIPS.SCRIP_TYPE.NIFTY_OPTIONS]: niftyOptions,
    } = data;

    if (niftyFutures) {
      const atmStrikePrice = Math.round(niftyFutures.currentPrice / 100) * 100;

      const atmStrikeCE = niftyOptions?.[atmStrikePrice]?.["CE"];
      const atmStrikePE = niftyOptions?.[atmStrikePrice]?.["PE"];
    }
  };

  this.exitRules = (data) => {

  };
}

module.exports = LongShortSyntheticFutures;

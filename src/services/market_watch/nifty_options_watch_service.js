const { SCRIPS } = require("@constants")
const BaseMarketWatchService = require("./base_market_watch_service");

function NiftyOptionsWatchService(strikePrice, optionType) {
  BaseMarketWatchService.call(this, SCRIPS.SCRIP_TYPE.NIFTY_OPTION(`${strikePrice}/${optionType}`), 1, 1);

  this.strikePrice = strikePrice;
  this.optionType = optionType;

  this.fetchMarketData = (marketData) => {
    const {
      [SCRIPS.SCRIP_TYPE.NIFTY_OPTION_CHAIN]: niftyOptions,
    } = marketData;

    return niftyOptions?.[strikePrice]?.[optionType];
  };

  this.start();
}

module.exports = NiftyOptionsWatchService;

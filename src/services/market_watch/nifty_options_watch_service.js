const { SCRIPS } = require("@constants")
const BaseMarketWatchService = require("./base_market_watch_service");

function NiftyOptionsWatchService(strikePrice, optionType, optionExpiry) {
  BaseMarketWatchService.call(this, SCRIPS.SCRIP_TYPE.NIFTY_OPTION(`${strikePrice}/${optionType}/${optionExpiry}`), 1, 1);

  this.strikePrice = strikePrice;
  this.optionType = optionType;
  this.optionExpiry = optionExpiry;

  this.fetchMarketData = (marketData) => {
    const {
      [SCRIPS.SCRIP_TYPE.NIFTY_OPTION_CHAIN]: niftyOptions,
    } = marketData;

    return niftyOptions?.[this.strikePrice]?.[this.optionType];
  };

  this.start();
}

module.exports = NiftyOptionsWatchService;

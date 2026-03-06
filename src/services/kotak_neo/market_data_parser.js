const { SCRIPS } = require("@constants");

function MarketDataParser() {
  this.niftyOptionChainScrips = {};

  this.setScrips = (scrips) => {
    const { niftyOptionChainScrips, niftyFutScrip } = scrips;

    this.niftyOptionChainScrips = niftyOptionChainScrips;
    this.niftyFutScrip = niftyFutScrip;
  }

  const parseNiftyOptionChain = (rawData) => {
    const scripDetails = this.niftyOptionChainScrips[`${rawData.e}|${rawData.tk}`];

    return {
      ...scripDetails,
      currentPrice: rawData.ltp,
      low: rawData.lo,
      high: rawData.h,
      open: rawData.op,
      close: rawData.c,
      openInterest: rawData.oi,
      change: rawData.cng,
      changePercentage: rawData.nc,
      exchange: rawData.e,
      // type: SCRIPS.SCRIP_TYPE.NIFTY_OPTIONS,
    };
  };

  const parseNiftyFut = (rawData) => {
    const scripDetails = this.niftyFutScrip[`${rawData.e}|${rawData.tk}`];

    return {
      ...scripDetails,
      currentPrice: rawData.ltp,
      low: rawData.lo,
      high: rawData.h,
      open: rawData.op,
      close: rawData.c,
      change: rawData.cng,
      changePercentage: rawData.nc,
      exchange: rawData.e,
      volume: rawData.v,
      // type: SCRIPS.SCRIP_TYPE.NIFTY_FUTURE,
    };
  }

  const parseNiftyIndex = (rawData) => {
    return {
      symbol: "Nifty 50",
      currentPrice: rawData.iv,
      low: rawData.lowPrice,
      high: rawData.highPrice,
      open: rawData.openingPrice,
      close: rawData.ic,
      change: rawData.cng,
      changePercentage: rawData.nc,
      exchange: rawData.e,
      // type: SCRIPS.SCRIP_TYPE.NIFTY_INDEX,
    };
  };

  this.parseMarketData = (rawDataArray) =>
    rawDataArray.reduce((parsedData, rawData) => {
      const key = `${rawData.e}|${rawData.tk}`;

      switch (true) {
        case Object.keys(this.niftyOptionChainScrips).includes(key):
          parsedData[SCRIPS.SCRIP_TYPE.NIFTY_OPTIONS] ||= [];
          parsedData[SCRIPS.SCRIP_TYPE.NIFTY_OPTIONS].push(parseNiftyOptionChain(rawData));
          break;

        case Object.keys(this.niftyFutScrip).includes(key):
          parsedData[SCRIPS.SCRIP_TYPE.NIFTY_FUTURE] = parseNiftyFut(rawData);
          break;

        case SCRIPS.NIFTY_50 === key:
          parsedData[SCRIPS.SCRIP_TYPE.NIFTY_INDEX] = parseNiftyIndex(rawData);
          break;

        default:
          break;
      }

      return parsedData;
    }, {});
}

module.exports = { marketDataParser: new MarketDataParser() };

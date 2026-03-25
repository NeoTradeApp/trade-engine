const { logger } = require("winston");
const moment = require("moment");
const BaseService = require("../base_service");
const { appEvents } = require("@events");
const { REDIS, EVENT, SCRIPS } = require("@constants");
const { redisService } = require("../redis");
const { getErrorMessage, downloadAndParseCsv, getDateOfNext, getMonthEndDateOf } = require("@utils");

const { KOTAK_NEO_API_BASE_URL, KOTAK_NEO_ACCESS_TOKEN } = process.env;
const KOTAK_NEO_EXPIRY_ADDITION = 315511200;

const OPTION_CHAIN_DEPTH = 5;
const NIFTY_STRIKE_PRICE_INTERVAL = 50;
const { NIFTY_WEEKLY_EXPIRY, NIFTY_MONTHLY_EXPIRY } = process.env;

function KotakNeoService() {
  BaseService.call(this);

  this.baseUrl = KOTAK_NEO_API_BASE_URL;

  this.errorHandler = (error, details = {}) => {
    const { status, data: errorObj } = error.response || {};
    const errorMessage = getErrorMessage(errorObj);

    logger.error("KotakNeoService: ", status, details, errorMessage);
  };

  const baseCallApi = this.callApi;

  this.callApi = async (...args) => {
    this.defaultHeaders = {
      Authorization: KOTAK_NEO_ACCESS_TOKEN,
      "neo-fin-key": "neotradeapi",
    };

    return await baseCallApi.apply(this, args);
  };

  const downloadAndParseMasterScrip = async (exchange) => {
    const response = await this.callApi(
      "GET",
      "/script-details/1.0/masterscrip/file-paths",
      "",
      { baseUrl: "https://e21.kotaksecurities.com" }
    );

    const { filesPaths } = response?.data || {};
    if (!filesPaths) return [];

    const exchangeFileLink = (filesPaths || []).find((fileLink) => fileLink.includes(exchange))
    const parsedCsv = await downloadAndParseCsv(exchangeFileLink);
    const parseExpiry = (epoch) => epoch && moment.unix(parseInt(epoch) + KOTAK_NEO_EXPIRY_ADDITION).format("YYYY-MM-DD");

    return parsedCsv.map(ins => ({
      instrumentToken: ins.pSymbol,
      tradingSymbol: ins.pTrdSymbol,
      name: ins.pInstName,
      expiry: parseExpiry(ins.pExpiryDate),
      strikePrice: ins.dStrikePrice,
      optionType: ins.pOptionType,
      exchangeSegment: ins.pExchSeg,
      lotSize: ins.lLotSize,
    }));
  };

  this.loadInstruments = async (exchange) =>
    await redisService.cache(
      REDIS.KEY.KOTAK_NEO.MASTER_SCRIP(exchange),
      () => downloadAndParseMasterScrip(exchange),
      "24h"
    );

  const findInstruments = async (regexPattern, expiry) => {
    const instruments = await this.loadInstruments(SCRIPS.EXCHANGES.NSE_FO);

    return instruments.reduce((obj, ins) => {
      const [matches] = Array.from(ins.tradingSymbol.matchAll(new RegExp(regexPattern, "g")));

      if (ins.expiry === expiry && matches) {
        const [, symbol, strikePrice, optionType] = matches;
        obj[`${ins.exchangeSegment}|${ins.instrumentToken}`] = {
          symbol,
          strikePrice,
          optionType,
          ...ins,
        };
      }

      return obj;
    }, {});
  }

  this.loadNiftyOptionChainScrips = async () => {
    const lastTradedNifyValue = 22900;
    const niftyWeeklyExpiry = getDateOfNext(NIFTY_WEEKLY_EXPIRY || "Tuesday");

    const niftyATMStrikePrice = parseInt(lastTradedNifyValue / 50) * 50;
    const strikePrices = Array.from(
      { length: 11 },
      (_, i) => niftyATMStrikePrice + (i - OPTION_CHAIN_DEPTH) * NIFTY_STRIKE_PRICE_INTERVAL
    );

    return await findInstruments(
      `^(NIFTY)[0-9]+(${strikePrices.join("|")})(CE|PE)$`,
      niftyWeeklyExpiry
    );
  }

  this.loadNiftyFuturesScrip = async () => {
    const niftyMonthlyExpiry = getMonthEndDateOf(NIFTY_MONTHLY_EXPIRY || "Tuesday")

    return await findInstruments(
      `^(NIFTY)(${moment().format("YYMMM").toUpperCase()})(FUT)$`,
      niftyMonthlyExpiry
    );
  }
}

module.exports = { kotakNeoService: new KotakNeoService() };

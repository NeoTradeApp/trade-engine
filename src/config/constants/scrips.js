const SCRIPS = {
  NIFTY_50: "nse_cm|Nifty 50",
  EXCHANGES: {
    NSE_FO: "nse_fo",
    NSE_CM: "nse_cm",
  },
  SCRIP_TYPE: {
    NIFTY_INDEX: "NIFTY_INDEX",
    NIFTY_FUTURE: "NIFTY_FUTURE",
    NIFTY_OPTION_CHAIN: "NIFTY_OPTION_CHAIN",
    NIFTY_OPTION: (option) => `NIFTY_OPTION/${option}`,
  }
};

module.exports = { SCRIPS };

const { redisService, KotakNeo } = require("@services");
const { kotakNeoService, hsWebSocketService, marketDataParser } = KotakNeo;
const { appEvents } = require("@events");
const { EVENT, SCRIPS } = require("@constants");

function App() {
  this.start = async () => {
    await redisService.connect();

    await kotakNeoService.loadInstruments(SCRIPS.EXCHANGES.NSE_FO);
    // await kotakNeoService.loadInstruments(SCRIPS.EXCHANGES.NSE_CM);

    const niftyOptionChainScrips = await kotakNeoService.loadNiftyOptionChainScrips();
    const niftyFutScrip = await kotakNeoService.loadNiftyFuturesScrip();
    marketDataParser.setScrips({ niftyOptionChainScrips, niftyFutScrip });

    await hsWebSocketService.connect();

    appEvents.on(EVENT.HS_WEB_SOCKET.CONNECTION_OPEN, async () => {
      await hsWebSocketService.subscribeIndex(SCRIPS.NIFTY_50);
      await hsWebSocketService.subscribeScrips(Object.keys({
        ...niftyOptionChainScrips,
        ...niftyFutScrip,
      }).join("&"));
    });
  };

  this.stop = async () => {
    await redisService.disconnect();
    hsWebSocketService.disconnect();
  };
}

module.exports = App;

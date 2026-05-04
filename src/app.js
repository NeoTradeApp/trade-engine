const { redisService, KotakNeo, niftyFuturesWatchService: niftyFutures } = require("@services");
const { kotakNeoService, hsWebSocketService, marketDataParser } = KotakNeo;
const { appEvents } = require("@events");
const { EVENT, SCRIPS } = require("@constants");
const { UserStrategies } = require("@strategies");

// TODO: REMOVE
// require("./services/market_simulator");

function App() {
  let userStrategies = null;
  let removeHsConnectEvent = null;

  this.start = async () => {
    await redisService.connect();

    await this.configScrips();
    this.configWatchers();
    await hsWebSocketService.connect();

    // TODO: REMOVE
    // this.loadStrategies();
    setTimeout(() => this.loadStrategies(), 5000);
  };

  this.stop = async () => {
    await redisService.disconnect();
    hsWebSocketService.disconnect();

    removeHsConnectEvent();
    removeHsConnectEvent = null;

    userStrategies && userStrategies.stopAll();
    userStrategies = null;

    niftyFutures.destroy();
  };

  this.configScrips = async () => {
    await kotakNeoService.loadInstruments(SCRIPS.EXCHANGES.NSE_FO);
    // await kotakNeoService.loadInstruments(SCRIPS.EXCHANGES.NSE_CM);

    const niftyOptionChainScrips = await kotakNeoService.loadNiftyOptionChainScrips();
    const niftyFutScrip = await kotakNeoService.loadNiftyFuturesScrip();
    marketDataParser.setScrips({ niftyOptionChainScrips, niftyFutScrip });

    removeHsConnectEvent = appEvents.onEvent(EVENT.HS_WEB_SOCKET.CONNECTION_OPEN, async () => {
      await hsWebSocketService.subscribeIndex(SCRIPS.NIFTY_50);
      await hsWebSocketService.subscribeScrips(Object.keys({
        ...niftyOptionChainScrips,
        ...niftyFutScrip,
      }).join("&"));
    });
  };

  this.configWatchers = () => {
    niftyFutures.loadHistory();
  };

  this.loadStrategies = async () => {
    const userId = "02869ff3-53cc-4ab5-bd17-ee9939b0fa36";
    userStrategies = new UserStrategies(userId);
    userStrategies.deployAll();
  };
}

module.exports = App;

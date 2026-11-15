const {
  redisService,
  KotakNeo,
  niftyIndexWatchService: niftyIndex,
  niftyFuturesWatchService: niftyFutures,
  healthcheck,
} = require("@services");
const { appEvents } = require("@events");
const { EVENT, SCRIPS } = require("@constants");
const { UserStrategies } = require("@strategies");

// TODO: REMOVE
// require("./services/market_simulator");

const HEALTHCHECK_INTERVAL = 60_000;

function App() {
  let userStrategies = null;
  let removeHsConnectEvent = null;
  let healthcheckTimer = null;

  this.start = async () => {
    await redisService.connect();

    await this.configScrips();
    this.configWatchers();
    await KotakNeo.webSocketService.connect();

    // TODO: REMOVE
    // this.loadStrategies();
    setTimeout(() => this.loadStrategies(), 3000);

    healthcheckTimer = setInterval(() => healthcheck.beat(), HEALTHCHECK_INTERVAL);
  };

  this.stop = async () => {
    // KotakNeo.orderStreamingService.disconnect();
    await redisService.disconnect();
    KotakNeo.webSocketService.disconnect();

    removeHsConnectEvent();
    removeHsConnectEvent = null;

    userStrategies && userStrategies.stopAll();
    userStrategies = null;

    niftyIndex.destroy();
    niftyFutures.destroy();

    if (healthcheckTimer) {
      clearInterval(healthcheckTimer);
      healthcheckTimer = null;
    }
  };

  this.configScrips = async () => {
    await KotakNeo.kotakNeoService.loadInstruments(SCRIPS.EXCHANGES.NSE_FO);
    // await KotakNeo.kotakNeoService.loadInstruments(SCRIPS.EXCHANGES.NSE_CM);

    const niftyOptionChainScrips = await KotakNeo.kotakNeoService.loadNiftyOptionChainScrips();
    const niftyFutScrip = await KotakNeo.kotakNeoService.loadNiftyFuturesScrip();
    KotakNeo.marketDataParser.setScrips({ niftyOptionChainScrips, niftyFutScrip });

    removeHsConnectEvent = appEvents.onEvent(EVENT.HS_WEB_SOCKET.CONNECTION_OPEN, async () => {
      await KotakNeo.webSocketService.subscribeIndex(SCRIPS.NIFTY_50);
      await KotakNeo.webSocketService.subscribeScrips(Object.keys({
        ...niftyOptionChainScrips,
        ...niftyFutScrip,
      }));
    });
  };

  this.configWatchers = () => {
    niftyIndex.loadHistory();
    niftyFutures.loadHistory();
  };

  this.loadStrategies = async () => {
    const userId = "02869ff3-53cc-4ab5-bd17-ee9939b0fa36";
    userStrategies = new UserStrategies(userId);
    userStrategies.deployAll();
  };
}

module.exports = App;

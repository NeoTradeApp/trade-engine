const { NiftyIndexWatchService, niftyIndexWatchService } = require("./nifty_index_watch_service");
const { NiftyFuturesWatchService, niftyFuturesWatchService } = require("./nifty_futures_watch_service");
const NiftyOptionsWatchService = require("./nifty_options_watch_service");

module.exports = {
  NiftyIndexWatchService,
  niftyIndexWatchService,
  NiftyFuturesWatchService,
  niftyFuturesWatchService,
  NiftyOptionsWatchService,
};

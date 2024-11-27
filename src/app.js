const {
  redisService,
  kotakNeoService,
  hsWebSocketService,
} = require("@services");

function App() {
  this.start = async () => {
    await redisService.connect();
    await kotakNeoService.generateAccessToken();
    await hsWebSocketService.connect();
  };

  this.stop = async () => {
    database.disconnect();
    await redisService.disconnect();
  };
}

module.exports = App;

const redis = require("redis");
const { logger } = require("winston");

const EIGHT_HOURS_IN_SECONDS = 28800;

function RedisCache() {
  this.cacheClient = redis.createClient({
    url: 'redis://redis:6379'
  });
  this.pubSubClient = this.client.duplicate();

  this.cacheClient.on("error", this.handleError);

  this.connect = async () => {
    await this.cacheClient.connect();
    await this.cacheClient.configSet('notify-keyspace-events', 'Ex');

    await this.pubSubClient.connect();
  };

  this.subscribeKeyExpiryEvent = async (callback) => {
    // Subscribe to expiration events
    const databaseIndex = 0;
    const channel = `__keyevent@${databaseIndex}__:expired`;

    await this.pubSubClient.subscribe(channel, callback);
  }

  this.disconnect = async () => {
    await this.cacheClient.disconnect();
  };

  this.handleError = (error) => {
    logger.error("Redis Error:", error);
  };

  this.cache = async (
    cacheKey,
    callback,
    expiryTime = EIGHT_HOURS_IN_SECONDS
  ) => {
    if (!this.cacheClient) {
      logger.error("Redis not connected");
      return await callback();
    }

    let data = await this.cacheClient.get(cacheKey);
    if (data) return JSON.parse(data);

    data = await callback();
    await this.cacheClient.set(cacheKey, JSON.stringify(data), {
      EX: expiryTime, // seconds
      NX: true,
    });

    return data;
  };
}

module.exports = { redisCache: new RedisCache() };

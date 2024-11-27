const CryptoJS = require("crypto-js");
const { logger } = require("winston");
const BaseService = require("./base_service");
const { appEvents } = require("@events");
const { redisService } = require("./redis");
const { REDIS, EVENT } = require("@constants");

const {
  KOTAK_NEO_CONSUMER_KEY,
  KOTAK_NEO_CONSUMER_SECRET,
  KOTAK_NEO_USERNAME,
  KOTAK_NEO_PASSWORD,
  KOTAK_NEO_NAPI_URL,
  KOTAK_NEO_GW_NAPI_URL,
} = process.env;

const A_DAY_IN_SECONDS = 86400;

function KotakNeoService() {
  BaseService.call(this);

  this.baseUrl = KOTAK_NEO_GW_NAPI_URL;

  this.errorHandler = (error, details = {}) => {
    const { status, data: { error: errorDetails } = {} } = error.response || {};
    const errorMessage =
      errorDetails && errorDetails.map((e) => e.message).join(". ");

    logger.error("KotakNeoService: ", error);
  };

  this.generateAccessToken = async () => {
    try {
      await redisService.cache(
        REDIS.KOTAK_NEO.ACCESS_TOKEN,
        async () => {
          const consumerAuthToken = CryptoJS.enc.Base64.stringify(
            CryptoJS.enc.Utf8.parse(
              `${KOTAK_NEO_CONSUMER_KEY}:${KOTAK_NEO_CONSUMER_SECRET}`
            )
          );

          const body = {
            grant_type: "password",
            username: KOTAK_NEO_USERNAME,
            password: KOTAK_NEO_PASSWORD,
          };

          const response = await this.callApi("POST", "/oauth2/token", body, {
            headers: { Authorization: `Basic ${consumerAuthToken}` },
            baseUrl: KOTAK_NEO_NAPI_URL,
          });

          return response.access_token;
        },
        A_DAY_IN_SECONDS
      );
    } catch (error) {
      logger.error(error);
      setTimeout(
        () => appEvents.emit(EVENT.KOTAK_NEO.ACCESS_TOKEN_EXPIRED),
        3000
      );
    }
  };

  appEvents.on(EVENT.KOTAK_NEO.ACCESS_TOKEN_EXPIRED, this.generateAccessToken);
}

module.exports = { kotakNeoService: new KotakNeoService() };

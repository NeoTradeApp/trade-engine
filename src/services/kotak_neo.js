const JWT = require("jsonwebtoken");
const CryptoJS = require("crypto-js");
const BaseService = require("./base_service");
const { redisCache } = require("./redis");
const { KotakNeoApiError } = require("@error_handlers");

const {
  KOTAK_NEO_CONSUMER_KEY,
  KOTAK_NEO_CONSUMER_SECRET,
  KOTAK_NEO_USERNAME,
  KOTAK_NEO_PASSWORD,
  KOTAK_NEO_NAPI_URL,
  KOTAK_NEO_GW_NAPI_URL,
} = process.env;

const EIGHT_HOURS_IN_SECONDS = 28800;

function KotakNeo(mobileNumber, password) {
  BaseService.call(this);

  this.baseUrl = KOTAK_NEO_GW_NAPI_URL;
  this.mobileNumber = mobileNumber;
  this.password = password;

  this.errorHandler = (error, details = {}) => {
    throw new KotakNeoApiError(error.message, error.status, details);
  };

  this.accessToken = redisCache.cache(
    "access_token",
    async () => {
      const consumerAuthToken = CryptoJS.enc.Base64.stringify(
        `${KOTAK_NEO_CONSUMER_KEY}:${KOTAK_NEO_CONSUMER_SECRET}`
      );

      const body = {
        grant_type: "password",
        username: KOTAK_NEO_USERNAME,
        password: KOTAK_NEO_PASSWORD,
      };

      const response = await this.callApi("POST", "/oauth2/token", body, {
        ...authHeader("Basic", consumerAuthToken),
        baseUrl: KOTAK_NEO_NAPI_URL,
      });

      return response.access_token;
    },
    EIGHT_HOURS_IN_SECONDS
  );

  // this.generateAccessToken = async () => {
  //   const consumerAuthToken = CryptoJS.enc.Base64.stringify(
  //     `${KOTAK_NEO_CONSUMER_KEY}:${KOTAK_NEO_CONSUMER_SECRET}`
  //   );

  //   const body = {
  //     grant_type: "password",
  //     username: KOTAK_NEO_USERNAME,
  //     password: KOTAK_NEO_PASSWORD,
  //   };

  //   const response = await this.callApi("POST", "/oauth2/token", body, {
  //     ...authHeader("Basic", consumerAuthToken),
  //     baseUrl: KOTAK_NEO_NAPI_URL,
  //   });

  //   return response.access_token;
  // };

  // this.generateAccessToken().then((accessToken) => {
  //   this.accessToken = accessToken;
  // });

  this.generateViewToken = async (accessToken) => {
    const body = {
      mobileNumber: this.mobileNumber,
      password: this.password,
    };

    const { data } = await this.callApi(
      "POST",
      "/login/1.0/login/v2/validate",
      body,
      authHeader("Bearer", accessToken)
    );

    return data && data.token;
  };

  this.generateOtp = (token) => {
    this.callApi("POST", "/login/1.0/login/otp/generate", {
      userId: getUserId(token),
      sendEmail: false,
      isWhitelisted: true,
    });
  };

  this.getSessionToken = (sid, viewToken, accessToken, userId, otp) => {
    const body = { userId, otp };
    const options = {
      headers: {
        sid,
        Auth: viewToken,
        Authorization: accessToken,
      },
    };

    this.callApi("POST", "/login/1.0/login/v2/validate", body, options);
  };

  const getUserId = (accessToken) => {
    const data = JWT.verify(accessToken);
    return data.sub;
  };

  const authHeader = (type, token) => ({
    headers: { Authorization: `${type} ${token}` },
  });
}

module.exports = KotakNeo;

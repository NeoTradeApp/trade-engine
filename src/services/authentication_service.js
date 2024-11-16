const JWT = require("jsonwebtoken");
const crypto = require("crypto");
const moment = require("moment");
const CryptoJS = require("crypto-js");

const {
  SIGN_AUTH_TOKEN_SECRET,
  AUTH_PAYLOAD_ENCRYPTION_SECRET,
  AUTH_TOKEN_EXPIRES_IN_MINUTES,
} = process.env;

function AuthenticationService() {
  this.signToken = (payload) => {
    const nonce = crypto.randomBytes(16).toString("base64");
    const expires = moment().add(
      AUTH_TOKEN_EXPIRES_IN_MINUTES || "600",
      "minutes"
    );

    const jwtPayload = {
      nonce,
      sub: encryptPayload(payload),
      iat: new Date().getTime(),
      exp: expires.unix(),
      type: "ACCESS",
    };

    const token = JWT.sign(jwtPayload, SIGN_AUTH_TOKEN_SECRET);
    return token;
  };

  const encryptPayload = (payload) =>
    CryptoJS.AES.encrypt(
      JSON.stringify(payload),
      AUTH_PAYLOAD_ENCRYPTION_SECRET
    ).toString();

  this.verifyToken = (authToken) => {
    try {
      const decreptedToken = JWT.verify(authToken, SIGN_AUTH_TOKEN_SECRET);
      return decreptPayload(decreptedToken.sub);
    } catch (error) {
      throw {
        status: 401,
        expiredAt: error.expiredAt,
        message: "Invalid JWT token or the token is expired",
      };
    }
  };

  const decreptPayload = (ecryptedPayload) => {
    const bytes = CryptoJS.AES.decrypt(
      ecryptedPayload,
      AUTH_PAYLOAD_ENCRYPTION_SECRET
    );

    const payload = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(payload);
  };
}

module.exports = new AuthenticationService();

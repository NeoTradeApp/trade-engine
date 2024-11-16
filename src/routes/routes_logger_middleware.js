const express = require("express");
const { logger } = require("winston");

const router = express.Router();

const blockedKeys = [
  "auth",
  "token",
  "password",
  "code",
  "authorization",
  "key",
  "secret",
  "cookie",
].map(
  (blockedKey) =>
    new RegExp(`\\"([^\\"]*${blockedKey}[^\\"]*)\\":\\"[^\\"]*\\"`, "ig")
);

const filterParams = (params) => {
  let filteredParams = JSON.stringify(params);

  blockedKeys.forEach((blockedKey) => {
    filteredParams = filteredParams.replace(blockedKey, '"$1":"***"');
  });

  return filteredParams;
};

router.use((req, res, next) => {
  const formattedParams = ["query", "params", "headers", "body"]
    .filter((key) => req[key])
    .map((key) => `${key}: ${filterParams(req[key])}`)
    .join(" | ");

  logger.request(`${req.method} ${req.path} | ${formattedParams}`);

  next();
});

module.exports = { routesLoggerMiddleware: router }

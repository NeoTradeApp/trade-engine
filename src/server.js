const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { logger } = require("winston");

const Database = require("@database");
const { redisCache } = require("@services/redis");
const { PORT = 4000, FRONTEND_HOST_URL } = process.env;

function Server() {
  const database = new Database();
  this.app = express();

  this.start = async () => {
    await database.connect();
    await redisCache.connect();
    await this.config();

    this.server = this.app.listen(PORT, (error) => {
      if (error) {
        logger.error("Error in starting the server", error);
      } else {
        logger.info("Listening on port:", PORT);
      }
    });
  };

  this.stop = async () => {
    database.disconnect();
    await redisCache.disconnect();
    return this.server && this.server.close();
  };

  const configAppRoutes = () => {
    const AppRoutes = require("@routes");
    const appRoutes = new AppRoutes(this.app);
    appRoutes.config();
  }

  this.config = async () => {
    this.app.use(cookieParser());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());
    this.app.use(cors({ origin: FRONTEND_HOST_URL, credentials: true }));

    configAppRoutes();
  };
}

module.exports = Server;

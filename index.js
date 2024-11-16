require('module-alias/register')

const dotEnv = require('dotenv');
dotEnv.config();

const { logger } = require('@config/logger');
logger.config();

const Server = require('./src/server');
const server = new Server();
server.start();

const handleUncaughtException = () => {
  const { logger } = require('winston');
  ['exit', 'SIGTERM', 'SIGINT', 'uncaughtException'].forEach((event) =>
    process.on(event, (error) => {
      logger.error(`Gracefully shutting down the server. [${event}]`, error);
      server.stop();
    }));
};

handleUncaughtException();

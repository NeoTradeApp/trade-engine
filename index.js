require("module-alias/register");

const dotEnv = require("dotenv");
dotEnv.config();

const { logger } = require("@config/logger");
logger.config();

const App = require("./src/app");
const app = new App();
app.start();

const handleUncaughtException = () => {
  const { logger } = require("winston");
  ["exit", "SIGTERM", "SIGINT", "uncaughtException"].forEach((event) =>
    process.on(event, (error) => {
      logger.error(`Gracefully shutting down the engine. [${event}]`, error);
      app.stop();
      process.exit(1);
    })
  );
};

handleUncaughtException();

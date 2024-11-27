const util = require("util");
const winston = require("winston");
const { combine, timestamp, printf, colorize } = winston.format;
const { APPLICATION_NAME } = process.env;

function Logger() {
  const transports = [
    new winston.transports.File({
      filename: `./logs/${APPLICATION_NAME}-error.log`,
      level: "error",
    }),
    new winston.transports.File({ filename: `./logs/${APPLICATION_NAME}.log` }),
    new winston.transports.Console(),
  ];

  const utilFormatter = {
    transform: (info) => {
      const args = info[Symbol.for("splat")];
      if (args) {
        info.message = util.format(info.message, ...args);
      }
      return info;
    },
  };

  const format = combine(
    colorize(),
    timestamp(),
    utilFormatter,
    printf(({ level, message, timestamp }) => {
      return `[${level}]: ${timestamp} => ${message}\n`;
    })
  );

  this.config = () => {
    winston.addColors({
      sql: "blue",
      warning: "yellow",
      request: "green",
      socket: "green",
    });

    winston.logger = winston.createLogger({
      levels: {
        ...winston.config.syslog.levels,
        request: 5,
        sql: 6,
        socket: 6,
      },
      format,
      transports,
    });
  };
}

module.exports = { logger: new Logger() };

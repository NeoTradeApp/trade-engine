const { Sequelize, QueryTypes } = require("sequelize");
const { logger } = require("winston");
const { schema } = require("@database/schemas");

const { DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_NAME } =
  process.env;

function Database() {
  this.connection = new Sequelize(
    DATABASE_NAME,
    DATABASE_USERNAME,
    DATABASE_PASSWORD,
    {
      host: DATABASE_HOST,
      dialect: "postgres",
      dialectOptions: {
        useUTC: false, // for reading from database
      },
      timezone: "+05:30",
      logging: (sqlQuery) => logger.sql(sqlQuery),
      // operationsAliases: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );

  this.connect = async () => {
    try {
      await this.connection.authenticate();
      logger.info("Connected to the database");

      schema.config(this.connection);
      await this.sync();

      return this.connection;
    } catch (error) {
      logger.error("Unable to connect to the database", error);
      throw error;
    }
  };

  this.disconnect = () => {
    logger.info("Disconnecting database");
    return this.connection && this.connection.close();
  };

  this.executeQuery = async (rawQuery) => {
    if (this.connection) {
      return await this.connection.query(rawQuery, { type: QueryTypes.SELECT });
    }

    logget.warning("Database is not connected");
  };

  this.sync = async () => {
    await this.connection.sync();
    logger.info("Database tables synced successfully!");
  };
}

module.exports = Database;

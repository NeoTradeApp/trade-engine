const { Sequelize, QueryTypes } = require("sequelize");
const { logger } = require("winston");
const { Model } = require("@models");

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
      this.configModels();

      await this.connection.authenticate();
      logger.info("Connected to the database");

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

  this.configModels = () => {
    const models = new Model(this.connection, Sequelize);
    models.config();
  };

  this.executeQuery = async (rawQuery) => {
    if (this.connection) {
      return await this.connection.query(rawQuery, { type: QueryTypes.SELECT });
    }

    logger.warning("Database is not connected");
  };
}

module.exports = Database;

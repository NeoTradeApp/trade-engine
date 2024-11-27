"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Order.init(
    {
      scrip: DataTypes.STRING,
      tnxType: DataTypes.ENUM("buy", "sell"),
      productType: DataTypes.ENUM("MIS", "NRML"),
      orderType: DataTypes.ENUM("Limit", "Market", "SL-LMT", "SL-MKT"),
      status: DataTypes.ENUM("pending", "completed", "cancelled"),
      price: DataTypes.INTEGER,
      userId: DataTypes.INTEGER,
      providerUserId: DataTypes.STRING,
      providerName: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Order",
    }
  );

  return Order;
};

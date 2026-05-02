// models/strategy.js
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Strategy extends Model {
    static associate(models) {
      Strategy.hasMany(models.Position, {
        foreignKey: "strategyId",
      });
    }
  }

  Strategy.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      strategyId: {
        type: DataTypes.STRING,
        unique: true,
      },
      strategyName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      }
    },
    {
      sequelize,
      modelName: "Strategy", // → strategies
      underscored: true,
      timestamps: true,
    }
  );

  return Strategy;
};

// models/position.js
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Position extends Model {
    static associate(models) {
      Position.belongsTo(models.Strategy, {
        foreignKey: "strategyId",
      });

      Position.hasMany(models.Order, {
        foreignKey: "positionId",
      });
    }
  }

  Position.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },

      strategyId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      pnl: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      netPnl: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      status: {
        type: DataTypes.ENUM("ACTIVE", "CLOSED", "CANCELLED"),
      },

      name: DataTypes.STRING,
      description: DataTypes.STRING,

      entryPrice: DataTypes.DECIMAL(12, 2),
      exitPrice: DataTypes.DECIMAL(12, 2),

      entryTime: DataTypes.DATE,
      exitTime: DataTypes.DATE,

      target: DataTypes.DECIMAL(12, 2),
      stoploss: DataTypes.DECIMAL(12, 2),
      trailingStoploss: DataTypes.DECIMAL(12, 2),
      trailStoplossAt: DataTypes.DECIMAL(12, 2),
    },
    {
      sequelize,
      modelName: "Position", // → positions
      underscored: true,
      timestamps: true,
    }
  );

  return Position;
};

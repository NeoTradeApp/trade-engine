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

      status: {
        type: DataTypes.ENUM("ACTIVE", "CLOSED", "CANCELLED"),
      },

      name: DataTypes.STRING,
      description: DataTypes.STRING,

      entry_price: DataTypes.DECIMAL(12, 2),
      exit_price: DataTypes.DECIMAL(12, 2),

      entry_time: DataTypes.DATE,
      exit_time: DataTypes.DATE,

      target: DataTypes.DECIMAL(12, 2),
      stoploss: DataTypes.DECIMAL(12, 2),
      trailing_stoploss: DataTypes.DECIMAL(12, 2),
      trail_stoploss_at: DataTypes.DECIMAL(12, 2),
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

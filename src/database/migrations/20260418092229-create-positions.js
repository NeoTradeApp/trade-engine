'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("positions", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      strategy_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "strategies",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      pnl: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },

      net_pnl: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },

      status: {
        type: Sequelize.ENUM("ACTIVE", "CLOSED", "CANCELLED"),
      },

      name: Sequelize.STRING,
      description: Sequelize.STRING,

      entry_price: Sequelize.DECIMAL(12, 2),
      exit_price: Sequelize.DECIMAL(12, 2),

      entry_time: Sequelize.DATE,
      exit_time: Sequelize.DATE,

      target: Sequelize.DECIMAL(12, 2),
      stoploss: Sequelize.DECIMAL(12, 2),
      trailing_stoploss: Sequelize.DECIMAL(12, 2),
      trail_stoploss_at: Sequelize.DECIMAL(12, 2),

      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("positions");
  }
};

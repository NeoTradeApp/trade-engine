'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("orders", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      parent_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      position_id: {
        type: Sequelize.UUID,
        references: {
          model: "positions",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      order_id: {
        type: Sequelize.STRING,
      },
      user_id: {
        type: Sequelize.STRING,
      },

      tnx_type: Sequelize.ENUM("BUY", "SELL"),
      product_type: Sequelize.ENUM("MIS", "NRML"),
      order_type: Sequelize.ENUM("LIMIT", "MARKET", "SL-LMT", "SL-MKT"),
      status: Sequelize.ENUM(
        "OPEN",
        "FILLED",
        "PARTIAL",
        "CANCELLED",
        "REJECTED"
      ),

      remarks: Sequelize.STRING,

      name: Sequelize.STRING,
      symbol: Sequelize.STRING,

      type: Sequelize.STRING, // STOCK / INDEX / CE / PE
      scrip: Sequelize.STRING,
      exchange: Sequelize.STRING,

      quantity: Sequelize.INTEGER,
      filled_quantity: Sequelize.INTEGER,

      price: Sequelize.DECIMAL(12, 2),
      brokerage: Sequelize.DECIMAL(12, 2),
      taxes: Sequelize.DECIMAL(12, 2),

      service_provider_user_id: Sequelize.STRING,
      service_provider_name: Sequelize.STRING,

      remarks: Sequelize.STRING,

      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("orders");
  }
};

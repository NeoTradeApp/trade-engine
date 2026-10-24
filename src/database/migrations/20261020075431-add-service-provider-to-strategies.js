'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'strategies', // Target table name (make sure it matches your DB table casing, usually plural)
      'service_provider', // Name of the new column
      {
        type: Sequelize.STRING,   // Data type
        allowNull: true,          // Highly recommended for existing tables to prevent errors on historical rows
        defaultValue: "paper_trade" // Optional: populates existing rows with this value automatically
      }
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('strategies', 'service_provider');
  }
};

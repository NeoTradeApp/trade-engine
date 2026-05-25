// migrations/xxxx-create-strategies.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("strategies", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      strategy_id: {
        type: Sequelize.STRING,
        unique: true,
      },
      strategy_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.STRING,
      },
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("strategies");
  },
};

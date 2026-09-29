'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert("strategies", [{
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: "3574a958-d889-48f1-8546-8bfba7ca7b83",
      strategy_name: "LONG_SHORT_SYNTHETIC_FUTURES"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: "4b9230b2-1660-4a1b-8ba6-1545b9f70744",
      strategy_name: "OPTION_BUY_SCALPING"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: "8546a357-d889-d889-8546-8bfba7ca7b83",
      strategy_name: "LONG_SHORT_SYNTHETIC_FUTURES_50_200"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: Sequelize.literal("gen_random_uuid()"),
      strategy_name: "OPTION_BUY_SCALPING_15_15"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: Sequelize.literal("gen_random_uuid()"),
      strategy_name: "LONG_SHORT_SYNTHETIC_FUTURES_15_MIN"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: Sequelize.literal("gen_random_uuid()"),
      strategy_name: "LONG_SHORT_SYNTHETIC_FUTURES_7_21"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: Sequelize.literal("gen_random_uuid()"),
      strategy_name: "OPTION_SELL_SCALPING"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: Sequelize.literal("gen_random_uuid()"),
      strategy_name: "OPTION_SELL_SCALPING_1_3"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: Sequelize.literal("gen_random_uuid()"),
      strategy_name: "OPTION_SELL_STRADDLE"
    }, {
      id: Sequelize.literal("gen_random_uuid()"),
      user_id: "02869ff3-53cc-4ab5-bd17-ee9939b0fa36",
      strategy_id: Sequelize.literal("gen_random_uuid()"),
      strategy_name: "OPTION_SELL_SCALPING_HFT"
    }], {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete("strategies", null, {});
  }
};

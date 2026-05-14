const { logger } = require("winston");
const { Strategy, Position, Order } = require("@models");
const { STRATEGY } = require("@constants");
const LongShortSyntheticFutures = require("./long_short_synthetic_futures");
const OptionBuyScalping = require("./option_buy_scalping");
const LongShortSyntheticFutures50200 = require("./long_short_synthetic_futures_50_200");

function UserStrategies(userId) {
  this.userId = userId;
  this.strategies = [];

  const strategiesMappings = {
    [STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES]: LongShortSyntheticFutures,
    [STRATEGY.OPTION_BUY_SCALPING]: OptionBuyScalping,
    [STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES_50_200]: LongShortSyntheticFutures50200,
  };

  this.deployAll = async () => {
    const strategies = await Strategy.findAll({
      where: { userId },
      include: [
        {
          model: Position,
          include: [Order],
        },
      ],
    });

    strategies.forEach((_) => {
      const strategyFromDB = _.toJSON();
      const StrategyClass = strategiesMappings[strategyFromDB?.strategyName];

      if (StrategyClass) {
        const strategy = new StrategyClass(strategyFromDB.id, this.userId);
        this.strategies.push(strategy);
        strategy.start();
      }
    });
  };

  this.stopAll = () => {
    this.strategies.forEach((strategy) => {
      strategy.stop();
    })
  };
}

module.exports = UserStrategies;

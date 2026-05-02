const { logger } = require("winston");
const { Strategy, Position, Order } = require("@models");
const { STRATEGY } = require("@constants");
const LongShortSyntheticFutures = require("./long_short_synthetic_futures");

function UserStrategies(userId) {
  this.userId = userId;
  this.strategies = [];

  const strategiesMappings = {
    [STRATEGY.LONG_SHORT_SYNTHETIC_FUTURES]: LongShortSyntheticFutures,
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

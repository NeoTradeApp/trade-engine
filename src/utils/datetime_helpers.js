const moment = require("moment");

const todayTimeIst = (time) => {
  const now = moment().utcOffset("+05:30");

  if (time) now.startOf("day").set(time);

  return now;
};

const marketOpeningTime = todayTimeIst({ hour: 9, minute: 14 });

const marketClosingTIme = todayTimeIst({ hour: 15, minute: 31 });

const isMarketOpen = () => {
  const now = todayTimeIst();

  return now.isBetween(marketOpeningTime, marketClosingTIme);
};

module.exports = {
  marketOpeningTime,
  marketClosingTIme,
  isMarketOpen,
};

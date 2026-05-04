const moment = require("moment");
const { MARKET_HOLIDAYS } = process.env;

const todayTimeIst = (time) => {
  const now = moment().utcOffset("+05:30");

  if (time) now.startOf("day").set(time);

  return now;
};

const marketOpeningTime = todayTimeIst({ hour: 9, minute: 0 });

const marketClosingTIme = todayTimeIst({ hour: 15, minute: 31 });

const isMarketOpen = () => {
  const now = todayTimeIst();

  if (MARKET_HOLIDAYS.split(",").some(holiday => moment(holiday).isSame(now, "day"))) return false;

  const day = now.day();
  const isWeekend = day === 0 || day === 6; // 0 = Sunday, 6 = Saturday

  return !isWeekend && now.isBetween(marketOpeningTime, marketClosingTIme);
};

const isCurrenTimeBefore = (time) => todayTimeIst().isBefore(todayTimeIst(time));
const isCurrenTimeAfter = (time) => todayTimeIst().isAfter(todayTimeIst(time));

const parseTimeToSeconds = (timeInStr) => {
  const multiplier = {
    "s": 1,
    "m": 60,
    "h": 3600,
    "d": 86400,
    "w": 604800,
  };
  const sum = (arr) => arr.reduce((s, n) => s + n, 0);

  const unitsWithValue = Array.from(timeInStr.matchAll(/(\d+)([A-Za-z])/g)) || [];

  const timeInSeconds = unitsWithValue.map((unitWithValue) => {
    const [, value, unit] = unitWithValue;
    return value && unit ? (parseFloat(value) * (multiplier[unit] || 1)) : 0;
  });

  return sum(timeInSeconds);
};

const weekDayIndexOf = (day) => {
  const weekDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return weekDays.indexOf(day.toLowerCase());
}

const getDateOfNext = (targetDay) => {
  const weekDayIndex = weekDayIndexOf(targetDay);

  const today = todayTimeIst();

  if (today.isoWeekday() > weekDayIndex) {
    today.add(1, "week");
  }

  return today.isoWeekday(weekDayIndex).format("YYYY-MM-DD");
};

const getMonthEndDateOf = (targetDay) => {
  const getLastDayOfMonth = (referenceDay, day) => {
    const weekDayIndex = weekDayIndexOf(day);
    const endOfMonth = referenceDay.endOf('month');

    while (endOfMonth.day() !== weekDayIndex) {
      endOfMonth.subtract(1, 'day');
    }

    return endOfMonth;
  };

  const today = todayTimeIst();
  let lastDayOfMonth = getLastDayOfMonth(today, targetDay);

  if (todayTimeIst().isAfter(lastDayOfMonth, "day")) {
    const nextMonth = todayTimeIst().add(1, "month");
    lastDayOfMonth = getLastDayOfMonth(nextMonth, targetDay);
  }

  return lastDayOfMonth.format("YYYY-MM-DD");
};

const setCallbackAtTime = (callback, time) => {
  const now = todayTimeIst();

  let target = todayTimeIst(time);

  // If target time already passed today
  if (target.isSameOrBefore(now)) {
    return;
  }

  const delay = target.diff(now);
  return setTimeout(() => callback(), delay);
};

module.exports = {
  todayTimeIst,
  isCurrenTimeBefore,
  isCurrenTimeAfter,
  parseTimeToSeconds,
  marketOpeningTime,
  marketClosingTIme,
  isMarketOpen,
  getDateOfNext,
  getMonthEndDateOf,
  setCallbackAtTime,
};

const { parseTimeToSeconds } = require("./datetime_helpers");

const debounce = (fn, delay) => {
  let timer = null;

  return (...args) => {
    timer && clearTimeout(timer);
    timer = setTimeout(() => fn(...args), parseTimeToSeconds(delay) * 1000);
  };
}

module.exports= { debounce };

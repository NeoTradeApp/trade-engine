const { parseTimeToSeconds } = require("./datetime_helpers");

const debounce = (fn, delay) => {
  let timer = null;

  return (...args) => {
    timer && clearTimeout(timer);
    timer = setTimeout(() => fn(...args), parseTimeToSeconds(delay) * 1000);
  };
};

const debounceWithBurst = (fn, delay) => {
  let timer;
  let lastCall = 0;
  let payload;

  return (payloadFn) => {
    timer && clearTimeout(timer);
    const now = Date.now();
    payload = payloadFn(payload);

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(payload);
      payload = null;
    } else {
      timer = setTimeout(() => {
        fn(payload);
        payload = null;
      }, delay);
    }
  };
};

const delay = (ms) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
};

module.exports = { debounce, debounceWithBurst, delay };

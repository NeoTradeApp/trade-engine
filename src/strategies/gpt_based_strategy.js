function ema(values, period) {
  const multiplier = 2 / (period + 1);
  const result = [];

  let emaValue = values[0];
  result.push(emaValue);

  for (let i = 1; i < values.length; i++) {
    emaValue =
      (values[i] - emaValue) * multiplier +
      emaValue;

    result.push(emaValue);
  }

  return result;
}

function rsi(closes, period = 14) {
  const result = Array(closes.length).fill(null);

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];

    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  result[period] =
    100 - 100 / (1 + avgGain / (avgLoss || 0.000001));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];

    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);

    avgGain =
      ((avgGain * (period - 1)) + gain) / period;

    avgLoss =
      ((avgLoss * (period - 1)) + loss) / period;

    const rs = avgGain / (avgLoss || 0.000001);

    result[i] = 100 - (100 / (1 + rs));
  }

  return result;
}

function atr(candles, period = 14) {
  const tr = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(
        candles[i].high - candles[i].low
      );
      continue;
    }

    const highLow =
      candles[i].high - candles[i].low;

    const highClose =
      Math.abs(
        candles[i].high -
        candles[i - 1].close
      );

    const lowClose =
      Math.abs(
        candles[i].low -
        candles[i - 1].close
      );

    tr.push(
      Math.max(
        highLow,
        highClose,
        lowClose
      )
    );
  }

  return ema(tr, period);
}

function calculateMarketState(candles) {
  const closes = candles.map(c => c.close);

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);

  const atr14 = atr(candles, 14);
  const rsi14 = rsi(closes, 14);

  const states = [];

  for (let i = 50; i < candles.length; i++) {

    const emaSlope =
      ema20[i] - ema20[i - 5];

    const upTrend =
      ema20[i] > ema50[i] &&
      emaSlope > 0;

    const downTrend =
      ema20[i] < ema50[i] &&
      emaSlope < 0;

    const distanceFromEMA =
      (closes[i] - ema20[i]) /
      (atr14[i] || 0.0001);

    const uptrendPullback =
      upTrend &&
      distanceFromEMA < -0.5 &&
      rsi14[i] > 40;

    const downtrendPullback =
      downTrend &&
      distanceFromEMA > 0.5 &&
      rsi14[i] < 60;

    const prevUptrendPullback =
      i > 0 &&
      states[i - 1]?.state ===
      "UPTREND_PULLBACK";

    const prevDowntrendPullback =
      i > 0 &&
      states[i - 1]?.state ===
      "DOWNTREND_PULLBACK";

    const uptrendResume =
      prevUptrendPullback &&
      closes[i] > ema20[i];

    const downtrendResume =
      prevDowntrendPullback &&
      closes[i] < ema20[i];

    const sideways =
      Math.abs(emaSlope) <
      atr14[i] * 0.05;

    let state = "SIDEWAYS";

    if (uptrendResume)
      state = "UPTREND_RESUME";
    else if (downtrendResume)
      state = "DOWNTREND_RESUME";
    else if (uptrendPullback)
      state = "UPTREND_PULLBACK";
    else if (downtrendPullback)
      state = "DOWNTREND_PULLBACK";
    else if (upTrend)
      state = "UPTREND";
    else if (downTrend)
      state = "DOWNTREND";
    else if (sideways)
      state = "SIDEWAYS";

    states.push({
      timestamp: candles[i].timestamp,
      close: closes[i],
      ema20: ema20[i],
      ema50: ema50[i],
      atr: atr14[i],
      rsi: rsi14[i],
      state
    });
  }

  return states;
}

const calculateCharges = (price, quantity, transactionType) => {
  const turnover = price * quantity;
  const type = transactionType.toUpperCase();

  if (!["BUY", "SELL"].includes(type)) {
    throw new Error("transactionType must be BUY or SELL");
  }

  // Rates
  const STT_SELL = 0.0015;       // 0.15%
  const NSE_TRANSACTION = 0.0003552; // 0.03552%
  const SEBI = 0.000001;         // ₹10 / crore
  const STAMP_DUTY_BUY = 0.00003; // 0.003%
  const GST = 0.18;

  // Charges applicable to this transaction
  const stt = type === "SELL"
    ? turnover * STT_SELL
    : 0;

  const transactionCharges =
    turnover * NSE_TRANSACTION;

  const sebiCharges =
    turnover * SEBI;

  const stampDuty = type === "BUY"
    ? turnover * STAMP_DUTY_BUY
    : 0;

  // No brokerage passed here, so GST is on transaction + SEBI charges
  const gst =
    (transactionCharges + sebiCharges) * GST;

  const totalCharges =
    stt +
    transactionCharges +
    sebiCharges +
    stampDuty +
    gst;

  return Number(totalCharges.toFixed(2));

  //   return {
  //     turnover,
  //     stt,
  //     transactionCharges,
  //     sebiCharges,
  //     stampDuty,
  //     gst,
  //     totalCharges
  //   };
};

const calculateBrokerage = () => 10;

module.exports = {
  calculateCharges,
  calculateBrokerage,
};

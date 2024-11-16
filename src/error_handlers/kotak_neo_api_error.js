class KotakNeoApiError extends Error {
  constructor(message, status, details) {
    super(message);

    Object.assign(this, {
      name: "KotakNeoApiError",
      message,
      status,
      details,
    });
  }
}

module.exports = KotakNeoApiError;

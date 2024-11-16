class ApplicationError extends Error {
  constructor(message, status, code, details) {
    super(message);

    Object.assign(this, {
      name: "ApplicationError",
      message,
      status,
      code,
      details,
    });
  }
}

module.exports = ApplicationError;

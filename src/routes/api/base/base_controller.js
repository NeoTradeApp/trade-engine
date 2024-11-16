const { logger } = require("winston");

function BaseController(req, res, next) {
  this.headers = req.headers;
  this.body = req.body;
  this.params = req.params;
  this.query = req.query;

  this.req = req;
  this.res = res;
  this.next = next;

  this.user = req.user;

  this.withTryCatch = (fn) => async () => {
    try {
      await fn();
    } catch (error) {
      this.errorHandler(error);
    }
  };

  this.permittedField = (params, ...fields) =>
    fields.reduce(
      (result, field) => ({ ...result, [field]: params[field] }),
      {}
    );

  this.sendResponse = (message, data = {}) =>
    this.res.status(200).send({
      message,
      data,
    });

  this.errorHandler = (error) => {
    // console.log("ERROR", Object.getOwnPropertyDescriptors(error));
    const { status = 500, message, ...others } = error;

    this.res.status(status).send({
      ...others,
      message, // it's not an enumerable property of Error
    });

    if (status >= 500) {
      logger.error(error);
    }
  };
}

const exportActions = (klass) => {
  klass.action =
    (action) =>
    (...args) =>
      new klass(...args)[action]();

  return klass;
};

module.exports = { BaseController, exportActions };

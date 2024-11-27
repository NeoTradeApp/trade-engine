const axios = require("axios");

function BaseService() {
  this.baseUrl = "";
  this.defaultHeaders = {};

  this.errorHandler = (error, errorDetails = {}) => {
    Object.assign(error, errorDetails);
    throw error;
  };

  // this.withErrorCatch =
  //   (fn) =>
  //   async (...args) => {
  //     try {
  //       return await fn(...args);
  //     } catch (error) {
  //       this.errorHandler(error);
  //     }
  //   };

  this.callApi = async (method, path, data, options = {}) => {
    try {
      const headers = { ...this.defaultHeaders, ...options.headers };
      const baseUrl = options.baseUrl || this.baseUrl;
      const config = {
        method,
        url: `${baseUrl}${path}`,
        headers,
        data,
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      this.errorHandler(error, { method, path });
    }
  };
}

module.exports = BaseService;

const express = require("express");

const BaseRoute = require("@api/base/base_routes");
const V1Routes = require("./v1");
const V2Routes = require("./v2");

function ApiRoutes() {
  BaseRoute.call(this, express.Router());

  this.config = () => {
    const v1Router = new V1Routes().config();

    this.use("/v2", new V2Routes().config())
      .use("/v1", v1Router)
      .use("/", v1Router);

    return this.router;
  };
}

module.exports = ApiRoutes;

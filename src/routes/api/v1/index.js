const express = require('express');

const BaseRoute = require("@api/base/base_routes");
const UsersRoutes = require("./users");

function V1Routes() {
  BaseRoute.call(this, express.Router());

  this.config = () => {
    this.use("/users", new UsersRoutes().config());

    return this.router;
  };
}

module.exports = V1Routes;

const express = require('express');
const AuthenticationMiddleware = require("@api/v1/middlewares/authentication")
const BaseRoute = require("@api/base/base_routes");
const UsersController = require("./users_controller");

function UsersRoutes() {
  BaseRoute.call(this, express.Router());

  this.useMiddleware = AuthenticationMiddleware;

  const parentConfig = this.config;
  this.config = () => {
    this.get("/profile", UsersController.action("profile"));

    return parentConfig();
  };
}

module.exports = UsersRoutes;

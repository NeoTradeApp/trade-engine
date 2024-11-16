const express = require("express");

const { routesLoggerMiddleware } = require("./routes_logger_middleware");
const { authRoutes } = require("./auth_routes");
const ApiRoutes = require("./api");

function AppRoutes(app) {
  this.app = app;
  this.router = express.Router();

  this.config = () => {
    this.router
      .use("/healthcheck", (req, res) =>
        res.status(200).send("Server is up and running")
      )
      .use(routesLoggerMiddleware)
      .use("/auth", authRoutes)
      .use("/api", new ApiRoutes(this.router).config());

    this.app.use("/", this.router);
  };
}

module.exports = AppRoutes;

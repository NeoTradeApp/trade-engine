const express = require("express");
const AuthenticationService = require("@services/authentication_service");
const { User } = require("@models");

const { FRONTEND_HOST_URL, AUTH_TOKEN_EXPIRES_IN_MINUTES } = process.env;

const router = express.Router();
const maxAge = 1000 * 60 * parseInt(AUTH_TOKEN_EXPIRES_IN_MINUTES || 600);
const cookiesOptions = { maxAge, httpOnly: true };

router
  .post("/login", (req, res) => {
    const { user_id } = req.body;
    const token = AuthenticationService.signToken({ user_id });
    res.cookie("auth-token", token, cookiesOptions);
    return res.send({ message: "Logged in successfully" });
  })
  .post("/logout", (req, res) => {
    req.logout(() => {});
    res.clearCookie("auth-token");
    return res.send({ message: "Logged out successfully" });
  });

module.exports = { authRoutes: router };

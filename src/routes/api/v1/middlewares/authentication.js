const AuthenticationService = require("@services/authentication_service");

const AuthenticationMiddleware = (req, res, next) => {
  try {
    const authToken = req.cookies["auth-token"];
    const user = AuthenticationService.verifyToken(authToken);
    req.user = user;
    req.employee = user;
    next();
  } catch (error) {
    res.status(401).send({
      name: "Authentication module",
      message: "Failed to authenticate user",
    });
  }
};

module.exports = AuthenticationMiddleware;

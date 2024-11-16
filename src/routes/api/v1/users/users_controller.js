const moment = require("moment");
const { BaseController, exportActions } = require("@api/base/base_controller");

function UsersController(...args) {
  BaseController.call(this, ...args);

  this.profile = this.withTryCatch(async () => {
    return this.sendResponse("Employee profile details", this.user);
  });
}

module.exports = exportActions(UsersController);

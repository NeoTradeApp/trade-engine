const { schema } = require("@database/schemas");
const { UserSchema } = schema;

class User extends UserSchema {
  // static associations() {
  // }
}

module.exports = User;

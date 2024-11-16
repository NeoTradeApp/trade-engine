const userSchema = require("./users");

function Schema() {
  this.config = (dbConnection) => {
    Object.assign(this, {
      UserSchema: userSchema(dbConnection),
    });
  };
}

const schema = new Schema();
module.exports = { schema };

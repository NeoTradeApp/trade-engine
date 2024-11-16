const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define("users", {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    encryptedPassword: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.STRING,
    },
    modifiedBy: {
      type: DataTypes.STRING,
    },
  });

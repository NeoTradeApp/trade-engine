"use strict";

const fs = require("fs");
const path = require("path");
const basename = path.basename(__filename);

const models = {};
function Model(sequelize, Sequelize) {
  this.config = () => {
    fs.readdirSync(__dirname)
      .filter((file) => {
        return (
          file.indexOf(".") !== 0 &&
          file !== basename &&
          file.slice(-3) === ".js" &&
          file.indexOf(".test.js") === -1
        );
      })
      .forEach((file) => {
        const model = require(path.join(__dirname, file))(
          sequelize,
          Sequelize.DataTypes
        );

        models[model.name] = model;
      });

    Object.keys(models).forEach((modelName) => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });
  };
}

module.exports = models;
module.exports.Model = Model;

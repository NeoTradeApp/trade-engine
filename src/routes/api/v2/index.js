const express = require("express");

const V1Routes = require("@api/v1");

function V2Routes() {
  V1Routes.call(this, express.Router());

  const v1Config = this.config;
  this.config = () => {
    /* changes in the new version of routes here */

    /* configure previous version routes */
    return v1Config();
  };
}

module.exports = V2Routes;

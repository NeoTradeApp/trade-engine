const fs = require("fs");

let lastHeartbeat = Date.now();

module.exports.beat = () => {
  lastHeartbeat = Date.now();

  fs.writeFileSync(
    "/tmp/trade-engine-health",
    lastHeartbeat.toString()
  );
};

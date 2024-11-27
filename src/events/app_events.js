const EventEmitter = require("events");

class AppEvents extends EventEmitter {
  onEvent(eventKey, fn) {
    this.on(eventKey, fn);

    return () => this.off(eventKey, fn);
  }
}

module.exports = { appEvents: new AppEvents() };

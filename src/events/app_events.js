const EventEmitter = require("events");

class AppEvents extends EventEmitter {
  onEvent(eventKey, fn) {
    this.on(eventKey, fn);

    return () => this.off(eventKey, fn);
  }
}

const appEvents = new AppEvents();

appEvents.setMaxListeners(100);

module.exports = { appEvents };

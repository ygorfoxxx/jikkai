const { EventEmitter } = require("events");

class StateCache extends EventEmitter {
  constructor() {
    super();
    this.state = {};
    this.updatedAt = "";
  }

  get() {
    return this.state || {};
  }

  set(nextState, meta = {}) {
    if (!nextState || typeof nextState !== "object") return this.get();
    const previous = this.state || {};
    this.state = nextState;
    this.updatedAt = meta.updatedAt || new Date().toISOString();
    this.emit("change", {
      state: this.state,
      previous,
      updatedAt: this.updatedAt,
      source: meta.source || "unknown",
      changedKeys: changedKeys(previous, this.state)
    });
    return this.state;
  }
}

function changedKeys(previous = {}, next = {}) {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
  return Array.from(keys).filter(key => previous?.[key] !== next?.[key]);
}

module.exports = { StateCache, changedKeys };

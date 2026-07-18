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
    this.state = protectCoreState(nextState, previous);
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

function hasUsableUsers(data) {
  return Array.isArray(data?.users) && data.users.some(user => user?.username && user.role !== "contratante");
}

function protectCoreState(next = {}, previous = {}) {
  if (hasUsableUsers(next)) return next;
  if (!hasUsableUsers(previous)) return next;
  return {
    ...next,
    users: Array.isArray(previous.users) ? previous.users : [],
    roles: Array.isArray(next.roles) && next.roles.length ? next.roles : (previous.roles || []),
    trios: Array.isArray(next.trios) && next.trios.length ? next.trios : (previous.trios || []),
    clas: Array.isArray(next.clas) && next.clas.length ? next.clas : (previous.clas || []),
    divisoes: Array.isArray(next.divisoes) && next.divisoes.length ? next.divisoes : (previous.divisoes || []),
    juramentados: Array.isArray(next.juramentados) && next.juramentados.length ? next.juramentados : (previous.juramentados || []),
  };
}

function changedKeys(previous = {}, next = {}) {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
  return Array.from(keys).filter(key => previous?.[key] !== next?.[key]);
}

module.exports = { StateCache, changedKeys };

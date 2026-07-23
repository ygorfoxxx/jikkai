const os = require("os");

class PresenceService {
  constructor({ supabase, broadcast }) {
    this.supabase = supabase;
    this.broadcast = typeof broadcast === "function" ? broadcast : () => {};
    this.channel = null;
    this.profile = null;
    this.subscribed = false;
    this.clientId = `${os.hostname()}-${process.pid}`;
    this.heartbeat = null;
  }

  start() {
    if (!this.supabase || this.channel) return;
    this.channel = this.supabase.channel("jikkai_app_presence", {
      config: { presence: { key: this.clientId } }
    });
    this.channel.on("presence", { event: "sync" }, () => this.broadcastPresence());
    this.channel.on("presence", { event: "join" }, () => this.broadcastPresence());
    this.channel.on("presence", { event: "leave" }, () => this.broadcastPresence());
    this.channel.subscribe(status => {
      this.subscribed = status === "SUBSCRIBED";
      if (this.subscribed && this.profile) {
        this.track(this.profile).then(() => this.broadcastPresence()).catch(() => this.broadcastPresence());
      } else {
        this.broadcastPresence();
      }
    });
    this.startHeartbeat();
  }

  async update(profile = {}) {
    const now = new Date().toISOString();
    const previous = this.profile || {};
    this.profile = {
      username: String(profile.username || "").trim(),
      codinome: profile.codinome || profile.displayName || profile.nomeRP || previous.codinome || "",
      role: profile.role || previous.role || "",
      section: profile.section || previous.section || "central",
      availability: profile.availability || previous.availability || "",
      location: Object.prototype.hasOwnProperty.call(profile, "location") ? this.normalizeLocation(profile.location) : previous.location || null,
      status: "online",
      appOpen: true,
      clientId: this.clientId,
      onlineAt: previous.onlineAt || profile.onlineAt || now,
      lastSeen: now,
      updatedAt: now
    };
    await this.track(this.profile);
    this.broadcastPresence();
    return this.list();
  }

  startHeartbeat() {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      if (!this.profile || !this.subscribed) return;
      this.profile = {
        ...this.profile,
        status: "online",
        appOpen: true,
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.track(this.profile).then(() => this.broadcastPresence()).catch(error => {
        console.error("JIKKAI presence heartbeat failed", error);
      });
    }, 20000);
    this.heartbeat.unref?.();
  }

  async track(profile) {
    if (!this.channel || !this.subscribed || !profile?.username) return;
    try {
      await this.channel.track(profile);
    } catch (error) {
      console.error("JIKKAI presence track failed", error);
    }
  }

  list() {
    if (!this.channel) return [];
    const state = this.channel.presenceState() || {};
    const byUsername = new Map();
    for (const item of Object.values(state).flat()) {
      const username = String(item?.username || "").trim();
      if (!username) continue;
      const next = {
        username,
        codinome: item.codinome || "",
        role: item.role || "",
        section: item.section || "",
        availability: item.availability || "",
        location: this.normalizeLocation(item.location),
        status: item.status || "online",
        appOpen: item.appOpen !== false,
        clientId: item.clientId || "",
        onlineAt: item.onlineAt || "",
        lastSeen: item.lastSeen || "",
        updatedAt: item.updatedAt || item.lastSeen || ""
      };
      const key = username.toLowerCase();
      const previous = byUsername.get(key);
      if (!previous || new Date(next.lastSeen || 0).getTime() >= new Date(previous.lastSeen || 0).getTime()) {
        byUsername.set(key, next);
      }
    }
    return Array.from(byUsername.values());
  }

  broadcastPresence() {
    this.broadcast("presence:changed", {
      users: this.list(),
      updatedAt: new Date().toISOString()
    });
  }

  normalizeLocation(location = null) {
    if (!location || typeof location !== "object") return null;
    const mapX = Number(location.mapX);
    const mapY = Number(location.mapY);
    const rawX = Number(location.rawX);
    const rawY = Number(location.rawY);
    const rawZ = Number(location.rawZ);
    const ageMs = Number(location.ageMs ?? 0);
    if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) return null;
    return {
      mapX: Math.max(0, Math.min(100, mapX)),
      mapY: Math.max(0, Math.min(100, mapY)),
      rawX: Number.isFinite(rawX) ? rawX : null,
      rawY: Number.isFinite(rawY) ? rawY : null,
      rawZ: Number.isFinite(rawZ) ? rawZ : null,
      source: String(location.source || "native").slice(0, 32),
      updatedAt: location.updatedAt || new Date().toISOString(),
      ageMs: Number.isFinite(ageMs) ? Math.max(0, ageMs) : 0
    };
  }

  async stop() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    if (!this.channel) return;
    try {
      await this.channel.untrack();
      await this.supabase.removeChannel(this.channel);
    } catch (error) {
      console.error("JIKKAI presence stop failed", error);
    } finally {
      this.channel = null;
      this.subscribed = false;
    }
  }
}

module.exports = { PresenceService };

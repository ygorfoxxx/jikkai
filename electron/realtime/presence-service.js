const os = require("os");

const REMOTE_PROFILE_TTL_MS = 15000;

class PresenceService {
  constructor({ supabase, broadcast }) {
    this.supabase = supabase;
    this.broadcast = typeof broadcast === "function" ? broadcast : () => {};
    this.channel = null;
    this.profile = null;
    this.subscribed = false;
    this.clientId = `${os.hostname()}-${process.pid}-${process.env.JIKKAI_DESKTOP_RUN_ID || Date.now().toString(36)}`;
    this.heartbeat = null;
    this.remoteProfiles = new Map();
  }

  start() {
    if (!this.supabase || this.channel) return;
    this.channel = this.supabase.channel("jikkai_app_presence", {
      config: {
        presence: { key: this.clientId },
        broadcast: { self: false, ack: false }
      }
    });
    this.channel.on("presence", { event: "sync" }, () => this.broadcastPresence());
    this.channel.on("presence", { event: "join" }, () => {
      this.broadcastProfile().catch(error => console.error("JIKKAI presence join broadcast failed", error));
      this.broadcastPresence();
    });
    this.channel.on("presence", { event: "leave" }, () => this.broadcastPresence());
    this.channel.on("broadcast", { event: "profile" }, message => this.receiveBroadcast(message?.payload));
    this.channel.subscribe(status => {
      this.subscribed = status === "SUBSCRIBED";
      if (this.subscribed && this.profile) {
        Promise.all([this.track(this.profile), this.broadcastProfile()])
          .then(() => this.broadcastPresence())
          .catch(() => this.broadcastPresence());
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
    await Promise.all([this.track(this.profile), this.broadcastProfile()]);
    this.broadcastPresence();
    return this.list();
  }

  startHeartbeat() {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      if (!this.profile || !this.subscribed) return;
      const now = new Date().toISOString();
      this.profile = {
        ...this.profile,
        status: "online",
        appOpen: true,
        lastSeen: now,
        updatedAt: now
      };
      Promise.all([this.track(this.profile), this.broadcastProfile()])
        .then(() => this.broadcastPresence())
        .catch(error => console.error("JIKKAI presence heartbeat failed", error));
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

  async broadcastProfile() {
    if (!this.channel || !this.subscribed || !this.profile?.username) return;
    const sentAt = new Date().toISOString();
    try {
      await this.channel.send({
        type: "broadcast",
        event: "profile",
        payload: { ...this.profile, sentAt }
      });
    } catch (error) {
      console.error("JIKKAI presence broadcast failed", error);
    }
  }

  receiveBroadcast(profile = {}) {
    const username = String(profile?.username || "").trim();
    const clientId = String(profile?.clientId || username).trim();
    if (!username || !clientId || clientId === this.clientId) return;
    const receivedAt = new Date().toISOString();
    this.remoteProfiles.set(clientId, {
      username,
      codinome: profile.codinome || profile.displayName || profile.nomeRP || "",
      role: profile.role || "",
      section: profile.section || "",
      availability: profile.availability || "",
      location: this.normalizeLocation(profile.location, receivedAt),
      status: profile.status || "online",
      appOpen: profile.appOpen !== false,
      clientId,
      onlineAt: profile.onlineAt || "",
      lastSeen: profile.lastSeen || profile.updatedAt || receivedAt,
      updatedAt: profile.updatedAt || profile.lastSeen || receivedAt,
      receivedAt,
      receivedAtMs: Date.now()
    });
    this.broadcastPresence();
  }

  list() {
    const now = new Date().toISOString();
    const state = this.channel?.presenceState?.() || {};
    const byUsername = new Map();
    for (const item of Object.values(state).flat()) {
      this.mergeUser(byUsername, this.normalizeProfile(item, now));
    }
    this.pruneRemoteProfiles();
    for (const item of this.remoteProfiles.values()) {
      this.mergeUser(byUsername, item);
    }
    return Array.from(byUsername.values()).map(({ receivedAtMs, ...user }) => user);
  }

  normalizeProfile(item = {}, receivedAt = new Date().toISOString()) {
    const username = String(item?.username || "").trim();
    if (!username) return null;
    return {
      username,
      codinome: item.codinome || "",
      role: item.role || "",
      section: item.section || "",
      availability: item.availability || "",
      location: this.normalizeLocation(item.location, receivedAt),
      status: item.status || "online",
      appOpen: item.appOpen !== false,
      clientId: item.clientId || "",
      onlineAt: item.onlineAt || "",
      lastSeen: item.lastSeen || "",
      updatedAt: item.updatedAt || item.lastSeen || "",
      receivedAt,
      receivedAtMs: Date.now()
    };
  }

  mergeUser(byUsername, next) {
    if (!next?.username) return;
    const key = next.username.toLowerCase();
    const nextTime = Number(next.receivedAtMs || new Date(next.receivedAt || next.lastSeen || next.updatedAt || 0).getTime());
    const previous = byUsername.get(key);
    const previousTime = Number(previous?.receivedAtMs || new Date(previous?.receivedAt || previous?.lastSeen || previous?.updatedAt || 0).getTime());
    if (!previous || nextTime >= previousTime) byUsername.set(key, next);
  }

  pruneRemoteProfiles() {
    const cutoff = Date.now() - REMOTE_PROFILE_TTL_MS;
    for (const [key, profile] of this.remoteProfiles.entries()) {
      if (Number(profile.receivedAtMs || 0) < cutoff) this.remoteProfiles.delete(key);
    }
  }

  broadcastPresence() {
    this.broadcast("presence:changed", {
      users: this.list(),
      updatedAt: new Date().toISOString()
    });
  }

  normalizeLocation(location = null, receivedAt = "") {
    if (!location || typeof location !== "object") return null;
    const mapX = Number(location.mapX);
    const mapY = Number(location.mapY);
    const rawX = Number(location.rawX);
    const rawY = Number(location.rawY);
    const rawZ = Number(location.rawZ);
    const ageMs = Number(location.ageMs ?? 0);
    if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) return null;
    const sourceUpdatedAt = location.sourceUpdatedAt || location.updatedAt || "";
    return {
      mapX: Math.max(0, Math.min(100, mapX)),
      mapY: Math.max(0, Math.min(100, mapY)),
      rawX: Number.isFinite(rawX) ? rawX : null,
      rawY: Number.isFinite(rawY) ? rawY : null,
      rawZ: Number.isFinite(rawZ) ? rawZ : null,
      source: String(location.source || "native").slice(0, 32),
      sourceUpdatedAt,
      updatedAt: receivedAt || sourceUpdatedAt || new Date().toISOString(),
      receivedAt: receivedAt || location.receivedAt || "",
      ageMs: Number.isFinite(ageMs) ? Math.max(0, ageMs) : 0
    };
  }

  async stop() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.remoteProfiles.clear();
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

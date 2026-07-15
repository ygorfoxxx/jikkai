const os = require("os");

class PresenceService {
  constructor({ supabase, broadcast }) {
    this.supabase = supabase;
    this.broadcast = typeof broadcast === "function" ? broadcast : () => {};
    this.channel = null;
    this.profile = null;
    this.subscribed = false;
    this.clientId = `${os.hostname()}-${process.pid}`;
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
      if (this.subscribed && this.profile) this.track(this.profile);
      this.broadcastPresence();
    });
  }

  async update(profile = {}) {
    this.profile = {
      username: String(profile.username || "").trim(),
      codinome: profile.codinome || profile.displayName || profile.nomeRP || "",
      role: profile.role || "",
      section: profile.section || "central",
      status: "online",
      clientId: this.clientId,
      onlineAt: profile.onlineAt || new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
    await this.track(this.profile);
    return this.list();
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
    return Object.values(state)
      .flat()
      .filter(item => item?.username)
      .map(item => ({
        username: item.username,
        codinome: item.codinome || "",
        role: item.role || "",
        section: item.section || "",
        status: item.status || "online",
        clientId: item.clientId || "",
        onlineAt: item.onlineAt || "",
        lastSeen: item.lastSeen || ""
      }));
  }

  broadcastPresence() {
    this.broadcast("presence:changed", {
      users: this.list(),
      updatedAt: new Date().toISOString()
    });
  }

  async stop() {
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

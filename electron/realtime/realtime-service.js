const { createClient } = require("@supabase/supabase-js");
const { StateCache } = require("./state-cache");
const { normalizeStateEvent } = require("./event-normalizer");
const { PresenceService } = require("./presence-service");
const { NotificationService } = require("./notification-service");

const SUPABASE_URL = "https://mhbbqtjsxruuuiqixlvc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYmJxdGpzeHJ1dXVpcWl4bHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NzA4NzMsImV4cCI6MjA5MTI0Njg3M30.LPSE8QZcNXfpcDlgu1vPcwW_gelG1UGb-hkLrCoXvXk";

class RealtimeService {
  constructor({ broadcast }) {
    this.broadcast = typeof broadcast === "function" ? broadcast : () => {};
    this.cache = new StateCache();
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    this.channel = null;
    this.started = false;
    this.presence = new PresenceService({ supabase: this.supabase, broadcast: this.broadcast });
    this.notifications = new NotificationService({ broadcast: this.broadcast });
    this.cache.on("change", change => {
      const event = normalizeStateEvent(change);
      this.broadcast("realtime:state", event);
      this.notifications.handle(event);
    });
  }

  async start() {
    if (this.started) return;
    this.started = true;
    await this.refresh("initial");
    this.subscribeState();
    this.presence.start();
  }

  async refresh(source = "refresh") {
    try {
      const { data, error } = await this.supabase
        .from("fox_state")
        .select("data,updated_at")
        .eq("id", 1)
        .single();
      if (error) throw error;
      if (data?.data) this.cache.set(data.data, { updatedAt: data.updated_at, source });
      return this.cache.get();
    } catch (error) {
      console.error("JIKKAI realtime refresh failed", error);
      return this.cache.get();
    }
  }

  subscribeState() {
    if (this.channel) return;
    this.channel = this.supabase.channel("jikkai_fox_state");
    this.channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "fox_state", filter: "id=eq.1" },
      payload => {
        const next = payload?.new?.data;
        if (next) this.cache.set(next, { updatedAt: payload.new.updated_at, source: "postgres_changes" });
      }
    );
    this.channel.subscribe(status => {
      this.broadcast("realtime:status", {
        status,
        updatedAt: new Date().toISOString()
      });
      if (status === "SUBSCRIBED") this.refresh("subscribed");
    });
  }

  getState() {
    return {
      data: this.cache.get(),
      updatedAt: this.cache.updatedAt,
      source: "cache"
    };
  }

  async updatePresence(profile) {
    return this.presence.update(profile);
  }

  getPresence() {
    return {
      users: this.presence.list(),
      updatedAt: new Date().toISOString()
    };
  }

  async stop() {
    await this.presence.stop();
    if (this.channel) {
      try {
        await this.supabase.removeChannel(this.channel);
      } catch (error) {
        console.error("JIKKAI realtime stop failed", error);
      } finally {
        this.channel = null;
      }
    }
    this.started = false;
  }
}

module.exports = { RealtimeService };

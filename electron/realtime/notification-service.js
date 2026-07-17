class NotificationService {
  constructor({ broadcast }) {
    this.broadcast = typeof broadcast === "function" ? broadcast : () => {};
    this.lastUrgentMeeting = "";
  }

  handle(event = {}) {
    if (!event?.data) return;
    if (!event.areas?.includes("mapa")) return;
    const meetings = Array.isArray(event.data.mapaReunioes) ? event.data.mapaReunioes : [];
    const now = Date.now();
    const active = meetings
      .filter(m => m?.status !== "cancelada" && Number.isFinite(Number(m.x)) && Number.isFinite(Number(m.y)))
      .filter(m => new Date(m.expiresAt).getTime() > now)
      .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0];
    if (!active || active.id === this.lastUrgentMeeting) return;
    this.lastUrgentMeeting = active.id;
    this.broadcast("realtime:alert", {
      type: "map.meeting",
      title: active.titulo || "Reuniao marcada no mapa",
      message: active.descricao || "Um ponto de encontro foi definido no mapa estrategico.",
      meeting: active,
      source: event.source || "realtime",
      createdAt: new Date().toISOString()
    });
  }
}

module.exports = { NotificationService };

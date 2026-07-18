class NotificationService {
  constructor({ broadcast, now = () => Date.now() } = {}) {
    this.broadcast = typeof broadcast === "function" ? broadcast : () => {};
    this.now = now;
    this.sent = new Map();
    this.cooldownMs = 12000;
  }

  emitOnce(key, payload) {
    const previous = this.sent.get(key) || 0;
    const current = this.now();
    if (previous && current - previous < this.cooldownMs) return false;
    this.sent.set(key, current);
    if (this.sent.size > 120) {
      for (const [entry, at] of this.sent) if (current - at > 120000) this.sent.delete(entry);
    }
    this.broadcast("realtime:alert", payload);
    return true;
  }

  activeMeeting(data) {
    return (Array.isArray(data?.mapaReunioes) ? data.mapaReunioes : [])
      .filter(meeting => meeting?.status !== "cancelada")
      .filter(meeting => Number.isFinite(Number(meeting.x)) && Number.isFinite(Number(meeting.y)))
      .filter(meeting => new Date(meeting.expiresAt).getTime() > this.now())
      .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0] || null;
  }

  handle(event = {}) {
    if (!event?.data || !Array.isArray(event.areas)) return;
    const data = event.data;
    const previous = event.previous || {};

    if (event.areas.includes("mapa")) {
      const meeting = this.activeMeeting(data);
      if (meeting) this.emitOnce(`meeting:${meeting.id}`, {
        type: "map.meeting",
        priority: "critical",
        title: meeting.titulo || "Reuniao marcada no mapa",
        message: meeting.descricao || "Um ponto de encontro foi definido no mapa estrategico.",
        meeting,
        source: event.source || "realtime",
        createdAt: new Date(this.now()).toISOString()
      });
    }

    if (event.areas.includes("missoes") && Object.keys(previous).length) {
      const oldIds = new Set((previous.missoes || []).map(mission => mission.id));
      const assigned = (data.missoes || []).find(mission => mission?.id && !oldIds.has(mission.id) && !["concluida", "cancelada", "arquivada"].includes(mission.status));
      if (assigned) this.emitOnce(`mission:${assigned.id}`, {
        type: "mission.assigned",
        priority: "critical",
        title: assigned.titulo || "Nova missao atribuida",
        message: assigned.desc || "Uma nova operacao aguarda sua atencao.",
        mission: assigned,
        source: event.source || "realtime",
        createdAt: new Date(this.now()).toISOString()
      });
    }

    if (event.areas.includes("operacional") || event.areas.includes("missoes")) {
      const timer = (data.fieldTimers || []).find(item => ["ativo", "pausado"].includes(item.status) && item.endsAt && new Date(item.endsAt).getTime() > this.now() && new Date(item.endsAt).getTime() - this.now() <= 60000);
      if (timer) this.emitOnce(`timer:${timer.id}:critical`, {
        type: "field.timer.critical",
        priority: "critical",
        title: timer.nome || "Cronometro terminando",
        message: "O cronometro entra na janela final.",
        timer,
        source: event.source || "realtime",
        createdAt: new Date(this.now()).toISOString()
      });
    }
  }
}

module.exports = { NotificationService };

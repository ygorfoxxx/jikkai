(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.JikkaiTraining = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MODALIDADES = ["1x1", "Equipes", "Taijutsu", "Kenjutsu", "Ninjutsu", "Defesa e esquiva", "Livre"];

  function createSession({ id, createdBy, participants = [], modalidade = "1x1", durationMinutes = 5, now = new Date() } = {}) {
    const createdAt = new Date(now).toISOString();
    const unique = Array.from(new Set(participants.filter(Boolean)));
    const scores = Object.fromEntries(unique.map(username => [username, 0]));
    return {
      id: id || `training_${Date.now().toString(36)}`,
      mode: "treino",
      modalidade: MODALIDADES.includes(modalidade) ? modalidade : "1x1",
      durationMinutes: Number.isFinite(Number(durationMinutes)) ? Math.max(0, Number(durationMinutes)) : 5,
      participants: unique,
      scores,
      round: 1,
      roundHistory: [],
      status: "ativo",
      createdBy: createdBy || "app",
      createdAt,
      startedAt: createdAt,
      elapsedSeconds: 0,
      eventTimeline: [{ type: "started", at: createdAt, by: createdBy || "app" }]
    };
  }

  function elapsedSeconds(session, now = Date.now()) {
    if (!session) return 0;
    const started = new Date(session.startedAt || session.createdAt || now).getTime();
    const base = Number(session.elapsedSeconds) || 0;
    if (!Number.isFinite(started) || session.status === "pausado" || session.status === "encerrado") return Math.max(0, Math.round(base));
    return Math.max(0, Math.round(base + Math.max(0, now - started) / 1000));
  }

  function remainingSeconds(session, now = Date.now()) {
    if (!session || Number(session.durationMinutes) <= 0) return 0;
    return Math.max(0, Number(session.durationMinutes) * 60 - elapsedSeconds(session, now));
  }

  function formatSeconds(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function addPoint(session, username, amount = 1) {
    return { ...session, scores: { ...(session.scores || {}), [username]: Math.max(0, Number(session.scores?.[username] || 0) + amount) } };
  }

  function pause(session, now = new Date()) {
    if (!session || session.status !== "ativo") return session;
    const at = new Date(now).toISOString();
    return { ...session, status: "pausado", elapsedSeconds: elapsedSeconds(session, new Date(now).getTime()), pausedAt: at, eventTimeline: [...(session.eventTimeline || []), { type: "paused", at }] };
  }

  function resume(session, now = new Date()) {
    if (!session || session.status !== "pausado") return session;
    const at = new Date(now).toISOString();
    return { ...session, status: "ativo", startedAt: at, pausedAt: null, eventTimeline: [...(session.eventTimeline || []), { type: "resumed", at }] };
  }

  function nextRound(session, now = new Date()) {
    const at = new Date(now).toISOString();
    return { ...session, round: Math.max(1, Number(session.round) || 1) + 1, roundHistory: [...(session.roundHistory || []), { round: session.round, scores: { ...(session.scores || {}) }, at }], eventTimeline: [...(session.eventTimeline || []), { type: "round", round: Number(session.round) + 1, at }] };
  }

  return { MODALIDADES, createSession, elapsedSeconds, remainingSeconds, formatSeconds, addPoint, pause, resume, nextRound };
});

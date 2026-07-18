const test = require("node:test");
const assert = require("node:assert/strict");

const field = require("../assets/js/field-state.js");
const timers = require("../assets/js/rule-timer-presets.js");
const training = require("../assets/js/training.js");
const reports = require("../assets/js/auto-report.js");
const actions = require("../assets/js/quick-actions.js");
const { NotificationService } = require("../electron/realtime/notification-service.js");

const NOW = new Date("2026-07-17T12:00:00.000Z");

test("normalizes legacy state without removing existing data", () => {
  const legacy = { users: [{ username: "viper" }], missoes: [{ id: "old", titulo: "Legacy", status: "andamento" }], mapaReunioes: [{ id: "meeting" }] };
  const normalized = field.normalizeState(legacy);
  assert.equal(normalized.users[0].username, "viper");
  assert.equal(normalized.missoes[0].titulo, "Legacy");
  assert.equal(normalized.missoes[0].fieldMode, false);
  assert.deepEqual(normalized.trainingSessions, []);
  assert.deepEqual(normalized.quickSignals, []);
  assert.equal(normalized.mapaReunioes[0].id, "meeting");
});

test("creates a mission from a preset with default objectives", () => {
  const mission = field.createMissionFromPreset({ presetId: "vigilancia", target: "ghost", assignedBy: "leader", now: NOW, id: "mission-1" });
  assert.equal(mission.id, "mission-1");
  assert.equal(mission.titulo, "Operação de Vigilância");
  assert.equal(mission.fieldMode, true);
  assert.equal(mission.objetivos.length, 3);
  assert.equal(mission.phase, "Preparação");
});

test("advances phases and records objective complete/undo", () => {
  let mission = field.createMissionFromPreset({ presetId: "busca", target: "ghost", now: NOW, id: "mission-2" });
  mission = field.toggleObjective(mission, 0, { by: "ghost", now: NOW });
  assert.equal(mission.objetivos[0].done, true);
  assert.equal(mission.eventTimeline.at(-1).type, "objective_completed");
  mission = field.toggleObjective(mission, 0, { by: "ghost", now: NOW });
  assert.equal(mission.objetivos[0].done, false);
  assert.equal(mission.eventTimeline.at(-1).type, "objective_reopened");
  mission = field.advanceMissionPhase(mission, { by: "leader", now: NOW });
  assert.equal(mission.phase, "Reunindo");
  mission = field.finishMission(mission, { by: "leader", now: NOW });
  assert.equal(mission.status, "concluida");
  assert.equal(mission.phase, "Encerrada");
});

test("timers respect presets and can be chained", () => {
  const timer = timers.createTimer({ presetId: "perseguicao", now: NOW, id: "timer-1" });
  assert.equal(timer.durationMinutes, 5);
  assert.equal(timers.remainingSeconds(timer, NOW), 300);
  const next = timers.chainNext(timer, { now: new Date(NOW.getTime() + 300000), id: "timer-2" });
  assert.equal(next.presetId, "retirada");
  assert.equal(next.durationMinutes, 2);
  assert.equal(timers.formatSeconds(125), "02:05");
});

test("unlimited training keeps a growing clock and manual score", () => {
  let session = training.createSession({ createdBy: "leader", participants: ["viper", "ghost"], modalidade: "1x1", durationMinutes: 0, now: NOW, id: "training-1" });
  assert.equal(session.durationMinutes, 0);
  assert.equal(training.remainingSeconds(session, new Date(NOW.getTime() + 60000)), 0);
  session = training.addPoint(session, "viper");
  assert.equal(session.scores.viper, 1);
  session = training.nextRound(session, NOW);
  assert.equal(session.round, 2);
  const revanche = training.createSession({ createdBy: "leader", participants: session.participants, modalidade: session.modalidade, durationMinutes: 5, now: NOW, id: "training-2" });
  assert.deepEqual(revanche.scores, { viper: 0, ghost: 0 });
});

test("automatic reports accept optional notes and name maps", () => {
  const mission = field.createMissionFromPreset({ presetId: "reuniao", target: "team:alpha", now: NOW, id: "mission-report" });
  const report = reports.buildMissionReport({ ...mission, startedAt: NOW.toISOString() }, "viper", NOW);
  assert.equal(report.status, "rascunho");
  assert.match(report.conteudo, /Objetivos: 0\/3/);
  const trainingReport = reports.buildTrainingReport({ id: "training-report", modalidade: "1x1", participants: ["viper"], scores: { viper: 2 }, elapsedSeconds: 120 }, { viper: "VIPER" }, "leader", NOW);
  assert.match(trainingReport.conteudo, /VIPER: 2/);
});

test("quick actions and /eu templates never send game commands", () => {
  const signal = actions.createSignal({ actionId: "ciente", username: "viper", mode: "rp", now: NOW, id: "signal-1" });
  assert.equal(signal.visibility, "pessoal");
  assert.match(actions.getTemplate("observar")?.text || "", /^\/eu/);
});

test("operational notifications are deduplicated", () => {
  let now = 1000;
  const events = [];
  const service = new NotificationService({ broadcast: (_channel, payload) => events.push(payload), now: () => now });
  const meeting = { id: "meeting-alert", x: 20, y: 30, expiresAt: new Date(now + 600000).toISOString(), titulo: "Reuniao" };
  const event = { areas: ["mapa"], data: { mapaReunioes: [meeting] }, previous: {}, source: "test" };
  service.handle(event);
  service.handle(event);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "map.meeting");
  now += 13000;
  service.handle(event);
  assert.equal(events.length, 2);
});

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.JikkaiFieldState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PHASES = ["Preparação", "Reunindo", "Em deslocamento", "Posicionados", "Em ação", "Retirada", "Debriefing", "Encerrada"];
  const MISSION_PRESETS = [
    { id: "vigilancia", nome: "Vigilância", titulo: "Operação de Vigilância", desc: "Observar a área sem exposição e retornar com informação útil.", objetivos: ["Chegar à região definida", "Observar sem exposição", "Retornar ou registrar conclusão"] },
    { id: "recrutamento", nome: "Recrutamento", titulo: "Operação de Recrutamento", desc: "Identificar, abordar e registrar um possível contato para a Jikkai.", objetivos: ["Chegar ao ponto de contato", "Conduzir a abordagem", "Retornar com o resultado"] },
    { id: "confianca", nome: "Missão de confiança", titulo: "Missão de Confiança", desc: "Operação curta para avaliar disciplina, comunicação e retorno.", objetivos: ["Receber a orientação", "Executar sem exposição", "Apresentar o retorno"] },
    { id: "mineracao", nome: "Mineração", titulo: "Operação de Mineração", desc: "Coletar o recurso indicado e retornar ao ponto seguro.", objetivos: ["Chegar à área de mineração", "Coletar o recurso", "Retornar com o material"] },
    { id: "escolta", nome: "Escolta", titulo: "Operação de Escolta", desc: "Conduzir o alvo ou contato até o destino combinado.", objetivos: ["Encontrar o escoltado", "Manter a rota segura", "Confirmar a chegada"] },
    { id: "reuniao", nome: "Reunião", titulo: "Reunião Operacional", desc: "Reunir os participantes no ponto indicado e alinhar a operação.", objetivos: ["Chegar ao ponto de encontro", "Confirmar os participantes", "Registrar o alinhamento"] },
    { id: "investigacao", nome: "Investigação", titulo: "Operação de Investigação", desc: "Coletar indícios sem presumir identidade ou conclusão.", objetivos: ["Definir a área de observação", "Registrar indícios", "Retornar sem exposição"] },
    { id: "busca", nome: "Busca", titulo: "Operação de Busca", desc: "Localizar o ponto ou item indicado e informar o resultado.", objetivos: ["Chegar à região definida", "Verificar os pontos relevantes", "Comunicar o resultado"] },
    { id: "treino", nome: "Treino", titulo: "Treino Operacional", desc: "Treinar comunicação, deslocamento e execução em equipe.", objetivos: ["Reunir a equipe", "Executar o exercício", "Registrar o debriefing"] },
    { id: "livre", nome: "Operação livre", titulo: "Operação de Campo", desc: "Operação criada pela liderança com detalhes complementares opcionais.", objetivos: ["Receber a orientação", "Executar o objetivo", "Retornar e registrar conclusão"] }
  ];

  function getMissionPreset(id) {
    return MISSION_PRESETS.find(preset => preset.id === id) || MISSION_PRESETS[MISSION_PRESETS.length - 1];
  }

  function normalizeMission(mission = {}) {
    const status = String(mission.status || "atribuida");
    const terminal = ["concluida", "falhou", "recusada", "arquivada", "cancelada", "encerrada"].includes(status);
    return {
      ...mission,
      fieldMode: Boolean(mission.fieldMode || mission.preset || mission.phase || mission.timerPreset),
      preset: mission.preset || "livre",
      phase: mission.phase || (terminal ? "Encerrada" : "Preparação"),
      startedAt: mission.startedAt || null,
      endedAt: mission.endedAt || null,
      timerPreset: mission.timerPreset || "",
      quickStatus: mission.quickStatus || "",
      eventTimeline: Array.isArray(mission.eventTimeline) ? mission.eventTimeline : [],
      autoReport: mission.autoReport !== false,
      rpSourceConfirmed: Boolean(mission.rpSourceConfirmed)
    };
  }

  function normalizeTraining(session = {}) {
    return {
      ...session,
      mode: session.mode || "treino",
      modalidade: session.modalidade || session.type || "1x1",
      durationMinutes: Number.isFinite(Number(session.durationMinutes)) ? Math.max(0, Number(session.durationMinutes)) : 5,
      participants: Array.from(new Set(Array.isArray(session.participants) ? session.participants.filter(Boolean) : [])),
      scores: { ...(session.scores || {}) },
      round: Math.max(1, Number(session.round) || 1),
      status: session.status || "ativo",
      elapsedSeconds: Number(session.elapsedSeconds) || 0,
      roundHistory: Array.isArray(session.roundHistory) ? session.roundHistory : [],
      eventTimeline: Array.isArray(session.eventTimeline) ? session.eventTimeline : []
    };
  }

  function normalizeState(data = {}) {
    const next = { ...data };
    next.missoes = (Array.isArray(data.missoes) ? data.missoes : []).map(normalizeMission);
    next.trainingSessions = (Array.isArray(data.trainingSessions) ? data.trainingSessions : []).map(normalizeTraining);
    next.quickSignals = Array.isArray(data.quickSignals) ? data.quickSignals : [];
    next.fieldTimers = Array.isArray(data.fieldTimers) ? data.fieldTimers : [];
    next.fieldEvents = Array.isArray(data.fieldEvents) ? data.fieldEvents : [];
    next.fieldMode = data.fieldMode === "training" ? "training" : "rp";
    next.rpQuickTemplates = Array.isArray(data.rpQuickTemplates) ? data.rpQuickTemplates : [];
    return next;
  }

  function createMissionFromPreset({ presetId = "livre", target, participants = [], assignedBy = "app", sigilo = "Restrito", now = new Date(), id } = {}) {
    const preset = getMissionPreset(presetId);
    const createdAt = new Date(now).toISOString();
    const people = Array.from(new Set([target, ...participants].filter(Boolean)));
    return normalizeMission({
      id: id || `mission_${Date.now().toString(36)}`,
      titulo: preset.titulo,
      desc: preset.desc,
      assignedTo: target,
      participants: people,
      aceites: [],
      assignedBy,
      createdAt,
      updatedAt: createdAt,
      objetivos: preset.objetivos.map(text => ({ text, done: false })),
      status: "atribuida",
      sigilo,
      source: "field_preset",
      assignmentLabel: `Preset ${preset.nome}`,
      fieldMode: true,
      preset: preset.id,
      phase: "Preparação",
      eventTimeline: [{ type: "created", at: createdAt, by: assignedBy }],
      autoReport: true
    });
  }

  function nextPhase(current) {
    const index = PHASES.indexOf(current);
    return PHASES[Math.min(PHASES.length - 1, Math.max(0, index < 0 ? 0 : index + 1))];
  }

  function toggleObjective(mission, index, { by = "app", now = new Date() } = {}) {
    const current = normalizeMission(mission);
    const objectives = current.objetivos.map((objective, objectiveIndex) => {
      if (objectiveIndex !== Number(index)) return { ...objective };
      return { ...objective, done: !Boolean(objective.done), completedAt: !objective.done ? new Date(now).toISOString() : null, completedBy: !objective.done ? by : "" };
    });
    const changed = objectives[Number(index)];
    const eventTimeline = changed?.done === true
      ? [...current.eventTimeline, { type: "objective_completed", index: Number(index), text: changed.text || "", at: new Date(now).toISOString(), by }]
      : [...current.eventTimeline, { type: "objective_reopened", index: Number(index), text: changed?.text || "", at: new Date(now).toISOString(), by }];
    return { ...current, objetivos: objectives, eventTimeline, updatedAt: new Date(now).toISOString() };
  }

  function advanceMissionPhase(mission, { by = "app", now = new Date() } = {}) {
    const current = normalizeMission(mission);
    const phase = nextPhase(current.phase);
    const at = new Date(now).toISOString();
    return { ...current, phase, startedAt: current.startedAt || at, eventTimeline: [...current.eventTimeline, { type: "phase", from: current.phase, to: phase, at, by }], updatedAt: at };
  }

  function finishMission(mission, { by = "app", now = new Date() } = {}) {
    const current = normalizeMission(mission);
    const at = new Date(now).toISOString();
    return { ...current, status: "concluida", phase: "Encerrada", endedAt: at, eventTimeline: [...current.eventTimeline, { type: "finished", at, by }], updatedAt: at };
  }

  return { PHASES, MISSION_PRESETS, getMissionPreset, normalizeMission, normalizeTraining, normalizeState, createMissionFromPreset, nextPhase, toggleObjective, advanceMissionPhase, finishMission };
});

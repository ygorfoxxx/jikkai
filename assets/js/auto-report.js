(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.JikkaiAutoReport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function timestamp(value) {
    return value ? new Date(value).toLocaleString("pt-BR") : "não registrado";
  }

  function buildMissionReport(mission = {}, author = "app", now = new Date()) {
    const objectives = Array.isArray(mission.objetivos) ? mission.objetivos : [];
    const done = objectives.filter(objective => objective.done).length;
    const timeline = Array.isArray(mission.eventTimeline) ? mission.eventTimeline : [];
    const lines = [
      `Operação: ${mission.titulo || "Operação de campo"}`,
      `Preset: ${mission.preset || "livre"}`,
      `Fase final: ${mission.phase || "não registrada"}`,
      `Objetivos: ${done}/${objectives.length}`,
      `Início: ${timestamp(mission.startedAt || mission.createdAt)}`,
      `Encerramento: ${timestamp(mission.endedAt || now)}`,
      `Eventos registrados: ${timeline.length}`
    ];
    return {
      id: `report_${Date.now().toString(36)}`,
      missionId: mission.id || "",
      tipo: "missao",
      titulo: `Relatório preliminar · ${mission.titulo || "Operação de campo"}`,
      resumo: lines.join(" · "),
      conteudo: lines.join("\n"),
      observacao: "",
      status: "rascunho",
      auto: true,
      autor: author,
      createdBy: author,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString()
    };
  }

  function buildTrainingReport(session = {}, names = [], author = "app", now = new Date()) {
    const nameMap = names && !Array.isArray(names) ? names : {};
    const score = Object.entries(session.scores || {}).map(([username, value]) => `${nameMap[username] || username}: ${value}`).join(" · ");
    const lines = [
      `Modalidade: ${session.modalidade || "1x1"}`,
      `Participantes: ${Object.keys(nameMap).length ? Object.values(nameMap).join(", ") : (session.participants || []).join(", ")}`,
      `Placar final: ${score || "0"}`,
      `Rodada: ${session.round || 1}`,
      `Duração: ${Math.round((Number(session.elapsedSeconds) || 0) / 60)} min`
    ];
    return {
      id: `report_${Date.now().toString(36)}`,
      trainingId: session.id || "",
      tipo: "treino",
      titulo: `Resumo automático · ${session.modalidade || "Treino"}`,
      resumo: lines.join(" · "),
      conteudo: lines.join("\n"),
      observacao: "",
      status: "rascunho",
      auto: true,
      autor: author,
      createdBy: author,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString()
    };
  }

  return { buildMissionReport, buildTrainingReport };
});

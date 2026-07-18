(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.JikkaiRuleTimers = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERIFIED_AT = "2026-07-17";
  const RULE_NOTICE = "Preset de apoio ao RP; as regras oficiais podem mudar.";
  const PRESETS = [
    { id: "perseguicao", nome: "Perseguição", minutos: 5, categoria: "campo", descricao: "Janela inicial de perseguição." },
    { id: "retirada", nome: "Retirada após perseguição", minutos: 2, categoria: "campo", descricao: "Tempo curto para sair da área." },
    { id: "cerco", nome: "Cerco no portão", minutos: 10, categoria: "campo", descricao: "Controle de acesso e comunicação." },
    { id: "fuga", nome: "Fuga", minutos: 15, categoria: "campo", descricao: "Janela de fuga do alvo ou equipe." },
    { id: "invasao", nome: "Invasão", minutos: 60, categoria: "campo", descricao: "Operação prolongada de invasão." },
    { id: "sequestro", nome: "Sequestro", minutos: 90, categoria: "campo", descricao: "Janela operacional de sequestro." },
    { id: "interrogatorio", nome: "Interrogatório", minutos: 90, categoria: "campo", descricao: "Tempo de cena para interrogatório." },
    { id: "julgamento", nome: "Julgamento", minutos: 90, categoria: "campo", descricao: "Janela para julgamento e decisão." },
    { id: "crash", nome: "Retorno após crash", minutos: 3, categoria: "suporte", descricao: "Retorno sem ticket." },
    { id: "crash_ticket", nome: "Retorno após crash com ticket", minutos: 5, categoria: "suporte", descricao: "Retorno com ticket confirmado." },
    { id: "treino_3", nome: "Treino · 3 min", minutos: 3, categoria: "treino", descricao: "Rodada curta de treinamento." },
    { id: "treino_5", nome: "Treino · 5 min", minutos: 5, categoria: "treino", descricao: "Duração padrão de treinamento." },
    { id: "treino_10", nome: "Treino · 10 min", minutos: 10, categoria: "treino", descricao: "Treino prolongado." }
  ].map(preset => ({ ...preset, verificadoEm: VERIFIED_AT, aviso: RULE_NOTICE }));

  function getPreset(id) {
    return PRESETS.find(preset => preset.id === id) || null;
  }

  function formatSeconds(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function elapsedSeconds(timer, now = Date.now()) {
    if (!timer) return 0;
    const started = new Date(timer.startedAt || timer.createdAt || now).getTime();
    const ends = new Date(timer.endsAt || 0).getTime();
    if (!Number.isFinite(started)) return 0;
    const total = Number(timer.elapsedSeconds) || 0;
    if (timer.status === "paused") return Math.max(0, Math.round(total));
    const current = Math.max(0, (now - started) / 1000);
    return Math.max(0, Math.round(total + current));
  }

  function remainingSeconds(timer, now = Date.now()) {
    if (!timer) return 0;
    const duration = Math.max(0, Number(timer.durationMinutes) || 0) * 60;
    return Math.max(0, duration - elapsedSeconds(timer, now));
  }

  function isExpired(timer, now = Date.now()) {
    if (!timer || timer.status === "encerrado") return true;
    if (timer.endsAt) return new Date(timer.endsAt).getTime() <= now && timer.status !== "paused";
    return remainingSeconds(timer, now) <= 0;
  }

  function createTimer({ id, presetId = "perseguicao", createdBy = "app", mode = "rp", now = new Date() } = {}) {
    const preset = getPreset(presetId) || PRESETS[0];
    const startedAt = new Date(now).toISOString();
    return {
      id: id || `timer_${Date.now().toString(36)}`,
      presetId: preset.id,
      nome: preset.nome,
      descricao: preset.descricao,
      categoria: preset.categoria,
      durationMinutes: preset.minutos,
      startedAt,
      createdAt: startedAt,
      endsAt: new Date(new Date(now).getTime() + preset.minutos * 60000).toISOString(),
      elapsedSeconds: 0,
      status: "ativo",
      mode,
      createdBy,
      chainNextPresetId: preset.id === "perseguicao" ? "retirada" : ""
    };
  }

  function chainNext(timer, { id, createdBy = timer?.createdBy || "app", mode = timer?.mode || "rp", now = new Date() } = {}) {
    if (!timer?.chainNextPresetId) return null;
    return createTimer({ id, presetId: timer.chainNextPresetId, createdBy, mode, now });
  }

  return { PRESETS, getPreset, formatSeconds, elapsedSeconds, remainingSeconds, isExpired, createTimer, chainNext, VERIFIED_AT, RULE_NOTICE };
});

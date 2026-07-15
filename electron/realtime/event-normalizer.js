const AREA_BY_KEY = {
  missoes: "missoes",
  relatorios: "relatorios",
  mapaPontos: "mapa",
  mapaRotas: "mapa",
  mapaReunioes: "mapa",
  users: "membros",
  roles: "estrutura",
  divisoes: "estrutura",
  trios: "estrutura",
  convites: "iniciacao",
  juramentados: "iniciacao",
  contratos: "contratos",
  propostas: "contratos",
  fases: "jikkai",
  alertas: "alertas",
  convocacoes: "alertas"
};

function normalizeStateEvent(change = {}) {
  const changedKeys = Array.isArray(change.changedKeys) ? change.changedKeys : [];
  const areas = Array.from(new Set(changedKeys.map(key => AREA_BY_KEY[key] || "operacional")));
  return {
    type: "state.changed",
    source: change.source || "unknown",
    updatedAt: change.updatedAt || new Date().toISOString(),
    changedKeys,
    areas,
    data: change.state || {}
  };
}

module.exports = { normalizeStateEvent };

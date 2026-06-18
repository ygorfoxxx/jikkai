const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador, encontrado ${count}`);
  html = html.replace(oldText, newText);
}

replaceOnce(
  "// PROTOCOLO DE INICIAÇÃO v1 (primeiro acesso e juramento integrado)",
  "// PROTOCOLO DE INICIAÇÃO v1 (primeiro acesso e juramento integrado)\n// ETAPA 3 — PAINEL ESTRATÉGICO JIKKAI v1 (fases, riscos e fontes integradas)",
  "marcador da Etapa 3"
);

const strategicCore = String.raw`
const OBJETIVO_STATUS_CFG = {
  nao_iniciado: { label: "Não iniciado", cor: "#71717A", badge: "bg-zinc-900 text-zinc-400 border-zinc-700" },
  preparacao: { label: "Em preparação", cor: "#2563EB", badge: "bg-blue-950 text-blue-300 border-blue-800" },
  andamento: { label: "Em andamento", cor: "#EA580C", badge: "bg-orange-950 text-orange-300 border-orange-800" },
  parcial: { label: "Parcial", cor: "#CA8A04", badge: "bg-yellow-950 text-yellow-300 border-yellow-800" },
  bloqueado: { label: "Bloqueado", cor: "#DC2626", badge: "bg-red-950 text-red-300 border-red-800" },
  concluido: { label: "Concluído", cor: "#16A34A", badge: "bg-green-950 text-green-300 border-green-800" },
  fracassado: { label: "Fracassado", cor: "#7F1D1D", badge: "bg-red-950 text-red-400 border-red-900" },
  cancelado: { label: "Cancelado", cor: "#52525B", badge: "bg-zinc-950 text-zinc-600 border-zinc-800" },
};

const FASE_STATUS_CFG = {
  planejada: { label: "Planejada", cor: "#71717A", badge: "bg-zinc-900 text-zinc-400 border-zinc-700" },
  bloqueada: { label: "Bloqueada", cor: "#B91C1C", badge: "bg-red-950 text-red-300 border-red-800" },
  andamento: { label: "Em operação", cor: "#EA580C", badge: "bg-orange-950 text-orange-300 border-orange-800" },
  concluida: { label: "Concluída", cor: "#16A34A", badge: "bg-green-950 text-green-300 border-green-800" },
  suspensa: { label: "Suspensa", cor: "#CA8A04", badge: "bg-yellow-950 text-yellow-300 border-yellow-800" },
};

const RISCO_CFG = {
  Baixo: { indice: 1, cor: "#16A34A", badge: "bg-green-950 text-green-300 border-green-800" },
  Moderado: { indice: 2, cor: "#CA8A04", badge: "bg-yellow-950 text-yellow-300 border-yellow-800" },
  Elevado: { indice: 3, cor: "#EA580C", badge: "bg-orange-950 text-orange-300 border-orange-800" },
  Crítico: { indice: 4, cor: "#DC2626", badge: "bg-red-950 text-red-300 border-red-800" },
};

const PRIORIDADE_PESO = { Secundária: 1, Normal: 2, Importante: 3, Crítica: 5 };
const FONTE_ESTRATEGICA_CFG = {
  relatorio: { label: "Relatório", cor: "#A855F7" },
  mapa: { label: "Mapa", cor: "#38BDF8" },
  missao: { label: "Missão", cor: "#EA580C" },
  contrato: { label: "Contrato", cor: "#EF4444" },
  objetivo: { label: "Objetivo", cor: "#F59E0B" },
  comando: { label: "Comando", cor: "#F97316" },
};

function normalizarRisco(valor) {
  const v = String(valor || "").toLowerCase();
  if (v.includes("crít") || v.includes("letal")) return "Crítico";
  if (v.includes("alta") || v.includes("elev")) return "Elevado";
  if (v.includes("méd") || v.includes("moder")) return "Moderado";
  return RISCO_CFG[valor] ? valor : "Baixo";
}

function normalizarStatusObjetivo(status, done = false) {
  if (done) return "concluido";
  const mapa = { pendente: "nao_iniciado", andamento: "andamento", concluida: "concluido", concluido: "concluido" };
  return OBJETIVO_STATUS_CFG[status] ? status : (mapa[status] || "nao_iniciado");
}

function normalizarObjetivoEstrategico(obj, fase, index) {
  const status = normalizarStatusObjetivo(obj.status, obj.done);
  const progressoPadrao = status === "concluido" ? 100 : status === "parcial" ? 50 : status === "andamento" ? 25 : 0;
  const prioridade = PRIORIDADE_PESO[obj.prioridade] ? obj.prioridade : "Normal";
  return {
    id: obj.id || `obj_${fase.id || fase.n}_${index + 1}`,
    titulo: obj.titulo || obj.text || `Objetivo ${index + 1}`,
    descricao: obj.descricao || "",
    status,
    progresso: Math.max(0, Math.min(100, Number(obj.progresso ?? progressoPadrao))),
    prioridade,
    peso: Number(obj.peso) || PRIORIDADE_PESO[prioridade],
    responsavel: obj.responsavel || "",
    apoioTipo: obj.apoioTipo || "",
    apoioId: obj.apoioId || "",
    prazo: obj.prazo || "",
    prazoTipo: obj.prazoTipo || "sem_prazo",
    risco: normalizarRisco(obj.risco || "Baixo"),
    bloqueio: obj.bloqueio || "",
    recursos: Array.isArray(obj.recursos) ? obj.recursos : (obj.recursosTexto ? String(obj.recursosTexto).split("\n").filter(Boolean) : []),
    missaoId: obj.missaoId || "",
    relatorioId: obj.relatorioId || "",
    contratoId: obj.contratoId || "",
    mapaId: obj.mapaId || "",
    observacoes: obj.observacoes || "",
    atualizadaEm: obj.atualizadaEm || "",
  };
}

function normalizarFaseEstrategica(fase, index) {
  const id = fase.id || `fase_${fase.n || index + 1}`;
  const base = { ...fase, id };
  const objetivos = (fase.objetivos || []).map((o, i) => normalizarObjetivoEstrategico(o, base, i));
  const statusLegado = { pendente: index === 0 ? "andamento" : "planejada", andamento: "andamento", concluida: "concluida" };
  return {
    ...fase,
    id,
    n: Number(fase.n) || index + 1,
    titulo: fase.titulo || `Fase ${index + 1}`,
    desc: fase.desc || fase.descricao || "",
    status: FASE_STATUS_CFG[fase.status] ? fase.status : (statusLegado[fase.status] || "planejada"),
    objetivos,
    responsavelGeral: fase.responsavelGeral || "",
    prazo: fase.prazo || "",
    prazoTipo: fase.prazoTipo || "sem_prazo",
    riscoGeral: normalizarRisco(fase.riscoGeral || "Baixo"),
    progressoManualAtivo: Boolean(fase.progressoManualAtivo),
    progressoManual: Math.max(0, Math.min(100, Number(fase.progressoManual) || 0)),
    requisitos: Array.isArray(fase.requisitos) ? fase.requisitos.map((r, i) => typeof r === "string" ? { id: `req_${id}_${i}`, texto: r, atendido: false } : { id: r.id || `req_${id}_${i}`, texto: r.texto || r.text || "Requisito", atendido: Boolean(r.atendido) }) : [],
    atualizadaEm: fase.atualizadaEm || "",
  };
}

function progressoObjetivo(obj) {
  if (obj.status === "concluido") return 100;
  if (obj.status === "cancelado") return 0;
  return Math.max(0, Math.min(100, Number(obj.progresso) || 0));
}

function progressoFase(fase) {
  if (fase.progressoManualAtivo) return Math.max(0, Math.min(100, Number(fase.progressoManual) || 0));
  const objetivos = fase.objetivos || [];
  if (!objetivos.length) return fase.status === "concluida" ? 100 : 0;
  const pesoTotal = objetivos.reduce((s, o) => s + Math.max(1, Number(o.peso) || 1), 0);
  return Math.round(objetivos.reduce((s, o) => s + progressoObjetivo(o) * Math.max(1, Number(o.peso) || 1), 0) / pesoTotal);
}

function progressoGeralJikkai(fases) {
  const validas = fases || [];
  if (!validas.length) return 0;
  return Math.round(validas.reduce((s, f) => s + progressoFase(f), 0) / validas.length);
}

function prazoAtrasado(prazo, status) {
  if (!prazo || ["concluido", "concluida", "cancelado"].includes(status)) return false;
  const data = new Date(prazo + (String(prazo).length === 10 ? "T23:59:59" : ""));
  return !Number.isNaN(data.getTime()) && data.getTime() < Date.now();
}

function fonteLabel(tipo) {
  return FONTE_ESTRATEGICA_CFG[tipo] || FONTE_ESTRATEGICA_CFG.comando;
}

function coletarSinaisEstrategicos(data) {
  const sinais = [];
  const add = sinal => {
    if (!sinal?.titulo) return;
    sinais.push({
      id: sinal.id || `sinal_${sinal.fonteTipo}_${sinal.fonteId || uid()}`,
      titulo: sinal.titulo,
      descricao: sinal.descricao || "",
      risco: normalizarRisco(sinal.risco || "Moderado"),
      categoria: sinal.categoria || "Operacional",
      fonteTipo: sinal.fonteTipo || "comando",
      fonteId: sinal.fonteId || "",
      fonteNome: sinal.fonteNome || "",
      faseId: sinal.faseId || "",
      objetivoId: sinal.objetivoId || "",
      status: sinal.status || "ativo",
      criadoEm: sinal.criadoEm || sinal.data || "",
    });
  };

  (data.sinaisEstrategicos || []).filter(s => s.status !== "resolvido").forEach(s => add(s));

  (data.relatorios || []).filter(r => r.alertaJikkai && r.statusAlerta !== "resolvido").forEach(r => add({
    id: `relatorio_${r.id}`, titulo: r.titulo, descricao: r.resumoEstrategico || r.descricao,
    risco: r.riscoJikkai || "Moderado", categoria: r.categoriaJikkai || "Inteligência",
    fonteTipo: "relatorio", fonteId: r.id, fonteNome: r.titulo, faseId: r.faseId, objetivoId: r.objetivoId, criadoEm: r.data,
  }));

  [...(data.mapaPontos || []), ...(data.mapaRotas || [])].forEach(item => {
    const texto = `${item.status || ""} ${item.desc || ""}`.toLowerCase();
    const automatico = item.alertaJikkai || item.type === "risco" || ["Alta", "Crítica"].includes(item.threat) || /compromet|hostil|bloquead|ameaça|perdido/.test(texto);
    if (!automatico || item.statusAlerta === "resolvido") return;
    add({
      id: `mapa_${item.kind || "point"}_${item.id}`, titulo: item.alertaTitulo || item.name,
      descricao: item.desc || `Situação: ${item.status || "não informada"}.`, risco: item.riscoJikkai || item.threat,
      categoria: item.categoriaJikkai || "Territorial", fonteTipo: "mapa", fonteId: item.id, fonteNome: item.name,
      faseId: item.faseId, objetivoId: item.objetivoId, criadoEm: item.updatedAt || item.createdAt || data.mapaAtualizadoEm,
    });
  });

  (data.missoes || []).filter(m => m.status === "falhou").forEach(m => add({
    id: `missao_${m.id}`, titulo: `Operação fracassada: ${m.titulo}`, descricao: m.relatorio?.resumo || m.desc,
    risco: "Elevado", categoria: "Operacional", fonteTipo: "missao", fonteId: m.id, fonteNome: m.titulo,
    faseId: m.faseId, objetivoId: m.objetivoId, criadoEm: m.updatedAt || m.createdAt,
  }));

  (data.contratos || []).filter(c => c.status === "Falhou" && (c.faseId || c.objetivoId)).forEach(c => add({
    id: `contrato_${c.id}`, titulo: `Contrato fracassado: ${c.titulo}`, descricao: c.descricaoCurta || c.descricao,
    risco: "Elevado", categoria: "Operacional", fonteTipo: "contrato", fonteId: c.id, fonteNome: c.titulo,
    faseId: c.faseId, objetivoId: c.objetivoId, criadoEm: c.criadoEm,
  }));

  (data.fases || []).forEach(f => (f.objetivos || []).forEach(o => {
    if (o.status === "bloqueado" || prazoAtrasado(o.prazo, o.status) || RISCO_CFG[normalizarRisco(o.risco)].indice >= 3) {
      add({
        id: `objetivo_${o.id}`, titulo: o.status === "bloqueado" ? `Objetivo bloqueado: ${o.titulo}` : prazoAtrasado(o.prazo, o.status) ? `Objetivo atrasado: ${o.titulo}` : `Risco em objetivo: ${o.titulo}`,
        descricao: o.bloqueio || o.observacoes || o.descricao, risco: o.risco || (o.status === "bloqueado" ? "Elevado" : "Moderado"),
        categoria: "Planejamento", fonteTipo: "objetivo", fonteId: o.id, fonteNome: o.titulo, faseId: f.id, objetivoId: o.id, criadoEm: o.atualizadaEm,
      });
    }
  }));

  const ordem = { Crítico: 4, Elevado: 3, Moderado: 2, Baixo: 1 };
  return sinais.sort((a, b) => (ordem[b.risco] || 0) - (ordem[a.risco] || 0) || new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}

function RiscoBadge({ risco, compacto = false }) {
  const valor = normalizarRisco(risco);
  const cfg = RISCO_CFG[valor];
  return <span className={`inline-flex items-center gap-1 rounded border font-black uppercase tracking-wider ${cfg.badge} ${compacto ? "text-[8px] px-1.5 py-0.5" : "text-[10px] px-2 py-1"}`}><IAlert className={compacto ? "w-2.5 h-2.5" : "w-3 h-3"} />{valor}</span>;
}

function ObjetivoStatusBadge({ status }) {
  const cfg = OBJETIVO_STATUS_CFG[status] || OBJETIVO_STATUS_CFG.nao_iniciado;
  return <span className={`text-[9px] px-2 py-0.5 rounded border font-black uppercase tracking-wider ${cfg.badge}`}>{cfg.label}</span>;
}

function FonteEstrategicaBadge({ tipo }) {
  const cfg = fonteLabel(tipo);
  return <span className="text-[8px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-black" style={{ color: cfg.cor, borderColor: cfg.cor + "80", background: cfg.cor + "18" }}>{cfg.label}</span>;
}

`;

replaceOnce(
  "// ============ JIKKAI ============\nconst STATUS_CFG = {",
  "// ============ JIKKAI ============\n" + strategicCore + "const STATUS_CFG = {",
  "núcleo do painel estratégico"
);

const migrateStart = html.indexOf("function migrate(raw)");
const migrateReturn = html.indexOf("  return migrated;", migrateStart);
if (migrateStart < 0 || migrateReturn < 0) throw new Error("Função migrate não encontrada.");
const migration = String.raw`  migrated.fases = (migrated.fases || DEFAULT_FASES).map((fase, index) => normalizarFaseEstrategica(fase, index));
  migrated.sinaisEstrategicos = Array.isArray(migrated.sinaisEstrategicos) ? migrated.sinaisEstrategicos : [];
`;
html = html.slice(0, migrateReturn) + migration + html.slice(migrateReturn);

for (const marker of ["ETAPA 3 — PAINEL ESTRATÉGICO", "function coletarSinaisEstrategicos", "normalizarFaseEstrategica", "migrated.sinaisEstrategicos"]) {
  if (!html.includes(marker)) throw new Error("Fundação estratégica ausente: " + marker);
}

fs.writeFileSync(path, html, "utf8");
console.log("Fundação integrada do Painel Estratégico aplicada.");

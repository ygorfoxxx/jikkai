const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(label + ": esperado 1 marcador, encontrado " + count);
  html = html.replace(oldText, newText);
}

replaceOnce(
  "// PROTOCOLO DE INICIAÇÃO v1 (primeiro acesso e juramento integrado)",
  "// PROTOCOLO DE INICIAÇÃO v1 (primeiro acesso e juramento integrado)\n// ETAPA 3 — PAINEL ESTRATÉGICO JIKKAI v1 (fases, riscos e fontes integradas)",
  "marcador da Etapa 3"
);

const strategicCore = fs.readFileSync("scripts/painel-estrategico-core.fragment", "utf8");

replaceOnce(
  "// ============ JIKKAI ============\nconst STATUS_CFG = {",
  "// ============ JIKKAI ============\n" + strategicCore + "\nconst STATUS_CFG = {",
  "núcleo do painel estratégico"
);

const migrateStart = html.indexOf("function migrate(raw)");
const migrateReturn = html.indexOf("  return migrated;", migrateStart);
if (migrateStart < 0 || migrateReturn < 0) throw new Error("Função migrate não encontrada.");
const migration = "  migrated.fases = (migrated.fases || DEFAULT_FASES).map((fase, index) => normalizarFaseEstrategica(fase, index));\n  migrated.sinaisEstrategicos = Array.isArray(migrated.sinaisEstrategicos) ? migrated.sinaisEstrategicos : [];\n";
html = html.slice(0, migrateReturn) + migration + html.slice(migrateReturn);

for (const marker of ["ETAPA 3 — PAINEL ESTRATÉGICO", "function coletarSinaisEstrategicos", "normalizarFaseEstrategica", "migrated.sinaisEstrategicos"]) {
  if (!html.includes(marker)) throw new Error("Fundação estratégica ausente: " + marker);
}

fs.writeFileSync(path, html, "utf8");
console.log("Fundação integrada do Painel Estratégico aplicada.");

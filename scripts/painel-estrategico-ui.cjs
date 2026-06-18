const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");
const faseFragment = fs.readFileSync("scripts/painel-estrategico-fase.fragment", "utf8");
const planoFragment = fs.readFileSync("scripts/painel-estrategico-plano.fragment", "utf8");

const faseStart = html.indexOf("function FaseEditor(");
const faseEnd = html.indexOf("// ============ RELATÓRIOS DE INTELIGÊNCIA ============", faseStart);
if (faseStart < 0 || faseEnd < 0 || faseEnd <= faseStart) throw new Error("Bloco antigo de FaseEditor não encontrado.");
html = html.slice(0, faseStart) + faseFragment + "\n\n" + html.slice(faseEnd);

const planoStart = html.indexOf("function PlanoSection(");
const planoEnd = html.indexOf("function ArquivoPublicoPage", planoStart);
if (planoStart < 0 || planoEnd < 0 || planoEnd <= planoStart) throw new Error("Bloco antigo de PlanoSection não encontrado.");
html = html.slice(0, planoStart) + planoFragment + "\n\n" + html.slice(planoEnd);

for (const marker of [
  "function FaseEditor",
  "function FaseEstrategicaCard",
  "function ObjetivoEstrategicoCard",
  "function SinalEstrategicoCard",
  "function PlanoSection",
  "Painel Estratégico JIKKAI",
  "Alertas ativos",
]) {
  if (!html.includes(marker)) throw new Error("Interface estratégica ausente: " + marker);
}
for (const unique of ["function FaseEditor", "function FaseEstrategicaCard", "function ObjetivoEstrategicoCard", "function PlanoSection"]) {
  const count = html.split(unique).length - 1;
  if (count !== 1) throw new Error(unique + " encontrado " + count + " vezes");
}

fs.writeFileSync(path, html, "utf8");
console.log("Sala de comando do Painel JIKKAI aplicada.");

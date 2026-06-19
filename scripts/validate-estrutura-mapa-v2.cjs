const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const mapa = fs.readFileSync("mapa.html", "utf8");

const htmlMarkers = [
  "ESTRUTURA HIERARQUICA v2",
  'id: "capitao"',
  'estruturaPosicao: "conselheiro"',
  'estruturaPosicao: "capitao_ramo"',
  "const ESTRUTURA_POSICOES",
  "function estruturaPosicaoRole",
  "Conselheiro · Consigliere",
  "Capitão do ramo · Caporegime",
  "Capitão não designado",
  "Posição herdada do cargo",
  "A posição definida aqui controla automaticamente",
  "definirCapitao",
  "migrated.users = migrated.users.map(u => ({ ...u, estruturaNivel: estruturaPosicaoRole",
];

for (const marker of htmlMarkers) {
  if (!html.includes(marker)) throw new Error("Validação da estrutura falhou: " + marker);
}

for (const unique of ["function EstruturaSection", "function IntroducaoEstruturaAtual", "function RamosManager", "function CargosManager", "const ESTRUTURA_POSICOES"]) {
  const count = html.split(unique).length - 1;
  if (count !== 1) throw new Error(`${unique} encontrado ${count} vezes`);
}

const mapMarkers = [
  "jikkai-map-scroll-v2",
  "min-height:0",
  "overflow-y:auto",
  "overscroll-behavior:contain",
  "-webkit-overflow-scrolling:touch",
  "height:100dvh",
];

for (const marker of mapMarkers) {
  if (!mapa.includes(marker)) throw new Error("Validação do mapa falhou: " + marker);
}

console.log("Estrutura hierárquica e rolagem dos locais do mapa validadas.");

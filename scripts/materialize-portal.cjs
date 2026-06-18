const fs = require("fs");
const { spawnSync } = require("child_process");

fs.mkdirSync("source", { recursive: true });
fs.copyFileSync("index.html", "source/index.base.html");
fs.copyFileSync("mapa.html", "source/mapa.base.html");

const build = spawnSync(process.execPath, ["scripts/build-etapa2.cjs"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status || 1);

const transforms = [
  "fix-avatar.cjs",
  "etapa2-core.cjs",
  "etapa2-reputacao-ui.cjs",
  "etapa2-admin-tabs.cjs",
  "etapa2-admin-user-fields.cjs",
  "etapa2-admin-notes.cjs",
  "etapa2-admin-badges.cjs",
  "etapa2-ramos.cjs",
  "introducao-juramento.cjs",
  "introducao-data-app.cjs",
  "introducao-admin.cjs",
  "painel-estrategico-core.cjs",
  "painel-estrategico-relatorios.cjs",
  "painel-estrategico-ui.cjs",
  "painel-estrategico-mapa.cjs",
  "validate-portal-v3.cjs",
];

const wrapper = [
  'const fs = require("fs");',
  'fs.copyFileSync("source/index.base.html", "index.html");',
  'fs.copyFileSync("source/mapa.base.html", "mapa.html");',
  'const etapas = ' + JSON.stringify(transforms.map(x => "./" + x), null, 2) + ';',
  'for (const arquivo of etapas) { console.log("Executando", arquivo); require(arquivo); }',
  'console.log("Portal regenerado a partir dos fontes-base.");',
  '',
].join("\n");

fs.writeFileSync("scripts/build-etapa2.cjs", wrapper);
fs.writeFileSync("vercel.json", '{\n  "outputDirectory": "."\n}\n');

for (const file of [
  ".painel-ready",
  "REVISAO_PAINEL.txt",
  "docs/painel-validacao.txt",
  "docs/revisao.md",
  "docs/fontes-alertas.md",
]) {
  if (fs.existsSync(file)) fs.rmSync(file);
}

console.log("Arquivos públicos consolidados.");

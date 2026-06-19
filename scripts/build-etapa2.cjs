const fs = require("fs");
fs.copyFileSync("source/index.base.html", "index.html");
fs.copyFileSync("source/mapa.base.html", "mapa.html");
const etapas = [
  "./fix-avatar.cjs",
  "./etapa2-core.cjs",
  "./etapa2-reputacao-ui.cjs",
  "./etapa2-admin-tabs.cjs",
  "./etapa2-admin-user-fields.cjs",
  "./etapa2-admin-notes.cjs",
  "./etapa2-admin-badges.cjs",
  "./etapa2-ramos.cjs",
  "./introducao-juramento.cjs",
  "./introducao-data-app.cjs",
  "./introducao-admin.cjs",
  "./painel-estrategico-core.cjs",
  "./painel-estrategico-relatorios.cjs",
  "./painel-estrategico-ui.cjs",
  "./painel-estrategico-mapa.cjs",
  "./ajustes-iniciacao-ramos.cjs",
  "./mobile-responsive-loader.cjs",
  "./mobile-responsive-polish.cjs",
  "./validate-portal-v3.cjs"
];
for (const arquivo of etapas) {
  console.log("Executando", arquivo);
  require(arquivo);
}
console.log("Portal regenerado a partir dos fontes-base.");

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
  "./validate-portal.cjs",
];

for (const arquivo of etapas) {
  console.log("Executando", arquivo);
  require(arquivo);
}

console.log("Build integrado da Jikkai concluído.");

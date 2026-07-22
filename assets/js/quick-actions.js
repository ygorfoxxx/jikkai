(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.JikkaiQuickActions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ACTIONS = [
    { id: "ciente", label: "Ciente", icon: "✓", category: "comunicacao" },
    { id: "caminho", label: "A caminho", icon: "➜", category: "comunicacao" },
    { id: "local", label: "No local", icon: "⌖", category: "comunicacao" },
    { id: "aguardando", label: "Aguardando", icon: "…", category: "comunicacao" },
    { id: "area_limpa", label: "Área limpa", icon: "◈", category: "campo" },
    { id: "apoio", label: "Preciso de apoio", icon: "+", category: "urgente" },
    { id: "ferido", label: "Ferido", icon: "!", category: "urgente" },
    { id: "recuar", label: "Recuar", icon: "↩", category: "urgente" },
    { id: "silencio", label: "Silêncio", icon: "◌", category: "campo" },
    { id: "objetivo", label: "Finalizar objetivo", icon: "◆", category: "campo" }
  ];
  const TEMPLATES = [
    { id: "mascara_on", label: "Ajustar máscara", text: "/eu ajusta a máscara e verifica se o encaixe cobre sua identidade." },
    { id: "mascara_off", label: "Retirar máscara", text: "/eu retira a máscara com cautela e guarda o item." },
    { id: "observar", label: "Observar ambiente", text: "/eu observa o ambiente em silêncio, atento a movimentos e rotas de saída." },
    { id: "carta", label: "Escrever carta", text: "/eu escreve uma carta curta e revisa o conteúdo antes de dobrá-la." },
    { id: "selar", label: "Selar carta", text: "/eu sela a carta com cuidado, mantendo o conteúdo protegido." },
    { id: "pombo", label: "Usar pombo-correio", text: "/eu prende a mensagem ao pombo-correio e o solta em direção ao destino." },
    { id: "mineracao", label: "Preparar mineração", text: "/eu prepara as ferramentas de mineração e confere o equipamento." },
    { id: "recolher", label: "Recolher minério", text: "/eu recolhe o minério encontrado e o armazena com cuidado." },
    { id: "ferimento", label: "Observar ferimento", text: "/eu observa o ferimento e avalia a gravidade antes de agir." },
    { id: "auxilio", label: "Prestar auxílio", text: "/eu presta auxílio ao ferido e mantém a situação sob controle." },
    { id: "reuniao", label: "Aguardar reunião", text: "/eu aguarda no ponto combinado, mantendo atenção ao redor." },
    { id: "sinal", label: "Sinal discreto", text: "/eu realiza um sinal discreto para indicar que compreendeu a mensagem." }
  ];

  function getAction(id) { return ACTIONS.find(action => action.id === id) || null; }
  function getTemplate(id) { return TEMPLATES.find(template => template.id === id) || null; }
  function createSignal({ id, actionId, username, mode = "rp", missionId = "", meetingId = "", visibility = "", now = new Date(), ttlMinutes = 10 } = {}) {
    const action = getAction(actionId);
    const createdAt = new Date(now).toISOString();
    return {
      id: id || `signal_${Date.now().toString(36)}`,
      actionId,
      label: action?.label || actionId,
      username,
      missionId,
      meetingId,
      mode,
      visibility: visibility || (mode === "training" ? "compartilhado" : "pessoal"),
      createdAt,
      expiresAt: new Date(new Date(now).getTime() + ttlMinutes * 60000).toISOString(),
      status: "ativo"
    };
  }

  return { ACTIONS, TEMPLATES, getAction, getTemplate, createSignal };
});

const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(label + ": esperado 1 marcador, encontrado " + count);
  html = html.replace(oldText, newText);
}

function replaceAll(oldText, newText, minimum, label) {
  const count = html.split(oldText).length - 1;
  if (count < minimum) throw new Error(label + ": esperado pelo menos " + minimum + ", encontrado " + count);
  html = html.split(oldText).join(newText);
}

if (!html.includes("// MOBILE RESPONSIVE v1")) {
  replaceOnce(
    "// ETAPA 3 — PAINEL ESTRATÉGICO JIKKAI v1 (fases, riscos e fontes integradas)",
    "// ETAPA 3 — PAINEL ESTRATÉGICO JIKKAI v1 (fases, riscos e fontes integradas)\n// MOBILE RESPONSIVE v1 (navegação, toque, formulários e História integrada)",
    "marcador mobile"
  );

  const mobileCss = `
  html, body, #root { min-height: 100%; }
  body { overflow-x: hidden; }
  .mobile-scrollbar-none { scrollbar-width: none; }
  .mobile-scrollbar-none::-webkit-scrollbar { display: none; }
  @media (max-width: 639px) {
    input.fox-input, select.fox-input, textarea.fox-input {
      font-size: 16px;
      min-height: 44px;
      padding: 10px 12px;
    }
    textarea.fox-input { min-height: 96px; }
    button, a, input, select, textarea { touch-action: manipulation; }
    [data-jikkai-map-link] { display: none !important; }
    .mobile-tap { min-width: 44px; min-height: 44px; }
    .mobile-safe-bottom { padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); }
    .mobile-sheet-panel { max-height: 82dvh; padding-bottom: calc(env(safe-area-inset-bottom) + 5.5rem); }
  }
`;
  replaceOnce("</style>", mobileCss + "</style>", "estilos mobile");

  const mediaHelper = `function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);
  return matches;
}

`;
  replaceOnce("// ============ UI ============", mediaHelper + "// ============ UI ============", "helper responsivo");

  replaceOnce(
    '<div className="mb-8 flex items-start justify-between gap-3 flex-wrap">',
    '<div className="mb-5 sm:mb-8 flex items-start justify-between gap-3 flex-wrap">',
    "espaçamento do título"
  );
  replaceOnce(
    '<h2 className="text-3xl font-bold text-orange-50 tracking-wide serif">{children}</h2>',
    '<h2 className="text-2xl sm:text-3xl font-bold text-orange-50 tracking-wide serif leading-tight">{children}</h2>',
    "título responsivo"
  );
  replaceOnce(
    '      {action}\n    </div>',
    '      {action && <div className="w-full sm:w-auto">{action}</div>}\n    </div>',
    "ação do título"
  );
  replaceOnce(
    'className={`${variants[variant]} ${sizes[size]} uppercase tracking-wider font-bold rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${className}`}',
    'className={`${variants[variant]} ${sizes[size]} min-h-11 sm:min-h-0 justify-center uppercase tracking-wider font-bold rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${className}`}',
    "área de toque dos botões"
  );

  replaceOnce(
    '<div className="relative overflow-hidden rounded-lg border border-orange-900/50 bg-gradient-to-br from-black via-red-950/30 to-black p-8">',
    '<div className="relative overflow-hidden rounded-lg border border-orange-900/50 bg-gradient-to-br from-black via-red-950/30 to-black p-5 sm:p-8">',
    "hero mobile"
  );
  replaceOnce(
    '<h1 className="text-5xl font-black text-orange-50 mb-4 serif">F.O.X.</h1>',
    '<h1 className="text-4xl sm:text-5xl font-black text-orange-50 mb-4 serif">F.O.X.</h1>',
    "título do hero"
  );
  replaceOnce(
    '<div className="grid grid-cols-2 md:grid-cols-4 gap-4">',
    '<div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">',
    "grade de estatísticas"
  );
  replaceOnce(
    '<div className={`p-4 rounded-lg border ${accent ?',
    '<div className={`p-3 sm:p-4 rounded-lg border ${accent ?',
    "cartão de estatística"
  );

  replaceOnce(
    'className="absolute top-2 right-2 bg-black/80 border border-red-700 text-red-400 hover:bg-red-950 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"',
    'className="absolute top-2 right-2 mobile-tap bg-black/90 border border-red-700 text-red-400 hover:bg-red-950 p-2 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"',
    "exclusão da galeria no toque"
  );

  replaceOnce(
    '<div className="flex gap-2">\n                  <input value={e.era}',
    '<div className="flex flex-col sm:flex-row gap-2">\n                  <input value={e.era}',
    "editor da linha do tempo"
  );
  replaceOnce(
    '<div className="flex gap-1">\n                    <button onClick={() => move(i, -1)} className="px-2 bg-zinc-900 border border-zinc-800 rounded text-zinc-400" title="Subir">↑</button>\n                    <button onClick={() => move(i, 1)} className="px-2 bg-zinc-900 border border-zinc-800 rounded text-zinc-400" title="Descer">↓</button>\n                    <button onClick={() => remove(i)} className="px-2 bg-red-950/80 text-red-300 rounded"><ITrash className="w-3 h-3" /></button>\n                  </div>',
    '<div className="flex gap-2 w-full sm:w-auto">\n                    <button onClick={() => move(i, -1)} className="mobile-tap flex-1 sm:flex-none px-3 bg-zinc-900 border border-zinc-800 rounded text-zinc-400" title="Subir">↑</button>\n                    <button onClick={() => move(i, 1)} className="mobile-tap flex-1 sm:flex-none px-3 bg-zinc-900 border border-zinc-800 rounded text-zinc-400" title="Descer">↓</button>\n                    <button onClick={() => remove(i)} className="mobile-tap flex-1 sm:flex-none px-3 bg-red-950/80 text-red-300 rounded"><ITrash className="w-4 h-4 mx-auto" /></button>\n                  </div>',
    "ações da linha do tempo"
  );

  replaceOnce(
    "function ClaPage({ data, setData, role }) {",
    "function ClaPage({ data, setData, role, embedded = false }) {",
    "assinatura da página do clã"
  );
  replaceOnce(
    '<SectionTitle icon={ICrown} sub="As faces do clã Lamona" action={action}>Clãs</SectionTitle>',
    '<SectionTitle icon={ICrown} sub={embedded ? "Ramos, figuras, membros e mandamentos" : "As faces do clã Lamona"} action={action}>{embedded ? "Clã Lamona" : "Clãs"}</SectionTitle>',
    "cabeçalho do clã incorporado"
  );
  replaceOnce(
    '<div key={c.id || ci} className="rounded-lg border p-6" style={{',
    '<div key={c.id || ci} className="rounded-lg border p-4 sm:p-6" style={{',
    "cartão de clã mobile"
  );
  replaceOnce(
    '<div className="flex gap-2 flex-wrap items-start">\n                  <input value={c.nome}',
    '<div className="flex flex-col sm:flex-row gap-2 items-start">\n                  <input value={c.nome}',
    "campos principais do clã"
  );
  replaceOnce(
    '<input value={c.tipo} onChange={(e) => updateCla(ci, { tipo: e.target.value })} placeholder="Tipo (badge)" className="fox-input w-32" />',
    '<input value={c.tipo} onChange={(e) => updateCla(ci, { tipo: e.target.value })} placeholder="Tipo (badge)" className="fox-input w-full sm:w-32" />',
    "tipo do clã mobile"
  );
  replaceOnce(
    '<div className="flex gap-2 items-center flex-wrap">\n                  <label className="fox-label mb-0">ID (interno)</label>',
    '<div className="grid grid-cols-2 sm:flex gap-2 items-end sm:items-center">\n                  <label className="fox-label mb-0 col-span-2 sm:col-span-1">ID (interno)</label>',
    "metadados do clã"
  );
  replaceOnce(
    'className="ml-auto text-red-300 bg-red-950/80 p-2 rounded"',
    'className="mobile-tap col-span-2 sm:col-span-1 sm:ml-auto text-red-300 bg-red-950/80 p-2 rounded flex items-center justify-center"',
    "excluir clã mobile"
  );

  replaceOnce(
    '<div className="flex gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded items-start">',
    '<div className="flex flex-col sm:flex-row gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded items-start">',
    "mandamento mobile"
  );
  replaceOnce(
    '<div className="flex gap-1 flex-shrink-0">\n                    <button onClick={() => moveMandamento(i, -1)} className="px-2 bg-zinc-900 border border-zinc-800 rounded text-zinc-400" title="Subir">↑</button>\n                    <button onClick={() => moveMandamento(i, 1)} className="px-2 bg-zinc-900 border border-zinc-800 rounded text-zinc-400" title="Descer">↓</button>\n                    <button onClick={() => removeMandamento(i)} className="px-2 bg-red-950/80 text-red-300 rounded"><ITrash className="w-3 h-3" /></button>\n                  </div>',
    '<div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">\n                    <button onClick={() => moveMandamento(i, -1)} className="mobile-tap flex-1 sm:flex-none px-3 bg-zinc-900 border border-zinc-800 rounded text-zinc-400" title="Subir">↑</button>\n                    <button onClick={() => moveMandamento(i, 1)} className="mobile-tap flex-1 sm:flex-none px-3 bg-zinc-900 border border-zinc-800 rounded text-zinc-400" title="Descer">↓</button>\n                    <button onClick={() => removeMandamento(i)} className="mobile-tap flex-1 sm:flex-none px-3 bg-red-950/80 text-red-300 rounded"><ITrash className="w-4 h-4 mx-auto" /></button>\n                  </div>',
    "ações dos mandamentos"
  );

  const historiaStart = html.indexOf("function HistoriaPage(");
  const historiaEnd = html.indexOf("// ============ FIGURAS ============", historiaStart);
  if (historiaStart < 0 || historiaEnd < 0) throw new Error("Bloco HistoriaPage não encontrado.");
  const historiaMobile = `function HistoriaPage({ data, setData, role, usuario }) {
  const [subTab, setSubTab] = useState("timeline");
  const isMobile = useMediaQuery("(max-width: 639px)");

  useEffect(() => {
    if (!isMobile && subTab === "cla") setSubTab("timeline");
  }, [isMobile, subTab]);

  const galeriaCount = (data.galeria || []).length;
  const SUB_TABS = [
    { id: "timeline", label: "Linha do Tempo", mobileLabel: "Linha do Tempo", icon: IBook, badge: null },
    ...(isMobile ? [{ id: "cla", label: "Clã Lamona", mobileLabel: "Clã Lamona", icon: ICrown, badge: null }] : []),
    { id: "galeria", label: "Galeria de Sombras", mobileLabel: "Galeria", icon: IImage, badge: galeriaCount > 0 ? galeriaCount : null },
  ];

  return (
    <div>
      <SectionTitle icon={IBook} sub="O legado e os registros do clã Lamona">História</SectionTitle>

      <div className="mb-5 sm:mb-8 bg-zinc-950/60 border border-zinc-800 rounded-xl p-1 grid grid-cols-3 sm:flex gap-1">
        {SUB_TABS.map(t => {
          const I = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={\`min-w-0 sm:min-w-[140px] sm:flex-1 min-h-14 sm:min-h-0 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 rounded-lg text-[9px] sm:text-xs uppercase tracking-wide sm:tracking-wider font-bold transition-all \${active ? "bg-gradient-to-r from-red-700 to-orange-700 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"}\`}
            >
              <I className="w-4 h-4 flex-shrink-0" />
              <span className="leading-tight text-center">{isMobile ? t.mobileLabel : t.label}</span>
              {t.badge && (
                <span className={\`text-[9px] px-1.5 py-0.5 rounded-full font-black \${active ? "bg-black/40 text-white" : "bg-orange-600 text-black"}\`}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {subTab === "timeline" && <LinhaDoTempoSection data={data} setData={setData} podeEditar={hasPerm(role,"edit_history")} />}
      {subTab === "cla" && isMobile && <ClaPage data={data} setData={setData} role={role} embedded />}
      {subTab === "galeria" && <GaleriaSection data={data} setData={setData} isLider={hasPerm(role,"edit_gallery")} usuario={usuario} />}
    </div>
  );
}

`;
  html = html.slice(0, historiaStart) + historiaMobile + html.slice(historiaEnd);

  replaceAll(
    'className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm fadein"',
    'className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-sm fadein"',
    2,
    "modais mobile"
  );
  replaceAll(
    'className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-zinc-950 border border-orange-800 rounded-xl shadow-2xl"',
    'className="w-full max-w-3xl max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto bg-zinc-950 border border-orange-800 rounded-t-2xl sm:rounded-xl shadow-2xl"',
    2,
    "painéis dos modais"
  );

  replaceOnce(
    'className="fixed bottom-4 right-4 z-40 bg-black/90 backdrop-blur border border-orange-700/60 rounded-full shadow-2xl flex items-center gap-2 px-3 py-2"',
    'className="fixed bottom-20 right-3 sm:bottom-4 sm:right-4 z-40 bg-black/90 backdrop-blur border border-orange-700/60 rounded-full shadow-2xl flex items-center gap-2 px-3 py-2 max-w-[calc(100vw-1.5rem)]"',
    "player mobile"
  );

  replaceOnce(
    '  const [tab, setTab] = useState("home");\n  const [data, setData] = useState(null);',
    '  const [tab, setTab] = useState("home");\n  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);\n  const [data, setData] = useState(null);',
    "estado do menu mobile"
  );

  replaceOnce(
    '  // Sync indicator\n  const syncIndicator',
    `  const mobilePrimaryIds = isContratante
    ? ["visaogeral", "jikkai", "arquivos"]
    : ["home", "historia", "membros", "jikkai"];
  const mobilePrimaryTabs = TABS.filter(t => mobilePrimaryIds.includes(t.id));
  const mobileMoreTabs = TABS.filter(t => !mobilePrimaryIds.includes(t.id) && t.id !== "cla");
  const mobileMoreActive = mobileMoreTabs.some(t => t.id === tab);
  const selecionarTabMobile = (id) => {
    setTab(id);
    setMobileMoreOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Sync indicator
  const syncIndicator`,
    "configuração da navegação mobile"
  );

  replaceOnce(
    '<nav className="border-t border-zinc-900 bg-black/60">',
    '<nav className="hidden sm:block border-t border-zinc-900 bg-black/60">',
    "menu desktop preservado"
  );
  replaceOnce(
    '<main className="max-w-6xl mx-auto px-4 py-8">',
    '<main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-28 sm:pb-8">',
    "conteúdo mobile"
  );
  replaceOnce(
    '<footer className="border-t border-zinc-900 mt-16 py-6 text-center text-zinc-700 text-xs">',
    '<footer className="border-t border-zinc-900 mt-10 sm:mt-16 pt-6 pb-28 sm:py-6 text-center text-zinc-700 text-xs">',
    "rodapé mobile"
  );

  const mobileNavigation = `      {mobileMoreOpen && (
        <div className="sm:hidden fixed inset-0 z-[90]">
          <button aria-label="Fechar menu" onClick={() => setMobileMoreOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="mobile-sheet-panel absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-orange-800 bg-zinc-950 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
              <div><div className="text-[9px] uppercase tracking-[0.3em] text-orange-600">Navegação</div><div className="text-lg font-black text-orange-50 serif">Mais opções</div></div>
              <button onClick={() => setMobileMoreOpen(false)} className="mobile-tap flex items-center justify-center rounded-full border border-zinc-800 text-zinc-400"><IX className="w-5 h-5" /></button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {mobileMoreTabs.map(t => { const I = t.icon; return (
                <button key={t.id} onClick={() => selecionarTabMobile(t.id)} className={\`min-h-20 rounded-xl border p-3 flex flex-col items-center justify-center gap-2 text-center \${tab === t.id ? "border-orange-600 bg-orange-950/40 text-orange-300" : "border-zinc-800 bg-black/50 text-zinc-400"}\`}>
                  <I className="w-5 h-5" /><span className="text-[10px] uppercase tracking-wider font-bold leading-tight">{t.label}</span>
                </button>
              ); })}
              {!isContratante && <a href="./mapa.html" className="min-h-20 rounded-xl border border-sky-900 bg-sky-950/20 p-3 flex flex-col items-center justify-center gap-2 text-sky-300 text-center"><ITarget className="w-5 h-5" /><span className="text-[10px] uppercase tracking-wider font-bold">Mapa Estratégico</span></a>}
              <button onClick={() => { setUsuario(null); setMobileMoreOpen(false); }} className="min-h-20 rounded-xl border border-red-900 bg-red-950/20 p-3 flex flex-col items-center justify-center gap-2 text-red-300"><ILogout className="w-5 h-5" /><span className="text-[10px] uppercase tracking-wider font-bold">Sair</span></button>
            </div>
          </div>
        </div>
      )}

      <nav className="sm:hidden fixed inset-x-0 bottom-0 z-[95] border-t border-orange-900/50 bg-black/95 backdrop-blur-xl mobile-safe-bottom">
        <div className="grid" style={{ gridTemplateColumns: \`repeat(\${mobilePrimaryTabs.length + 1}, minmax(0, 1fr))\` }}>
          {mobilePrimaryTabs.map(t => { const I = t.icon; const active = tab === t.id; return (
            <button key={t.id} onClick={() => selecionarTabMobile(t.id)} className={\`min-h-[62px] px-1 py-2 flex flex-col items-center justify-center gap-1 border-t-2 \${active ? "border-orange-500 text-orange-400 bg-orange-950/20" : "border-transparent text-zinc-600"}\`}>
              <I className="w-5 h-5" /><span className="text-[8px] uppercase tracking-wide font-bold leading-none text-center">{t.id === "visaogeral" ? "Início" : t.label.replace(/ \(.+\)$/, "")}</span>
            </button>
          ); })}
          <button onClick={() => setMobileMoreOpen(true)} className={\`min-h-[62px] px-1 py-2 flex flex-col items-center justify-center gap-1 border-t-2 \${mobileMoreOpen || mobileMoreActive ? "border-orange-500 text-orange-400 bg-orange-950/20" : "border-transparent text-zinc-600"}\`}>
            <ISettings className="w-5 h-5" /><span className="text-[8px] uppercase tracking-wide font-bold">Mais</span>
          </button>
        </div>
      </nav>

`;
  replaceOnce(
    '      <footer className="border-t border-zinc-900 mt-10 sm:mt-16 pt-6 pb-28 sm:py-6 text-center text-zinc-700 text-xs">',
    mobileNavigation + '      <footer className="border-t border-zinc-900 mt-10 sm:mt-16 pt-6 pb-28 sm:py-6 text-center text-zinc-700 text-xs">',
    "navegação inferior"
  );

  const markers = [
    "MOBILE RESPONSIVE v1",
    "function useMediaQuery",
    "mobileMoreOpen",
    "mobilePrimaryTabs",
    "mobile-sheet-panel",
    "Clã Lamona",
    "embedded />",
    "hidden sm:block border-t",
    "bottom-20 right-3",
  ];
  for (const marker of markers) {
    if (!html.includes(marker)) throw new Error("Ajuste mobile ausente: " + marker);
  }

  fs.writeFileSync(path, html, "utf8");
  console.log("Camada responsiva para celulares aplicada.");
} else {
  console.log("Camada responsiva já aplicada; nenhuma alteração necessária.");
}

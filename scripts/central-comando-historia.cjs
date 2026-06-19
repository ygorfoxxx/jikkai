const fs = require("fs");
const path = require("path");

const portalPath = "index.html";
let html = fs.readFileSync(portalPath, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador, encontrado ${count}`);
  html = html.replace(oldText, newText);
}

function replaceBlock(startMarker, endMarker, replacement, label) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${label}: bloco não encontrado`);
  html = html.slice(0, start) + replacement.trimEnd() + "\n\n" + html.slice(end);
}

if (!html.includes("// CENTRAL DE COMANDO v2")) {
  replaceOnce(
    "// ACESSO RAIZ LEADER v1 (o username leader mantém autoridade total independentemente do cargo)",
    "// ACESSO RAIZ LEADER v1 (o username leader mantém autoridade total independentemente do cargo)\n// CENTRAL DE COMANDO v2 (F.O.X. como grupo, Lamona como legado e Jikkai como organização operacional)",
    "marcador da Central de Comando"
  );

  const homeBlock = fs.readFileSync(path.join(__dirname, "central-comando-home.block.txt"), "utf8");
  replaceBlock(
    "function HomePage({ data, usuario, missoesCount }) {",
    "// ============ GALERIA DE SOMBRAS ============",
    homeBlock,
    "nova Visão Geral"
  );

  const historiaBlock = fs.readFileSync(path.join(__dirname, "central-comando-historia.block.txt"), "utf8");
  replaceBlock(
    "function HistoriaPage({ data, setData, role, usuario }) {",
    "// ============ FIGURAS ============",
    historiaBlock,
    "História com Clã Lamona"
  );

  replaceOnce(
    '<SectionTitle icon={ICrown} sub={embedded ? "Ramos, figuras, membros e mandamentos" : "As faces do clã Lamona"} action={action}>{embedded ? "Clã Lamona" : "Clãs"}</SectionTitle>',
    `{embedded ? (\n        <div className="mb-6 border-l-4 border-orange-600 pl-4">\n          <div className="text-[9px] uppercase tracking-[0.3em] text-orange-600">Legado familiar</div>\n          <h2 className="text-2xl font-black text-orange-50 serif mt-1">Clã Lamona</h2>\n          <p className="text-zinc-500 text-sm mt-1 italic">A família que antecede a F.O.X.; seus ramos, membros, figuras e mandamentos.</p>\n          {action && <div className="mt-3">{action}</div>}\n        </div>\n      ) : (\n        <SectionTitle icon={ICrown} sub="As faces do clã Lamona" action={action}>Clãs</SectionTitle>\n      )}`,
    "cabeçalho incorporado do Clã Lamona"
  );

  replaceOnce(
    "function MembrosPage({ data, setData, role, usuario, viewerIsContratante }) {",
    "function MembrosPage({ data, setData, role, usuario, viewerIsContratante, navigationRequest }) {",
    "assinatura de Membros"
  );

  replaceOnce(
    `  const [editandoMeuDossie, setEditandoMeuDossie] = useState(false);\n  const podeEditarTrios = hasPerm(role, "edit_trios");`,
    `  const [editandoMeuDossie, setEditandoMeuDossie] = useState(false);\n\n  useEffect(() => {\n    if (navigationRequest?.tab !== "membros") return;\n    if (["lista", "estrutura", "reputacao", "trios"].includes(navigationRequest.subTab)) setSubTab(navigationRequest.subTab);\n    if (navigationRequest.action === "meu-dossie") {\n      setSubTab("lista");\n      setEditandoMeuDossie(true);\n    }\n  }, [navigationRequest?.token]);\n\n  const podeEditarTrios = hasPerm(role, "edit_trios");`,
    "navegação interna de Membros"
  );

  replaceOnce(
    "function JikkaiPage({ data, setData, isLider, usuario, role, viewerIsContratante }) {",
    "function JikkaiPage({ data, setData, isLider, usuario, role, viewerIsContratante, navigationRequest }) {",
    "assinatura da Jikkai"
  );

  replaceOnce(
    `  useEffect(() => {\n    if (viewerIsContratante && subTab !== "contratos") setSubTab("contratos");\n  }, [viewerIsContratante, subTab]);`,
    `  useEffect(() => {\n    if (viewerIsContratante && subTab !== "contratos") setSubTab("contratos");\n  }, [viewerIsContratante, subTab]);\n\n  useEffect(() => {\n    if (viewerIsContratante || navigationRequest?.tab !== "jikkai") return;\n    if (["plano", "contratos", "relatorios"].includes(navigationRequest.subTab)) setSubTab(navigationRequest.subTab);\n  }, [navigationRequest?.token, viewerIsContratante]);`,
    "navegação interna da Jikkai"
  );

  replaceOnce(
    `  const [tab, setTab] = useState("home");\n  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);\n  const [data, setData] = useState(null);`,
    `  const [tab, setTab] = useState("home");\n  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);\n  const [navigationRequest, setNavigationRequest] = useState(null);\n  const [data, setData] = useState(null);`,
    "estado de navegação contextual"
  );

  replaceOnce(
    '    { id: "historia", label: "História", icon: IBook },\n    { id: "cla", label: "Clã Lamona", icon: ICrown },\n    { id: "membros", label: "Membros", icon: IUsers },',
    '    { id: "historia", label: "História", icon: IBook },\n    { id: "membros", label: "Membros", icon: IUsers },',
    "remoção da aba principal Clã Lamona"
  );

  replaceOnce(
    `  const mobilePrimaryTabs = TABS.filter(t => mobilePrimaryIds.includes(t.id));\n  const mobileMoreTabs = TABS.filter(t => !mobilePrimaryIds.includes(t.id) && t.id !== "cla");\n  const mobileMoreActive = mobileMoreTabs.some(t => t.id === tab);\n  const selecionarTabMobile = (id) => {\n    setTab(id);\n    setMobileMoreOpen(false);\n    window.scrollTo({ top: 0, behavior: "smooth" });\n  };`,
    `  const mobilePrimaryTabs = TABS.filter(t => mobilePrimaryIds.includes(t.id));\n  const mobileMoreTabs = TABS.filter(t => !mobilePrimaryIds.includes(t.id));\n  const mobileMoreActive = mobileMoreTabs.some(t => t.id === tab);\n  const navegarPara = (id, subTab = "", action = "") => {\n    if (id === "mapa") {\n      window.location.href = "./mapa.html";\n      return;\n    }\n    setTab(id);\n    setNavigationRequest({ tab: id, subTab, action, token: Date.now() });\n    setMobileMoreOpen(false);\n    window.scrollTo({ top: 0, behavior: "smooth" });\n  };\n  const selecionarTabMobile = (id) => navegarPara(id);`,
    "navegação contextual do App"
  );

  replaceOnce(
    'onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-3',
    'onClick={() => navegarPara(t.id)} className={`flex items-center gap-2 px-4 py-3',
    "navegação desktop"
  );

  replaceOnce(
    '{tab === "home" && !isContratante && <HomePage data={data} usuario={usuarioAtual} missoesCount={minhasMissoesCount} />}',
    '{tab === "home" && !isContratante && <HomePage data={data} usuario={usuarioAtual} role={role} isLider={isLider} onNavigate={navegarPara} />}',
    "renderização da Central de Comando"
  );

  replaceOnce(
    '{tab === "historia" && !isContratante && <HistoriaPage data={data} setData={setData} role={role} usuario={usuarioAtual} />}',
    '{tab === "historia" && !isContratante && <HistoriaPage data={data} setData={setData} role={role} usuario={usuarioAtual} navigationRequest={navigationRequest} />}',
    "renderização da História"
  );

  replaceOnce(
    '        {tab === "cla" && !isContratante && <ClaPage data={data} setData={setData} role={role} />}\n',
    "",
    "remoção da página isolada do Clã Lamona"
  );

  replaceOnce(
    '{tab === "membros" && !isContratante && <MembrosPage data={data} setData={setData} role={role} usuario={usuarioAtual} viewerIsContratante={isContratante} />}',
    '{tab === "membros" && !isContratante && <MembrosPage data={data} setData={setData} role={role} usuario={usuarioAtual} viewerIsContratante={isContratante} navigationRequest={navigationRequest} />}',
    "renderização de Membros"
  );

  replaceOnce(
    '{tab === "jikkai" && <JikkaiPage data={data} setData={setData} isLider={isLider} usuario={usuarioAtual} role={role} viewerIsContratante={isContratante} />}',
    '{tab === "jikkai" && <JikkaiPage data={data} setData={setData} isLider={isLider} usuario={usuarioAtual} role={role} viewerIsContratante={isContratante} navigationRequest={navigationRequest} />}',
    "renderização da Jikkai"
  );

  fs.writeFileSync(portalPath, html, "utf8");
  console.log("Central de Comando e História unificada aplicadas.");
} else {
  console.log("Central de Comando já aplicada.");
}

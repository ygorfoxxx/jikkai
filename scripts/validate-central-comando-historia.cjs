const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

const markers = [
  "CENTRAL DE COMANDO v2",
  "function HomePage({ data, usuario, role, isLider, onNavigate })",
  "A F.O.X. é o grupo que reúne seus membros e não possui uma chefia única",
  "A Jikkai é a organização operacional criada pelo grupo",
  "Legado fundador",
  "Tenshigami — Viper-01",
  "function destinoSinalVisaoGeral",
  "function sinalAutorizadoNaVisaoGeral",
  "function DashboardMetric",
  "function DashboardPriority",
  "Clã Lamona</span>",
  "function HistoriaPage({ data, setData, role, usuario, navigationRequest })",
  '{ id: "cla", label: "Clã Lamona"',
  'subTab === "cla" && <ClaPage data={data} setData={setData} role={role} embedded />',
  "function MembrosPage({ data, setData, role, usuario, viewerIsContratante, navigationRequest })",
  "function JikkaiPage({ data, setData, isLider, usuario, role, viewerIsContratante, navigationRequest })",
  "const [navigationRequest, setNavigationRequest] = useState(null);",
  "const navegarPara = (id, subTab = \"\", action = \"\")",
  "navigationRequest={navigationRequest}",
];

for (const marker of markers) {
  if (!html.includes(marker)) throw new Error("Validação da Central de Comando falhou: " + marker);
}

const forbidden = [
  '{ id: "cla", label: "Clã Lamona", icon: ICrown },\n    { id: "membros"',
  'tab === "cla" && !isContratante',
  '...(isMobile ? [{ id: "cla"',
  'if (!isMobile && subTab === "cla")',
];

for (const marker of forbidden) {
  if (html.includes(marker)) throw new Error("Estrutura antiga ainda presente: " + marker);
}

for (const unique of [
  "function HomePage(",
  "function HistoriaPage(",
  "function DashboardMetric(",
  "function destinoSinalVisaoGeral(",
]) {
  const count = html.split(unique).length - 1;
  if (count !== 1) throw new Error(`${unique} encontrado ${count} vezes`);
}

console.log("Central de Comando, identidades F.O.X./Lamona/Jikkai e História unificada validadas.");

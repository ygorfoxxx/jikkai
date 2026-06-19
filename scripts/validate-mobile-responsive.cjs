const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const markers = [
  "MOBILE RESPONSIVE v1",
  "MOBILE POLISH v1",
  "viewport-fit=cover",
  "function useMediaQuery",
  "font-size: 16px",
  "mobileMoreOpen",
  "mobilePrimaryTabs",
  "mobile-sheet-panel",
  "hidden sm:block border-t border-zinc-900",
  "sm:hidden fixed inset-x-0 bottom-0",
  "bottom-20 right-3 sm:bottom-4",
  'subTab === "cla" && <ClaPage data={data} setData={setData} role={role} embedded />',
  '{ id: "cla", label: "Clã Lamona", mobileLabel: "Clã Lamona"',
  "function ClaPage({ data, setData, role, embedded = false })",
  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
  "max-h-[100dvh] sm:max-h-[92vh]",
  "pb-28 sm:pb-8",
  't.id === "visaogeral" || t.id === "home" ? "Início"',
  '<span className="sm:hidden leading-tight text-center">{t.mobileLabel}</span>',
  '<span className="hidden sm:inline leading-tight text-center">{t.label}</span>',
];

for (const marker of markers) {
  if (!html.includes(marker)) throw new Error("Validação mobile falhou: " + marker);
}

const removidosIntencionalmente = [
  '{ id: "cla", label: "Clã Lamona", icon: ICrown },\n    { id: "membros"',
  'tab === "cla" && !isContratante',
  'subTab === "cla" && isMobile',
  'if (!isMobile && subTab === "cla")',
];

for (const marker of removidosIntencionalmente) {
  if (html.includes(marker)) throw new Error("Navegação antiga ainda presente: " + marker);
}

for (const unique of ["function useMediaQuery", "function HistoriaPage", "function ClaPage", "const [mobileMoreOpen"]) {
  const count = html.split(unique).length - 1;
  if (count !== 1) throw new Error(unique + " encontrado " + count + " vezes");
}

console.log("Experiência mobile validada com Clã Lamona dentro de História em todos os dispositivos.");

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
  "subTab === \"cla\" && isMobile",
  "<ClaPage data={data} setData={setData} role={role} embedded />",
  "function ClaPage({ data, setData, role, embedded = false })",
  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
  "max-h-[100dvh] sm:max-h-[92vh]",
  "pb-28 sm:pb-8",
  't.id === "visaogeral" || t.id === "home" ? "Início"',
];

for (const marker of markers) {
  if (!html.includes(marker)) throw new Error("Validação mobile falhou: " + marker);
}

if (!html.includes('{ id: "cla", label: "Clã Lamona", icon: ICrown }')) {
  throw new Error("A aba desktop Clã Lamona foi removida ou alterada.");
}

for (const unique of ["function useMediaQuery", "function HistoriaPage", "function ClaPage", "const [mobileMoreOpen"]) {
  const count = html.split(unique).length - 1;
  if (count !== 1) throw new Error(unique + " encontrado " + count + " vezes");
}

console.log("Experiência mobile validada sem remover a navegação desktop.");

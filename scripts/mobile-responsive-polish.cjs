const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(label + ": esperado 1 marcador, encontrado " + count);
  html = html.replace(oldText, newText);
}

if (!html.includes("// MOBILE POLISH v1")) {
  replaceOnce(
    "// MOBILE RESPONSIVE v1 (navegação, toque, formulários e História integrada)",
    "// MOBILE RESPONSIVE v1 (navegação, toque, formulários e História integrada)\n// MOBILE POLISH v1 (áreas seguras, densidade e rótulos móveis)",
    "marcador de refinamento"
  );

  replaceOnce(
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
    "viewport seguro"
  );

  const css = `
  @media (max-width: 639px) {
    .p-6 { padding: 1rem !important; }
    .p-8, .p-10 { padding: 1.25rem !important; }
    .text-5xl { font-size: 2.5rem !important; line-height: 1 !important; }
    .text-4xl { font-size: 2rem !important; line-height: 1.1 !important; }
    .text-3xl { line-height: 1.15 !important; }
    .fixed.inset-0 { overscroll-behavior: contain; }
  }
`;
  replaceOnce("</style>", css + "</style>", "css de refinamento");

  replaceOnce(
    '<div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">',
    '<div className="max-w-6xl mx-auto px-3 py-3 sm:px-4 sm:py-4 flex items-center justify-between gap-3">',
    "cabeçalho compacto"
  );

  replaceOnce(
    'className="p-2 text-zinc-500 hover:text-red-500 transition-colors"',
    'className="mobile-tap p-2 text-zinc-500 hover:text-red-500 transition-colors flex items-center justify-center"',
    "botão de saída"
  );

  replaceOnce(
    '{t.id === "visaogeral" ? "Início" : t.label.replace(/ (.+)$/, "")}',
    '{t.id === "visaogeral" || t.id === "home" ? "Início" : t.label.replace(/ \\(.+\\)$/, "")}',
    "rótulos da navegação inferior"
  );

  fs.writeFileSync(path, html, "utf8");
  console.log("Refinamentos finais da experiência mobile aplicados.");
} else {
  console.log("Refinamentos mobile já aplicados.");
}

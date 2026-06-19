const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "estrutura-mapa-v2.cjs");
const runtimePath = path.join(__dirname, ".estrutura-mapa-v2.runtime.cjs");
let source = fs.readFileSync(sourcePath, "utf8");

function materializarTemplate(variable, nextCode) {
  const startToken = `const ${variable} = String.raw\``;
  const start = source.indexOf(startToken);
  const next = source.indexOf(nextCode, start + startToken.length);
  if (start < 0 || next < 0) throw new Error(`Bloco-fonte ausente: ${variable}`);

  let rawDeclaration = source.slice(start, next);
  let content = rawDeclaration.slice(startToken.length).trimEnd();
  if (!content.endsWith("`;")) throw new Error(`Fechamento inválido no bloco ${variable}`);
  content = content.slice(0, -2);

  source = source.slice(0, start) + `const ${variable} = ${JSON.stringify(content)};` + source.slice(next);
}

materializarTemplate("rolesBlock", '\n\n  html = replaceBlock(html, "const DEFAULT_ROLES = ["');
materializarTemplate("estruturaBlock", '\n\n  html = replaceBlock(html, "function EstruturaSection({ data, onOpen })"');
materializarTemplate("introBlock", '\n\n  html = replaceBlock(html, "function IntroducaoEstruturaAtual({ data, usuario })"');
materializarTemplate("ramosBlock", '\n\n  html = replaceBlock(html, "function RamosManager({ data, setData, usuario })"');
materializarTemplate("cargosBlock", '\n\n  html = replaceBlock(html, "function CargosManager({ data, setData })"');
materializarTemplate("migrateBlock", '\n\n  html = replaceBlock(html, "// Garante cargos protegidos + permissions[]"');
materializarTemplate("mapCss", '\n  mapa = replaceOnce(mapa, "</style>"');

fs.writeFileSync(runtimePath, source, "utf8");
try {
  require(runtimePath);
} finally {
  if (fs.existsSync(runtimePath)) fs.rmSync(runtimePath);
}

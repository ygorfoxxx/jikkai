const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const markers = [
  "Que meu próprio sangue queime, que as correntes da minha alma me esmaguem se eu trair este julgamento",
  "function fraseJuramentoAceita",
  "Recruta em Observação",
  "const escolherAvatarIniciacao",
  "foto_iniciacao_atualizada",
  "function nomeResponsavelEstrategico",
  '<optgroup label="Ramos">',
  'value={"ramo:" + r.id}',
];

for (const marker of markers) {
  if (!html.includes(marker)) throw new Error("Validação dos ajustes falhou: " + marker);
}

for (const unique of ["function fraseJuramentoAceita", "function nomeResponsavelEstrategico", "const escolherAvatarIniciacao"]) {
  const count = html.split(unique).length - 1;
  if (count !== 1) throw new Error(unique + " encontrado " + count + " vezes");
}

if (html.includes('const FRASE_JURAMENTO = "Meu sangue pertence à F.O.X.";')) {
  throw new Error("A frase antiga do juramento ainda está ativa.");
}
if (html.includes("const fraseOk = fraseTypo.trim() === FRASE_JURAMENTO;")) {
  throw new Error("A validação rígida antiga ainda está ativa.");
}

console.log("Ajustes de iniciação, juramento e responsáveis por ramo validados.");

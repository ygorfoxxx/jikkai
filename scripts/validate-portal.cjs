const fs = require("fs");
const https = require("https");
const vm = require("vm");

const html = fs.readFileSync("index.html", "utf8");
const markers = [
  "ETAPA 2 — REPUTAÇÃO E LEALDADE v1",
  "PROTOCOLO DE INICIAÇÃO v1",
  "function ReputacaoSection",
  "function RamosManager",
  "function IntroducaoPrimeiroAcesso",
  "function RegistroJuramentosManager",
  "function juramentoDoUsuario",
  'id: "reputacao", label: "Reputação"',
  'id: "ramos", label: "Ramos"',
  'id: "juramentos", label: "Juramentos"',
  "REPUTACAO_NIVEIS",
  "LEALDADE_NIVEIS",
  "Imagem do juramento no RP",
  'usuarioAtual.iniciacaoStatus === "pendente"',
  "migrated.juramentados",
];
for (const marker of markers) {
  if (!html.includes(marker)) throw new Error("Validação falhou: " + marker);
}
for (const unique of [
  "function ReputacaoSection",
  "function RamosManager",
  "function IntroducaoPrimeiroAcesso",
  "function RegistroJuramentosManager",
  "function JuramentoPage",
  "function JuramentadoView",
  "function MembrosPage",
  "function UsuariosManager",
]) {
  const count = html.split(unique).length - 1;
  if (count !== 1) throw new Error(unique + " encontrado " + count + " vezes");
}

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
if (!scripts.length) throw new Error("Script principal não encontrado");
const jsx = scripts[scripts.length - 1][1];

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(download(next, redirects + 1));
      }
      if (res.statusCode !== 200) return reject(new Error("Falha ao obter Babel: HTTP " + res.statusCode));
      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

(async () => {
  const babelCode = await download("https://unpkg.com/@babel/standalone@7.24.7/babel.min.js");
  const context = {};
  vm.createContext(context);
  vm.runInContext(babelCode, context);
  const result = context.Babel.transform(jsx, { presets: ["env", "react"], filename: "index.jsx" });
  if (!result || !result.code) throw new Error("Babel não gerou JavaScript");
  new vm.Script(result.code, { filename: "portal-compilado.js" });
  console.log("Portal validado:", result.code.length, "bytes compilados");
})().catch(error => {
  console.error(error);
  process.exit(1);
});

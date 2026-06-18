const fs = require("fs");
const https = require("https");
const vm = require("vm");

const html = fs.readFileSync("index.html", "utf8");
const mapa = fs.readFileSync("mapa.html", "utf8");

const htmlMarkers = [
  "ETAPA 2 — REPUTAÇÃO E LEALDADE v1",
  "PROTOCOLO DE INICIAÇÃO v1",
  "ETAPA 3 — PAINEL ESTRATÉGICO JIKKAI v1",
  "function ReputacaoSection",
  "function RamosManager",
  "function IntroducaoPrimeiroAcesso",
  "function RegistroJuramentosManager",
  "function coletarSinaisEstrategicos",
  "function FaseEstrategicaCard",
  "function ObjetivoEstrategicoCard",
  "function SinalEstrategicoCard",
  "function PlanoSection",
  "Gerar alerta no Painel JIKKAI",
  "criarAlertaManual",
  "migrated.sinaisEstrategicos",
];
for (const marker of htmlMarkers) {
  if (!html.includes(marker)) throw new Error("Validação do portal falhou: " + marker);
}

const mapMarkers = ["Comprometido", "Integração com o Painel JIKKAI", "populateStrategicLinks", "editorDraft.faseId"];
for (const marker of mapMarkers) {
  if (!mapa.includes(marker)) throw new Error("Validação do mapa falhou: " + marker);
}

const uniqueFunctions = [
  "function PlanoSection",
  "function FaseEditor",
  "function FaseEstrategicaCard",
  "function ObjetivoEstrategicoCard",
  "function SinalEstrategicoCard",
  "function coletarSinaisEstrategicos",
];
for (const marker of uniqueFunctions) {
  const count = html.split(marker).length - 1;
  if (count !== 1) throw new Error(marker + " encontrado " + count + " vezes");
}

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 5) {
        response.resume();
        return resolve(download(new URL(response.headers.location, url).toString(), redirects + 1));
      }
      if (response.statusCode !== 200) return reject(new Error("Falha ao obter Babel: HTTP " + response.statusCode));
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => body += chunk);
      response.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

(async () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const mapScripts = [...mapa.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  if (!scripts.length || !mapScripts.length) throw new Error("Scripts não encontrados");

  const babelCode = await download("https://unpkg.com/@babel/standalone@7.24.7/babel.min.js");
  const context = {};
  vm.createContext(context);
  vm.runInContext(babelCode, context);
  const compiled = context.Babel.transform(scripts[scripts.length - 1][1], { presets: ["env", "react"], filename: "index.jsx" });
  if (!compiled?.code) throw new Error("Babel não gerou JavaScript");
  new vm.Script(compiled.code, { filename: "portal-compilado.js" });
  new vm.Script(mapScripts[mapScripts.length - 1][1], { filename: "mapa.js" });
  console.log("Portal validado:", compiled.code.length, "bytes compilados");
})().catch(error => {
  console.error(error);
  process.exit(1);
});

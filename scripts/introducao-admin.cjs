const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function patchSection(oldText, newText, label) {
  const inicio = html.indexOf("function GerenciarPage");
  const fim = html.indexOf("function UsuariosManager", inicio);
  if (inicio < 0 || fim < 0) throw new Error(label + ": GerenciarPage não encontrada");
  const section = html.slice(inicio, fim);
  const count = section.split(oldText).length - 1;
  if (count !== 1) throw new Error(label + ": esperado 1 marcador, encontrado " + count);
  html = html.slice(0, inicio) + section.replace(oldText, newText) + html.slice(fim);
}

patchSection(
  '  const podeRamos = isLider;\n  const podeBackup = isLider;',
  '  const podeRamos = isLider;\n  const podeJuramentos = isLider;\n  const podeBackup = isLider;',
  "permissão do arquivo de juramentos"
);

patchSection(
  '          podeRamos && { id: "ramos", label: "Ramos", icon: IShield },\n          podeMissoes',
  '          podeRamos && { id: "ramos", label: "Ramos", icon: IShield },\n          podeJuramentos && { id: "juramentos", label: "Juramentos", icon: ISkull },\n          podeMissoes',
  "aba de juramentos"
);

patchSection(
  '      {aba === "ramos" && <RamosManager data={data} setData={setData} usuario={usuario} />}\n      {aba === "missoes"',
  '      {aba === "ramos" && <RamosManager data={data} setData={setData} usuario={usuario} />}\n      {aba === "juramentos" && <RegistroJuramentosManager data={data} setData={setData} usuario={usuario} />}\n      {aba === "missoes"',
  "renderização do arquivo de juramentos"
);

for (const marcador of ['id: "juramentos", label: "Juramentos"', "<RegistroJuramentosManager"]) {
  if (!html.includes(marcador)) throw new Error("Administração de juramentos incompleta: " + marcador);
}

fs.writeFileSync(path, html, "utf8");
console.log("Arquivo administrativo de juramentos aplicado.");

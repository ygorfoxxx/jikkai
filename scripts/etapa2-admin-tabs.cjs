const fs = require("fs");
const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function patch(startMarker, endMarker, oldText, newText, label) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${label}: seção ausente`);
  const section = html.slice(start, end);
  const count = section.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: marcador ${count}`);
  html = html.slice(0, start) + section.replace(oldText, newText) + html.slice(end);
}

patch(
  "function GerenciarPage",
  "function UsuariosManager",
  '  const podeCargos = isLider || hasPerm(role,"manage_roles");\n  const podeBackup = isLider;',
  '  const podeCargos = isLider || hasPerm(role,"manage_roles");\n  const podeRamos = isLider;\n  const podeBackup = isLider;',
  "permissão"
);

patch(
  "function GerenciarPage",
  "function UsuariosManager",
  '          podeCargos && { id: "cargos", label: "Cargos", icon: ICrown },\n          podeMissoes',
  '          podeCargos && { id: "cargos", label: "Cargos", icon: ICrown },\n          podeRamos && { id: "ramos", label: "Ramos", icon: IShield },\n          podeMissoes',
  "aba"
);

patch(
  "function GerenciarPage",
  "function UsuariosManager",
  '      {aba === "cargos" && <CargosManager data={data} setData={setData} />}\n      {aba === "missoes"',
  '      {aba === "cargos" && <CargosManager data={data} setData={setData} />}\n      {aba === "ramos" && <RamosManager data={data} setData={setData} usuario={usuario} />}\n      {aba === "missoes"',
  "render"
);

if (!html.includes('id: "ramos", label: "Ramos"')) throw new Error("Aba Ramos não aplicada");
fs.writeFileSync(path, html, "utf8");
console.log("Aba administrativa de ramos aplicada.");

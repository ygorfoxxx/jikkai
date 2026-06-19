const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const mapa = fs.readFileSync("mapa.html", "utf8");

const htmlMarkers = [
  "ACESSO RAIZ LEADER v1",
  "function isRootUser(user)",
  "function roleEfetivoUsuario(user, role)",
  "hasLeaderPerms: true",
  "permissions: ALL_PERMISSIONS",
  "const role = roleEfetivoUsuario(usuarioAtual, roleRegistrado);",
  "const isLider = isRootUser(usuarioAtual) || role?.hasLeaderPerms === true;",
  "const isContratante = !isRootUser(usuarioAtual) && usuarioAtual?.role === \"contratante\";",
];

for (const marker of htmlMarkers) {
  if (!html.includes(marker)) throw new Error("Validação do acesso raiz falhou no portal: " + marker);
}

const mapMarkers = [
  "function userCanEdit(user,role)",
  "const eligible=userCanEdit(user,role);",
  "if(!user||!userCanEdit(user,role))",
  'toLowerCase()==="leader"||roleCanEdit(role)',
];

for (const marker of mapMarkers) {
  if (!mapa.includes(marker)) throw new Error("Validação do acesso raiz falhou no mapa: " + marker);
}

console.log("Acesso raiz permanente do usuário leader validado no portal e no mapa.");

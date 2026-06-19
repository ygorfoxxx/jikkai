const fs = require("fs");

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador, encontrado ${count}`);
  return text.replace(oldText, newText);
}

let html = fs.readFileSync("index.html", "utf8");

if (!html.includes("// ACESSO RAIZ LEADER v1")) {
  html = replaceOnce(
    html,
    "// ESTRUTURA HIERARQUICA v2 (cargos posicionais, conselheiro lateral e capitães de ramo)",
    "// ESTRUTURA HIERARQUICA v2 (cargos posicionais, conselheiro lateral e capitães de ramo)\n// ACESSO RAIZ LEADER v1 (o username leader mantém autoridade total independentemente do cargo)",
    "marcador do acesso raiz"
  );

  html = replaceOnce(
    html,
    `function hasPerm(role, permId) {\n  if (!role) return false;\n  if (role.hasLeaderPerms === true) return true;\n  return Array.isArray(role.permissions) && role.permissions.includes(permId);\n}`,
    `function hasPerm(role, permId) {\n  if (!role) return false;\n  if (role.hasLeaderPerms === true) return true;\n  return Array.isArray(role.permissions) && role.permissions.includes(permId);\n}\n\nfunction isRootUser(user) {\n  return String(user?.username || "").trim().toLowerCase() === "leader";\n}\n\nfunction roleEfetivoUsuario(user, role) {\n  if (!isRootUser(user)) return role;\n  return {\n    id: role?.id || "leader",\n    nome: role?.nome || "Acesso raiz",\n    cor: role?.cor || "#D85A30",\n    estruturaPosicao: role?.estruturaPosicao || "independente",\n    ...(role || {}),\n    hasLeaderPerms: true,\n    permissions: ALL_PERMISSIONS,\n    rootAccess: true,\n  };\n}`,
    "helpers do acesso raiz"
  );

  html = replaceOnce(
    html,
    `  const role = usuarioAtual && data ? data.roles.find(r => r.id === usuarioAtual.role) : null;`,
    `  const roleRegistrado = usuarioAtual && data ? data.roles.find(r => r.id === usuarioAtual.role) : null;\n  const role = roleEfetivoUsuario(usuarioAtual, roleRegistrado);`,
    "cargo efetivo da sessão"
  );

  html = replaceOnce(
    html,
    `  const isLider = role?.hasLeaderPerms === true;`,
    `  const isLider = isRootUser(usuarioAtual) || role?.hasLeaderPerms === true;`,
    "identificação de líder"
  );

  html = replaceOnce(
    html,
    `  const isContratante = usuarioAtual?.role === "contratante";`,
    `  const isContratante = !isRootUser(usuarioAtual) && usuarioAtual?.role === "contratante";`,
    "proteção contra perfil externo"
  );

  fs.writeFileSync("index.html", html, "utf8");
  console.log("Acesso raiz permanente do usuário leader aplicado ao portal.");
} else {
  console.log("Acesso raiz do usuário leader já aplicado ao portal.");
}

let mapa = fs.readFileSync("mapa.html", "utf8");

if (!mapa.includes("function userCanEdit(user,role)")) {
  mapa = replaceOnce(
    mapa,
    `  const eligible=roleCanEdit(role);`,
    `  const eligible=userCanEdit(user,role);`,
    "autorização do visualizador no mapa"
  );

  mapa = replaceOnce(
    mapa,
    `function roleCanEdit(role){\n  return !!(role&&(role.hasLeaderPerms===true||role.id==="conselheiro"||(Array.isArray(role.permissions)&&role.permissions.includes("edit_map"))));\n}`,
    `function roleCanEdit(role){\n  return !!(role&&(role.hasLeaderPerms===true||role.id==="conselheiro"||(Array.isArray(role.permissions)&&role.permissions.includes("edit_map"))));\n}\nfunction userCanEdit(user,role){\n  return String(user?.username||"").trim().toLowerCase()==="leader"||roleCanEdit(role);\n}`,
    "acesso raiz do mapa"
  );

  mapa = replaceOnce(
    mapa,
    `  if(!user||!roleCanEdit(role)){`,
    `  if(!user||!userCanEdit(user,role)){`,
    "autenticação do mapa"
  );

  fs.writeFileSync("mapa.html", mapa, "utf8");
  console.log("Acesso raiz permanente do usuário leader aplicado ao mapa.");
} else {
  console.log("Acesso raiz do usuário leader já aplicado ao mapa.");
}

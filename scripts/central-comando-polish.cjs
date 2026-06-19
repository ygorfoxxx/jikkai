const fs = require("fs");

let html = fs.readFileSync("index.html", "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador, encontrado ${count}`);
  html = html.replace(oldText, newText);
}

if (!html.includes("// IDENTIDADE FOX LAMONA JIKKAI v1")) {
  replaceOnce(
    "// CENTRAL DE COMANDO v2 (F.O.X. como grupo, Lamona como legado e Jikkai como organização operacional)",
    "// CENTRAL DE COMANDO v2 (F.O.X. como grupo, Lamona como legado e Jikkai como organização operacional)\n// IDENTIDADE FOX LAMONA JIKKAI v1",
    "marcador de identidade"
  );

  replaceOnce(
    '<div className="text-zinc-600 text-[10px] uppercase tracking-widest truncate">Clã Lamona</div>',
    '<div className="text-zinc-600 text-[10px] uppercase tracking-widest truncate">Grupo F.O.X. · Organização Jikkai</div>',
    "subtítulo do cabeçalho"
  );

  replaceOnce(
    'sub="Dossiês, hierarquia, reputação e formações da F.O.X."',
    'sub="Membros da F.O.X. e estrutura operacional da Jikkai."',
    "subtítulo da área de membros"
  );

  replaceOnce(
    '<p className="uppercase tracking-widest">F.O.X. · Clã Lamona · {new Date().getFullYear()}</p>',
    '<p className="uppercase tracking-widest">Grupo F.O.X. · Organização Jikkai · Legado Lamona · {new Date().getFullYear()}</p>',
    "rodapé institucional"
  );

  fs.writeFileSync("index.html", html, "utf8");
  console.log("Identidade F.O.X., Lamona e Jikkai alinhada no portal.");
} else {
  console.log("Identidade institucional já alinhada.");
}

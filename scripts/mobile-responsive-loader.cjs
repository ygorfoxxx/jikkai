const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "mobile-responsive.cjs");
const runtimePath = path.join(__dirname, ".mobile-responsive.runtime.cjs");
let source = fs.readFileSync(sourcePath, "utf8");

function patch(oldBlock, newBlock, label) {
  const count = source.split(oldBlock).length - 1;
  if (count !== 1) throw new Error(label + ": esperado 1 bloco, encontrado " + count);
  source = source.replace(oldBlock, newBlock);
}

patch(
`  replaceOnce(
    'className="ml-auto text-red-300 bg-red-950/80 p-2 rounded"',
    'className="mobile-tap col-span-2 sm:col-span-1 sm:ml-auto text-red-300 bg-red-950/80 p-2 rounded flex items-center justify-center"',
    "excluir clã mobile"
  );`,
`  replaceAll(
    'className="ml-auto text-red-300 bg-red-950/80 p-2 rounded"',
    'className="mobile-tap col-span-2 sm:col-span-1 sm:ml-auto text-red-300 bg-red-950/80 p-2 rounded flex items-center justify-center"',
    1,
    "ações de exclusão mobile"
  );`,
"ações de exclusão"
);

patch(
`  replaceOnce(
    '<div className="flex gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded items-start">',
    '<div className="flex flex-col sm:flex-row gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded items-start">',
    "mandamento mobile"
  );`,
`  replaceOnce(
    'className="flex gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded items-start"',
    'className="flex flex-col sm:flex-row gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded items-start"',
    "mandamento mobile"
  );`,
"estrutura dos mandamentos"
);

fs.writeFileSync(runtimePath, source, "utf8");

try {
  require(runtimePath);
} finally {
  if (fs.existsSync(runtimePath)) fs.rmSync(runtimePath);
}

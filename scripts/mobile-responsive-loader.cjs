const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "mobile-responsive.cjs");
const runtimePath = path.join(__dirname, ".mobile-responsive.runtime.cjs");
let source = fs.readFileSync(sourcePath, "utf8");

const oldBlock = `  replaceOnce(
    'className="ml-auto text-red-300 bg-red-950/80 p-2 rounded"',
    'className="mobile-tap col-span-2 sm:col-span-1 sm:ml-auto text-red-300 bg-red-950/80 p-2 rounded flex items-center justify-center"',
    "excluir clã mobile"
  );`;

const newBlock = `  replaceAll(
    'className="ml-auto text-red-300 bg-red-950/80 p-2 rounded"',
    'className="mobile-tap col-span-2 sm:col-span-1 sm:ml-auto text-red-300 bg-red-950/80 p-2 rounded flex items-center justify-center"',
    1,
    "ações de exclusão mobile"
  );`;

const count = source.split(oldBlock).length - 1;
if (count !== 1) throw new Error("Correção mobile esperava 1 bloco, encontrou " + count);
source = source.replace(oldBlock, newBlock);
fs.writeFileSync(runtimePath, source, "utf8");

try {
  require(runtimePath);
} finally {
  if (fs.existsSync(runtimePath)) fs.rmSync(runtimePath);
}

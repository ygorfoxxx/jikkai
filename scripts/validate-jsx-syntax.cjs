const fs = require("fs");
const parser = require("@babel/parser");

const html = fs.readFileSync("index.html", "utf8");
const match = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/i);
if (!match) throw new Error("Script Babel principal não encontrado em index.html.");

parser.parse(match[1], {
  sourceType: "script",
  allowReturnOutsideFunction: false,
  plugins: [
    "jsx",
    "optionalChaining",
    "nullishCoalescingOperator",
    "objectRestSpread",
  ],
});

console.log("Sintaxe JSX do portal validada com @babel/parser.");

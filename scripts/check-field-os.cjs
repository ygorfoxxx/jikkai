const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const modules = [
  "assets/js/rule-timer-presets.js",
  "assets/js/field-state.js",
  "assets/js/training.js",
  "assets/js/quick-actions.js",
  "assets/js/auto-report.js"
];
for (const relative of modules) require(path.join(root, relative));

for (const relative of ["app.html", "overlay.html", "mapa.html"]) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, "utf8");
  const scripts = [...source.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  for (const script of scripts) {
    if (script.trim()) new Function(script);
  }
}

const portal = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!/<script type="text\/babel"/i.test(portal)) throw new Error("Portal Babel script missing");
for (const marker of ["fox_state", "localStorage", "juramento", "dossie"]) {
  if (!portal.toLowerCase().includes(marker.toLowerCase())) throw new Error(`Portal marker missing: ${marker}`);
}

const app = fs.readFileSync(path.join(root, "app.html"), "utf8");
const overlay = fs.readFileSync(path.join(root, "overlay.html"), "utf8");
for (const required of ["rule-timer-presets.js", "field-state.js", "training.js", "quick-actions.js", "auto-report.js"]) {
  if (!app.includes(`assets/js/${required}`) || !overlay.includes(`assets/js/${required}`)) throw new Error(`Module missing: ${required}`);
}
console.log("field-os check: ok");

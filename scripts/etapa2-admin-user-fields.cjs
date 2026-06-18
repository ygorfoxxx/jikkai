const fs = require("fs");
const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function patch(oldText, newText, label) {
  const start = html.indexOf("function UsuariosManager");
  const end = html.indexOf("function CargosManager", start);
  if (start < 0 || end < 0) throw new Error(`${label}: seção ausente`);
  const section = html.slice(start, end);
  const count = section.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: marcador ${count}`);
  html = html.slice(0, start) + section.replace(oldText, newText) + html.slice(end);
}

patch(
  '    nivelAcesso: 1, iniciacaoStatus: "pendente", avatarUrl: "", avatarStoragePath: "",',
  '    nivelAcesso: 1, iniciacaoStatus: "pendente", avatarUrl: "", avatarStoragePath: "",\n    reputacao: "Desconhecido", lealdade: "Observado", reputacaoNota: "", lealdadeNota: "",',
  "valores"
);

patch(
  `            <div><label className="fox-label">Ramo</label><select value={form.cla || ""} onChange={e => setForm({ ...form, cla: e.target.value })} className="fox-input"><option value="">— Sem ramo —</option>{(data.clas || []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            <div><label className="fox-label">Posição na estrutura</label>`,
  `            <div><label className="fox-label">Ramo</label><select value={form.cla || ""} onChange={e => setForm({ ...form, cla: e.target.value })} className="fox-input"><option value="">— Sem ramo —</option>{(data.clas || []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            <div><label className="fox-label">Reputação externa</label><select value={form.reputacao || "Desconhecido"} onChange={e => setForm({ ...form, reputacao: e.target.value, reputacaoAtualizadaEm: new Date().toISOString() })} className="fox-input">{REPUTACAO_NIVEIS.map(n => <option key={n}>{n}</option>)}</select></div>
            <div><label className="fox-label">Lealdade interna</label><select value={form.lealdade || "Observado"} onChange={e => setForm({ ...form, lealdade: e.target.value, lealdadeAtualizadaEm: new Date().toISOString() })} className="fox-input">{LEALDADE_NIVEIS.map(n => <option key={n}>{n}</option>)}</select></div>
            <div><label className="fox-label">Posição na estrutura</label>`,
  "seletores"
);

if (!html.includes("REPUTACAO_NIVEIS.map") || !html.includes("LEALDADE_NIVEIS.map")) throw new Error("Seletores narrativos ausentes");
fs.writeFileSync(path, html, "utf8");
console.log("Níveis narrativos adicionados ao editor.");

const fs = require("fs");
let html = fs.readFileSync("index.html", "utf8");
const start = html.indexOf("function UsuariosManager");
const end = html.indexOf("function CargosManager", start);
if (start < 0 || end < 0) throw new Error("Editor de membros não encontrado");
const oldText = `            <div><label className="fox-label">Iniciação</label><select value={form.iniciacaoStatus || "pendente"} onChange={e => setForm({ ...form, iniciacaoStatus: e.target.value })} className="fox-input"><option value="pendente">Pendente</option><option value="concluida">Concluída</option></select></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="fox-label">Descrição / observação de dossiê</label>`;
const newText = `            <div><label className="fox-label">Iniciação</label><select value={form.iniciacaoStatus || "pendente"} onChange={e => setForm({ ...form, iniciacaoStatus: e.target.value })} className="fox-input"><option value="pendente">Pendente</option><option value="concluida">Concluída</option></select></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="fox-label">Justificativa da reputação</label><textarea rows="2" value={form.reputacaoNota || ""} onChange={e => setForm({ ...form, reputacaoNota: e.target.value })} className="fox-input" placeholder="Motivo da classificação externa" /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="fox-label">Justificativa da lealdade</label><textarea rows="2" value={form.lealdadeNota || ""} onChange={e => setForm({ ...form, lealdadeNota: e.target.value })} className="fox-input" placeholder="Motivo da classificação interna" /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="fox-label">Descrição / observação de dossiê</label>`;
const section = html.slice(start, end);
if ((section.split(oldText).length - 1) !== 1) throw new Error("Marcador das notas não encontrado");
html = html.slice(0, start) + section.replace(oldText, newText) + html.slice(end);
fs.writeFileSync("index.html", html, "utf8");
console.log("Notas narrativas aplicadas.");

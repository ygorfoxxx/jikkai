const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function countOf(needle) {
  return html.split(needle).length - 1;
}

function replaceOnce(oldText, newText, label) {
  const count = countOf(oldText);
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador, encontrado ${count}`);
  html = html.replace(oldText, newText);
}

function replaceInSection(startMarker, endMarker, oldText, newText, label) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${label}: seção não encontrada`);
  const section = html.slice(start, end);
  const count = section.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador na seção, encontrado ${count}`);
  html = html.slice(0, start) + section.replace(oldText, newText) + html.slice(end);
}

const reputationSection = `function ReputacaoSection({ data, onOpen }) {
  const [filtroReputacao, setFiltroReputacao] = useState("Todos");
  const [filtroLealdade, setFiltroLealdade] = useState("Todos");
  const [busca, setBusca] = useState("");

  const membros = (data.users || [])
    .filter(u => u.role !== "contratante")
    .filter(u => filtroReputacao === "Todos" || u.reputacao === filtroReputacao)
    .filter(u => filtroLealdade === "Todos" || u.lealdade === filtroLealdade)
    .filter(u => {
      const termo = busca.trim().toLowerCase();
      if (!termo) return true;
      return [u.codinome, u.displayName, u.nomeRP, u.username].some(v => String(v || "").toLowerCase().includes(termo));
    })
    .slice()
    .sort((a, b) => {
      const lealdade = lealdadeConfig(b.lealdade).indice - lealdadeConfig(a.lealdade).indice;
      if (lealdade !== 0) return lealdade;
      return reputacaoConfig(b.reputacao).indice - reputacaoConfig(a.reputacao).indice;
    });

  return (
    <div className="fadein space-y-6">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-red-900/40 bg-gradient-to-br from-red-950/20 to-black p-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-red-600 mb-1">Visão do mundo</div>
          <h3 className="text-xl font-black text-orange-50 serif">Reputação externa</h3>
          <p className="text-zinc-500 text-sm mt-2">Representa como vilas, rivais, contratantes e rumores enxergam cada operador.</p>
          <div className="flex flex-wrap gap-2 mt-4">{REPUTACAO_NIVEIS.map(n => <ReputacaoBadge key={n} tipo="reputacao" valor={n} compacto />)}</div>
        </div>
        <div className="rounded-xl border border-orange-900/40 bg-gradient-to-br from-orange-950/20 to-black p-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-orange-600 mb-1">Confiança da organização</div>
          <h3 className="text-xl font-black text-orange-50 serif">Lealdade interna</h3>
          <p className="text-zinc-500 text-sm mt-2">Representa confiança, compromisso, histórico e importância dentro da Jikkai.</p>
          <div className="flex flex-wrap gap-2 mt-4">{LEALDADE_NIVEIS.map(n => <ReputacaoBadge key={n} tipo="lealdade" valor={n} compacto />)}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
        <div>
          <label className="fox-label">Buscar membro</label>
          <input value={busca} onChange={e => setBusca(e.target.value)} className="fox-input" placeholder="Codinome, nome ou usuário" />
        </div>
        <div>
          <label className="fox-label">Reputação externa</label>
          <select value={filtroReputacao} onChange={e => setFiltroReputacao(e.target.value)} className="fox-input">
            <option>Todos</option>
            {REPUTACAO_NIVEIS.map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="fox-label">Lealdade interna</label>
          <select value={filtroLealdade} onChange={e => setFiltroLealdade(e.target.value)} className="fox-input">
            <option>Todos</option>
            {LEALDADE_NIVEIS.map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-zinc-500 text-sm italic">{membros.length} {membros.length === 1 ? "registro encontrado" : "registros encontrados"}</div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-700">Alterações oficiais: somente liderança</div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {membros.map(u => {
          const ramo = (data.clas || []).find(c => c.id === u.cla);
          return (
            <button key={u.username} onClick={() => onOpen(u)} className="text-left rounded-xl border border-zinc-800 bg-zinc-950/60 hover:border-orange-700 transition-all p-4">
              <div className="flex items-center gap-3">
                <MemberAvatar user={u} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-orange-50 font-black truncate">{getCodinome(u)}</div>
                  <div className="text-zinc-600 text-xs truncate">{ramo?.nome || "Sem ramo"} · {u.patente || "Sem patente"}</div>
                </div>
              </div>
              <div className="grid gap-2 mt-4">
                <div className="flex items-center justify-between gap-2"><span className="text-[9px] uppercase tracking-wider text-red-700">Externa</span><ReputacaoBadge tipo="reputacao" valor={u.reputacao} compacto /></div>
                <div className="flex items-center justify-between gap-2"><span className="text-[9px] uppercase tracking-wider text-orange-700">Interna</span><ReputacaoBadge tipo="lealdade" valor={u.lealdade} compacto /></div>
              </div>
              {(u.reputacaoNota || u.lealdadeNota) && <div className="mt-3 pt-3 border-t border-zinc-800 text-zinc-600 text-xs line-clamp-2">{u.lealdadeNota || u.reputacaoNota}</div>}
            </button>
          );
        })}
      </div>

      {membros.length === 0 && <div className="p-10 text-center rounded-xl border border-zinc-800 bg-zinc-950/40 text-zinc-600 italic">Nenhum membro corresponde aos filtros.</div>}
    </div>
  );
}

`;

replaceOnce(
  "function MembrosPage({ data, setData, role, usuario, viewerIsContratante }) {",
  reputationSection + "function MembrosPage({ data, setData, role, usuario, viewerIsContratante }) {",
  "seção de reputação"
);

replaceInSection(
  "function MembrosPage",
  "function TriosSection",
  `    { id: "estrutura", label: "Estrutura", icon: ICrown, badge: null },
    { id: "trios", label: "Trios", icon: ISwords, badge: (data.trios || []).length || null },`,
  `    { id: "estrutura", label: "Estrutura", icon: ICrown, badge: null },
    { id: "reputacao", label: "Reputação", icon: ITarget, badge: null },
    { id: "trios", label: "Trios", icon: ISwords, badge: (data.trios || []).length || null },`,
  "aba de reputação"
);

replaceInSection(
  "function MembrosPage",
  "function TriosSection",
  `      {subTab === "estrutura" && <EstruturaSection data={data} onOpen={setDossieAberto} />}
      {subTab === "trios" && <TriosSection data={data} setData={setData} podeEditar={podeEditarTrios} />}`,
  `      {subTab === "estrutura" && <EstruturaSection data={data} onOpen={setDossieAberto} />}
      {subTab === "reputacao" && <ReputacaoSection data={data} onOpen={setDossieAberto} />}
      {subTab === "trios" && <TriosSection data={data} setData={setData} podeEditar={podeEditarTrios} />}`,
  "renderização da reputação"
);

replaceInSection(
  "function MembrosPage",
  "function TriosSection",
  'sub="Dossiês, hierarquia e formações da F.O.X."',
  'sub="Dossiês, hierarquia, reputação e formações da F.O.X."',
  "subtítulo dos membros"
);

for (const marker of ["function ReputacaoSection", 'id: "reputacao", label: "Reputação"', 'subTab === "reputacao"']) {
  if (!html.includes(marker)) throw new Error(`Validação visual da Etapa 2 falhou: ${marker}`);
}
if (countOf("function ReputacaoSection") !== 1) throw new Error("ReputacaoSection duplicada");

fs.writeFileSync(path, html, "utf8");
console.log("Painel visual de reputação aplicado.");

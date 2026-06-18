const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador, encontrado ${count}`);
  html = html.replace(oldText, newText);
}

replaceOnce(
  "function RelatorioModal({ relatorio, onSave, onClose, niveisPermitidos = SIGILO_NIVEIS }) {",
  "function RelatorioModal({ relatorio, onSave, onClose, niveisPermitidos = SIGILO_NIVEIS, data }) {",
  "propriedade data do relatório"
);

replaceOnce(
  '  const [confidencialidade, setConfid] = useState(normalizarSigilo(relatorio?.confidencialidade || niveisPermitidos[Math.min(1, niveisPermitidos.length - 1)] || "Público"));\n\n  const valido',
  `  const [confidencialidade, setConfid] = useState(normalizarSigilo(relatorio?.confidencialidade || niveisPermitidos[Math.min(1, niveisPermitidos.length - 1)] || "Público"));
  const [alertaJikkai, setAlertaJikkai] = useState(Boolean(relatorio?.alertaJikkai));
  const [riscoJikkai, setRiscoJikkai] = useState(relatorio?.riscoJikkai || "Moderado");
  const [categoriaJikkai, setCategoriaJikkai] = useState(relatorio?.categoriaJikkai || "Inteligência");
  const [faseId, setFaseId] = useState(relatorio?.faseId || "");
  const [objetivoId, setObjetivoId] = useState(relatorio?.objetivoId || "");
  const [resumoEstrategico, setResumoEstrategico] = useState(relatorio?.resumoEstrategico || "");
  const faseSelecionada = (data?.fases || []).find(f => f.id === faseId);

  const valido`,
  "estados estratégicos do relatório"
);

replaceOnce(
  `      descricao: descricao.trim(),
      confidencialidade,
    });`,
  `      descricao: descricao.trim(),
      confidencialidade,
      alertaJikkai,
      riscoJikkai: alertaJikkai ? riscoJikkai : "",
      categoriaJikkai: alertaJikkai ? categoriaJikkai : "",
      faseId: alertaJikkai ? faseId : "",
      objetivoId: alertaJikkai ? objetivoId : "",
      resumoEstrategico: alertaJikkai ? resumoEstrategico.trim() : "",
      statusAlerta: alertaJikkai ? (relatorio?.statusAlerta || "ativo") : "",
    });`,
  "dados estratégicos do relatório"
);

replaceOnce(
  `          <div>
            <label className="fox-label">Descrição completa *</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="8" className="fox-input" placeholder="Detalhes da observação, contexto, possíveis implicações..." />
          </div>`,
  `          <div>
            <label className="fox-label">Descrição completa *</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="8" className="fox-input" placeholder="Detalhes da observação, contexto, possíveis implicações..." />
          </div>

          <div className={\`rounded-lg border p-4 transition-colors \${alertaJikkai ? "border-red-800 bg-red-950/20" : "border-zinc-800 bg-black/30"}\`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={alertaJikkai} onChange={e => setAlertaJikkai(e.target.checked)} className="mt-1 w-4 h-4 accent-red-600" />
              <div><div className="text-orange-50 font-bold text-sm">Gerar alerta no Painel JIKKAI</div><div className="text-zinc-600 text-xs mt-1">O painel exibirá este relatório como uma fonte rastreável de risco. Não marque relatórios comuns.</div></div>
            </label>
            {alertaJikkai && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-red-900/40 fadein">
                <div><label className="fox-label">Nível de risco</label><select value={riscoJikkai} onChange={e => setRiscoJikkai(e.target.value)} className="fox-input">{Object.keys(RISCO_CFG).map(r => <option key={r}>{r}</option>)}</select></div>
                <div><label className="fox-label">Categoria</label><select value={categoriaJikkai} onChange={e => setCategoriaJikkai(e.target.value)} className="fox-input"><option>Inteligência</option><option>Operacional</option><option>Político</option><option>Diplomático</option><option>Exposição</option><option>Financeiro</option><option>Pessoal</option><option>Desconhecido</option></select></div>
                <div><label className="fox-label">Fase afetada</label><select value={faseId} onChange={e => { setFaseId(e.target.value); setObjetivoId(""); }} className="fox-input"><option value="">— Plano geral —</option>{(data?.fases || []).map(f => <option key={f.id} value={f.id}>Fase {f.n} · {f.titulo}</option>)}</select></div>
                <div><label className="fox-label">Objetivo afetado</label><select value={objetivoId} onChange={e => setObjetivoId(e.target.value)} className="fox-input" disabled={!faseSelecionada}><option value="">— Toda a fase —</option>{(faseSelecionada?.objetivos || []).map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}</select></div>
                <div className="sm:col-span-2"><label className="fox-label">Resumo para a central de comando</label><textarea rows="3" value={resumoEstrategico} onChange={e => setResumoEstrategico(e.target.value)} className="fox-input" placeholder="Ex: Informante em Suna comprometido; interromper contato e revisar a rota de infiltração." /></div>
              </div>
            )}
          </div>`,
  "painel estratégico no modal de relatório"
);

replaceOnce(
  `                    {r.statusAprovacao && <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800">{r.statusAprovacao}</span>}
                    {r.local &&`,
  `                    {r.statusAprovacao && <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800">{r.statusAprovacao}</span>}
                    {r.alertaJikkai && <><FonteEstrategicaBadge tipo="relatorio" /><RiscoBadge risco={r.riscoJikkai} compacto /></>}
                    {r.local &&`,
  "badges estratégicos do relatório"
);

replaceOnce(
  `          niveisPermitidos={niveisPermitidos}
        />`,
  `          niveisPermitidos={niveisPermitidos}
          data={data}
        />`,
  "envio de data ao modal"
);

for (const marker of ["Gerar alerta no Painel JIKKAI", "resumoEstrategico", "data={data}", "FonteEstrategicaBadge tipo=\"relatorio\""]) {
  if (!html.includes(marker)) throw new Error("Integração de relatórios ausente: " + marker);
}

fs.writeFileSync(path, html, "utf8");
console.log("Relatórios integrados ao Painel Estratégico.");

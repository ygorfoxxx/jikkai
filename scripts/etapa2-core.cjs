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

replaceOnce(
  "// ETAPA 1 — FUNDAÇÃO DOS MEMBROS v1 (dossiês, avatares, estrutura e vínculos)",
  "// ETAPA 1 — FUNDAÇÃO DOS MEMBROS v1 (dossiês, avatares, estrutura e vínculos)\n// ETAPA 2 — REPUTAÇÃO E LEALDADE v1 (ramos dinâmicos e progressão narrativa)",
  "marcador da Etapa 2"
);

const reputationBlock = `const REPUTACAO_NIVEIS = ["Desconhecido", "Sussurros", "Temido", "Procurado", "Lenda das Sombras"];
const LEALDADE_NIVEIS = ["Observado", "Recruta", "Juramentado", "Veterano", "Pilar da F.O.X."];

const REPUTACAO_CFG = {
  "Desconhecido": { indice: 0, badge: "border-zinc-700 bg-zinc-950 text-zinc-400", desc: "O mundo exterior ainda não reconhece este nome." },
  "Sussurros": { indice: 1, badge: "border-slate-700 bg-slate-950 text-slate-300", desc: "Rumores começaram a circular entre vilas e informantes." },
  "Temido": { indice: 2, badge: "border-orange-800 bg-orange-950/40 text-orange-300", desc: "A presença deste operador já altera decisões e rotas." },
  "Procurado": { indice: 3, badge: "border-red-800 bg-red-950/50 text-red-300", desc: "Vilas, rivais ou autoridades procuram ativamente este nome." },
  "Lenda das Sombras": { indice: 4, badge: "border-purple-700 bg-purple-950/50 text-purple-300", desc: "O nome ultrapassou os fatos e tornou-se parte da história." },
};

const LEALDADE_CFG = {
  "Observado": { indice: 0, badge: "border-zinc-700 bg-zinc-950 text-zinc-400", desc: "Ainda está sob avaliação da liderança." },
  "Recruta": { indice: 1, badge: "border-blue-800 bg-blue-950/40 text-blue-300", desc: "Foi admitido, mas ainda está construindo confiança interna." },
  "Juramentado": { indice: 2, badge: "border-orange-800 bg-orange-950/40 text-orange-300", desc: "Assumiu formalmente o pacto e os princípios da organização." },
  "Veterano": { indice: 3, badge: "border-red-800 bg-red-950/50 text-red-300", desc: "Possui histórico comprovado de serviço, presença e confiança." },
  "Pilar da F.O.X.": { indice: 4, badge: "border-yellow-700 bg-yellow-950/40 text-yellow-300", desc: "Sustenta a organização, o legado e suas decisões mais importantes." },
};

function reputacaoConfig(valor) {
  return REPUTACAO_CFG[valor] || REPUTACAO_CFG.Desconhecido;
}

function lealdadeConfig(valor) {
  return LEALDADE_CFG[valor] || LEALDADE_CFG.Observado;
}

function ReputacaoBadge({ tipo, valor, compacto = false }) {
  const interno = tipo === "lealdade";
  const config = interno ? lealdadeConfig(valor) : reputacaoConfig(valor);
  const Icone = interno ? IShield : ITarget;
  return (
    <span className={\`inline-flex items-center gap-1 rounded border font-black uppercase tracking-wider \${config.badge} \${compacto ? "text-[8px] px-1.5 py-0.5" : "text-[10px] px-2 py-1"}\`} title={config.desc}>
      <Icone className={compacto ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {valor || (interno ? "Observado" : "Desconhecido")}
    </span>
  );
}

`;

replaceOnce(
  'const MEMBER_PROFILE_FIELDS = ["nomeRP", "elemento", "linhagem", "vilaOrigem", "especialidade"];',
  reputationBlock + 'const MEMBER_PROFILE_FIELDS = ["nomeRP", "elemento", "linhagem", "vilaOrigem", "especialidade"];',
  "constantes de reputação"
);

replaceOnce(
  '    criadoEm: "", criadoPor: "", perfilCompleto: false,\n',
  '    criadoEm: "", criadoPor: "", perfilCompleto: false,\n    reputacao: "Desconhecido", lealdade: "", reputacaoNota: "", lealdadeNota: "",\n    reputacaoAtualizadaEm: "", lealdadeAtualizadaEm: "",\n',
  "campos padrão de reputação"
);

replaceOnce(
  '  out.nivelAcesso = Math.max(1, Math.min(5, Number(out.nivelAcesso) || 1));\n  out.perfilCompleto = perfilCompletoUsuario(out);',
  `  out.nivelAcesso = Math.max(1, Math.min(5, Number(out.nivelAcesso) || 1));
  if (!REPUTACAO_NIVEIS.includes(out.reputacao)) out.reputacao = "Desconhecido";
  if (!u?.lealdade) out.lealdade = out.role === "leader" ? "Pilar da F.O.X." : (existente ? "Recruta" : "Observado");
  if (!LEALDADE_NIVEIS.includes(out.lealdade)) out.lealdade = existente ? "Recruta" : "Observado";
  out.perfilCompleto = perfilCompletoUsuario(out);`,
  "normalização da reputação"
);

replaceOnce(
  '    criadoEm: new Date().toISOString(), criadoPor: "sistema"\n',
  '    criadoEm: new Date().toISOString(), criadoPor: "sistema",\n    reputacao: "Sussurros", lealdade: "Pilar da F.O.X.", reputacaoNota: "", lealdadeNota: ""\n',
  "reputação do usuário padrão"
);

replaceInSection(
  "function DossieModal",
  "function MeuDossieModal",
  `        <div className="p-6">
          <div className="grid sm:grid-cols-2 gap-3">`,
  `        <div className="p-6">
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="p-4 rounded-lg border border-red-900/40 bg-red-950/10">
              <div className="text-[9px] uppercase tracking-[0.2em] text-red-600 mb-2">Reputação externa</div>
              <ReputacaoBadge tipo="reputacao" valor={membro.reputacao} />
              <p className="text-zinc-500 text-xs leading-relaxed mt-2">{membro.reputacaoNota || reputacaoConfig(membro.reputacao).desc}</p>
            </div>
            <div className="p-4 rounded-lg border border-orange-900/40 bg-orange-950/10">
              <div className="text-[9px] uppercase tracking-[0.2em] text-orange-600 mb-2">Lealdade interna</div>
              <ReputacaoBadge tipo="lealdade" valor={membro.lealdade} />
              <p className="text-zinc-500 text-xs leading-relaxed mt-2">{membro.lealdadeNota || lealdadeConfig(membro.lealdade).desc}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">`,
  "painel narrativo do dossiê"
);

replaceInSection(
  "function MembrosListSection",
  "function OrganogramaCard",
  `                  <div className="text-zinc-600 text-xs mt-1 truncate">{u.elemento || "Elemento não definido"}{u.linhagem ? \` · \${u.linhagem}\` : ""}</div>
                </div>`,
  `                  <div className="text-zinc-600 text-xs mt-1 truncate">{u.elemento || "Elemento não definido"}{u.linhagem ? \` · \${u.linhagem}\` : ""}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <ReputacaoBadge tipo="reputacao" valor={u.reputacao} compacto />
                    <ReputacaoBadge tipo="lealdade" valor={u.lealdade} compacto />
                  </div>
                </div>`,
  "badges na lista de membros"
);

replaceOnce(
  '  const juramentar = (dados) => setData(d => ({ ...d, juramentados: [...d.juramentados, dados] }));',
  `  const juramentar = (dados) => setData(d => ({
    ...d,
    juramentados: [...d.juramentados, dados],
    users: d.users.map(u => {
      if (u.username !== dados.username) return u;
      const atual = lealdadeConfig(u.lealdade).indice;
      const juramentado = lealdadeConfig("Juramentado").indice;
      return atual < juramentado ? { ...u, lealdade: "Juramentado", lealdadeAtualizadaEm: new Date().toISOString(), lealdadeNota: u.lealdadeNota || "Juramento formal registrado pelo portal." } : u;
    }),
    activityLog: [...(d.activityLog || []), atividade("juramento_registrado", dados.username, dados.username, "Concluiu o juramento e alcançou a lealdade Juramentado")],
  }));`,
  "integração do juramento com lealdade"
);

for (const marker of ["ETAPA 2 — REPUTAÇÃO E LEALDADE v1", "REPUTACAO_NIVEIS", "LEALDADE_NIVEIS", "function ReputacaoBadge", 'lealdade: "Juramentado"']) {
  if (!html.includes(marker)) throw new Error(`Validação do núcleo da Etapa 2 falhou: ${marker}`);
}

fs.writeFileSync(path, html, "utf8");
console.log("Núcleo da Etapa 2 aplicado.");

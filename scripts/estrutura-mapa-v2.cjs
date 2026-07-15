const fs = require("fs");

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador, encontrado ${count}`);
  return text.replace(oldText, newText);
}

function replaceBlock(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${label}: bloco não encontrado`);
  return text.slice(0, start) + replacement + "\n\n" + text.slice(end);
}

let html = fs.readFileSync("index.html", "utf8");

if (!html.includes("// ESTRUTURA HIERARQUICA v2")) {
  html = replaceOnce(
    html,
    "// MOBILE POLISH v1 (áreas seguras, densidade e rótulos móveis)",
    "// MOBILE POLISH v1 (áreas seguras, densidade e rótulos móveis)\n// ESTRUTURA HIERARQUICA v2 (cargos posicionais, conselheiro lateral e capitães de ramo)",
    "marcador da estrutura"
  );

  const rolesBlock = String.raw`const DEFAULT_ROLES = [
  { id: "leader", nome: "Líder", hasLeaderPerms: true, protected: true, cor: "#D85A30", permissions: [], estruturaPosicao: "lider", ordemEstrutura: 0 },
  { id: "conselheiro", nome: "Conselheiro", hasLeaderPerms: false, protected: true, cor: "#B91C1C", permissions: ["manage_users", "manage_missions", "manage_map_meetings"], estruturaPosicao: "conselheiro", ordemEstrutura: 10 },
  { id: "capitao", nome: "Capitão", hasLeaderPerms: false, protected: true, cor: "#C2410C", permissions: ["manage_map_meetings"], estruturaPosicao: "capitao_ramo", ordemEstrutura: 30 },
  { id: "member", nome: "Membro", hasLeaderPerms: false, protected: true, cor: "#7C2D12", permissions: [], estruturaPosicao: "operador", ordemEstrutura: 100 },
  { id: "contratante", nome: "Contratante", hasLeaderPerms: false, protected: true, cor: "#22C55E", permissions: [], estruturaPosicao: "fora", ordemEstrutura: 999 },
];

const ESTRUTURA_POSICOES = [
  { id: "lider", label: "Liderança central", desc: "Fica no topo do organograma." },
  { id: "conselheiro", label: "Conselheiro", desc: "Fica à direita e um pouco abaixo do líder, como um Consigliere." },
  { id: "capitao_ramo", label: "Capitão de ramo", desc: "Comanda um ramo, como um Caporegime." },
  { id: "operador", label: "Operador do ramo", desc: "Fica abaixo do capitão dentro do ramo." },
  { id: "independente", label: "Núcleo independente", desc: "Fica fora dos ramos, abaixo do comando central." },
  { id: "oculto", label: "Fora do organograma", desc: "O cargo continua existindo, mas não aparece na estrutura." },
  { id: "fora", label: "Externo", desc: "Reservado a contratantes e perfis externos." },
];

function normalizarPosicaoEstrutura(role) {
  const valor = String(role?.estruturaPosicao || role?.estruturaNivel || "").trim();
  if (ESTRUTURA_POSICOES.some(p => p.id === valor)) return valor;
  const nome = String(role?.nome || role?.id || "").toLowerCase();
  if (role?.id === "leader" || role?.hasLeaderPerms === true || /líder|lider|chef|boss/.test(nome)) return "lider";
  if (role?.id === "conselheiro" || /conselh|consigliere/.test(nome)) return "conselheiro";
  if (role?.id === "capitao" || /capit[aã]o|caporegime|comandante/.test(nome)) return "capitao_ramo";
  if (role?.id === "contratante" || /contratante|externo/.test(nome)) return "fora";
  return "operador";
}

function estruturaPosicaoRole(role) {
  return normalizarPosicaoEstrutura(role);
}

function estruturaPosicaoLabel(role) {
  const id = estruturaPosicaoRole(role);
  return ESTRUTURA_POSICOES.find(p => p.id === id)?.label || "Operador do ramo";
}

function ordemEstruturaRole(role) {
  const numero = Number(role?.ordemEstrutura);
  if (Number.isFinite(numero)) return numero;
  const padrao = { lider: 0, conselheiro: 10, capitao_ramo: 30, operador: 100, independente: 150, oculto: 900, fora: 999 };
  return padrao[estruturaPosicaoRole(role)] ?? 100;
}`;

  html = replaceBlock(html, "const DEFAULT_ROLES = [", "const DEFAULT_USERS = [", rolesBlock, "cargos padrão e posições");

  const estruturaBlock = String.raw`function EstruturaSection({ data, onOpen }) {
  const membros = (data.users || []).filter(u => u.role !== "contratante" && u.status !== "Oculto");
  const roleOf = u => (data.roles || []).find(r => r.id === u.role);
  const posOf = u => estruturaPosicaoRole(roleOf(u));
  const ordenar = lista => lista.slice().sort((a, b) => ordemEstruturaRole(roleOf(a)) - ordemEstruturaRole(roleOf(b)) || getCodinome(a).localeCompare(getCodinome(b), "pt-BR"));
  const lideranca = ordenar(membros.filter(u => posOf(u) === "lider"));
  const conselheiros = ordenar(membros.filter(u => posOf(u) === "conselheiro"));
  const reservados = new Set([...lideranca, ...conselheiros].map(u => u.username));
  const ramos = (data.clas || []).map(ramo => {
    const integrantes = membros.filter(u => !reservados.has(u.username) && u.cla === ramo.id && !["oculto", "fora", "independente"].includes(posOf(u)));
    return {
      ...ramo,
      capitaes: ordenar(integrantes.filter(u => posOf(u) === "capitao_ramo")),
      operadores: ordenar(integrantes.filter(u => posOf(u) !== "capitao_ramo")),
    };
  });
  const alocadosNosRamos = new Set(ramos.flatMap(r => [...r.capitaes, ...r.operadores].map(u => u.username)));
  const independentes = ordenar(membros.filter(u => !reservados.has(u.username) && !alocadosNosRamos.has(u.username) && !["oculto", "fora"].includes(posOf(u))));

  const Linha = ({ longa = false }) => <div className={`${longa ? "h-12" : "h-8"} w-px bg-gradient-to-b from-orange-700 to-zinc-800 mx-auto`} aria-hidden="true" />;
  const Vaga = ({ titulo, texto }) => (
    <div className="w-44 min-h-[118px] p-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center flex flex-col items-center justify-center">
      <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">{titulo}</div>
      <div className="text-zinc-700 text-xs mt-2 italic">{texto}</div>
    </div>
  );

  return (
    <div className="fadein space-y-10">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-orange-600">Estrutura de comando</div>
        <h3 className="text-2xl font-black text-orange-50 serif mt-1">Hierarquia da Jikkai</h3>
        <p className="text-zinc-600 text-sm mt-2">A posição de cada membro é herdada do cargo definido pela liderança e sincronizada em todo o portal.</p>
      </div>

      <section className="max-w-5xl mx-auto">
        <div className="relative min-h-[250px] sm:min-h-[230px]">
          <div className="text-center text-[10px] uppercase tracking-[0.3em] text-orange-500 mb-4">Liderança</div>
          <div className="flex flex-wrap justify-center gap-4">
            {lideranca.length ? lideranca.map(u => <OrganogramaCard key={u.username} membro={u} data={data} onOpen={onOpen} destaque />) : <Vaga titulo="Liderança" texto="Líder não designado" />}
          </div>

          <div className="mt-6 sm:mt-0 sm:absolute sm:right-0 sm:top-16 flex flex-col items-center">
            <div className="hidden sm:block absolute -left-14 top-8 w-12 border-t border-red-900/70" aria-hidden="true" />
            <div className="text-center text-[9px] uppercase tracking-[0.26em] text-red-500 mb-3">Conselheiro · Consigliere</div>
            <div className="flex flex-wrap justify-center gap-3">
              {conselheiros.length ? conselheiros.map(u => <OrganogramaCard key={u.username} membro={u} data={data} onOpen={onOpen} />) : <Vaga titulo="Conselheiro" texto="Cargo ainda não atribuído" />}
            </div>
          </div>
        </div>
        {(ramos.length > 0 || independentes.length > 0) && <Linha longa />}
      </section>

      <section>
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-5">Ramos e divisões</div>
        <div className="grid md:grid-cols-2 gap-5">
          {ramos.map(ramo => {
            const capitao = ramo.capitaes[0];
            const excedentes = ramo.capitaes.slice(1);
            return (
              <div key={ramo.id} className="rounded-xl border p-5" style={{ borderColor: (ramo.cor || "#7C2D12") + "70", background: `linear-gradient(145deg, ${(ramo.cor || "#7C2D12")}14, #050505)` }}>
                <div className="text-center mb-4">
                  <div className="font-black text-lg serif" style={{ color: ramo.cor }}>{ramo.nome}</div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600">{ramo.tipo || "Divisão"}</div>
                </div>

                <div className="rounded-lg border border-orange-900/40 bg-black/45 p-4 mb-4">
                  <div className="text-center text-[9px] uppercase tracking-[0.24em] text-orange-600 mb-3">Capitão do ramo · Caporegime</div>
                  <div className="flex justify-center">
                    {capitao ? <OrganogramaCard membro={capitao} data={data} onOpen={onOpen} destaque /> : <Vaga titulo="Capitão" texto="Designe um membro com cargo posicionado como Capitão de ramo" />}
                  </div>
                  {excedentes.length > 0 && <div className="mt-3 text-center text-yellow-500 text-[10px]">Atenção: há {ramo.capitaes.length} capitães neste ramo. Mantenha apenas um.</div>}
                </div>

                <div className="text-center text-[9px] uppercase tracking-[0.22em] text-zinc-600 mb-3">Operadores</div>
                {ramo.operadores.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-3">{ramo.operadores.map(u => <OrganogramaCard key={u.username} membro={u} data={data} onOpen={onOpen} />)}</div>
                ) : (
                  <div className="text-center text-zinc-700 text-xs italic py-4">Nenhum operador alocado.</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {independentes.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
          <div className="text-center mb-4"><div className="font-black text-lg text-zinc-300 serif">Núcleo Independente</div><div className="text-[10px] uppercase tracking-widest text-zinc-600">Sem ramo ou cargo independente</div></div>
          <div className="flex flex-wrap justify-center gap-3">{independentes.map(u => <OrganogramaCard key={u.username} membro={u} data={data} onOpen={onOpen} />)}</div>
        </section>
      )}

      <section className="pt-8 border-t border-orange-900/30">
        <div className="text-center mb-6">
          <div className="text-[10px] uppercase tracking-[0.35em] text-orange-600">Células operacionais</div>
          <h3 className="text-xl font-black text-orange-50 serif mt-1">Trios da Jikkai</h3>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data.trios || []).map(t => (
            <div key={t.id || t.nome} className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/60">
              <div className="p-4" style={{ background: `linear-gradient(135deg, ${t.cor || "#7c2d12"}, #000)` }}>
                <div className="font-black text-white">{t.nome}</div><div className="text-white/60 text-[10px] uppercase tracking-wider">{t.desc}</div>
              </div>
              <div className="p-4 flex flex-wrap gap-3">
                {(t.membros || []).map((m, i) => {
                  const u = data.users.find(x => x.username === m.username) || usuarioPorIdentidade(data.users, m.nome);
                  return u ? (
                    <button key={m.username || i} onClick={() => onOpen(u)} className="flex items-center gap-2 min-w-0 text-left">
                      <MemberAvatar user={u} size="sm" />
                      <div className="min-w-0"><div className="text-orange-50 text-xs font-bold truncate">{getCodinome(u)}</div><div className="text-[9px] uppercase tracking-wider" style={{ color: t.cor }}>{m.papel || "Operador"}</div></div>
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}`;

  html = replaceBlock(html, "function EstruturaSection({ data, onOpen })", "function ReputacaoSection({ data, onOpen })", estruturaBlock, "organograma principal");

  const introBlock = String.raw`function IntroducaoEstruturaAtual({ data, usuario }) {
  const membros = (data.users || []).filter(u => u.role !== "contratante" && u.status !== "Oculto");
  const roleOf = u => (data.roles || []).find(r => r.id === u.role);
  const posOf = u => estruturaPosicaoRole(roleOf(u));
  const lideranca = membros.filter(u => posOf(u) === "lider");
  const conselheiros = membros.filter(u => posOf(u) === "conselheiro");
  return (
    <div className="space-y-7">
      <div className="text-center"><div className="text-[10px] uppercase tracking-[0.35em] text-orange-600">Estrutura atual</div><h3 className="text-2xl font-black text-orange-50 serif mt-1">A hierarquia que recebe você</h3><p className="text-zinc-500 text-sm mt-2">Os registros são carregados dos cargos e ramos atuais da Jikkai.</p></div>
      <div className="relative min-h-[230px] sm:min-h-[210px] max-w-4xl mx-auto">
        <div className="text-center text-[9px] uppercase tracking-[0.3em] text-red-600 mb-3">Liderança</div>
        <div className="flex flex-wrap justify-center gap-3">{lideranca.map(u => <div key={u.username} className="w-40 p-3 rounded-xl border border-orange-600 bg-gradient-to-b from-red-950/40 to-black text-center"><MemberAvatar user={u} size="lg" className="mx-auto mb-2" /><div className="text-orange-50 font-black truncate">{getCodinome(u)}</div><div className="text-[9px] uppercase tracking-wider text-orange-600">{u.patente || roleOf(u)?.nome}</div></div>)}</div>
        <div className="mt-5 sm:mt-0 sm:absolute sm:right-0 sm:top-14"><div className="text-center text-[9px] uppercase tracking-[0.3em] text-orange-700 mb-3">Conselheiro</div><div className="flex flex-wrap justify-center gap-3">{conselheiros.length ? conselheiros.map(u => <div key={u.username} className="w-36 p-3 rounded-xl border border-zinc-800 bg-zinc-950/70 text-center"><MemberAvatar user={u} size="md" className="mx-auto mb-2" /><div className="text-orange-50 font-bold truncate">{getCodinome(u)}</div><div className="text-[9px] uppercase tracking-wider text-zinc-600">{u.patente || roleOf(u)?.nome || "Conselheiro"}</div></div>) : <div className="w-36 p-3 rounded-xl border border-dashed border-zinc-800 text-center text-zinc-700 text-xs italic">Não designado</div>}</div></div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {(data.clas || []).map(ramo => {
          const integrantes = membros.filter(u => u.cla === ramo.id && !["lider", "conselheiro", "oculto", "fora"].includes(posOf(u)));
          const capitaes = integrantes.filter(u => posOf(u) === "capitao_ramo");
          const operadores = integrantes.filter(u => posOf(u) !== "capitao_ramo");
          return <div key={ramo.id} className="rounded-xl border p-4" style={{ borderColor: (ramo.cor || "#7C2D12") + "80", background: "linear-gradient(145deg," + (ramo.cor || "#7C2D12") + "14,#050505)" }}><div className="text-[9px] uppercase tracking-wider text-zinc-600">{ramo.tipo || "Ramo"}</div><div className="font-black text-lg serif mb-3" style={{ color: ramo.cor || "#D85A30" }}>{ramo.nome}</div><div className="mb-3 p-3 rounded border border-orange-900/40 bg-black/40"><div className="text-[8px] uppercase tracking-wider text-orange-600 mb-2">Capitão</div>{capitaes.length ? capitaes.map(u => <div key={u.username} className="flex items-center gap-2"><MemberAvatar user={u} size="xs" /><span className="text-orange-300 text-[10px] font-black">{getCodinome(u)}</span></div>) : <div className="text-zinc-700 text-[10px] italic">Não designado</div>}</div><div className="flex flex-wrap gap-2">{operadores.map(u => <div key={u.username} className={"flex items-center gap-2 rounded-full border pr-3 " + (u.username === usuario.username ? "border-orange-500 bg-orange-950/30" : "border-zinc-800 bg-black/40")}><MemberAvatar user={u} size="xs" /><span className={"text-[10px] " + (u.username === usuario.username ? "text-orange-300 font-black" : "text-zinc-400")}>{getCodinome(u)}{u.username === usuario.username ? " · VOCÊ" : ""}</span></div>)}</div></div>;
        })}
      </div>
      {(data.trios || []).length > 0 && <div className="pt-5 border-t border-zinc-800"><div className="text-center text-[9px] uppercase tracking-[0.3em] text-orange-700 mb-4">Células operacionais</div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{data.trios.map(t => <div key={t.id || t.nome} className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60"><div className="font-bold text-orange-50 text-sm">{t.nome}</div><div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">{t.desc}</div><div className="flex -space-x-2">{(t.membros || []).map((m, i) => { const u = data.users.find(x => x.username === m.username); return u ? <MemberAvatar key={m.username || i} user={u} size="sm" className="border-black" /> : null; })}</div></div>)}</div></div>}
    </div>
  );
}`;

  html = replaceBlock(html, "function IntroducaoEstruturaAtual({ data, usuario })", "function IntroducaoPrimeiroAcesso({ data, usuario, juramentado, juramentar, onAtualizarPerfil, onConcluir, onLogout })", introBlock, "estrutura da introdução");

  const ramosBlock = String.raw`function RamosManager({ data, setData, usuario }) {
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo: "Divisão", cor: "#7C2D12", descricao: "" });
  const [erro, setErro] = useState("");
  const roleOf = u => (data.roles || []).find(r => r.id === u.role);
  const cargoCapitao = (data.roles || []).find(r => estruturaPosicaoRole(r) === "capitao_ramo");

  const criar = () => {
    const nome = form.nome.trim();
    if (!nome) { setErro("O nome do ramo é obrigatório."); return; }
    setData(d => {
      const base = slugEstrutura(nome) || "ramo";
      let id = base;
      let n = 2;
      while ((d.clas || []).some(c => c.id === id)) id = base + "-" + n++;
      const ramo = { id, nome, tipo: form.tipo.trim() || "Divisão", cor: form.cor || "#7C2D12", icon: "shield", descricao: form.descricao.trim(), figuras: [], protected: false };
      return { ...d, clas: [...(d.clas || []), ramo], activityLog: [...(d.activityLog || []), atividade("ramo_criado", usuario?.username, id, "Criou o ramo " + nome)] };
    });
    setForm({ nome: "", tipo: "Divisão", cor: "#7C2D12", descricao: "" });
    setErro("");
    setCriando(false);
  };

  const definirCapitao = (ramoId, username) => {
    if (!cargoCapitao) { alert("Crie ou configure um cargo na posição Capitão de ramo antes de designar o comando."); return; }
    setData(d => ({
      ...d,
      users: d.users.map(u => {
        const role = d.roles.find(r => r.id === u.role);
        const eraCapitaoDesteRamo = u.cla === ramoId && estruturaPosicaoRole(role) === "capitao_ramo";
        if (eraCapitaoDesteRamo && u.username !== username) return { ...u, role: "member", estruturaNivel: "operador", patente: u.patente === "Capitão" ? "" : u.patente };
        if (u.username === username) return { ...u, cla: ramoId, role: cargoCapitao.id, estruturaNivel: "capitao_ramo", patente: u.patente || "Capitão" };
        return u;
      }),
      activityLog: [...(d.activityLog || []), atividade("capitao_designado", usuario?.username, username || ramoId, username ? "Designou o capitão do ramo " + ramoId : "Removeu o capitão do ramo " + ramoId)],
    }));
  };

  const remover = ramo => {
    if (["soke", "bunke"].includes(ramo.id) || ramo.protected) { alert("Soke e Bunke são ramos protegidos."); return; }
    const quantidade = (data.users || []).filter(u => u.cla === ramo.id).length;
    if (quantidade) { alert("Transfira os membros deste ramo antes de removê-lo."); return; }
    if (!confirm("Remover o ramo " + ramo.nome + "?")) return;
    setData(d => ({ ...d, clas: (d.clas || []).filter(c => c.id !== ramo.id), activityLog: [...(d.activityLog || []), atividade("ramo_removido", usuario?.username, ramo.id, "Removeu o ramo " + ramo.nome)] }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-orange-50 font-bold text-lg serif">Ramos da Jikkai ({(data.clas || []).length})</h3><p className="text-zinc-600 text-xs">Cada ramo possui uma cadeira de Capitão. A designação altera o cargo e sincroniza o organograma inteiro.</p></div>
        {!criando && <Btn onClick={() => setCriando(true)} variant="primary"><IPlus className="w-3 h-3" /> Novo Ramo</Btn>}
      </div>
      {criando && (
        <div className="p-4 border border-orange-700 rounded-lg bg-zinc-950/80 space-y-3 fadein">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="fox-label">Nome *</label><input value={form.nome} onChange={e => setForm({...form, nome:e.target.value})} className="fox-input" /></div>
            <div><label className="fox-label">Tipo</label><input value={form.tipo} onChange={e => setForm({...form, tipo:e.target.value})} className="fox-input" placeholder="Divisão, família, inteligência..." /></div>
            <div><label className="fox-label">Cor</label><input type="color" value={form.cor} onChange={e => setForm({...form, cor:e.target.value})} className="h-10 w-full bg-black border border-zinc-700 rounded" /></div>
            <div><label className="fox-label">Descrição</label><input value={form.descricao} onChange={e => setForm({...form, descricao:e.target.value})} className="fox-input" /></div>
          </div>
          {erro && <div className="text-red-400 text-sm">{erro}</div>}
          <div className="flex gap-2"><Btn onClick={() => setCriando(false)} variant="ghost">Cancelar</Btn><Btn onClick={criar} variant="primary"><ISave className="w-3 h-3" /> Criar ramo</Btn></div>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {(data.clas || []).map(ramo => {
          const integrantes = (data.users || []).filter(u => u.cla === ramo.id && u.role !== "contratante");
          const capitaes = integrantes.filter(u => estruturaPosicaoRole(roleOf(u)) === "capitao_ramo");
          const capitao = capitaes[0];
          const protegido = ["soke", "bunke"].includes(ramo.id) || ramo.protected;
          return <div key={ramo.id} className="p-4 rounded-lg border bg-zinc-950/60" style={{borderColor:(ramo.cor || "#7C2D12")+"80"}}>
            <div className="flex justify-between gap-3"><div className="flex-1"><div className="text-[9px] uppercase tracking-wider text-zinc-600">{ramo.tipo || "Divisão"} · {integrantes.length} membros</div><div className="font-black text-lg serif" style={{color:ramo.cor}}>{ramo.nome}</div><p className="text-zinc-500 text-xs mt-2">{ramo.descricao || "Sem descrição."}</p></div>
            {!protegido && <button onClick={() => remover(ramo)} className="text-red-500"><ITrash className="w-4 h-4" /></button>}</div>
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <label className="fox-label">Capitão do ramo</label>
              <select value={capitao?.username || ""} onChange={e => definirCapitao(ramo.id, e.target.value)} className="fox-input">
                <option value="">— Capitão não designado —</option>
                {(data.users || []).filter(u => u.role !== "contratante" && u.status !== "Oculto").map(u => <option key={u.username} value={u.username}>{getCodinome(u)} · {u.cla === ramo.id ? "neste ramo" : "transferir para cá"}</option>)}
              </select>
              {!cargoCapitao && <div className="text-yellow-500 text-[10px] mt-2">Nenhum cargo está posicionado como Capitão de ramo.</div>}
              {capitaes.length > 1 && <div className="text-yellow-500 text-[10px] mt-2">Existem {capitaes.length} capitães neste ramo. Escolha um para regularizar.</div>}
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}`;

  html = replaceBlock(html, "function RamosManager({ data, setData, usuario })", "function CargosManager({ data, setData })", ramosBlock, "gerenciador de ramos e capitães");

  const cargosBlock = String.raw`function CargosManager({ data, setData }) {
  const vazio = () => ({ nome: "", hasLeaderPerms: false, cor: "#7C2D12", estruturaPosicao: "operador", ordemEstrutura: 100 });
  const [form, setForm] = useState(vazio());
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState(null);

  const abrirNovo = () => { setForm(vazio()); setEditando(null); setCriando(true); };
  const abrirEdicao = role => { setForm({ ...role, estruturaPosicao: estruturaPosicaoRole(role), ordemEstrutura: ordemEstruturaRole(role) }); setEditando(role.id); setCriando(true); };
  const cancelar = () => { setForm(vazio()); setEditando(null); setCriando(false); };

  const salvar = () => {
    if (!form.nome.trim()) return;
    if (editando) {
      setData(d => {
        const atual = d.roles.find(r => r.id === editando);
        const protegidoLider = atual?.id === "leader";
        const protegidoExterno = atual?.id === "contratante";
        const patch = {
          nome: form.nome.trim(),
          cor: form.cor,
          hasLeaderPerms: protegidoLider ? true : Boolean(form.hasLeaderPerms),
          estruturaPosicao: protegidoLider ? "lider" : protegidoExterno ? "fora" : form.estruturaPosicao,
          ordemEstrutura: Number(form.ordemEstrutura) || 0,
        };
        const roles = d.roles.map(r => r.id === editando ? { ...r, ...patch } : r);
        return {
          ...d,
          roles,
          users: d.users.map(u => u.role === editando ? { ...u, estruturaNivel: patch.estruturaPosicao } : u),
        };
      });
    } else {
      const id = slugEstrutura(form.nome) + "_" + uid().slice(0, 4);
      setData(d => ({ ...d, roles: [...d.roles, { id, nome: form.nome.trim(), hasLeaderPerms: Boolean(form.hasLeaderPerms), cor: form.cor, permissions: [], protected: false, estruturaPosicao: form.estruturaPosicao, ordemEstrutura: Number(form.ordemEstrutura) || 100 }] }));
    }
    cancelar();
  };

  const remover = (id) => {
    const role = data.roles.find(r => r.id === id);
    if (role?.protected) { alert("Este cargo é protegido."); return; }
    if (data.users.find(u => u.role === id)) { alert("Há usuários com esse cargo. Mude-os antes de remover."); return; }
    if (confirm(`Remover cargo ${role.nome}?`)) setData(d => ({ ...d, roles: d.roles.filter(r => r.id !== id) }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h3 className="text-orange-50 font-bold text-lg serif">Cargos ({data.roles.length})</h3><p className="text-zinc-600 text-xs mt-1">A posição definida aqui controla automaticamente onde todos os usuários desse cargo aparecem na estrutura.</p></div>
        {!criando && <Btn onClick={abrirNovo} variant="primary"><IPlus className="w-3 h-3" /> Novo Cargo</Btn>}
      </div>

      {criando && (
        <div className="p-4 bg-zinc-950/80 border border-orange-700 rounded-lg space-y-3 fadein">
          <h4 className="text-orange-50 font-bold">{editando ? "Editar cargo" : "Novo cargo customizado"}</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="fox-label">Nome do cargo</label><input value={form.nome} onChange={e => setForm({...form, nome:e.target.value})} className="fox-input" placeholder="Ex: Executor, Sábio, Espião..." /></div>
            <div><label className="fox-label">Posição no organograma</label><select value={form.estruturaPosicao} onChange={e => setForm({...form, estruturaPosicao:e.target.value})} className="fox-input" disabled={editando === "leader" || editando === "contratante"}>{ESTRUTURA_POSICOES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
            <div><label className="fox-label">Ordem dentro da posição</label><input type="number" value={form.ordemEstrutura} onChange={e => setForm({...form, ordemEstrutura:Number(e.target.value)})} className="fox-input" /><div className="text-zinc-700 text-[10px] mt-1">Números menores aparecem primeiro.</div></div>
            <div><label className="fox-label">Cor</label><input type="color" value={form.cor} onChange={e => setForm({...form, cor:e.target.value})} className="h-11 w-full rounded bg-black border border-zinc-700" /></div>
          </div>
          <div className="p-3 rounded border border-zinc-800 bg-black/50 text-zinc-500 text-xs">{ESTRUTURA_POSICOES.find(p => p.id === form.estruturaPosicao)?.desc}</div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={form.hasLeaderPerms} onChange={e => setForm({...form, hasLeaderPerms:e.target.checked})} disabled={editando === "leader"} className="w-4 h-4 accent-orange-600" />Este cargo tem permissões de líder (edição total)</label>
          <div className="flex gap-2 pt-2 border-t border-zinc-800"><Btn onClick={cancelar} variant="ghost"><IX className="w-3 h-3" /> Cancelar</Btn><Btn onClick={salvar} variant="primary"><ISave className="w-3 h-3" /> Salvar</Btn></div>
        </div>
      )}

      <div className="space-y-2">
        {data.roles.slice().sort((a,b) => ordemEstruturaRole(a)-ordemEstruturaRole(b)).map(r => {
          const count = data.users.filter(u => u.role === r.id).length;
          const isLeader = r.hasLeaderPerms === true;
          const togglePerm = pid => setData(d => ({ ...d, roles: d.roles.map(x => x.id === r.id ? { ...x, permissions: (x.permissions || []).includes(pid) ? x.permissions.filter(p => p !== pid) : [...(x.permissions || []), pid] } : x) }));
          return (
            <div key={r.id} className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-12 rounded" style={{ background: r.cor }} />
                <div className="flex-1 min-w-0"><div className="text-orange-50 font-bold">{r.nome} {r.protected && <span className="text-xs text-zinc-600">(protegido)</span>}</div><div className="text-zinc-500 text-xs">{count} usuário(s) · {isLeader ? <span className="text-orange-500">Permissões totais de líder</span> : `${(r.permissions || []).length} permissões`}</div><div className="text-[10px] uppercase tracking-wider text-orange-700 mt-1">{estruturaPosicaoLabel(r)} · ordem {ordemEstruturaRole(r)}</div></div>
                <button onClick={() => abrirEdicao(r)} className="text-orange-400 hover:text-orange-300 p-2" title="Editar cargo e posição"><IEdit className="w-4 h-4" /></button>
                {!r.protected && <button onClick={() => remover(r.id)} className="text-red-500 hover:text-red-400 p-2"><ITrash className="w-4 h-4" /></button>}
              </div>
              {!isLeader && r.id !== "contratante" && <div className="mt-3 pt-3 border-t border-zinc-800 grid sm:grid-cols-2 gap-1">{PERMISSIONS_LIST.map(p => <label key={p.id} className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer hover:text-orange-300 p-1"><input type="checkbox" checked={(r.permissions || []).includes(p.id)} onChange={() => togglePerm(p.id)} className="w-3.5 h-3.5 accent-orange-600 mt-0.5" /><span><strong>{p.label}</strong><br/><span className="text-zinc-600 text-[10px]">{p.desc}</span></span></label>)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}`;

  html = replaceBlock(html, "function CargosManager({ data, setData })", "function MissoesManager({ data, setData, usuario, role })", cargosBlock, "gerenciador de cargos posicionais");

  html = replaceOnce(
    html,
    'const novo = normalizarMembro({ ...form, username, nomeRP: form.nomeRP || form.displayName, level: Number(form.level) || 0, nivelAcesso: Number(form.nivelAcesso) || 1, criadoEm: new Date().toISOString(), criadoPor: usuario?.username || "lideranca", iniciacaoStatus: "pendente" }, false);',
    'const novo = normalizarMembro({ ...form, username, nomeRP: form.nomeRP || form.displayName, level: Number(form.level) || 0, nivelAcesso: Number(form.nivelAcesso) || 1, estruturaNivel: estruturaPosicaoRole(d.roles.find(r => r.id === form.role)), criadoEm: new Date().toISOString(), criadoPor: usuario?.username || "lideranca", iniciacaoStatus: "pendente" }, false);',
    "sincronização do cargo em novo membro"
  );

  html = replaceOnce(
    html,
    'const atualizado = normalizarMembro({ ...anterior, ...form, username: editando, password: form.password || anterior.password, level: Number(form.level) || 0, nivelAcesso: Number(form.nivelAcesso) || 1 });',
    'const atualizado = normalizarMembro({ ...anterior, ...form, username: editando, password: form.password || anterior.password, level: Number(form.level) || 0, nivelAcesso: Number(form.nivelAcesso) || 1, estruturaNivel: estruturaPosicaoRole(d.roles.find(r => r.id === form.role)) });',
    "sincronização do cargo em membro editado"
  );

  html = replaceOnce(
    html,
    '<div><label className="fox-label">Posição na estrutura</label><select value={form.estruturaNivel || "operador"} onChange={e => setForm({ ...form, estruturaNivel: e.target.value })} className="fox-input"><option value="lideranca">Liderança</option><option value="conselho">Conselho</option><option value="comandante">Comandante de divisão</option><option value="operador">Operador</option></select></div>',
    '<div><label className="fox-label">Posição herdada do cargo</label><div className="min-h-11 px-3 py-2.5 rounded border border-zinc-800 bg-black text-orange-300 text-sm">{estruturaPosicaoLabel(data.roles.find(r => r.id === form.role))}</div><div className="text-zinc-700 text-[10px] mt-1">Altere a posição na aba Cargos.</div></div>',
    "posição herdada no dossiê administrativo"
  );

  const migrateBlock = String.raw`// Garante cargos protegidos, permissões e posições estruturais sincronizadas.
  const defaultsById = Object.fromEntries(DEFAULT_ROLES.map(r => [r.id, r]));
  let rolesOut = (raw.roles || DEFAULT_ROLES).map(r => ({
    ...(defaultsById[r.id] || {}),
    ...r,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
    estruturaPosicao: normalizarPosicaoEstrutura(r),
    ordemEstrutura: Number.isFinite(Number(r.ordemEstrutura)) ? Number(r.ordemEstrutura) : ordemEstruturaRole(r),
  }));
  for (const rolePadrao of DEFAULT_ROLES) {
    if (!rolesOut.find(r => r.id === rolePadrao.id)) rolesOut.push({ ...rolePadrao });
  }
  rolesOut = rolesOut.map(r => {
    if (r.id === "leader") return { ...r, hasLeaderPerms: true, protected: true, estruturaPosicao: "lider", ordemEstrutura: 0 };
    if (r.id === "conselheiro") return { ...r, hasLeaderPerms: false, protected: true, estruturaPosicao: "conselheiro", ordemEstrutura: Number(r.ordemEstrutura) || 10, permissions: Array.from(new Set([...(r.permissions.length ? r.permissions : ["manage_users", "manage_missions"]), "manage_map_meetings"])) };
    if (r.id === "capitao") return { ...r, protected: true, estruturaPosicao: "capitao_ramo", ordemEstrutura: Number(r.ordemEstrutura) || 30, permissions: Array.from(new Set([...(r.permissions || []), "manage_map_meetings"])) };
    if (r.id === "member") return { ...r, protected: true, estruturaPosicao: r.estruturaPosicao || "operador", ordemEstrutura: Number(r.ordemEstrutura) || 100 };
    if (r.id === "contratante") return { ...r, protected: true, estruturaPosicao: "fora", ordemEstrutura: 999 };
    return { ...r, estruturaPosicao: normalizarPosicaoEstrutura(r), ordemEstrutura: ordemEstruturaRole(r) };
  });
  migrated.roles = rolesOut;
  migrated.users = migrated.users.map(u => ({ ...u, estruturaNivel: estruturaPosicaoRole(rolesOut.find(r => r.id === u.role)) }));`;

  html = replaceBlock(html, "// Garante cargos protegidos + permissions[]", "migrated.armas =", migrateBlock, "migração dos cargos estruturais");

  fs.writeFileSync("index.html", html, "utf8");
  console.log("Hierarquia configurável aplicada ao portal.");
} else {
  console.log("Hierarquia configurável já aplicada.");
}

let mapa = fs.readFileSync("mapa.html", "utf8");
if (!mapa.includes("/* jikkai-map-scroll-v2 */")) {
  const mapCss = String.raw`
/* jikkai-map-scroll-v2 */
.panel{
  min-height:0;
  max-height:100vh;
  max-height:100dvh;
  overflow:hidden;
}
.brand,.toolbar,.filters,.footer{flex:0 0 auto}
.list{
  min-height:0;
  flex:1 1 auto;
  overflow-x:hidden;
  overflow-y:auto;
  overscroll-behavior:contain;
  scrollbar-gutter:stable;
  -webkit-overflow-scrolling:touch;
}
@media(max-width:900px){
  .panel{
    height:100vh;
    height:100dvh;
    max-height:100dvh;
    overflow:hidden;
  }
  .list{padding-bottom:max(18px,env(safe-area-inset-bottom))}
}
`;
  mapa = replaceOnce(mapa, "</style>", mapCss + "</style>", "rolagem da lista do mapa");
  fs.writeFileSync("mapa.html", mapa, "utf8");
  console.log("Rolagem independente dos locais do mapa aplicada.");
} else {
  console.log("Rolagem do mapa já aplicada.");
}

const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

const inicio = html.indexOf("// ============ JURAMENTO ============");
const fim = html.indexOf("// ============ MINHAS MISSÕES ============", inicio);
if (inicio < 0 || fim < 0 || fim <= inicio) throw new Error("Seção de juramento não encontrada.");

const secao = String.raw`// ============ JURAMENTO E PRIMEIRO ACESSO ============
function juramentoDoUsuario(juramentados, usuario) {
  if (!usuario) return null;
  const identidades = [usuario.username, usuario.displayName, usuario.nomeRP, usuario.codinome]
    .map(v => slugEstrutura(v))
    .filter(Boolean);
  return (juramentados || []).find(j => {
    if (j.username && j.username === usuario.username) return true;
    const identidadeJuramento = slugEstrutura(j.nome || j.codinome || "");
    return identidadeJuramento && identidades.includes(identidadeJuramento);
  }) || null;
}

function JuramentadoView({ juramentado, modoIniciacao = false }) {
  return (
    <div>
      {!modoIniciacao && <SectionTitle icon={ISkull} sub="Pacto de sangue selado">Seu Juramento</SectionTitle>}
      <div className="rounded-xl border-2 border-orange-700 bg-gradient-to-br from-red-950/40 via-black to-orange-950/30 overflow-hidden fadein">
        {juramentado.fotoUrl && (
          <div className="relative border-b border-orange-900/40 bg-black">
            <img src={juramentado.fotoUrl} alt="Registro do juramento no RP" className="w-full max-h-[430px] object-contain" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
            <div className="absolute left-4 bottom-3 text-[9px] uppercase tracking-[0.3em] text-orange-400">Registro visual do ritual</div>
          </div>
        )}
        <div className="p-8 text-center">
          <ISkull className="w-20 h-20 text-orange-500 mx-auto mb-4 pulse-fire" />
          <div className="text-orange-600 uppercase tracking-[0.3em] text-xs mb-2">Pacto Selado</div>
          <h3 className="text-3xl font-black text-orange-50 mb-2 serif">{juramentado.nome}</h3>
          <div className="text-zinc-400 mb-1">{juramentado.linhagem || "Sem linhagem"} · {juramentado.elemento || "Elemento não registrado"}{juramentado.idade && " · " + juramentado.idade}</div>
          <div className="text-zinc-600 text-xs mb-6">Selado em {new Date(juramentado.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
          {juramentado.motivacao && (
            <div className="max-w-xl mx-auto bg-black/60 border border-orange-900/40 rounded p-4 mb-6">
              <div className="text-orange-600 text-xs uppercase tracking-wider mb-2">Motivação declarada</div>
              <p className="text-zinc-300 italic text-sm leading-relaxed">“{juramentado.motivacao}”</p>
            </div>
          )}
          <div className="pt-6 border-t border-orange-900/40 text-zinc-400 italic max-w-lg mx-auto text-sm">
            “Que meu sangue se misture ao sangue Lamona. Que minha lâmina sirva à sombra. Que eu seja esquecido pelo mundo, mas lembrado pela F.O.X.”
          </div>
          {!modoIniciacao && <div className="mt-6 text-[10px] uppercase tracking-wider text-zinc-700">Este registro é pessoal. O arquivo completo é visível somente à liderança.</div>}
        </div>
      </div>
    </div>
  );
}

function JuramentoPage({ usuario, juramentado, juramentar, data, modoIniciacao = false, onConcluido = null }) {
  const mandamentos = data?.mandamentos || DEFAULT_MANDAMENTOS;
  const [step, setStep] = useState(0);
  const [aceitos, setAceitos] = useState(() => new Array(mandamentos.length).fill(false));
  const [form, setForm] = useState({
    nome: usuario?.nomeRP || usuario?.displayName || "",
    linhagem: usuario?.linhagem || "",
    elemento: usuario?.elemento || "Katon",
    idade: "",
    motivacao: "",
  });
  const [fraseTypo, setFraseTypo] = useState("");
  const [selando, setSelando] = useState(false);
  const [fotoUrl, setFotoUrl] = useState("");
  const [fotoErro, setFotoErro] = useState("");
  const fotoRef = useRef();

  useEffect(() => { setAceitos(new Array(mandamentos.length).fill(false)); }, [mandamentos.length]);

  const escolherFoto = (e) => {
    const file = e.target.files?.[0];
    setFotoErro("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setFotoErro("Escolha uma imagem JPG, PNG ou WEBP."); return; }
    if (file.size > 6 * 1024 * 1024) { setFotoErro("A imagem deve ter no máximo 6 MB."); return; }
    const reader = new FileReader();
    reader.onerror = () => setFotoErro("Não foi possível ler a imagem.");
    reader.onload = () => {
      const imagem = new Image();
      imagem.onerror = () => setFotoErro("A imagem não pôde ser processada.");
      imagem.onload = () => {
        const limite = 960;
        const escala = Math.min(1, limite / Math.max(imagem.naturalWidth, imagem.naturalHeight));
        const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
        const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));
        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setFotoErro("Seu navegador não conseguiu preparar a imagem."); return; }
        ctx.drawImage(imagem, 0, 0, largura, altura);
        setFotoUrl(canvas.toDataURL("image/jpeg", 0.78));
      };
      imagem.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  if (juramentado) return <JuramentadoView juramentado={juramentado} modoIniciacao={modoIniciacao} />;

  const todosAceitos = aceitos.every(Boolean);
  const formValido = form.nome.trim() && form.motivacao.trim();
  const fraseOk = fraseTypo.trim() === FRASE_JURAMENTO;

  const iniciarSelo = async () => {
    setSelando(true);
    await new Promise(r => setTimeout(r, 2600));
    juramentar({
      id: "juramento_" + uid(),
      ...form,
      nome: form.nome.trim(),
      data: new Date().toISOString(),
      username: usuario.username,
      fotoUrl,
      versao: 2,
      origem: modoIniciacao ? "primeiro_acesso" : "portal",
    });
    setSelando(false);
    if (onConcluido) onConcluido();
  };

  if (selando) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center fadein">
      <ISkull className="w-24 h-24 text-orange-600 mb-6 pulse-fire" />
      <div className="text-orange-600 uppercase tracking-[0.4em] text-xs mb-3">Selando o Pacto</div>
      <h2 className="text-3xl font-black text-orange-50 serif mb-6">Seu sangue pertence à F.O.X.</h2>
      <div className="w-full max-w-md h-2 bg-zinc-900 rounded overflow-hidden"><div className="h-full bg-gradient-to-r from-red-700 to-orange-600 blood-fill" /></div>
      <div className="text-zinc-600 text-xs mt-4 italic">Registrando o juramento nos arquivos da Jikkai...</div>
    </div>
  );

  return (
    <div>
      {!modoIniciacao && <SectionTitle icon={IDrop} sub={"Etapa " + (step + 1) + " de 4"}>Ritual de Juramento</SectionTitle>}
      <div className="mb-6"><div className="flex gap-1">{[0,1,2,3].map(i => <div key={i} className={"flex-1 h-1 rounded " + (i <= step ? "bg-orange-600" : "bg-zinc-900")} />)}</div></div>

      {step === 0 && (
        <div className="fadein">
          <div className="rounded-lg border-2 border-red-900/60 bg-gradient-to-br from-red-950/30 to-black p-8 text-center">
            <IAlert className="w-16 h-16 text-red-500 mx-auto mb-4 pulse-fire" />
            <h3 className="text-2xl font-black text-red-50 serif mb-3">ADVERTÊNCIA FINAL</h3>
            <p className="text-zinc-300 leading-relaxed max-w-xl mx-auto mb-4">O juramento que você está prestes a fazer é <strong className="text-red-400">irrevogável dentro do RP</strong>. Uma vez selado, seu destino ficará atrelado à Jikkai e à F.O.X.</p>
            <p className="text-zinc-400 leading-relaxed max-w-xl mx-auto mb-6 text-sm italic">Realize o ritual no jogo antes ou durante esta etapa. A imagem do acontecimento poderá ser anexada ao registro, mas não é obrigatória.</p>
            <div className="text-red-500 uppercase tracking-widest text-xs mb-4">Se prosseguires, não haverá retorno</div>
            <Btn onClick={() => setStep(1)} variant="primary" size="lg">Tenho coragem — Prosseguir</Btn>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="fadein space-y-4">
          <div className="p-4 bg-zinc-950/60 border border-orange-900/40 rounded"><h3 className="text-orange-50 font-bold mb-1">Os {mandamentos.length} Mandamentos</h3><p className="text-zinc-500 text-sm">Leia e aceite cada princípio individualmente.</p></div>
          <div className="space-y-2">
            {mandamentos.map((m, i) => (
              <label key={i} className={"flex items-start gap-3 p-4 rounded border cursor-pointer transition-all " + (aceitos[i] ? "bg-orange-950/20 border-orange-700" : "bg-zinc-950/50 border-zinc-800 hover:border-zinc-700")}>
                <input type="checkbox" checked={aceitos[i] || false} onChange={(e) => { const n = [...aceitos]; n[i] = e.target.checked; setAceitos(n); }} className="mt-1 w-4 h-4 accent-orange-600" />
                <div><div className="text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">Mandamento {i + 1}</div><div className="text-zinc-200">{m}</div></div>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2"><Btn onClick={() => setStep(0)} variant="ghost">Voltar</Btn><Btn onClick={() => setStep(2)} variant="primary" disabled={!todosAceitos} className="flex-1 justify-center">{todosAceitos ? "Aceito os Mandamentos" : "Aceite todos (" + aceitos.filter(Boolean).length + "/" + mandamentos.length + ")"}</Btn></div>
        </div>
      )}

      {step === 2 && (
        <div className="fadein space-y-4">
          <div className="p-4 bg-zinc-950/60 border border-orange-900/40 rounded"><h3 className="text-orange-50 font-bold mb-1">Identificação do Juramentado</h3><p className="text-zinc-500 text-sm">Declare quem você é, por que busca pertencer e, opcionalmente, anexe a imagem do RP.</p></div>
          <div className="space-y-4 p-6 bg-zinc-950/50 border border-zinc-800 rounded">
            <div><label className="fox-label">Nome no jogo *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="fox-input" /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="fox-label">Linhagem</label><input value={form.linhagem} onChange={(e) => setForm({ ...form, linhagem: e.target.value })} className="fox-input" placeholder="Uchiha, Hyuuga..." /></div>
              <div><label className="fox-label">Idade RP</label><input value={form.idade} onChange={(e) => setForm({ ...form, idade: e.target.value })} className="fox-input" /></div>
            </div>
            <div><label className="fox-label">Elemento</label><select value={form.elemento} onChange={(e) => setForm({ ...form, elemento: e.target.value })} className="fox-input"><option>Katon</option><option>Suiton</option><option>Doton</option><option>Raiton</option><option>Fuuton</option></select></div>
            <div><label className="fox-label">Motivação * — Por que quer entrar?</label><textarea value={form.motivacao} onChange={(e) => setForm({ ...form, motivacao: e.target.value })} rows="4" className="fox-input" placeholder="Sua história, seu motivo..." /></div>

            <div className="p-4 rounded-lg border border-zinc-800 bg-black/40">
              <div className="flex items-center justify-between gap-3 mb-3"><div><div className="text-orange-50 text-sm font-bold">Imagem do juramento no RP</div><div className="text-zinc-600 text-xs">Opcional · JPG, PNG ou WEBP · até 6 MB</div></div><Btn onClick={() => fotoRef.current?.click()} variant="default"><IUpload className="w-3 h-3" /> Escolher imagem</Btn></div>
              <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherFoto} className="hidden" />
              {fotoUrl && <div className="relative rounded-lg overflow-hidden border border-orange-900/50 bg-black"><img src={fotoUrl} alt="Prévia do juramento" className="w-full max-h-80 object-contain" /><button onClick={() => { setFotoUrl(""); if (fotoRef.current) fotoRef.current.value = ""; }} className="absolute top-2 right-2 p-2 rounded bg-black/80 text-red-400"><ITrash className="w-4 h-4" /></button></div>}
              {!fotoUrl && <div className="py-8 text-center text-zinc-700 text-xs italic border border-dashed border-zinc-800 rounded">Você poderá concluir o juramento sem anexar uma imagem.</div>}
              {fotoErro && <div className="text-red-400 text-xs mt-2">{fotoErro}</div>}
            </div>
          </div>
          <div className="flex gap-2 pt-2"><Btn onClick={() => setStep(1)} variant="ghost">Voltar</Btn><Btn onClick={() => setStep(3)} variant="primary" disabled={!formValido} className="flex-1 justify-center">Prosseguir</Btn></div>
        </div>
      )}

      {step === 3 && (
        <div className="fadein space-y-4">
          <div className="p-6 bg-gradient-to-br from-red-950/30 to-black border-2 border-orange-900/60 rounded-lg text-center">
            <ISkull className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <h3 className="text-orange-50 font-bold text-xl serif mb-2">O Juramento Final</h3>
            <p className="text-zinc-400 text-sm mb-6">Digite exatamente a frase abaixo:</p>
            <div className="bg-black/60 border border-orange-700 rounded py-4 px-6 mb-6 inline-block"><code className="text-orange-400 text-lg serif italic">“{FRASE_JURAMENTO}”</code></div>
            <input value={fraseTypo} onChange={(e) => setFraseTypo(e.target.value)} className="fox-input text-center text-lg" placeholder="Digite a frase..." autoFocus />
            {fraseTypo && !fraseOk && <div className="text-red-500 text-xs mt-2">A frase não coincide exatamente.</div>}
          </div>
          <div className="flex gap-2 pt-2"><Btn onClick={() => setStep(2)} variant="ghost">Voltar</Btn><Btn onClick={iniciarSelo} variant="primary" disabled={!fraseOk} className="flex-1 justify-center" size="lg"><IDrop className="w-4 h-4" /> Selar o Pacto</Btn></div>
        </div>
      )}
    </div>
  );
}

function IntroducaoEstruturaAtual({ data, usuario }) {
  const membros = (data.users || []).filter(u => u.role !== "contratante" && u.status !== "Oculto");
  const lideranca = membros.filter(u => data.roles.find(r => r.id === u.role)?.hasLeaderPerms || u.estruturaNivel === "lideranca");
  const conselho = membros.filter(u => !lideranca.includes(u) && (u.estruturaNivel === "conselho" || u.role === "conselheiro"));
  return (
    <div className="space-y-7">
      <div className="text-center"><div className="text-[10px] uppercase tracking-[0.35em] text-orange-600">Estrutura atual</div><h3 className="text-2xl font-black text-orange-50 serif mt-1">A hierarquia que recebe você</h3><p className="text-zinc-500 text-sm mt-2">Os registros abaixo são carregados diretamente dos membros atuais da Jikkai.</p></div>
      <div>
        <div className="text-center text-[9px] uppercase tracking-[0.3em] text-red-600 mb-3">Liderança</div>
        <div className="flex flex-wrap justify-center gap-3">{lideranca.map(u => <div key={u.username} className="w-40 p-3 rounded-xl border border-orange-600 bg-gradient-to-b from-red-950/40 to-black text-center"><MemberAvatar user={u} size="lg" className="mx-auto mb-2" /><div className="text-orange-50 font-black truncate">{getCodinome(u)}</div><div className="text-[9px] uppercase tracking-wider text-orange-600">{u.patente || data.roles.find(r => r.id === u.role)?.nome}</div></div>)}</div>
      </div>
      {conselho.length > 0 && <div><div className="h-7 w-px bg-orange-900 mx-auto" /><div className="text-center text-[9px] uppercase tracking-[0.3em] text-orange-700 mb-3">Conselho</div><div className="flex flex-wrap justify-center gap-3">{conselho.map(u => <div key={u.username} className="w-36 p-3 rounded-xl border border-zinc-800 bg-zinc-950/70 text-center"><MemberAvatar user={u} size="md" className="mx-auto mb-2" /><div className="text-orange-50 font-bold truncate">{getCodinome(u)}</div><div className="text-[9px] uppercase tracking-wider text-zinc-600">{u.patente || "Conselho"}</div></div>)}</div></div>}
      <div className="grid md:grid-cols-2 gap-4">
        {(data.clas || []).map(ramo => {
          const integrantes = membros.filter(u => u.cla === ramo.id);
          if (!integrantes.length) return null;
          return <div key={ramo.id} className="rounded-xl border p-4" style={{ borderColor: (ramo.cor || "#7C2D12") + "80", background: "linear-gradient(145deg," + (ramo.cor || "#7C2D12") + "14,#050505)" }}><div className="text-[9px] uppercase tracking-wider text-zinc-600">{ramo.tipo || "Ramo"}</div><div className="font-black text-lg serif mb-3" style={{ color: ramo.cor || "#D85A30" }}>{ramo.nome}</div><div className="flex flex-wrap gap-2">{integrantes.map(u => <div key={u.username} className={"flex items-center gap-2 rounded-full border pr-3 " + (u.username === usuario.username ? "border-orange-500 bg-orange-950/30" : "border-zinc-800 bg-black/40")}><MemberAvatar user={u} size="xs" /><span className={"text-[10px] " + (u.username === usuario.username ? "text-orange-300 font-black" : "text-zinc-400")}>{getCodinome(u)}{u.username === usuario.username ? " · VOCÊ" : ""}</span></div>)}</div></div>;
        })}
      </div>
      {(data.trios || []).length > 0 && <div className="pt-5 border-t border-zinc-800"><div className="text-center text-[9px] uppercase tracking-[0.3em] text-orange-700 mb-4">Células operacionais</div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{data.trios.map(t => <div key={t.id || t.nome} className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60"><div className="font-bold text-orange-50 text-sm">{t.nome}</div><div className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">{t.desc}</div><div className="flex -space-x-2">{(t.membros || []).map((m, i) => { const u = data.users.find(x => x.username === m.username); return u ? <MemberAvatar key={m.username || i} user={u} size="sm" className="border-black" /> : null; })}</div></div>)}</div></div>}
    </div>
  );
}

function IntroducaoPrimeiroAcesso({ data, usuario, juramentado, juramentar, onConcluir, onLogout }) {
  const [etapa, setEtapa] = useState(0);
  const ramo = (data.clas || []).find(c => c.id === usuario.cla);
  const cargo = (data.roles || []).find(r => r.id === usuario.role);
  const recrutador = (data.users || []).find(u => u.username === usuario.criadoPor);
  const total = 6;
  const avancar = () => setEtapa(v => Math.min(total - 1, v + 1));
  const voltar = () => setEtapa(v => Math.max(0, v - 1));

  return (
    <div className="min-h-screen bg-black text-zinc-200 relative overflow-hidden">
      <div className="fixed inset-0 opacity-25 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 15%, #7C2D12 0%, transparent 38%), radial-gradient(circle at 80% 80%, #C2410C 0%, transparent 36%)" }} />
      <div className="relative max-w-5xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-6"><div><div className="text-[9px] uppercase tracking-[0.4em] text-orange-600">Protocolo de iniciação</div><div className="text-orange-50 font-black serif text-xl">JIKKAI · F.O.X.</div></div><button onClick={onLogout} className="flex items-center gap-2 text-zinc-600 hover:text-red-400 text-xs uppercase tracking-wider"><ILogout className="w-4 h-4" /> Sair</button></div>
        <div className="flex gap-1 mb-6">{Array.from({ length: total }).map((_, i) => <div key={i} className={"h-1 flex-1 rounded " + (i <= etapa ? "bg-gradient-to-r from-red-700 to-orange-600" : "bg-zinc-900")} />)}</div>

        <div className="rounded-2xl border border-orange-900/50 bg-zinc-950/85 backdrop-blur p-5 sm:p-8 shadow-2xl">
          {etapa === 0 && <div className="fadein text-center"><div className="text-[10px] uppercase tracking-[0.35em] text-orange-600 mb-3">Identidade reconhecida</div><MemberAvatar user={usuario} size="xl" className="mx-auto mb-4" /><h1 className="text-4xl font-black text-orange-50 serif">{getCodinome(usuario)}</h1><div className="text-zinc-500 italic mt-1">{usuario.nomeRP || usuario.displayName}</div><div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto mt-7 text-left">{[["Ramo", ramo?.nome || "Aguardando designação"],["Patente", usuario.patente || cargo?.nome || "Recruta"],["Nível de acesso", "Nível " + (usuario.nivelAcesso || 1)],["Responsável pelo ingresso", recrutador ? getCodinome(recrutador) : "Comando da Jikkai"]].map(([l,v]) => <div key={l} className="p-3 rounded-lg border border-zinc-800 bg-black/40"><div className="text-[9px] uppercase tracking-wider text-orange-700">{l}</div><div className="text-zinc-200 text-sm mt-1">{v}</div></div>)}</div><p className="text-zinc-500 text-sm max-w-xl mx-auto mt-6">Seu acesso foi autorizado. Antes de entrar no portal, você conhecerá a organização, sua estrutura e as responsabilidades que assumirá.</p><div className="mt-7"><Btn onClick={avancar} variant="primary" size="lg">Confirmar identidade</Btn></div></div>}

          {etapa === 1 && <div className="fadein"><div className="text-center mb-7"><IFlame className="w-16 h-16 text-orange-500 mx-auto mb-3 pulse-fire" /><div className="text-[10px] uppercase tracking-[0.35em] text-orange-600">Introdução</div><h2 className="text-3xl font-black text-orange-50 serif mt-1">O que é a Jikkai</h2></div><div className="max-w-3xl mx-auto space-y-4 text-zinc-300 leading-relaxed"><p>A <strong className="text-orange-400">Jikkai</strong> é a estrutura estratégica responsável por preservar a ordem, conduzir operações e manter vivo o legado da F.O.X.</p><p>Ela reúne liderança, conselho, ramos, divisões e células operacionais. Cada integrante possui uma função, um nível de acesso e responsabilidade sobre aquilo que conhece e executa.</p><div className="p-5 border-l-4 border-orange-600 bg-orange-950/10 italic text-orange-100">À espreita nas trevas, manter a ordem. Nós somos sombras, entretanto mostramos o caminho.</div><p>Entrar não significa apenas receber uma conta. Significa ocupar uma posição registrada dentro da organização.</p></div><div className="flex gap-2 mt-8"><Btn onClick={voltar} variant="ghost">Voltar</Btn><Btn onClick={avancar} variant="primary" className="flex-1 justify-center">Conhecer a estrutura</Btn></div></div>}

          {etapa === 2 && <div className="fadein"><IntroducaoEstruturaAtual data={data} usuario={usuario} /><div className="flex gap-2 mt-8"><Btn onClick={voltar} variant="ghost">Voltar</Btn><Btn onClick={avancar} variant="primary" className="flex-1 justify-center">Entendi meu lugar</Btn></div></div>}

          {etapa === 3 && <div className="fadein"><div className="text-center mb-7"><IShield className="w-14 h-14 text-orange-500 mx-auto mb-3" /><div className="text-[10px] uppercase tracking-[0.35em] text-orange-600">Conduta</div><h2 className="text-3xl font-black text-orange-50 serif mt-1">O peso do seu acesso</h2></div><div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">{[["Respeitar a hierarquia","Ordens, decisões e conflitos seguem a cadeia de comando registrada."],["Preservar informações","Dados internos não devem ser levados para fora da organização sem autorização."],["Responder pelos próprios atos","Toda ação realizada em nome da Jikkai possui consequências no RP."],["Registrar acontecimentos","Missões, relatórios e fatos relevantes mantêm a história oficial viva."],["Não usar o nome sem autorização","A reputação da F.O.X. não pode ser empenhada em decisões pessoais."],["Honrar o pacto","O juramento formaliza sua entrada e sua lealdade interna."]].map(([t,d]) => <div key={t} className="p-4 rounded-lg border border-zinc-800 bg-black/40"><div className="text-orange-300 font-bold text-sm">{t}</div><p className="text-zinc-500 text-xs leading-relaxed mt-2">{d}</p></div>)}</div><div className="flex gap-2 mt-8"><Btn onClick={voltar} variant="ghost">Voltar</Btn><Btn onClick={avancar} variant="primary" className="flex-1 justify-center">Prosseguir ao juramento</Btn></div></div>}

          {etapa === 4 && <div className="fadein">{juramentado ? <div className="space-y-5"><div className="p-4 rounded-lg border border-green-900/50 bg-green-950/10 flex items-start gap-3"><ICheck className="w-5 h-5 text-green-500 mt-0.5" /><div><div className="text-green-300 font-bold">Juramento anterior localizado</div><p className="text-zinc-500 text-sm mt-1">Seu registro foi preservado. Não será necessário repetir o pacto.</p></div></div><JuramentadoView juramentado={juramentado} modoIniciacao /><div className="flex gap-2"><Btn onClick={voltar} variant="ghost">Voltar</Btn><Btn onClick={() => setEtapa(5)} variant="primary" className="flex-1 justify-center">Validar registro e continuar</Btn></div></div> : <JuramentoPage usuario={usuario} juramentado={null} juramentar={juramentar} data={data} modoIniciacao onConcluido={() => setEtapa(5)} />}</div>}

          {etapa === 5 && <div className="fadein text-center py-5"><ICheck className="w-20 h-20 text-green-500 mx-auto mb-5" /><div className="text-[10px] uppercase tracking-[0.4em] text-green-600">Iniciação concluída</div><h2 className="text-4xl font-black text-orange-50 serif mt-2">Seu registro está ativo</h2><p className="text-zinc-400 max-w-xl mx-auto mt-4 leading-relaxed">Você conhece a Jikkai, reconhece sua estrutura e possui um juramento registrado. Apresente-se ao responsável pelo seu ingresso e aguarde sua primeira designação.</p><div className="mt-7 p-4 rounded-lg border border-orange-900/40 bg-orange-950/10 max-w-md mx-auto"><div className="text-[9px] uppercase tracking-wider text-orange-700">Status</div><div className="text-orange-300 font-black mt-1">MEMBRO INICIADO · ACESSO NÍVEL {usuario.nivelAcesso || 1}</div></div><div className="mt-8"><Btn onClick={onConcluir} variant="primary" size="lg"><ILock className="w-4 h-4" /> Acessar o portal</Btn></div></div>}
        </div>
      </div>
    </div>
  );
}

function RegistroJuramentosManager({ data, setData, usuario }) {
  const [busca, setBusca] = useState("");
  const registros = (data.juramentados || []).map((j, index) => ({ j, index })).filter(({ j }) => {
    const termo = busca.trim().toLowerCase();
    return !termo || [j.nome, j.username, j.linhagem, j.elemento].some(v => String(v || "").toLowerCase().includes(termo));
  }).sort((a, b) => new Date(b.j.data || 0) - new Date(a.j.data || 0));
  const remover = (registro) => {
    if (!confirm("Remover o juramento de " + registro.nome + "? O membro continuará existindo no portal.")) return;
    setData(d => ({ ...d, juramentados: (d.juramentados || []).filter((_, i) => i !== registro.__index), activityLog: [...(d.activityLog || []), atividade("juramento_removido", usuario?.username, registro.username, "Removeu o registro de juramento de " + registro.nome)] }));
  };
  const reabrir = username => {
    if (!username || !confirm("Reabrir a introdução de primeiro acesso para este membro? O juramento atual será preservado.")) return;
    setData(d => ({ ...d, users: d.users.map(u => u.username === username ? { ...u, iniciacaoStatus: "pendente", iniciacaoReabertaEm: new Date().toISOString() } : u), activityLog: [...(d.activityLog || []), atividade("iniciacao_reaberta", usuario?.username, username, "Reabriu o protocolo de iniciação")]}));
  };
  return (
    <div className="space-y-5">
      <div><h3 className="text-orange-50 font-bold text-lg serif">Arquivo de Juramentos ({(data.juramentados || []).length})</h3><p className="text-zinc-600 text-xs mt-1">Visão exclusiva da liderança. Os membros continuam vendo apenas o próprio registro.</p></div>
      <input value={busca} onChange={e => setBusca(e.target.value)} className="fox-input" placeholder="Buscar por nome, usuário, linhagem ou elemento" />
      <div className="grid md:grid-cols-2 gap-4">
        {registros.map(({ j, index }) => {
          const membro = data.users.find(u => u.username === j.username) || usuarioPorIdentidade(data.users, j.nome);
          const registro = { ...j, __index: index };
          return <div key={j.id || index} className="rounded-xl overflow-hidden border border-orange-900/40 bg-zinc-950/70">{j.fotoUrl && <img src={j.fotoUrl} alt="Registro visual" className="w-full h-44 object-cover border-b border-orange-900/30" />}<div className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-orange-50 font-black">{j.nome}</div><div className="text-zinc-600 text-xs">@{j.username || membro?.username || "registro-legado"} · {new Date(j.data).toLocaleDateString("pt-BR")}</div></div><span className="text-[9px] uppercase tracking-wider px-2 py-1 rounded border border-orange-900 text-orange-500">v{j.versao || 1}</span></div><div className="text-zinc-500 text-xs mt-3">{j.linhagem || "Sem linhagem"} · {j.elemento || "Sem elemento"}</div>{j.motivacao && <p className="text-zinc-400 italic text-sm mt-3 line-clamp-3">“{j.motivacao}”</p>}<div className="flex gap-2 mt-4 pt-3 border-t border-zinc-800">{membro && <Btn onClick={() => reabrir(membro.username)} variant="ghost" className="text-[10px]">Refazer introdução</Btn>}<Btn onClick={() => remover(registro)} variant="danger" className="ml-auto"><ITrash className="w-3 h-3" /> Remover</Btn></div></div></div>;
        })}
      </div>
      {registros.length === 0 && <div className="p-8 text-center rounded-lg border border-zinc-800 text-zinc-600 italic">Nenhum juramento encontrado.</div>}
    </div>
  );
}

`;

html = html.slice(0, inicio) + secao + html.slice(fim);

for (const marcador of ["function IntroducaoPrimeiroAcesso", "function RegistroJuramentosManager", "Imagem do juramento no RP", "function juramentoDoUsuario"]) {
  if (!html.includes(marcador)) throw new Error("Falha ao aplicar introdução: " + marcador);
}

fs.writeFileSync(path, html, "utf8");
console.log("Introdução e juramento adaptado aplicados.");

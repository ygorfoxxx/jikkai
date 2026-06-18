const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(label + ": esperado 1 marcador, encontrado " + count);
  html = html.replace(oldText, newText);
}

function replaceAllChecked(oldText, newText, minimum, label) {
  const count = html.split(oldText).length - 1;
  if (count < minimum) throw new Error(label + ": esperado pelo menos " + minimum + ", encontrado " + count);
  html = html.split(oldText).join(newText);
}

const novaFrase = "Que meu próprio sangue queime, que as correntes da minha alma me esmaguem se eu trair este julgamento";

if (html.includes('const FRASE_JURAMENTO = "Meu sangue pertence à F.O.X.";')) {
  html = html.replace('const FRASE_JURAMENTO = "Meu sangue pertence à F.O.X.";', 'const FRASE_JURAMENTO = "' + novaFrase + '";');
} else if (!html.includes('const FRASE_JURAMENTO = "' + novaFrase + '";')) {
  throw new Error("Constante do juramento não encontrada.");
}

if (!html.includes("function fraseJuramentoAceita")) {
  const helperJuramento = `function normalizarFraseRitual(valor) {
  return String(valor || "")
    .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function distanciaLevenshtein(a, b) {
  const anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = anterior[0];
    anterior[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const acima = anterior[j];
      anterior[j] = Math.min(
        anterior[j] + 1,
        anterior[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = acima;
    }
  }
  return anterior[b.length];
}

function fraseJuramentoAceita(valor) {
  const digitada = normalizarFraseRitual(valor);
  const alvo = normalizarFraseRitual(FRASE_JURAMENTO);
  if (!digitada) return false;
  if (digitada === alvo) return true;

  const variacoes = [
    FRASE_JURAMENTO,
    "Que o meu próprio sangue queime, que as correntes da minha alma me esmaguem se eu trair este julgamento",
    "Que meu próprio sangue queime, que as correntes da minha alma me esmaguem se eu trair esse julgamento",
    "Que meu próprio sangue queime e que as correntes da minha alma me esmaguem se eu trair este julgamento",
    "Que meu próprio sangue queime, que as correntes da minha alma me esmaguem caso eu traia este julgamento",
  ].map(normalizarFraseRitual);
  if (variacoes.includes(digitada)) return true;

  const distancia = distanciaLevenshtein(digitada, alvo);
  const similaridade = 1 - distancia / Math.max(alvo.length, digitada.length, 1);
  const palavrasObrigatorias = ["sangue", "queime", "correntes", "alma", "esmaguem", "trair", "julgamento"];
  const presentes = palavrasObrigatorias.filter(palavra => digitada.includes(palavra)).length;
  return similaridade >= 0.88 || (presentes >= 6 && digitada.length >= alvo.length * 0.75);
}

`;
  const marker = "function JuramentoPage(";
  const pos = html.indexOf(marker);
  if (pos < 0) throw new Error("JuramentoPage não encontrado.");
  html = html.slice(0, pos) + helperJuramento + html.slice(pos);
}

html = html.replace(
  "“Que meu sangue se misture ao sangue Lamona. Que minha lâmina sirva à sombra. Que eu seja esquecido pelo mundo, mas lembrado pela F.O.X.”",
  "“" + novaFrase + ".”"
);
html = html.replace("const fraseOk = fraseTypo.trim() === FRASE_JURAMENTO;", "const fraseOk = fraseJuramentoAceita(fraseTypo);");
html = html.replace(">Seu sangue pertence à F.O.X.</h2>", ">{FRASE_JURAMENTO}</h2>");
html = html.replace("Digite exatamente a frase abaixo:", "Digite a frase abaixo. Pequenos erros de acentuação, pontuação ou digitação são tolerados:");
html = html.replace("A frase não coincide exatamente.", "A frase ainda está diferente demais do juramento.");

if (!html.includes('if (!existente && !String(out.patente || "").trim()) out.patente = "Recruta em Observação";')) {
  replaceOnce(
    "  const out = { ...base, ...u };\n  out.nomeRP = out.nomeRP || out.displayName || \"\";",
    "  const out = { ...base, ...u };\n  if (!existente && !String(out.patente || \"\").trim()) out.patente = \"Recruta em Observação\";\n  out.nomeRP = out.nomeRP || out.displayName || \"\";",
    "patente inicial"
  );
}

replaceOnce(
  "function IntroducaoPrimeiroAcesso({ data, usuario, juramentado, juramentar, onConcluir, onLogout }) {",
  "function IntroducaoPrimeiroAcesso({ data, usuario, juramentado, juramentar, onAtualizarPerfil, onConcluir, onLogout }) {",
  "assinatura da introdução"
);

if (!html.includes("const escolherAvatarIniciacao")) {
  const introState = `  const [avatarErro, setAvatarErro] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("");
  const avatarInputRef = useRef();
  const escolherAvatarIniciacao = (e) => {
    const arquivo = e.target.files?.[0];
    setAvatarErro("");
    setAvatarStatus("");
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      setAvatarErro("Escolha uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (arquivo.size > 6 * 1024 * 1024) {
      setAvatarErro("A imagem deve ter no máximo 6 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setAvatarErro("Não foi possível ler a imagem.");
    reader.onload = () => {
      const imagem = new Image();
      imagem.onerror = () => setAvatarErro("A imagem não pôde ser processada.");
      imagem.onload = () => {
        const lado = Math.min(imagem.naturalWidth, imagem.naturalHeight);
        const sx = Math.max(0, (imagem.naturalWidth - lado) / 2);
        const sy = Math.max(0, (imagem.naturalHeight - lado) / 2);
        const tamanho = 384;
        const canvas = document.createElement("canvas");
        canvas.width = tamanho;
        canvas.height = tamanho;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setAvatarErro("Seu navegador não conseguiu preparar a imagem.");
          return;
        }
        ctx.drawImage(imagem, sx, sy, lado, lado, 0, 0, tamanho, tamanho);
        onAtualizarPerfil?.({
          avatarUrl: canvas.toDataURL("image/jpeg", 0.82),
          avatarStoragePath: "",
        });
        setAvatarStatus("Foto registrada no seu dossiê.");
      };
      imagem.src = reader.result;
    };
    reader.readAsDataURL(arquivo);
  };
`;
  replaceOnce(
    "  const [etapa, setEtapa] = useState(0);\n",
    "  const [etapa, setEtapa] = useState(0);\n" + introState,
    "estado do avatar na introdução"
  );
}

const introStart = html.indexOf("function IntroducaoPrimeiroAcesso(");
const etapa0Start = html.indexOf("          {etapa === 0 &&", introStart);
const etapa1Start = html.indexOf("          {etapa === 1 &&", etapa0Start);
if (introStart < 0 || etapa0Start < 0 || etapa1Start < 0) throw new Error("Tela de identidade não encontrada.");

const novaEtapa0 = `          {etapa === 0 && (
            <div className="fadein text-center">
              <div className="text-[10px] uppercase tracking-[0.35em] text-orange-600 mb-3">Identidade reconhecida</div>
              <MemberAvatar user={usuario} size="xl" className="mx-auto mb-4" />
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherAvatarIniciacao} className="hidden" />
              <Btn onClick={() => avatarInputRef.current?.click()} variant="ghost" className="mx-auto">
                <IUpload className="w-3 h-3" /> {usuario.avatarUrl ? "Trocar foto" : "Adicionar foto"}
              </Btn>
              <div className="text-zinc-600 text-[10px] mt-2">Opcional · recorte quadrado automático · até 6 MB</div>
              {avatarStatus && <div className="text-green-400 text-xs mt-2">{avatarStatus}</div>}
              {avatarErro && <div className="text-red-400 text-xs mt-2">{avatarErro}</div>}
              <h1 className="text-4xl font-black text-orange-50 serif mt-5">{getCodinome(usuario)}</h1>
              <div className="text-zinc-500 italic mt-1">{usuario.nomeRP || usuario.displayName}</div>
              <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto mt-7 text-left">
                {[
                  ["Ramo", ramo?.nome || "Aguardando designação"],
                  ["Patente", usuario.patente || "Recruta em Observação"],
                  ["Nível de acesso", "Nível " + (usuario.nivelAcesso || 1)],
                  ["Responsável pelo ingresso", recrutador ? getCodinome(recrutador) : "Comando da Jikkai"],
                ].map(([l, v]) => <div key={l} className="p-3 rounded-lg border border-zinc-800 bg-black/40"><div className="text-[9px] uppercase tracking-wider text-orange-700">{l}</div><div className="text-zinc-200 text-sm mt-1">{v}</div></div>)}
              </div>
              <p className="text-zinc-500 text-sm max-w-xl mx-auto mt-6">Seu acesso foi autorizado. Antes de entrar no portal, você conhecerá a organização, sua estrutura e as responsabilidades que assumirá.</p>
              <div className="mt-7"><Btn onClick={avancar} variant="primary" size="lg">Confirmar identidade</Btn></div>
            </div>
          )}

`;
html = html.slice(0, etapa0Start) + novaEtapa0 + html.slice(etapa1Start);

if (!html.includes("foto_iniciacao_atualizada")) {
  replaceOnce(
    "      juramentar={juramentar}\n      onConcluir={() => concluirIniciacao(usuarioAtual.username)}",
    `      juramentar={juramentar}
      onAtualizarPerfil={(patch) => setData(d => ({
        ...d,
        users: d.users.map(u => {
          if (u.username !== usuarioAtual.username) return u;
          const atualizado = { ...u, ...patch };
          return { ...atualizado, perfilCompleto: perfilCompletoUsuario(atualizado) };
        }),
        activityLog: [...(d.activityLog || []), atividade("foto_iniciacao_atualizada", usuarioAtual.username, usuarioAtual.username, "Atualizou a foto durante a identificação de primeiro acesso")],
      }))}
      onConcluir={() => concluirIniciacao(usuarioAtual.username)}`,
    "callback da foto de primeiro acesso"
  );
}

if (!html.includes("function nomeResponsavelEstrategico")) {
  const helperResponsavel = `function nomeResponsavelEstrategico(valor, data) {
  if (!valor) return "Não designado";
  const texto = String(valor);
  if (texto.startsWith("ramo:")) {
    const ramoId = texto.slice(5);
    const ramo = (data.clas || []).find(c => c.id === ramoId);
    return ramo ? "Ramo · " + ramo.nome : "Ramo não encontrado";
  }
  const membro = (data.users || []).find(u => u.username === texto);
  return membro ? getCodinome(membro) : texto;
}

`;
  const faseEditorPos = html.indexOf("function FaseEditor(");
  if (faseEditorPos < 0) throw new Error("FaseEditor não encontrado.");
  html = html.slice(0, faseEditorPos) + helperResponsavel + html.slice(faseEditorPos);
}

if (!html.includes("  const ramos = data.clas || [];")) {
  replaceOnce(
    '  const users = (data.users || []).filter(u => u.role !== "contratante");\n',
    '  const users = (data.users || []).filter(u => u.role !== "contratante");\n  const ramos = data.clas || [];\n',
    "lista de ramos no editor"
  );
}

const selectFaseAntigo = '<div><label className="fox-label">Responsável geral</label><select value={draft.responsavelGeral || ""} onChange={e => update({ responsavelGeral: e.target.value })} className="fox-input"><option value="">— Não designado —</option>{users.map(u => <option key={u.username} value={u.username}>{getCodinome(u)}</option>)}</select></div>';
const selectFaseNovo = '<div><label className="fox-label">Responsável geral</label><select value={draft.responsavelGeral || ""} onChange={e => update({ responsavelGeral: e.target.value })} className="fox-input"><option value="">— Não designado —</option><optgroup label="Membros">{users.map(u => <option key={u.username} value={u.username}>{getCodinome(u)}</option>)}</optgroup><optgroup label="Ramos">{ramos.map(r => <option key={r.id} value={"ramo:" + r.id}>Ramo · {r.nome}</option>)}</optgroup></select></div>';
if (html.includes(selectFaseAntigo)) html = html.replace(selectFaseAntigo, selectFaseNovo);

const selectObjetivoAntigo = '<div><label className="fox-label">Responsável</label><select value={o.responsavel || ""} onChange={e => updateObj(i, { responsavel: e.target.value })} className="fox-input"><option value="">— Não designado —</option>{users.map(u => <option key={u.username} value={u.username}>{getCodinome(u)}</option>)}</select></div>';
const selectObjetivoNovo = '<div><label className="fox-label">Responsável</label><select value={o.responsavel || ""} onChange={e => updateObj(i, { responsavel: e.target.value })} className="fox-input"><option value="">— Não designado —</option><optgroup label="Membros">{users.map(u => <option key={u.username} value={u.username}>{getCodinome(u)}</option>)}</optgroup><optgroup label="Ramos">{ramos.map(r => <option key={r.id} value={"ramo:" + r.id}>Ramo · {r.nome}</option>)}</optgroup></select></div>';
if (html.includes(selectObjetivoAntigo)) html = html.replace(selectObjetivoAntigo, selectObjetivoNovo);

replaceAllChecked(
  "  const responsavel = data.users.find(u => u.username === objetivo.responsavel);",
  "  const responsavelLabel = nomeResponsavelEstrategico(objetivo.responsavel, data);",
  1,
  "responsável do objetivo"
);
replaceAllChecked(
  "  const responsavel = data.users.find(u => u.username === fase.responsavelGeral);",
  "  const responsavelLabel = nomeResponsavelEstrategico(fase.responsavelGeral, data);",
  2,
  "responsável da fase"
);
replaceAllChecked(
  '{responsavel ? getCodinome(responsavel) : "Não designado"}',
  "{responsavelLabel}",
  3,
  "exibição do responsável"
);

const markers = [
  novaFrase,
  "function fraseJuramentoAceita",
  "Recruta em Observação",
  "const escolherAvatarIniciacao",
  "foto_iniciacao_atualizada",
  "function nomeResponsavelEstrategico",
  '<optgroup label="Ramos">',
];
for (const marker of markers) {
  if (!html.includes(marker)) throw new Error("Ajuste não aplicado: " + marker);
}

fs.writeFileSync(path, html, "utf8");
console.log("Ajustes de iniciação, juramento e responsáveis por ramo aplicados.");

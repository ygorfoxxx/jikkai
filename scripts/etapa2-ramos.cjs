const fs = require("fs");
let html = fs.readFileSync("index.html", "utf8");
const marker = "function CargosManager({ data, setData }) {";
const component = `function RamosManager({ data, setData, usuario }) {
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo: "Divisão", cor: "#7C2D12", descricao: "" });
  const [erro, setErro] = useState("");
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
        <div><h3 className="text-orange-50 font-bold text-lg serif">Ramos da Jikkai ({(data.clas || []).length})</h3><p className="text-zinc-600 text-xs">Crie divisões além de Soke e Bunke. Depois, aloque os membros em Usuários.</p></div>
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
          const quantidade = (data.users || []).filter(u => u.cla === ramo.id && u.role !== "contratante").length;
          const protegido = ["soke", "bunke"].includes(ramo.id) || ramo.protected;
          return <div key={ramo.id} className="p-4 rounded-lg border bg-zinc-950/60" style={{borderColor:(ramo.cor || "#7C2D12")+"80"}}>
            <div className="flex justify-between gap-3"><div><div className="text-[9px] uppercase tracking-wider text-zinc-600">{ramo.tipo || "Divisão"} · {quantidade} membros</div><div className="font-black text-lg serif" style={{color:ramo.cor}}>{ramo.nome}</div><p className="text-zinc-500 text-xs mt-2">{ramo.descricao || "Sem descrição."}</p></div>
            {!protegido && <button onClick={() => remover(ramo)} className="text-red-500"><ITrash className="w-4 h-4" /></button>}</div>
          </div>;
        })}
      </div>
    </div>
  );
}

`;
if ((html.split(marker).length - 1) !== 1) throw new Error("Marcador de CargosManager não encontrado");
html = html.replace(marker, component + marker);
if ((html.split("function RamosManager").length - 1) !== 1) throw new Error("RamosManager não foi aplicado corretamente");
fs.writeFileSync("index.html", html, "utf8");
console.log("Gestão de ramos aplicada.");

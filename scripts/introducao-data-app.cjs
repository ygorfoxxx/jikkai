const fs = require("fs");

const path = "index.html";
let html = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(label + ": esperado 1 marcador, encontrado " + count);
  html = html.replace(oldText, newText);
}

replaceOnce(
  "// ETAPA 2 — REPUTAÇÃO E LEALDADE v1 (ramos dinâmicos e progressão narrativa)",
  "// ETAPA 2 — REPUTAÇÃO E LEALDADE v1 (ramos dinâmicos e progressão narrativa)\n// PROTOCOLO DE INICIAÇÃO v1 (primeiro acesso e juramento integrado)",
  "marcador da iniciação"
);

replaceOnce(
  '    criadoEm: "", criadoPor: "", perfilCompleto: false,\n    reputacao:',
  '    criadoEm: "", criadoPor: "", perfilCompleto: false,\n    iniciacaoConcluidaEm: "", iniciacaoVersao: 0, iniciacaoReabertaEm: "",\n    reputacao:',
  "campos de iniciação"
);

const blocoUsuarios = `  migrated.users = (raw.users || DEFAULT_USERS).map(u => normalizarMembro({
    ...u,
    codinome: u.codinome != null ? u.codinome : "",
    cla: u.cla != null ? u.cla : "",
  }, true));`;

const blocoMigrado = blocoUsuarios + `
  // Preserva juramentos antigos, normaliza os registros e reconhece quem já realizou o pacto.
  migrated.juramentados = (Array.isArray(raw.juramentados) ? raw.juramentados : []).map((j, index) => ({
    ...j,
    id: j.id || "juramento_legado_" + (j.username || slugEstrutura(j.nome) || index),
    fotoUrl: j.fotoUrl || "",
    versao: Number(j.versao) || 1,
    origem: j.origem || "legado",
  }));
  migrated.users = migrated.users.map(u => {
    const juramentoExistente = juramentoDoUsuario(migrated.juramentados, u);
    if (!juramentoExistente) return u;
    const nivelAtual = lealdadeConfig(u.lealdade).indice;
    const nivelJuramentado = lealdadeConfig("Juramentado").indice;
    return {
      ...u,
      iniciacaoStatus: "concluida",
      iniciacaoConcluidaEm: u.iniciacaoConcluidaEm || juramentoExistente.data || new Date().toISOString(),
      iniciacaoVersao: Number(u.iniciacaoVersao) || 1,
      lealdade: nivelAtual < nivelJuramentado ? "Juramentado" : u.lealdade,
      lealdadeNota: u.lealdadeNota || "Juramento anterior reconhecido e preservado pelo Protocolo de Iniciação.",
    };
  });`;
replaceOnce(blocoUsuarios, blocoMigrado, "migração dos juramentos antigos");

replaceOnce(
  '  const meuJuramento = data?.juramentados.find((j) => j.username === usuarioAtual?.username || j.nome.toLowerCase() === (usuarioAtual?.displayName || "").toLowerCase());',
  '  const meuJuramento = juramentoDoUsuario(data?.juramentados, usuarioAtual);',
  "localização segura do próprio juramento"
);

const inicioJuramentar = html.indexOf("  const juramentar = (dados) => setData(d => ({");
const fimJuramentar = html.indexOf("  const removerJuramento", inicioJuramentar);
if (inicioJuramentar < 0 || fimJuramentar < 0 || fimJuramentar <= inicioJuramentar) throw new Error("Função juramentar da Etapa 2 não encontrada.");

const novaFuncaoJuramentar = `  const juramentar = (dados) => setData(d => {
    const registros = Array.isArray(d.juramentados) ? d.juramentados : [];
    const existente = juramentoDoUsuario(registros, { username: dados.username, displayName: dados.nome, nomeRP: dados.nome, codinome: dados.nome });
    const registro = {
      ...existente,
      ...dados,
      id: dados.id || existente?.id || "juramento_" + uid(),
      fotoUrl: dados.fotoUrl || existente?.fotoUrl || "",
      versao: Number(dados.versao) || Number(existente?.versao) || 2,
      origem: dados.origem || existente?.origem || "portal",
    };
    const juramentados = existente
      ? registros.map(j => j === existente ? registro : j)
      : [...registros, registro];
    return {
      ...d,
      juramentados,
      users: d.users.map(u => {
        if (u.username !== dados.username) return u;
        const atual = lealdadeConfig(u.lealdade).indice;
        const juramentado = lealdadeConfig("Juramentado").indice;
        return {
          ...u,
          nomeRP: u.nomeRP || dados.nome || u.displayName,
          linhagem: u.linhagem || dados.linhagem || "",
          elemento: u.elemento || dados.elemento || "",
          lealdade: atual < juramentado ? "Juramentado" : u.lealdade,
          lealdadeAtualizadaEm: new Date().toISOString(),
          lealdadeNota: u.lealdadeNota || "Juramento formal registrado pelo portal.",
        };
      }),
      activityLog: [...(d.activityLog || []), atividade(existente ? "juramento_atualizado" : "juramento_registrado", dados.username, dados.username, existente ? "Atualizou o próprio registro de juramento" : "Concluiu o juramento e alcançou a lealdade Juramentado")],
    };
  });
`;
html = html.slice(0, inicioJuramentar) + novaFuncaoJuramentar + html.slice(fimJuramentar);

replaceOnce(
  '  const removerJuramento = (idx) => setData(d => ({ ...d, juramentados: d.juramentados.filter((_, i) => i !== idx) }));',
  `  const removerJuramento = (idx) => setData(d => ({ ...d, juramentados: d.juramentados.filter((_, i) => i !== idx) }));
  const concluirIniciacao = (username) => setData(d => ({
    ...d,
    users: d.users.map(u => u.username === username ? {
      ...u,
      iniciacaoStatus: "concluida",
      iniciacaoConcluidaEm: new Date().toISOString(),
      iniciacaoVersao: 1,
    } : u),
    activityLog: [...(d.activityLog || []), atividade("iniciacao_concluida", username, username, "Concluiu o Protocolo de Iniciação da Jikkai")],
  }));`,
  "conclusão do primeiro acesso"
);

replaceOnce(
  '  if (!usuarioAtual) return <LoginScreen data={data} onLogin={setUsuario} />;\n\n  const TABS =',
  `  if (!usuarioAtual) return <LoginScreen data={data} onLogin={setUsuario} />;

  if (!isContratante && !isLider && usuarioAtual.iniciacaoStatus === "pendente") {
    return <IntroducaoPrimeiroAcesso
      data={data}
      usuario={usuarioAtual}
      juramentado={meuJuramento}
      juramentar={juramentar}
      onConcluir={() => concluirIniciacao(usuarioAtual.username)}
      onLogout={() => setUsuario(null)}
    />;
  }

  const TABS =`,
  "bloqueio obrigatório do primeiro acesso"
);

for (const marcador of ["PROTOCOLO DE INICIAÇÃO v1", "migrated.juramentados", "concluirIniciacao", "<IntroducaoPrimeiroAcesso"]) {
  if (!html.includes(marcador)) throw new Error("Integração de dados incompleta: " + marcador);
}

fs.writeFileSync(path, html, "utf8");
console.log("Dados e login integrados ao Protocolo de Iniciação.");

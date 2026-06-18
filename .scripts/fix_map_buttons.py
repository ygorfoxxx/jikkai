from pathlib import Path

index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
role_anchor = '  const role = usuarioAtual && data ? data.roles.find(r => r.id === usuarioAtual.role) : null;\n'
role_insert = role_anchor + '''

  // Compartilha a identidade e o cargo da sessão atual com o mapa estratégico.
  // A senha ainda é exigida antes de qualquer alteração cartográfica.
  useEffect(() => {
    try {
      if (usuarioAtual && role) {
        localStorage.setItem("fox-map-viewer", JSON.stringify({
          username: usuarioAtual.username,
          roleId: role.id,
          updatedAt: new Date().toISOString(),
        }));
      } else {
        localStorage.removeItem("fox-map-viewer");
      }
    } catch {}
  }, [usuarioAtual?.username, role?.id]);
'''
if 'localStorage.setItem("fox-map-viewer"' not in index:
    if role_anchor not in index:
        raise SystemExit('Âncora do cargo não encontrada')
    index = index.replace(role_anchor, role_insert, 1)
if 'right:18px;bottom:18px;z-index:9999' in index:
    index = index.replace('right:18px;bottom:18px;z-index:9999', 'right:18px;bottom:76px;z-index:9999', 1)
elif 'right:18px;bottom:76px;z-index:9999' not in index:
    raise SystemExit('Posição do botão do mapa não encontrada')
index_path.write_text(index, encoding='utf-8')

map_path = Path('mapa.html')
mapa = map_path.read_text(encoding='utf-8')
mapa = mapa.replace('<button class="auth-mini" id="authBtn">Ativar edição</button>', '<button class="auth-mini" id="authBtn" hidden>Ativar edição</button>', 1)
mapa = mapa.replace('<div class="readonly-note" id="readonlyNote">Entre no portal como Líder ou Conselheiro para criar e editar locais e rotas.</div>', '<div class="readonly-note" id="readonlyNote">Mapa disponível em modo somente leitura.</div>', 1)
if 'const VIEWER_KEY="fox-map-viewer";' not in mapa:
    mapa = mapa.replace('const SESSION_KEY="fox-map-session";', 'const SESSION_KEY="fox-map-session";\nconst VIEWER_KEY="fox-map-viewer";', 1)
old_access = '''function parseSession(){
  try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null")}catch{return null}
}
function resolveAccess(state){
  const session=parseSession();
  const user=session&&state?.users?.find(u=>u.username===session.username);
  const role=user&&state?.roles?.find(r=>r.id===user.role);
  const canEdit=roleCanEdit(role);
  return{user,role,canEdit};
}'''
new_access = '''function parseSession(){
  try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null")}catch{return null}
}
function parseViewer(){
  try{return JSON.parse(localStorage.getItem(VIEWER_KEY)||"null")}catch{return null}
}
function resolveAccess(state){
  const viewer=parseViewer();
  const session=parseSession();
  const user=viewer&&state?.users?.find(u=>u.username===viewer.username);
  const role=user&&state?.roles?.find(r=>r.id===user.role);
  const eligible=roleCanEdit(role);
  const canEdit=!!(eligible&&session?.username===user?.username);
  return{user,role,eligible,canEdit};
}'''
if 'function parseViewer()' not in mapa:
    if old_access not in mapa:
        raise SystemExit('Bloco de acesso não encontrado')
    mapa = mapa.replace(old_access, new_access, 1)
if 'if(!access.eligible)return;' not in mapa:
    mapa = mapa.replace('''function openAuth(){
  if(access.canEdit){''', '''function openAuth(){
  if(!access.eligible)return;
  if(access.canEdit){''', 1)
old_ui = '''  el("adminTools").hidden=!access.canEdit;
  el("readonlyNote").hidden=access.canEdit;
  el("detailActions").hidden=!access.canEdit;
  el("authBtn").textContent=access.canEdit?"Encerrar edição":"Ativar edição";'''
new_ui = '''  el("adminTools").hidden=!access.canEdit;
  el("readonlyNote").hidden=!!access.eligible;
  el("detailActions").hidden=!access.canEdit;
  el("authBtn").hidden=!access.eligible;
  el("authBtn").textContent=access.canEdit?"Encerrar edição":"Ativar edição";'''
if 'el("authBtn").hidden=!access.eligible;' not in mapa:
    if old_ui not in mapa:
        raise SystemExit('Bloco de visibilidade não encontrado')
    mapa = mapa.replace(old_ui, new_ui, 1)
init_anchor = '''  if(cloudClient){
    cloudClient.channel("fox_map_changes")'''
init_replacement = '''  window.addEventListener("storage",e=>{
    if(e.key===VIEWER_KEY){
      sessionStorage.removeItem(SESSION_KEY);
      applyState(portalState);
    }
  });
  if(cloudClient){
    cloudClient.channel("fox_map_changes")'''
if 'if(e.key===VIEWER_KEY)' not in mapa:
    if init_anchor not in mapa:
        raise SystemExit('Inicialização do mapa não encontrada')
    mapa = mapa.replace(init_anchor, init_replacement, 1)
map_path.write_text(mapa, encoding='utf-8')

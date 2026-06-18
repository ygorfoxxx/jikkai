const fs = require("fs");

const path = "mapa.html";
let html = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 marcador, encontrado ${count}`);
  html = html.replace(oldText, newText);
}

replaceOnce(
  '<option>Controlado</option><option>Seguro</option><option>Observado</option>\n              <option>Neutro</option><option>Objetivo</option><option>Hostil</option><option>Desconhecido</option>',
  '<option>Controlado</option><option>Seguro</option><option>Observado</option>\n              <option>Neutro</option><option>Objetivo</option><option>Hostil</option><option>Comprometido</option><option>Desconhecido</option>',
  "status comprometido do mapa"
);

replaceOnce(
  `        <div class="field">
          <label>Descrição operacional</label>
          <textarea id="fDesc" maxlength="900" placeholder="Finalidade, riscos, regras de acesso e observações..."></textarea>
        </div>
        <div class="coord">`,
  `        <div class="field">
          <label>Descrição operacional</label>
          <textarea id="fDesc" maxlength="900" placeholder="Finalidade, riscos, regras de acesso e observações..."></textarea>
        </div>
        <div class="field" style="padding:12px;border:1px solid #7f1d1d;background:rgba(69,10,10,.25);border-radius:8px">
          <label style="color:#f87171">Integração com o Painel JIKKAI</label>
          <div style="font-size:11px;color:#a1a1aa;line-height:1.55;margin-bottom:10px">Locais do tipo <strong style="color:#fecaca">Risco</strong>, ameaça Alta/Crítica ou situação Hostil/Comprometida geram um alerta estratégico automático e rastreável.</div>
          <div class="form-grid">
            <div class="field"><label>Fase afetada</label><select id="fPhase"><option value="">Plano geral</option></select></div>
            <div class="field"><label>Objetivo afetado</label><select id="fObjective"><option value="">Toda a fase</option></select></div>
          </div>
          <div class="field" style="margin-top:10px"><label>Título do alerta</label><input id="fAlertTitle" maxlength="120" placeholder="Ex.: Informante em Suna comprometido"></div>
        </div>
        <div class="coord">`,
  "campos estratégicos do mapa"
);

replaceOnce(
  `function populateTypes(kind,current){
  const select=el("fType");select.innerHTML="";
  const source=kind==="route"?ROUTE_TYPES:POINT_TYPES;
  Object.entries(source).forEach(([id,cfg])=>{const o=document.createElement("option");o.value=id;o.textContent=cfg.label;if(id===current)o.selected=true;select.appendChild(o)});
}`,
  `function populateTypes(kind,current){
  const select=el("fType");select.innerHTML="";
  const source=kind==="route"?ROUTE_TYPES:POINT_TYPES;
  Object.entries(source).forEach(([id,cfg])=>{const o=document.createElement("option");o.value=id;o.textContent=cfg.label;if(id===current)o.selected=true;select.appendChild(o)});
}
function populateStrategicLinks(phaseId,objectiveId){
  const phaseSelect=el("fPhase"),objectiveSelect=el("fObjective");
  phaseSelect.innerHTML='<option value="">Plano geral</option>';
  (portalState?.fases||[]).forEach(f=>{const o=document.createElement("option");o.value=f.id||("fase_"+f.n);o.textContent="Fase "+f.n+" · "+f.titulo;if(o.value===phaseId)o.selected=true;phaseSelect.appendChild(o)});
  const phase=(portalState?.fases||[]).find(f=>(f.id||("fase_"+f.n))===phaseSelect.value);
  objectiveSelect.innerHTML='<option value="">Toda a fase</option>';
  (phase?.objetivos||[]).forEach(obj=>{const o=document.createElement("option");o.value=obj.id||"";o.textContent=obj.titulo||obj.text||"Objetivo";if(o.value===objectiveId)o.selected=true;objectiveSelect.appendChild(o)});
  objectiveSelect.disabled=!phase;
}`,
  "preenchimento dos vínculos estratégicos"
);

replaceOnce(
  `  el("fName").value=item.name||"";populateTypes(item.kind,item.type);el("fStatus").value=item.status||"Neutro";
  el("fThreat").value=item.threat||"Média";el("fSecrecy").value=item.sigilo||"Nível II";el("fDesc").value=item.desc||"";`,
  `  el("fName").value=item.name||"";populateTypes(item.kind,item.type);el("fStatus").value=item.status||"Neutro";
  el("fThreat").value=item.threat||"Média";el("fSecrecy").value=item.sigilo||"Nível II";el("fDesc").value=item.desc||"";
  populateStrategicLinks(item.faseId||"",item.objetivoId||"");el("fAlertTitle").value=item.alertaTitulo||"";`,
  "abertura dos vínculos estratégicos"
);

replaceOnce(
  `  editorDraft.sigilo=el("fSecrecy").value;editorDraft.desc=el("fDesc").value.trim();`,
  `  editorDraft.sigilo=el("fSecrecy").value;editorDraft.desc=el("fDesc").value.trim();
  editorDraft.faseId=el("fPhase").value;editorDraft.objetivoId=el("fObjective").value;editorDraft.alertaTitulo=el("fAlertTitle").value.trim();`,
  "salvamento dos vínculos estratégicos"
);

replaceOnce(
  `el("editorForm").addEventListener("submit",saveEditor);`,
  `el("editorForm").addEventListener("submit",saveEditor);
el("fPhase").addEventListener("change",()=>populateStrategicLinks(el("fPhase").value,""));`,
  "evento da fase do mapa"
);

for (const marker of ["Comprometido", "Integração com o Painel JIKKAI", "populateStrategicLinks", "editorDraft.faseId"]) {
  if (!html.includes(marker)) throw new Error("Integração do mapa ausente: " + marker);
}

fs.writeFileSync(path, html, "utf8");
console.log("Mapa integrado ao Painel Estratégico.");

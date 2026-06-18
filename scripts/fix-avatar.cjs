const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const oldChoose = `  const escolherFoto = (e) => {
    setErro("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErro("Escolha uma imagem JPG, PNG ou WEBP."); return; }
    if (file.size > 3 * 1024 * 1024) { setErro("A foto deve ter no máximo 3 MB."); return; }
    setArquivo(file);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  };`;

const newChoose = `  const escolherFoto = (e) => {
    setErro("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErro("Escolha uma imagem JPG, PNG ou WEBP."); return; }
    if (file.size > 3 * 1024 * 1024) { setErro("A foto deve ter no máximo 3 MB."); return; }
    const reader = new FileReader();
    reader.onerror = () => setErro("Não foi possível ler a imagem escolhida.");
    reader.onload = () => {
      const imagem = new Image();
      imagem.onerror = () => setErro("A imagem escolhida não pôde ser processada.");
      imagem.onload = () => {
        const tamanho = 384;
        const recorte = Math.min(imagem.naturalWidth, imagem.naturalHeight);
        const origemX = Math.max(0, (imagem.naturalWidth - recorte) / 2);
        const origemY = Math.max(0, (imagem.naturalHeight - recorte) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = tamanho;
        canvas.height = tamanho;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setErro("Seu navegador não conseguiu preparar a foto."); return; }
        ctx.drawImage(imagem, origemX, origemY, recorte, recorte, 0, 0, tamanho, tamanho);
        setPreview(canvas.toDataURL("image/jpeg", 0.82));
        setArquivo(file);
      };
      imagem.src = reader.result;
    };
    reader.readAsDataURL(file);
  };`;

if (!html.includes(oldChoose)) {
  throw new Error('Seletor de foto original não encontrado.');
}

html = html.replace(oldChoose, newChoose);

const modalStart = html.indexOf('function MeuDossieModal');
const start = html.indexOf('      if (arquivo) {', modalStart);
const end = html.indexOf('      setData(d => {', start);

if (modalStart < 0 || start < 0 || end < 0 || end <= start) {
  throw new Error('Bloco de salvamento do Meu Dossiê não encontrado.');
}

html = html.slice(0, start) + `      if (arquivo) {
        avatarUrl = preview;
        avatarStoragePath = "";
      }
` + html.slice(end);

html = html.replace(
  'JPG, PNG ou WEBP, até 3 MB. Use uma imagem quadrada para melhor enquadramento.',
  'JPG, PNG ou WEBP, até 3 MB. A foto será recortada e otimizada automaticamente.'
);

const modalEnd = html.indexOf('function MembrosListSection', modalStart);
const modalCode = html.slice(modalStart, modalEnd);
if (!modalCode.includes('const recorte = Math.min') || modalCode.includes('storage.from("galeria")')) {
  throw new Error('A correção do avatar não foi aplicada corretamente.');
}

fs.writeFileSync(path, html, 'utf8');
console.log('Avatar corrigido sem dependência de bucket.');

// No layout mobile, .app deixa de ser grid. Como os filhos do mapa são absolutos,
// a área .map-shell ficava sem altura e o navegador mostrava apenas o fundo preto.
const mapPath = 'mapa.html';
let mapHtml = fs.readFileSync(mapPath, 'utf8');
const mobileMapFixMarker = 'jikkai-mobile-map-layout-fix';
const mobileMapFix = `
/* ${mobileMapFixMarker} */
@media(max-width:900px){
  .app{
    display:block;
    position:relative;
    width:100%;
    height:100vh;
    height:100svh;
    height:100dvh;
    min-height:100vh;
    min-height:100dvh;
  }
  .map-shell{
    display:block;
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    min-height:100vh;
    min-height:100dvh;
  }
}
`;

if (!mapHtml.includes(mobileMapFixMarker)) {
  const styleEnd = mapHtml.indexOf('</style>');
  if (styleEnd < 0) {
    throw new Error('Bloco de estilos do mapa não encontrado.');
  }
  mapHtml = mapHtml.slice(0, styleEnd) + mobileMapFix + mapHtml.slice(styleEnd);
}

if (!mapHtml.includes(mobileMapFixMarker) || !mapHtml.includes('min-height:100dvh')) {
  throw new Error('A correção mobile do mapa não foi aplicada corretamente.');
}

fs.writeFileSync(mapPath, mapHtml, 'utf8');
console.log('Layout mobile do mapa estratégico corrigido.');

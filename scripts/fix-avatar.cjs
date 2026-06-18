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

const start = html.indexOf('      if (arquivo) {', html.indexOf('function MeuDossieModal'));
const end = html.indexOf('      setData(d => {', start);

if (!html.includes(oldChoose) || start < 0 || end < 0) {
  throw new Error('Estrutura esperada do Meu Dossiê não encontrada.');
}

html = html.replace(oldChoose, newChoose);
html = html.slice(0, start) + `      if (arquivo) {
        avatarUrl = preview;
        avatarStoragePath = "";
      }
` + html.slice(end);
html = html.replace(
  'JPG, PNG ou WEBP, até 3 MB. Use uma imagem quadrada para melhor enquadramento.',
  'JPG, PNG ou WEBP, até 3 MB. A foto será recortada e otimizada automaticamente.'
);

fs.writeFileSync(path, html, 'utf8');
console.log('Avatar corrigido sem dependência de bucket.');

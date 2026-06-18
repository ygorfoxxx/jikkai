from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
old = '''replace_once(
''' + "'''             <div className=\"text-zinc-600 text-[10px] mt-1\">O primeiro operador selecionado será registrado como responsável principal.</div>\n'''" + ''',
''' + "'''             <div className=\"text-zinc-600 text-[10px] mt-1\">\n               O primeiro operador selecionado será o responsável principal. A lista já respeita a autorização exigida por {sigiloConfig(form.sigilo).codigo}.\n             </div>\n'''" + ''',
"aviso elegibilidade"
)'''
new = '''replace_once(
''' + "'''            <div className=\"text-zinc-600 text-[10px] mt-1\">O primeiro operador selecionado será registrado como responsável principal.</div>\n'''" + ''',
''' + "'''            <div className=\"text-zinc-600 text-[10px] mt-1\">\n              O primeiro operador selecionado será o responsável principal. A lista já respeita a autorização exigida por {sigiloConfig(form.sigilo).codigo}.\n            </div>\n'''" + ''',
"aviso elegibilidade"
)'''
if old not in text:
    raise SystemExit("hotfix: bloco de elegibilidade não encontrado")
path.write_text(text.replace(old, new, 1), encoding="utf-8")

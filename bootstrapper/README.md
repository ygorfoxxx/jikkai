# JIKKAI Modern Bootstrapper

Instalador frontal do JIKKAI com interface própria em WPF/.NET 8.

O bootstrapper não modifica o código do aplicativo. Durante o build, o workflow:

1. compila o instalador interno existente do Electron/NSIS;
2. incorpora esse instalador como `Payload/JIKKAI-Payload.exe`;
3. publica uma única aplicação Windows com interface moderna;
4. executa o payload silenciosamente no local escolhido pelo usuário.

## Build local

Requisitos:

- Windows 10 ou 11;
- Node.js 22;
- .NET SDK 8;
- dependências do projeto instaladas com `npm ci`.

```powershell
npm run dist:installer
New-Item -ItemType Directory -Force bootstrapper/Jikkai.Bootstrapper/Payload
$payload = Get-ChildItem dist -Filter *.exe | Sort-Object Length -Descending | Select-Object -First 1
Copy-Item $payload.FullName bootstrapper/Jikkai.Bootstrapper/Payload/JIKKAI-Payload.exe

dotnet publish bootstrapper/Jikkai.Bootstrapper/Jikkai.Bootstrapper.csproj `
  -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeAllContentForSelfExtract=true
```

O executável final será criado em:

```text
bootstrapper/Jikkai.Bootstrapper/bin/Release/net8.0-windows/win-x64/publish/JIKKAI-Installer.exe
```

## Segurança e comportamento

- solicita privilégio de administrador pelo manifesto do Windows;
- calcula SHA-256 do payload antes da instalação;
- instala silenciosamente pelo NSIS usando `/S` e `/D=<pasta>`;
- preserva o comportamento atual de atalhos, atualização e desinstalação;
- não acessa nem altera os dados de perfil diretamente;
- impede o fechamento da janela enquanto a instalação estiver em andamento.

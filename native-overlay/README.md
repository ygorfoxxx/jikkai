# JIKKAI Native Overlay

Este modulo e o caminho pesado para usar o painel dentro do GTA SA em fullscreen exclusivo.

Ele nao substitui o app Electron. O Electron continua sendo a central do portal. Este modulo e uma camada nativa x86 carregada dentro do processo do GTA SA para desenhar por DirectX 9 sem minimizar o jogo.

Importante: nada deste modulo precisa ser colocado na pasta do GTA. O launcher do servidor pode verificar arquivos novos na pasta do jogo, entao o overlay nativo fica dentro da pasta do JIKKAI e e carregado por um host externo.

## Arquitetura

- `JikkaiOverlay.dll`: modulo x86 de render DirectX 9.
- `JikkaiNativeHost.exe`: host x86 externo que acompanha o launcher SLP, localiza `gta_sa.exe` e carrega o modulo por caminho absoluto.
- Hook Direct3D9 em `IDirect3DDevice9::EndScene`.
- Subclasse da janela do jogo para capturar mouse quando o modo mouse estiver ativo.
- Bridge simples por arquivo em `%LOCALAPPDATA%\JIKKAI\native-overlay-state.txt`.
- O Electron escreve o snapshot operacional nesse arquivo; o overlay nativo le esse estado.

## Fluxo SLP

O servidor usa whitelist pelo Discord e o `SLP_Launcher.exe` faz essa validacao antes de abrir o SA-MP/GTA.

O overlay JIKKAI nao toca nessa validacao:

- nao tenta autenticar whitelist;
- nao altera `SLP_Launcher.exe`;
- nao altera `samp.exe`, `samp_slp.exe` nem `gta_sa.exe`;
- nao cria arquivo novo em `C:\Shinobi Legends`;
- apenas abre ou acompanha o launcher oficial e espera `gta_sa.exe` existir.

Caminho padrao usado pelo host:

```text
C:\Shinobi Legends\SLP_Launcher.exe
```

## Atalhos dentro do jogo

- `ALT+M`: mostra/oculta o painel nativo.
- `ALT+K`: liga/desliga mouse do painel.
- Clique nos botoes do painel para alternar abas internas.

## Como compilar

Requisitos:

- Visual Studio 2022;
- workload `Desktop development with C++`;
- Windows SDK;
- build x86/Win32.

Com os requisitos instalados:

```powershell
npm run native:overlay
```

Saida esperada:

```text
native-overlay\bin\Release\Win32\JikkaiOverlay.dll
native-overlay\bin\Release\Win32\JikkaiNativeHost.exe
```

## Como testar no GTA SA

1. Nao copie nada para a pasta do GTA.
2. Abra o app JIKKAI Electron para manter o snapshot atualizado.
3. Execute `native-overlay\bin\Release\Win32\JikkaiNativeHost.exe`.
4. O host abre/acompanha `C:\Shinobi Legends\SLP_Launcher.exe`.
5. Entre normalmente pelo launcher, com a whitelist do Discord.
6. Quando o launcher abrir SA-MP/GTA, o host tenta ativar o overlay.
7. Use `ALT+M` dentro do jogo.
8. Use `ALT+K` para habilitar o mouse do painel.

Tambem e possivel abrir o launcher manualmente primeiro e depois executar o host:

```powershell
native-overlay\bin\Release\Win32\JikkaiNativeHost.exe --no-launch
```

Opcoes:

```powershell
JikkaiNativeHost.exe --game-dir "C:\Shinobi Legends"
JikkaiNativeHost.exe --launcher "C:\Shinobi Legends\SLP_Launcher.exe"
JikkaiNativeHost.exe --process gta_sa.exe
```

Se o launcher/servidor bloquear injecao em memoria, o host vai falhar ou o jogo pode fechar. Nesse caso, a solucao correta e pedir whitelist/autorizacao para o overlay JIKKAI. Este projeto nao implementa modo stealth nem burlar anti-cheat.

## Estado atual

Esta primeira entrega e a base tecnica:

- carrega o modulo sem alterar a pasta do GTA;
- instala hook D3D9;
- desenha painel nativo;
- le dados exportados pelo Electron;
- aceita mouse no painel sem abrir janela por cima do jogo.

As proximas evolucoes naturais sao:

- comandos reais de missoes pelo overlay nativo;
- mapa nativo com pontos/reunioes;
- bridge bidirecional com named pipe/local socket;
- render de texto melhorado;
- bloqueio completo de input DirectInput quando o mouse do painel estiver ativo.

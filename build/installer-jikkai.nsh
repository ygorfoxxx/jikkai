!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh

Var JikkaiWelcomeDialog
Var JikkaiWelcomeBg
Var JikkaiWelcomeKicker
Var JikkaiWelcomeTitle
Var JikkaiWelcomeCopy
Var JikkaiWelcomeFeatureOne
Var JikkaiWelcomeFeatureTwo
Var JikkaiWelcomeFeatureThree
Var JikkaiWelcomeFooter

!macro customHeader
  BrandingText "JIKKAI - F.O.X. Overlay Shinobi"
  ShowInstDetails nevershow
  InstallColors 0xF8FAFC 0x070707
!macroend

!macro customWelcomePage
  Page custom JikkaiWelcomePageCreate JikkaiWelcomePageLeave
!macroend

Function JikkaiWelcomePageCreate
  nsDialogs::Create 1018
  Pop $JikkaiWelcomeDialog
  ${If} $JikkaiWelcomeDialog == error
    Abort
  ${EndIf}

  SetCtlColors $JikkaiWelcomeDialog 0xF8FAFC 0x050505

  ${NSD_CreateLabel} 0 0 100% 100% ""
  Pop $JikkaiWelcomeBg
  SetCtlColors $JikkaiWelcomeBg 0xF8FAFC 0x050505

  ${NSD_CreateLabel} 18u 15u 265u 10u "F.O.X. - INSTALADOR OPERACIONAL"
  Pop $JikkaiWelcomeKicker
  SetCtlColors $JikkaiWelcomeKicker 0x23D3EE 0x050505

  ${NSD_CreateLabel} 18u 31u 265u 30u "JIKKAI"
  Pop $JikkaiWelcomeTitle
  SetCtlColors $JikkaiWelcomeTitle 0xFFF7ED 0x050505
  CreateFont $0 "Georgia" 24 900
  SendMessage $JikkaiWelcomeTitle ${WM_SETFONT} $0 1

  ${NSD_CreateLabel} 18u 67u 275u 34u "Instale o aplicativo operacional da Jikkai para usar overlay, mapa, missoes e dossies durante o roleplay shinobi."
  Pop $JikkaiWelcomeCopy
  SetCtlColors $JikkaiWelcomeCopy 0xC9D2DF 0x050505

  ${NSD_CreateLabel} 24u 116u 250u 13u "+ Overlay por atalho para GTA SA / SA-MP"
  Pop $JikkaiWelcomeFeatureOne
  SetCtlColors $JikkaiWelcomeFeatureOne 0xD69923 0x101010

  ${NSD_CreateLabel} 24u 137u 250u 13u "+ Mapa com localizacao, reunioes e sinais"
  Pop $JikkaiWelcomeFeatureTwo
  SetCtlColors $JikkaiWelcomeFeatureTwo 0xD69923 0x101010

  ${NSD_CreateLabel} 24u 158u 250u 13u "+ Missoes, equipe e dossies em modo de jogo"
  Pop $JikkaiWelcomeFeatureThree
  SetCtlColors $JikkaiWelcomeFeatureThree 0xD69923 0x101010

  ${NSD_CreateLabel} 18u 202u 275u 18u "Clique em Avancar para preparar o selo no Windows. A instalacao usa modo administrador."
  Pop $JikkaiWelcomeFooter
  SetCtlColors $JikkaiWelcomeFooter 0x7DD3FC 0x050505

  nsDialogs::Show
FunctionEnd

Function JikkaiWelcomePageLeave
FunctionEnd

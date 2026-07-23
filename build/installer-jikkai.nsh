!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh

Var JikkaiWelcomeDialog
Var JikkaiWelcomeBg
Var JikkaiHero
Var JikkaiHeroHandle
Var JikkaiWelcomeKicker
Var JikkaiWelcomeTitle
Var JikkaiWelcomeCopy
Var JikkaiFeatureOne
Var JikkaiFeatureTwo
Var JikkaiFeatureThree
Var JikkaiInstallLabel
Var JikkaiInstallDir
Var JikkaiBrowseButton
Var JikkaiFooter
Var JikkaiTitleFont
Var JikkaiHeadingFont
Var JikkaiBodyFont

!macro customHeader
  BrandingText "JIKKAI · INSTALADOR OPERACIONAL"
  WindowIcon on
  XPStyle on
  ShowInstDetails nevershow
  InstallColors 0xF8FAFC 0x050505

  !ifndef MUI_ABORTWARNING
    !define MUI_ABORTWARNING
  !endif
  !ifdef MUI_PAGE_CUSTOMFUNCTION_SHOW
    !undef MUI_PAGE_CUSTOMFUNCTION_SHOW
  !endif
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW JikkaiInstFilesShow
  !ifdef MUI_FINISHPAGE_TITLE
    !undef MUI_FINISHPAGE_TITLE
  !endif
  !define MUI_FINISHPAGE_TITLE "JIKKAI PRONTO PARA OPERAR"
  !ifdef MUI_FINISHPAGE_TEXT
    !undef MUI_FINISHPAGE_TEXT
  !endif
  !define MUI_FINISHPAGE_TEXT "A instalação foi concluída. O aplicativo e o overlay tático já podem ser iniciados pelo atalho da área de trabalho."
  !ifdef MUI_FINISHPAGE_RUN_TEXT
    !undef MUI_FINISHPAGE_RUN_TEXT
  !endif
  !define MUI_FINISHPAGE_RUN_TEXT "INICIAR JIKKAI"
!macroend

!macro customInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\jikkai-installer-art.bmp "${PROJECT_DIR}\assets\installer-sidebar.bmp"
  StrCpy $INSTDIR "$PROGRAMFILES64\JIKKAI"
!macroend

!macro customInstallMode
  StrCpy $isForceMachineInstall 1
!macroend

!macro customWelcomePage
  Page custom JikkaiWelcomePageCreate JikkaiWelcomePageLeave
!macroend

Function JikkaiStyleParentButtons
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:INSTALAR AGORA"
  CreateFont $JikkaiHeadingFont "Segoe UI" 9 700
  SendMessage $0 ${WM_SETFONT} $JikkaiHeadingFont 1

  GetDlgItem $1 $HWNDPARENT 2
  SendMessage $1 ${WM_SETTEXT} 0 "STR:CANCELAR"
  SendMessage $1 ${WM_SETFONT} $JikkaiHeadingFont 1

  GetDlgItem $2 $HWNDPARENT 3
  ShowWindow $2 ${SW_HIDE}
FunctionEnd

Function JikkaiWelcomePageCreate
  nsDialogs::Create 1018
  Pop $JikkaiWelcomeDialog
  ${If} $JikkaiWelcomeDialog == error
    Abort
  ${EndIf}

  SetCtlColors $JikkaiWelcomeDialog 0xF8FAFC 0x050505
  Call JikkaiStyleParentButtons

  CreateFont $JikkaiTitleFont "Segoe UI" 28 800
  CreateFont $JikkaiHeadingFont "Segoe UI" 9 700
  CreateFont $JikkaiBodyFont "Segoe UI" 9 400

  ${NSD_CreateLabel} 0 0 100% 100% ""
  Pop $JikkaiWelcomeBg
  SetCtlColors $JikkaiWelcomeBg 0xF8FAFC 0x050505

  ${NSD_CreateBitmap} 0 0 104u 220u ""
  Pop $JikkaiHero
  ${NSD_SetImage} $JikkaiHero "$PLUGINSDIR\jikkai-installer-art.bmp" $JikkaiHeroHandle

  ${NSD_CreateLabel} 118u 13u 164u 10u "JIKKAI · CLIENTE OPERACIONAL"
  Pop $JikkaiWelcomeKicker
  SetCtlColors $JikkaiWelcomeKicker 0x22D3EE 0x050505
  SendMessage $JikkaiWelcomeKicker ${WM_SETFONT} $JikkaiHeadingFont 1

  ${NSD_CreateLabel} 118u 29u 170u 34u "ENTRE NO CAMPO"
  Pop $JikkaiWelcomeTitle
  SetCtlColors $JikkaiWelcomeTitle 0xFFF7ED 0x050505
  SendMessage $JikkaiWelcomeTitle ${WM_SETFONT} $JikkaiTitleFont 1

  ${NSD_CreateLabel} 118u 67u 170u 30u "Instale o aplicativo Jikkai para acessar missões, dossiês, mapa e overlay durante o roleplay."
  Pop $JikkaiWelcomeCopy
  SetCtlColors $JikkaiWelcomeCopy 0xB8C2CF 0x050505
  SendMessage $JikkaiWelcomeCopy ${WM_SETFONT} $JikkaiBodyFont 1

  ${NSD_CreateLabel} 118u 104u 52u 22u "OVERLAY · TÁTICO"
  Pop $JikkaiFeatureOne
  SetCtlColors $JikkaiFeatureOne 0xF8D47A 0x111111
  SendMessage $JikkaiFeatureOne ${WM_SETFONT} $JikkaiHeadingFont 1

  ${NSD_CreateLabel} 175u 104u 52u 22u "MAPA · AO VIVO"
  Pop $JikkaiFeatureTwo
  SetCtlColors $JikkaiFeatureTwo 0xF8D47A 0x111111
  SendMessage $JikkaiFeatureTwo ${WM_SETFONT} $JikkaiHeadingFont 1

  ${NSD_CreateLabel} 232u 104u 52u 22u "DOSSIÊS · SYNC"
  Pop $JikkaiFeatureThree
  SetCtlColors $JikkaiFeatureThree 0xF8D47A 0x111111
  SendMessage $JikkaiFeatureThree ${WM_SETFONT} $JikkaiHeadingFont 1

  ${NSD_CreateLabel} 118u 137u 170u 10u "LOCAL DE INSTALAÇÃO"
  Pop $JikkaiInstallLabel
  SetCtlColors $JikkaiInstallLabel 0xD69923 0x050505
  SendMessage $JikkaiInstallLabel ${WM_SETFONT} $JikkaiHeadingFont 1

  ${NSD_CreateDirRequest} 118u 151u 132u 19u "$INSTDIR"
  Pop $JikkaiInstallDir
  SetCtlColors $JikkaiInstallDir 0xF8FAFC 0x121212
  SendMessage $JikkaiInstallDir ${WM_SETFONT} $JikkaiBodyFont 1

  ${NSD_CreateBrowseButton} 254u 151u 30u 19u "..."
  Pop $JikkaiBrowseButton
  ${NSD_OnClick} $JikkaiBrowseButton JikkaiBrowseInstallDir
  SendMessage $JikkaiBrowseButton ${WM_SETFONT} $JikkaiHeadingFont 1

  ${NSD_CreateLabel} 118u 180u 170u 26u "Instalação segura no Windows · atalhos criados automaticamente · execução como administrador."
  Pop $JikkaiFooter
  SetCtlColors $JikkaiFooter 0x7D8998 0x050505
  SendMessage $JikkaiFooter ${WM_SETFONT} $JikkaiBodyFont 1

  nsDialogs::Show
FunctionEnd

Function JikkaiBrowseInstallDir
  nsDialogs::SelectFolderDialog "Escolha onde instalar o JIKKAI" "$INSTDIR"
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $JikkaiInstallDir "$0"
  ${EndIf}
FunctionEnd

Function JikkaiWelcomePageLeave
  ${NSD_GetText} $JikkaiInstallDir $0
  ${If} $0 == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Escolha uma pasta para instalar o JIKKAI."
    Abort
  ${EndIf}
  StrCpy $INSTDIR "$0"
  ${NSD_FreeImage} $JikkaiHeroHandle
FunctionEnd

Function JikkaiInstFilesShow
  SetCtlColors $HWNDPARENT 0xF8FAFC 0x050505

  GetDlgItem $0 $HWNDPARENT 1004
  SetCtlColors $0 0xAEB8C7 0x050505

  GetDlgItem $1 $HWNDPARENT 1006
  SendMessage $1 ${PBM_SETBKCOLOR} 0 0x00111111
  SendMessage $1 ${PBM_SETBARCOLOR} 0 0x002399D6

  GetDlgItem $2 $HWNDPARENT 1
  SendMessage $2 ${WM_SETTEXT} 0 "STR:INSTALANDO..."

  GetDlgItem $3 $HWNDPARENT 2
  SendMessage $3 ${WM_SETTEXT} 0 "STR:CANCELAR"
FunctionEnd

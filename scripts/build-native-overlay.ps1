$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$overlayProject = Join-Path $repo "native-overlay\JikkaiOverlay\JikkaiOverlay.vcxproj"
$hostProject = Join-Path $repo "native-overlay\JikkaiNativeHost\JikkaiNativeHost.vcxproj"
$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"

if (!(Test-Path $vswhere)) {
  throw "vswhere.exe nao encontrado. Instale Visual Studio 2022 com Desktop development with C++."
}

$install = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$install) {
  throw "Visual Studio encontrado, mas o workload C++ x86/x64 nao esta instalado. Instale 'Desktop development with C++' e Windows SDK."
}

$msbuild = Join-Path $install "MSBuild\Current\Bin\MSBuild.exe"
if (!(Test-Path $msbuild)) {
  throw "MSBuild nao encontrado em $msbuild"
}

& $msbuild $overlayProject /m /p:Configuration=Release /p:Platform=Win32
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $msbuild $hostProject /m /p:Configuration=Release /p:Platform=Win32
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$overlay = Join-Path $repo "native-overlay\bin\Release\Win32\JikkaiOverlay.dll"
$hostExe = Join-Path $repo "native-overlay\bin\Release\Win32\JikkaiNativeHost.exe"
if ((Test-Path $overlay) -and (Test-Path $hostExe)) {
  Write-Host "Overlay nativo gerado em: $overlay"
  Write-Host "Host externo gerado em: $hostExe"
} else {
  throw "Build terminou, mas o .dll ou o host .exe nao foi encontrado."
}

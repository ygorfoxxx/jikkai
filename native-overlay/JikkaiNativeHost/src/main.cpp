#include <windows.h>
#include <tlhelp32.h>

#include <cmath>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

namespace {

std::wstring Lower(std::wstring value) {
  for (wchar_t &ch : value) ch = static_cast<wchar_t>(towlower(ch));
  return value;
}

DWORD FindProcessId(const std::wstring &processName) {
  PROCESSENTRY32W entry = {};
  entry.dwSize = sizeof(entry);

  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) return 0;

  const std::wstring target = Lower(processName);
  DWORD pid = 0;
  if (Process32FirstW(snapshot, &entry)) {
    do {
      if (Lower(entry.szExeFile) == target) {
        pid = entry.th32ProcessID;
        break;
      }
    } while (Process32NextW(snapshot, &entry));
  }

  CloseHandle(snapshot);
  return pid;
}

bool IsProcessRunning(const std::wstring &processName) {
  return FindProcessId(processName) != 0;
}

std::filesystem::path ModuleDirectory() {
  wchar_t path[MAX_PATH] = {};
  GetModuleFileNameW(nullptr, path, MAX_PATH);
  return std::filesystem::path(path).parent_path();
}

bool IsProcess32Bit(HANDLE process) {
  BOOL wow64 = FALSE;
  if (!IsWow64Process(process, &wow64)) return true;
  return wow64 == TRUE;
}

bool InjectDll(DWORD pid, const std::filesystem::path &dllPath) {
  HANDLE process = OpenProcess(
    PROCESS_CREATE_THREAD | PROCESS_QUERY_INFORMATION | PROCESS_VM_OPERATION | PROCESS_VM_WRITE | PROCESS_VM_READ,
    FALSE,
    pid
  );
  if (!process) {
    std::wcerr << L"Falha ao abrir gta_sa.exe. Execute o host como administrador se necessario. Erro: " << GetLastError() << L"\n";
    return false;
  }

  if (!IsProcess32Bit(process)) {
    std::wcerr << L"gta_sa.exe nao parece ser 32-bit. Este host precisa mirar o GTA SA classico 32-bit.\n";
    CloseHandle(process);
    return false;
  }

  const std::wstring fullPath = std::filesystem::absolute(dllPath).wstring();
  const size_t bytes = (fullPath.size() + 1) * sizeof(wchar_t);
  void *remotePath = VirtualAllocEx(process, nullptr, bytes, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (!remotePath) {
    std::wcerr << L"Falha ao reservar memoria remota. Erro: " << GetLastError() << L"\n";
    CloseHandle(process);
    return false;
  }

  if (!WriteProcessMemory(process, remotePath, fullPath.c_str(), bytes, nullptr)) {
    std::wcerr << L"Falha ao escrever caminho do overlay no processo. Erro: " << GetLastError() << L"\n";
    VirtualFreeEx(process, remotePath, 0, MEM_RELEASE);
    CloseHandle(process);
    return false;
  }

  HMODULE kernel32 = GetModuleHandleW(L"kernel32.dll");
  auto loadLibrary = reinterpret_cast<LPTHREAD_START_ROUTINE>(GetProcAddress(kernel32, "LoadLibraryW"));
  if (!loadLibrary) {
    std::wcerr << L"LoadLibraryW nao encontrado.\n";
    VirtualFreeEx(process, remotePath, 0, MEM_RELEASE);
    CloseHandle(process);
    return false;
  }

  HANDLE thread = CreateRemoteThread(process, nullptr, 0, loadLibrary, remotePath, 0, nullptr);
  if (!thread) {
    std::wcerr << L"Falha ao criar thread remota. Erro: " << GetLastError() << L"\n";
    VirtualFreeEx(process, remotePath, 0, MEM_RELEASE);
    CloseHandle(process);
    return false;
  }

  WaitForSingleObject(thread, 8000);
  DWORD remoteResult = 0;
  GetExitCodeThread(thread, &remoteResult);
  CloseHandle(thread);
  VirtualFreeEx(process, remotePath, 0, MEM_RELEASE);
  CloseHandle(process);

  if (!remoteResult) {
    std::wcerr << L"LoadLibraryW retornou zero. O overlay pode ter sido bloqueado pelo processo/launcher.\n";
    return false;
  }

  return true;
}

template <typename T>
bool ReadRemote(HANDLE process, uintptr_t address, T &out) {
  SIZE_T bytesRead = 0;
  return ReadProcessMemory(process, reinterpret_cast<LPCVOID>(address), &out, sizeof(T), &bytesRead) && bytesRead == sizeof(T);
}

bool ValidGameCoord(float value) {
  return std::isfinite(value) && std::fabs(value) < 100000.0f;
}

std::filesystem::path PositionPath() {
  wchar_t buffer[MAX_PATH] = {};
  DWORD size = GetEnvironmentVariableW(L"LOCALAPPDATA", buffer, MAX_PATH);
  std::filesystem::path base = size ? std::filesystem::path(buffer) : std::filesystem::temp_directory_path();
  return base / L"JIKKAI" / L"native-player-position.txt";
}

std::filesystem::path ModePath() {
  wchar_t buffer[MAX_PATH] = {};
  DWORD size = GetEnvironmentVariableW(L"LOCALAPPDATA", buffer, MAX_PATH);
  std::filesystem::path base = size ? std::filesystem::path(buffer) : std::filesystem::temp_directory_path();
  return base / L"JIKKAI" / L"native-overlay-mode.txt";
}

void WriteModeFile(bool positionOnly) {
  try {
    const auto target = ModePath();
    std::filesystem::create_directories(target.parent_path());
    std::ofstream file(target, std::ios::trunc);
    if (!file.is_open()) return;
    file << "position_only=" << (positionOnly ? "1" : "0") << "\n";
    file << "updated_tick=" << GetTickCount64() << "\n";
  } catch (...) {
  }
}

bool ReadPlayerPositionExternal(HANDLE process, float &x, float &y, float &z) {
  constexpr uintptr_t kPlayerPedPtr = 0x00B6F5F0;
  uintptr_t ped = 0;
  uintptr_t matrix = 0;
  if (!ReadRemote<uintptr_t>(process, kPlayerPedPtr, ped)) return false;
  if (!ReadRemote<uintptr_t>(process, ped + 0x14, matrix)) return false;
  if (!ReadRemote<float>(process, matrix + 0x30, x)) return false;
  if (!ReadRemote<float>(process, matrix + 0x34, y)) return false;
  if (!ReadRemote<float>(process, matrix + 0x38, z)) return false;
  return ValidGameCoord(x) && ValidGameCoord(y) && ValidGameCoord(z);
}

void WritePositionFile(float x, float y, float z, DWORD pid) {
  try {
    const auto target = PositionPath();
    std::filesystem::create_directories(target.parent_path());
    std::ofstream file(target, std::ios::trunc);
    if (!file.is_open()) return;
    file << std::fixed << std::setprecision(3);
    file << "ok=1\n";
    file << "x=" << x << "\n";
    file << "y=" << y << "\n";
    file << "z=" << z << "\n";
    file << "tick=" << GetTickCount64() << "\n";
    file << "pid=" << pid << "\n";
    file << "source=external_readonly\n";
  } catch (...) {
  }
}

int TrackPositionReadOnly(const std::wstring &processName, int waitSeconds) {
  std::wcout << L"Modo posicao segura: leitura externa somente. Sem injecao, sem hook, sem DLL no GTA.\n";
  DWORD pid = 0;
  for (int i = 0; i < waitSeconds && !pid; ++i) {
    pid = FindProcessId(processName);
    if (!pid) Sleep(1000);
  }
  if (!pid) {
    std::wcerr << L"gta_sa.exe nao encontrado para rastreamento seguro.\n";
    return 3;
  }

  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, FALSE, pid);
  if (!process) process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
  if (!process) {
    std::wcerr << L"Falha ao abrir gta_sa.exe para leitura. Erro: " << GetLastError() << L"\n";
    return 4;
  }

  std::wcout << L"Rastreamento seguro iniciado. PID: " << pid << L"\n";
  std::wcout << L"Arquivo de posicao: " << PositionPath().wstring() << L"\n";
  DWORD exitCode = STILL_ACTIVE;
  while (GetExitCodeProcess(process, &exitCode) && exitCode == STILL_ACTIVE) {
    float x = 0.0f, y = 0.0f, z = 0.0f;
    if (ReadPlayerPositionExternal(process, x, y, z)) {
      WritePositionFile(x, y, z, pid);
    }
    Sleep(750);
  }

  CloseHandle(process);
  std::wcout << L"gta_sa.exe encerrado. Rastreamento finalizado.\n";
  return 0;
}

std::filesystem::path DefaultGameDirectory() {
  return std::filesystem::path(L"C:\\Shinobi Legends");
}

std::filesystem::path ArgPath(int argc, wchar_t **argv, const std::wstring &name, const std::filesystem::path &fallback) {
  for (int i = 1; i + 1 < argc; ++i) {
    if (Lower(argv[i]) == Lower(name)) return std::filesystem::path(argv[i + 1]);
  }
  return fallback;
}

std::wstring ArgValue(int argc, wchar_t **argv, const std::wstring &name, const std::wstring &fallback) {
  for (int i = 1; i + 1 < argc; ++i) {
    if (Lower(argv[i]) == Lower(name)) return argv[i + 1];
  }
  return fallback;
}

int ArgInt(int argc, wchar_t **argv, const std::wstring &name, int fallback) {
  for (int i = 1; i + 1 < argc; ++i) {
    if (Lower(argv[i]) == Lower(name)) {
      try {
        return std::stoi(argv[i + 1]);
      } catch (...) {
        return fallback;
      }
    }
  }
  return fallback;
}

bool HasFlag(int argc, wchar_t **argv, const std::wstring &flag) {
  for (int i = 1; i < argc; ++i) {
    if (Lower(argv[i]) == Lower(flag)) return true;
  }
  return false;
}

bool StartSlpLauncher(const std::filesystem::path &launcherPath, const std::filesystem::path &gameDir) {
  if (!std::filesystem::exists(launcherPath)) {
    std::wcerr << L"SLP_Launcher.exe nao encontrado em: " << launcherPath.wstring() << L"\n";
    return false;
  }

  if (IsProcessRunning(L"SLP_Launcher.exe")) {
    std::wcout << L"SLP_Launcher.exe ja esta aberto. Aguardando SA-MP/GTA...\n";
    return true;
  }

  SHELLEXECUTEINFOW info = {};
  info.cbSize = sizeof(info);
  info.fMask = SEE_MASK_NOCLOSEPROCESS;
  info.lpVerb = L"open";
  info.lpFile = launcherPath.c_str();
  info.lpDirectory = gameDir.c_str();
  info.nShow = SW_SHOWNORMAL;

  if (!ShellExecuteExW(&info)) {
    std::wcerr << L"Falha ao abrir SLP_Launcher.exe. Erro: " << GetLastError() << L"\n";
    return false;
  }

  if (info.hProcess) CloseHandle(info.hProcess);
  std::wcout << L"SLP_Launcher.exe aberto. Whitelist/Discord continuam sendo responsabilidade do launcher oficial.\n";
  return true;
}

} // namespace

int wmain(int argc, wchar_t **argv) {
  const std::filesystem::path gameDir = ArgPath(argc, argv, L"--game-dir", DefaultGameDirectory());
  const std::filesystem::path launcherPath = ArgPath(argc, argv, L"--launcher", gameDir / L"SLP_Launcher.exe");
  const std::wstring processName = ArgValue(argc, argv, L"--process", L"gta_sa.exe");
  const bool noLaunch = HasFlag(argc, argv, L"--no-launch");
  const bool positionOnly = HasFlag(argc, argv, L"--position-only");
  const bool injectPositionOnly = HasFlag(argc, argv, L"--inject-position-only");
  const int configuredWaitSeconds = ArgInt(argc, argv, L"--wait-seconds", 300);
  const int waitSeconds = configuredWaitSeconds > 0 ? configuredWaitSeconds : 1;
  const std::filesystem::path dllPath = ModuleDirectory() / L"JikkaiOverlay.dll";

  std::wcout << L"JIKKAI Native Host\n";
  std::wcout << L"Pasta Shinobi Legends: " << gameDir.wstring() << L"\n";
  std::wcout << L"Launcher oficial: " << launcherPath.wstring() << L"\n";
  std::wcout << L"Processo alvo: " << processName << L"\n";
  std::wcout << L"Overlay: " << dllPath.wstring() << L"\n";
  std::wcout << L"Nenhum arquivo sera copiado para a pasta do GTA.\n";

  if (positionOnly) {
    return TrackPositionReadOnly(processName, waitSeconds);
  }

  if (!std::filesystem::exists(dllPath)) {
    std::wcerr << L"JikkaiOverlay.dll nao encontrado ao lado do host.\n";
    return 2;
  }

  if (!noLaunch && !IsProcessRunning(processName)) {
    StartSlpLauncher(launcherPath, gameDir);
  }

  DWORD pid = 0;
  for (int i = 0; i < waitSeconds && !pid; ++i) {
    pid = FindProcessId(processName);
    if (!pid) Sleep(1000);
  }

  if (!pid) {
    std::wcerr << L"gta_sa.exe nao encontrado. Abra o jogo pelo SLP_Launcher.exe e tente novamente.\n";
    return 3;
  }

  std::wcout << L"gta_sa.exe encontrado. PID: " << pid << L"\n";
  WriteModeFile(injectPositionOnly);
  if (!InjectDll(pid, dllPath)) return 4;

  std::wcout << (injectPositionOnly ? L"Rastreador de posicao injetado sem hook.\n" : L"Overlay JIKKAI carregado. Use ALT+M e ALT+K dentro do jogo.\n");
  return 0;
}

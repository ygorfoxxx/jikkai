#define NOMINMAX
#include <windows.h>
#include <windowsx.h>
#include <d3d9.h>

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#pragma comment(lib, "d3d9.lib")

namespace {

using EndSceneFn = HRESULT(WINAPI *)(IDirect3DDevice9 *);

struct Patch {
  void *target = nullptr;
  unsigned char original[5] = {};
  void *gateway = nullptr;
};

struct RectI {
  int x = 0;
  int y = 0;
  int w = 0;
  int h = 0;
};

struct Button {
  RectI rect;
  int tab = 0;
};

struct Snapshot {
  std::string user = "LEITURA RESTRITA";
  std::string role = "SESSAO NAO IDENTIFICADA";
  int missionCount = 0;
  std::string missionTitle = "SEM MISSAO ATIVA";
  std::string objective = "AGUARDANDO APP JIKKAI";
  std::string meetingTitle = "";
  int meetingMinutes = 0;
  std::string sync = "LOCAL";
};

struct PlayerPosition {
  bool ok = false;
  float x = 0.0f;
  float y = 0.0f;
  float z = 0.0f;
};

struct Vertex {
  float x;
  float y;
  float z;
  float rhw;
  DWORD color;
};

constexpr DWORD ORANGE = D3DCOLOR_ARGB(230, 249, 115, 22);
constexpr DWORD CYAN = D3DCOLOR_ARGB(230, 34, 211, 238);
constexpr DWORD PANEL = D3DCOLOR_ARGB(198, 5, 8, 12);
constexpr DWORD PANEL_HOT = D3DCOLOR_ARGB(210, 27, 10, 4);
constexpr DWORD CARD = D3DCOLOR_ARGB(188, 12, 16, 22);
constexpr DWORD TEXT = D3DCOLOR_ARGB(245, 255, 247, 237);
constexpr DWORD MUTED = D3DCOLOR_ARGB(230, 170, 184, 202);

Patch g_endScenePatch;
EndSceneFn g_originalEndScene = nullptr;
HWND g_gameWindow = nullptr;
WNDPROC g_originalWndProc = nullptr;
bool g_hooked = false;
bool g_visible = false;
bool g_mouseMode = false;
bool g_lastAltM = false;
bool g_lastAltK = false;
int g_tab = 0;
int g_mouseX = 0;
int g_mouseY = 0;
std::vector<Button> g_buttons;
Snapshot g_snapshot;
ULONGLONG g_lastSnapshotRead = 0;
ULONGLONG g_lastPositionWrite = 0;

std::string Trim(std::string value) {
  auto isSpace = [](unsigned char c) { return std::isspace(c) != 0; };
  value.erase(value.begin(), std::find_if(value.begin(), value.end(), [&](char c) { return !isSpace(static_cast<unsigned char>(c)); }));
  value.erase(std::find_if(value.rbegin(), value.rend(), [&](char c) { return !isSpace(static_cast<unsigned char>(c)); }).base(), value.end());
  return value;
}

std::string UpperAscii(std::string value) {
  std::string out;
  out.reserve(value.size());
  for (unsigned char c : value) {
    if (c >= 128) continue;
    out.push_back(static_cast<char>(std::toupper(c)));
  }
  return out;
}

std::string ClampText(const std::string &value, size_t maxLen) {
  std::string ascii;
  ascii.reserve(value.size());
  for (unsigned char c : value) {
    if (c >= 32 && c < 127) ascii.push_back(static_cast<char>(c));
  }
  if (ascii.size() > maxLen) return ascii.substr(0, maxLen - 3) + "...";
  return ascii;
}

std::filesystem::path SnapshotPath() {
  wchar_t buffer[MAX_PATH] = {};
  DWORD size = GetEnvironmentVariableW(L"LOCALAPPDATA", buffer, MAX_PATH);
  std::filesystem::path base = size ? std::filesystem::path(buffer) : std::filesystem::temp_directory_path();
  return base / L"JIKKAI" / L"native-overlay-state.txt";
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

bool PositionOnlyMode() {
  try {
    std::ifstream file(ModePath());
    if (!file.is_open()) return false;
    std::string line;
    while (std::getline(file, line)) {
      if (Trim(line) == "position_only=1") return true;
    }
  } catch (...) {
  }
  return false;
}

template <typename T>
bool SafeRead(uintptr_t address, T &out) {
  if (address < 0x10000) return false;
  __try {
    out = *reinterpret_cast<T *>(address);
    return true;
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return false;
  }
}

bool ValidGameCoord(float value) {
  return std::isfinite(value) && std::fabs(value) < 100000.0f;
}

bool ReadPlayerPosition(PlayerPosition &position) {
  // GTA SA 1.0: CPlayerPed pointer. The launcher can wrap the game, so every
  // read is guarded to avoid crashing if a build moves or delays this pointer.
  constexpr uintptr_t kPlayerPedPtr = 0x00B6F5F0;
  uintptr_t ped = 0;
  uintptr_t matrix = 0;
  if (!SafeRead<uintptr_t>(kPlayerPedPtr, ped)) return false;
  if (!SafeRead<uintptr_t>(ped + 0x14, matrix)) return false;

  float x = 0.0f;
  float y = 0.0f;
  float z = 0.0f;
  if (!SafeRead<float>(matrix + 0x30, x)) return false;
  if (!SafeRead<float>(matrix + 0x34, y)) return false;
  if (!SafeRead<float>(matrix + 0x38, z)) return false;
  if (!ValidGameCoord(x) || !ValidGameCoord(y) || !ValidGameCoord(z)) return false;

  position.ok = true;
  position.x = x;
  position.y = y;
  position.z = z;
  return true;
}

void PublishPlayerPosition() {
  const ULONGLONG now = GetTickCount64();
  if (now - g_lastPositionWrite < 750) return;
  g_lastPositionWrite = now;

  PlayerPosition position;
  if (!ReadPlayerPosition(position)) return;

  try {
    const auto target = PositionPath();
    std::filesystem::create_directories(target.parent_path());
    std::ofstream file(target, std::ios::trunc);
    if (!file.is_open()) return;
    file << std::fixed << std::setprecision(3);
    file << "ok=1\n";
    file << "x=" << position.x << "\n";
    file << "y=" << position.y << "\n";
    file << "z=" << position.z << "\n";
    file << "tick=" << now << "\n";
    file << "pid=" << GetCurrentProcessId() << "\n";
    file << "source=gta_sa_memory\n";
  } catch (...) {
  }
}

DWORD WINAPI PositionThread(LPVOID) {
  Sleep(1600);
  while (true) {
    PublishPlayerPosition();
    Sleep(750);
  }
  return 0;
}

int ParseInt(const std::string &value, int fallback = 0) {
  try {
    return std::stoi(value);
  } catch (...) {
    return fallback;
  }
}

void LoadSnapshot() {
  const ULONGLONG now = GetTickCount64();
  if (now - g_lastSnapshotRead < 800) return;
  g_lastSnapshotRead = now;

  std::ifstream file(SnapshotPath());
  if (!file.is_open()) return;

  std::map<std::string, std::string> lines;
  std::string line;
  while (std::getline(file, line)) {
    const size_t eq = line.find('=');
    if (eq == std::string::npos) continue;
    lines[Trim(line.substr(0, eq))] = Trim(line.substr(eq + 1));
  }

  if (lines.count("user")) g_snapshot.user = lines["user"];
  if (lines.count("role")) g_snapshot.role = lines["role"];
  if (lines.count("mission_count")) g_snapshot.missionCount = ParseInt(lines["mission_count"]);
  if (lines.count("mission_title")) g_snapshot.missionTitle = lines["mission_title"];
  if (lines.count("mission_objective")) g_snapshot.objective = lines["mission_objective"];
  if (lines.count("meeting_title")) g_snapshot.meetingTitle = lines["meeting_title"];
  if (lines.count("meeting_minutes")) g_snapshot.meetingMinutes = ParseInt(lines["meeting_minutes"]);
  if (lines.count("sync")) g_snapshot.sync = lines["sync"];
}

bool PointInRect(int x, int y, const RectI &r) {
  return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

void ForceCursorVisible() {
  ClipCursor(nullptr);
  SetCursor(LoadCursor(nullptr, IDC_ARROW));
  for (int i = 0; i < 8; ++i) ShowCursor(TRUE);
}

bool HotkeyPressed(int virtualKey, bool &lastState) {
  const bool down = (GetAsyncKeyState(VK_MENU) & 0x8000) && (GetAsyncKeyState(virtualKey) & 0x8000);
  const bool pressed = down && !lastState;
  lastState = down;
  return pressed;
}

void PollHotkeys() {
  if (HotkeyPressed('M', g_lastAltM)) {
    g_visible = !g_visible;
    if (!g_visible) g_mouseMode = false;
  }
  if (HotkeyPressed('K', g_lastAltK)) {
    if (!g_visible) g_visible = true;
    g_mouseMode = !g_mouseMode;
  }
  if (g_mouseMode) ForceCursorVisible();
}

void DrawQuad(IDirect3DDevice9 *device, float x, float y, float w, float h, DWORD color) {
  Vertex vertices[6] = {
    { x, y, 0.0f, 1.0f, color },
    { x + w, y, 0.0f, 1.0f, color },
    { x, y + h, 0.0f, 1.0f, color },
    { x + w, y, 0.0f, 1.0f, color },
    { x + w, y + h, 0.0f, 1.0f, color },
    { x, y + h, 0.0f, 1.0f, color }
  };
  device->DrawPrimitiveUP(D3DPT_TRIANGLELIST, 2, vertices, sizeof(Vertex));
}

void DrawBorder(IDirect3DDevice9 *device, float x, float y, float w, float h, DWORD color) {
  DrawQuad(device, x, y, w, 1.0f, color);
  DrawQuad(device, x, y + h - 1.0f, w, 1.0f, color);
  DrawQuad(device, x, y, 1.0f, h, color);
  DrawQuad(device, x + w - 1.0f, y, 1.0f, h, color);
}

const char **Glyph(char c) {
  static const char *space[7] = { "00000","00000","00000","00000","00000","00000","00000" };
  static const char *unknown[7] = { "11111","10001","00001","00010","00100","00000","00100" };
  static const char *A[7] = { "01110","10001","10001","11111","10001","10001","10001" };
  static const char *B[7] = { "11110","10001","10001","11110","10001","10001","11110" };
  static const char *C[7] = { "01111","10000","10000","10000","10000","10000","01111" };
  static const char *D[7] = { "11110","10001","10001","10001","10001","10001","11110" };
  static const char *E[7] = { "11111","10000","10000","11110","10000","10000","11111" };
  static const char *F[7] = { "11111","10000","10000","11110","10000","10000","10000" };
  static const char *G[7] = { "01111","10000","10000","10011","10001","10001","01111" };
  static const char *H[7] = { "10001","10001","10001","11111","10001","10001","10001" };
  static const char *I[7] = { "11111","00100","00100","00100","00100","00100","11111" };
  static const char *J[7] = { "00111","00010","00010","00010","10010","10010","01100" };
  static const char *K[7] = { "10001","10010","10100","11000","10100","10010","10001" };
  static const char *L[7] = { "10000","10000","10000","10000","10000","10000","11111" };
  static const char *M[7] = { "10001","11011","10101","10101","10001","10001","10001" };
  static const char *N[7] = { "10001","11001","10101","10011","10001","10001","10001" };
  static const char *O[7] = { "01110","10001","10001","10001","10001","10001","01110" };
  static const char *P[7] = { "11110","10001","10001","11110","10000","10000","10000" };
  static const char *Q[7] = { "01110","10001","10001","10001","10101","10010","01101" };
  static const char *R[7] = { "11110","10001","10001","11110","10100","10010","10001" };
  static const char *S[7] = { "01111","10000","10000","01110","00001","00001","11110" };
  static const char *T[7] = { "11111","00100","00100","00100","00100","00100","00100" };
  static const char *U[7] = { "10001","10001","10001","10001","10001","10001","01110" };
  static const char *V[7] = { "10001","10001","10001","10001","10001","01010","00100" };
  static const char *W[7] = { "10001","10001","10001","10101","10101","10101","01010" };
  static const char *X[7] = { "10001","10001","01010","00100","01010","10001","10001" };
  static const char *Y[7] = { "10001","10001","01010","00100","00100","00100","00100" };
  static const char *Z[7] = { "11111","00001","00010","00100","01000","10000","11111" };
  static const char *N0[7] = { "01110","10001","10011","10101","11001","10001","01110" };
  static const char *N1[7] = { "00100","01100","00100","00100","00100","00100","01110" };
  static const char *N2[7] = { "01110","10001","00001","00010","00100","01000","11111" };
  static const char *N3[7] = { "11110","00001","00001","01110","00001","00001","11110" };
  static const char *N4[7] = { "00010","00110","01010","10010","11111","00010","00010" };
  static const char *N5[7] = { "11111","10000","10000","11110","00001","00001","11110" };
  static const char *N6[7] = { "01110","10000","10000","11110","10001","10001","01110" };
  static const char *N7[7] = { "11111","00001","00010","00100","01000","01000","01000" };
  static const char *N8[7] = { "01110","10001","10001","01110","10001","10001","01110" };
  static const char *N9[7] = { "01110","10001","10001","01111","00001","00001","01110" };
  static const char *colon[7] = { "00000","00100","00100","00000","00100","00100","00000" };
  static const char *dash[7] = { "00000","00000","00000","11111","00000","00000","00000" };
  static const char *dot[7] = { "00000","00000","00000","00000","00000","01100","01100" };
  static const char *slash[7] = { "00001","00010","00010","00100","01000","01000","10000" };
  static const char *plus[7] = { "00000","00100","00100","11111","00100","00100","00000" };
  switch (c) {
    case ' ': return space; case 'A': return A; case 'B': return B; case 'C': return C; case 'D': return D;
    case 'E': return E; case 'F': return F; case 'G': return G; case 'H': return H; case 'I': return I;
    case 'J': return J; case 'K': return K; case 'L': return L; case 'M': return M; case 'N': return N;
    case 'O': return O; case 'P': return P; case 'Q': return Q; case 'R': return R; case 'S': return S;
    case 'T': return T; case 'U': return U; case 'V': return V; case 'W': return W; case 'X': return X;
    case 'Y': return Y; case 'Z': return Z; case '0': return N0; case '1': return N1; case '2': return N2;
    case '3': return N3; case '4': return N4; case '5': return N5; case '6': return N6; case '7': return N7;
    case '8': return N8; case '9': return N9; case ':': return colon; case '-': return dash; case '.': return dot;
    case '/': return slash; case '+': return plus; default: return unknown;
  }
}

void DrawTextMini(IDirect3DDevice9 *device, int x, int y, const std::string &text, DWORD color, int scale = 2, int maxChars = 48) {
  const std::string upper = UpperAscii(text);
  int cursor = x;
  int drawn = 0;
  for (char raw : upper) {
    if (drawn++ >= maxChars) break;
    const char **glyph = Glyph(raw);
    for (int row = 0; row < 7; ++row) {
      for (int col = 0; col < 5; ++col) {
        if (glyph[row][col] == '1') {
          DrawQuad(device, static_cast<float>(cursor + col * scale), static_cast<float>(y + row * scale), static_cast<float>(scale), static_cast<float>(scale), color);
        }
      }
    }
    cursor += 6 * scale;
  }
}

void ButtonRect(IDirect3DDevice9 *device, int x, int y, int w, int h, const std::string &label, int tab, bool active) {
  const DWORD fill = active ? D3DCOLOR_ARGB(220, 84, 32, 8) : D3DCOLOR_ARGB(188, 15, 18, 24);
  DrawQuad(device, static_cast<float>(x), static_cast<float>(y), static_cast<float>(w), static_cast<float>(h), fill);
  DrawBorder(device, static_cast<float>(x), static_cast<float>(y), static_cast<float>(w), static_cast<float>(h), active ? ORANGE : D3DCOLOR_ARGB(160, 255, 255, 255));
  DrawTextMini(device, x + 10, y + 10, label, active ? TEXT : MUTED, 2, 12);
  g_buttons.push_back({ { x, y, w, h }, tab });
}

void RenderPanel(IDirect3DDevice9 *device) {
  LoadSnapshot();

  D3DVIEWPORT9 vp = {};
  if (FAILED(device->GetViewport(&vp))) return;

  const int panelW = std::min<int>(520, std::max<int>(420, static_cast<int>(vp.Width) - 80));
  const int panelH = std::min<int>(680, std::max<int>(420, static_cast<int>(vp.Height) - 60));
  const int x = std::max<int>(24, static_cast<int>(vp.Width) - panelW - 28);
  const int y = 24;

  IDirect3DStateBlock9 *state = nullptr;
  device->CreateStateBlock(D3DSBT_ALL, &state);
  device->SetRenderState(D3DRS_ALPHABLENDENABLE, TRUE);
  device->SetRenderState(D3DRS_SRCBLEND, D3DBLEND_SRCALPHA);
  device->SetRenderState(D3DRS_DESTBLEND, D3DBLEND_INVSRCALPHA);
  device->SetRenderState(D3DRS_LIGHTING, FALSE);
  device->SetRenderState(D3DRS_ZENABLE, FALSE);
  device->SetRenderState(D3DRS_CULLMODE, D3DCULL_NONE);
  device->SetTexture(0, nullptr);
  device->SetFVF(D3DFVF_XYZRHW | D3DFVF_DIFFUSE);

  g_buttons.clear();
  DrawQuad(device, static_cast<float>(x), static_cast<float>(y), static_cast<float>(panelW), static_cast<float>(panelH), PANEL);
  DrawBorder(device, static_cast<float>(x), static_cast<float>(y), static_cast<float>(panelW), static_cast<float>(panelH), ORANGE);

  DrawTextMini(device, x + 18, y + 18, "JIKKAI NATIVE OVERLAY", ORANGE, 2, 32);
  DrawTextMini(device, x + 18, y + 42, ClampText(g_snapshot.user, 28), TEXT, 3, 28);
  DrawTextMini(device, x + 18, y + 72, ClampText(g_snapshot.role, 34), MUTED, 2, 34);
  DrawTextMini(device, x + panelW - 174, y + 24, g_mouseMode ? "MOUSE ON" : "MOUSE OFF", g_mouseMode ? CYAN : MUTED, 2, 14);
  DrawTextMini(device, x + panelW - 174, y + 48, "ALT+K", MUTED, 2, 8);

  const int tabY = y + 104;
  const int tabW = (panelW - 46) / 4;
  ButtonRect(device, x + 14, tabY, tabW, 42, "MISSOES", 0, g_tab == 0);
  ButtonRect(device, x + 20 + tabW, tabY, tabW, 42, "MAPA", 1, g_tab == 1);
  ButtonRect(device, x + 26 + tabW * 2, tabY, tabW, 42, "MEMBROS", 2, g_tab == 2);
  ButtonRect(device, x + 32 + tabW * 3, tabY, tabW, 42, "DOSSIOS", 3, g_tab == 3);

  const int contentY = y + 164;
  DrawQuad(device, static_cast<float>(x + 14), static_cast<float>(contentY), static_cast<float>(panelW - 28), static_cast<float>(panelH - 190), CARD);
  DrawBorder(device, static_cast<float>(x + 14), static_cast<float>(contentY), static_cast<float>(panelW - 28), static_cast<float>(panelH - 190), D3DCOLOR_ARGB(140, 255, 255, 255));

  if (g_tab == 0) {
    DrawTextMini(device, x + 30, contentY + 22, "MISSOES ATIVAS", ORANGE, 2, 20);
    DrawTextMini(device, x + 30, contentY + 52, std::to_string(g_snapshot.missionCount) + " OPERACOES", TEXT, 3, 18);
    DrawTextMini(device, x + 30, contentY + 100, ClampText(g_snapshot.missionTitle, 40), CYAN, 2, 40);
    DrawTextMini(device, x + 30, contentY + 132, ClampText(g_snapshot.objective, 48), MUTED, 2, 48);
  } else if (g_tab == 1) {
    DrawTextMini(device, x + 30, contentY + 22, "MAPA E REUNIAO", ORANGE, 2, 20);
    if (!g_snapshot.meetingTitle.empty()) {
      DrawTextMini(device, x + 30, contentY + 56, ClampText(g_snapshot.meetingTitle, 42), CYAN, 2, 42);
      DrawTextMini(device, x + 30, contentY + 90, std::to_string(g_snapshot.meetingMinutes) + " MIN RESTANTES", TEXT, 2, 24);
    } else {
      DrawTextMini(device, x + 30, contentY + 56, "SEM REUNIAO ATIVA", MUTED, 2, 28);
    }
  } else if (g_tab == 2) {
    DrawTextMini(device, x + 30, contentY + 22, "MEMBROS", ORANGE, 2, 14);
    DrawTextMini(device, x + 30, contentY + 56, "BASE NATIVA PRONTA", TEXT, 2, 28);
    DrawTextMini(device, x + 30, contentY + 88, "PROXIMO PASSO: LISTA ONLINE", MUTED, 2, 36);
  } else {
    DrawTextMini(device, x + 30, contentY + 22, "DOSSIOS", ORANGE, 2, 14);
    DrawTextMini(device, x + 30, contentY + 56, "ARQUIVO VISUAL EM PREPARO", TEXT, 2, 34);
  }

  DrawTextMini(device, x + 18, y + panelH - 32, "ALT+M OCULTA  ALT+K MOUSE  " + UpperAscii(g_snapshot.sync), MUTED, 2, 44);

  if (g_mouseMode) {
    DrawQuad(device, static_cast<float>(g_mouseX - 5), static_cast<float>(g_mouseY - 1), 11.0f, 2.0f, CYAN);
    DrawQuad(device, static_cast<float>(g_mouseX - 1), static_cast<float>(g_mouseY - 5), 2.0f, 11.0f, CYAN);
  }

  if (state) {
    state->Apply();
    state->Release();
  }
}

void HandleClick(int x, int y) {
  for (const Button &button : g_buttons) {
    if (PointInRect(x, y, button.rect)) {
      g_tab = button.tab;
      return;
    }
  }
}

LRESULT CALLBACK OverlayWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (g_visible && g_mouseMode) {
    switch (msg) {
      case WM_SETCURSOR:
        ForceCursorVisible();
        return TRUE;
      case WM_MOUSEMOVE:
        g_mouseX = GET_X_LPARAM(lParam);
        g_mouseY = GET_Y_LPARAM(lParam);
        ForceCursorVisible();
        return TRUE;
      case WM_LBUTTONDOWN:
        g_mouseX = GET_X_LPARAM(lParam);
        g_mouseY = GET_Y_LPARAM(lParam);
        HandleClick(g_mouseX, g_mouseY);
        return TRUE;
      case WM_LBUTTONUP:
      case WM_RBUTTONDOWN:
      case WM_RBUTTONUP:
      case WM_MBUTTONDOWN:
      case WM_MBUTTONUP:
      case WM_MOUSEWHEEL:
        return TRUE;
      default:
        break;
    }
  }

  return g_originalWndProc ? CallWindowProcW(g_originalWndProc, hwnd, msg, wParam, lParam) : DefWindowProcW(hwnd, msg, wParam, lParam);
}

void InstallWndProc(IDirect3DDevice9 *device) {
  if (g_gameWindow && g_originalWndProc) return;
  D3DDEVICE_CREATION_PARAMETERS params = {};
  if (FAILED(device->GetCreationParameters(&params))) return;
  HWND hwnd = params.hFocusWindow;
  if (!hwnd || !IsWindow(hwnd)) return;
  g_gameWindow = hwnd;
  SetLastError(0);
  LONG_PTR previous = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(OverlayWndProc));
  if (previous) g_originalWndProc = reinterpret_cast<WNDPROC>(previous);
}

HRESULT WINAPI HookedEndScene(IDirect3DDevice9 *device) {
  PollHotkeys();
  PublishPlayerPosition();
  if (device) {
    InstallWndProc(device);
    if (g_visible) RenderPanel(device);
  }
  return g_originalEndScene ? g_originalEndScene(device) : D3D_OK;
}

bool InstallPatch(void *target, void *detour, Patch &patch) {
  if (!target || !detour) return false;

  DWORD oldProtect = 0;
  if (!VirtualProtect(target, 5, PAGE_EXECUTE_READWRITE, &oldProtect)) return false;

  patch.target = target;
  memcpy(patch.original, target, 5);

  unsigned char *gateway = static_cast<unsigned char *>(VirtualAlloc(nullptr, 10, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE));
  if (!gateway) {
    VirtualProtect(target, 5, oldProtect, &oldProtect);
    return false;
  }

  memcpy(gateway, target, 5);
  gateway[5] = 0xE9;
  *reinterpret_cast<int32_t *>(gateway + 6) = static_cast<int32_t>((reinterpret_cast<uintptr_t>(target) + 5) - (reinterpret_cast<uintptr_t>(gateway) + 10));

  unsigned char patchBytes[5] = { 0xE9, 0, 0, 0, 0 };
  *reinterpret_cast<int32_t *>(patchBytes + 1) = static_cast<int32_t>(reinterpret_cast<uintptr_t>(detour) - reinterpret_cast<uintptr_t>(target) - 5);
  memcpy(target, patchBytes, 5);
  VirtualProtect(target, 5, oldProtect, &oldProtect);
  FlushInstructionCache(GetCurrentProcess(), target, 5);

  patch.gateway = gateway;
  return true;
}

LRESULT CALLBACK DummyWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

HWND CreateDummyWindow() {
  WNDCLASSEXW wc = {};
  wc.cbSize = sizeof(wc);
  wc.lpfnWndProc = DummyWndProc;
  wc.hInstance = GetModuleHandleW(nullptr);
  wc.lpszClassName = L"JikkaiNativeOverlayDummy";
  RegisterClassExW(&wc);
  return CreateWindowExW(0, wc.lpszClassName, L"Jikkai", WS_OVERLAPPEDWINDOW, 0, 0, 100, 100, nullptr, nullptr, wc.hInstance, nullptr);
}

bool InstallD3D9Hook() {
  HWND dummy = CreateDummyWindow();
  if (!dummy) return false;

  IDirect3D9 *d3d = Direct3DCreate9(D3D_SDK_VERSION);
  if (!d3d) {
    DestroyWindow(dummy);
    return false;
  }

  D3DPRESENT_PARAMETERS pp = {};
  pp.Windowed = TRUE;
  pp.SwapEffect = D3DSWAPEFFECT_DISCARD;
  pp.hDeviceWindow = dummy;
  pp.BackBufferFormat = D3DFMT_UNKNOWN;

  IDirect3DDevice9 *device = nullptr;
  HRESULT hr = d3d->CreateDevice(D3DADAPTER_DEFAULT, D3DDEVTYPE_HAL, dummy, D3DCREATE_SOFTWARE_VERTEXPROCESSING, &pp, &device);
  if (FAILED(hr)) {
    d3d->Release();
    DestroyWindow(dummy);
    return false;
  }

  void **vtable = *reinterpret_cast<void ***>(device);
  void *endScene = vtable[42];
  const bool ok = InstallPatch(endScene, reinterpret_cast<void *>(HookedEndScene), g_endScenePatch);
  if (ok) {
    g_originalEndScene = reinterpret_cast<EndSceneFn>(g_endScenePatch.gateway);
    g_hooked = true;
  }

  device->Release();
  d3d->Release();
  DestroyWindow(dummy);
  return ok;
}

DWORD WINAPI InitThread(LPVOID) {
  Sleep(1500);
  for (int attempt = 0; attempt < 120 && !g_hooked; ++attempt) {
    if (InstallD3D9Hook()) break;
    Sleep(500);
  }
  return 0;
}

} // namespace

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID) {
  if (reason == DLL_PROCESS_ATTACH) {
    DisableThreadLibraryCalls(module);
    HANDLE thread = CreateThread(nullptr, 0, PositionOnlyMode() ? PositionThread : InitThread, nullptr, 0, nullptr);
    if (thread) CloseHandle(thread);
  }
  return TRUE;
}

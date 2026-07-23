const { app, BrowserWindow, Menu, Notification, globalShortcut, ipcMain, protocol, net, screen, shell, Tray, nativeImage } = require("electron");
const { execFile, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { RealtimeService } = require("./realtime/realtime-service");

const APP_ROOT = path.resolve(__dirname, "..");
const APP_SCHEME = "jikkai";
const APP_HOST = "app";
const OVERLAY_SHORTCUT = "CommandOrControl+Shift+J";
const CLICK_THROUGH_SHORTCUT = "CommandOrControl+Shift+K";
const PORTAL_SHORTCUT = "CommandOrControl+Shift+M";
const SHORTCUT_GROUPS = {
  overlay: ["CommandOrControl+Shift+J", "Alt+J", "CommandOrControl+Alt+J"],
  clickThrough: ["CommandOrControl+Shift+K", "Alt+K", "CommandOrControl+Alt+K"],
  app: ["CommandOrControl+Shift+M", "Alt+M", "CommandOrControl+Alt+M"],
  search: ["Alt+F", "CommandOrControl+Alt+F"],
  sos: ["Alt+Backspace", "CommandOrControl+Alt+Backspace"],
  quickActions: ["Alt+Q", "CommandOrControl+Alt+Q"],
  combat: ["Alt+R", "CommandOrControl+Alt+R"],
  hide: ["Alt+H", "CommandOrControl+Alt+H"]
};
const SHORTCUT_MODIFIER = /^(Alt|Control|CommandOrControl|Ctrl|CommandOrControlOrAlt|CommandOrControl\+Alt)\+/i;
const SMOKE_TEST = process.argv.includes("--smoke-test");
const DEV_MODE = process.argv.includes("--dev");
const NATIVE_POSITION_FRESH_MS = 60000;
const START_PANEL = process.argv.some(arg => ["--panel", "--painel", "--tatico", "--tactical-panel"].includes(String(arg).toLowerCase()));
const START_MINIMIZED = !DEV_MODE && !SMOKE_TEST && !process.argv.includes("--show") && !START_PANEL;
const gotSingleInstanceLock = SMOKE_TEST || app.requestSingleInstanceLock();
const HUD_SIZE = { width: 300, height: 168 };
const PANEL_SIZE = { width: 640, height: 740 };
const MINIMAP_SIZE = { width: 360, height: 290 };
const DEFAULT_DESKTOP_PREFS = {
  overlay: {
    hud: { bounds: null, opacity: 0.92, scale: 1, side: "right", locked: false, displayId: null },
    panel: { bounds: null, opacity: 0.92, scale: 1, side: "right", locked: false, displayId: null },
    minimap: { bounds: null, opacity: 0.9, scale: 1, side: "right", locked: false, displayId: null },
    clickThrough: true,
    lastSection: "missao"
  },
  nativeOverlay: {
    autoStart: true
  }
};

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let overlayClickThrough = true;
let overlayMode = "hud";
let overlaySection = "missao";
let overlayLayoutMode = "hud";
let desktopPrefs = structuredClone(DEFAULT_DESKTOP_PREFS);
let isQuitting = false;
let shortcutStatus = {};
let realtimeService = null;
let lastNativeOperationalAlert = "";
let cursorReleaseTimer = null;
let lastCursorReleaseAt = 0;
let nativeHostProcess = null;
let nativeHostMode = "";
let lastNativeHostStartAt = 0;
let gameGuardTimer = null;
let lastGtaMissingNoticeAt = 0;

const RELEASE_CURSOR_SCRIPT = `
$code = @'
using System;
using System.Runtime.InteropServices;
public static class JikkaiCursor {
  [DllImport("user32.dll")] public static extern bool ClipCursor(IntPtr rect);
  [DllImport("user32.dll")] public static extern int ShowCursor(bool show);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue | Out-Null
[JikkaiCursor]::ClipCursor([IntPtr]::Zero) | Out-Null
for ($i = 0; $i -lt 12; $i++) { [JikkaiCursor]::ShowCursor($true) | Out-Null }
`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

if (!gotSingleInstanceLock) {
  app.exit(0);
}

function appUrl(page = "app.html") {
  return `${APP_SCHEME}://${APP_HOST}/${page.replace(/^\/+/, "")}`;
}

function isGtaProcessRunning() {
  if (SMOKE_TEST || process.platform !== "win32") return true;
  try {
    const output = execFileSync("tasklist.exe", ["/FI", "IMAGENAME eq gta_sa.exe", "/NH"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 1400
    });
    return /gta_sa\.exe/i.test(output);
  } catch {
    return false;
  }
}

function showGtaRequiredNotice() {
  const now = Date.now();
  if (now - lastGtaMissingNoticeAt < 3500) return;
  lastGtaMissingNoticeAt = now;
  if (!Notification.isSupported()) return;
  new Notification({
    title: "JIKKAI - Sobreposicao",
    body: "Abra o GTA_SA.exe pelo SLP Launcher para usar o overlay em jogo.",
    silent: false
  }).show();
}

function guardGameOverlay(notify = true) {
  if (isGtaProcessRunning()) return true;
  if (notify) showGtaRequiredNotice();
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    overlayWindow.hide();
  }
  stopCursorReleasePulse();
  return false;
}

function startGameOverlayGuard() {
  if (gameGuardTimer || SMOKE_TEST || process.platform !== "win32") return;
  gameGuardTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return;
    if (!isGtaProcessRunning()) {
      overlayWindow.hide();
      stopCursorReleasePulse();
    }
  }, 2500);
  gameGuardTimer.unref?.();
}

function broadcastToWindows(channel, payload) {
  if (channel === "realtime:alert") {
    showNativeOperationalAlert(payload);
    if (["map.meeting", "mission.assigned", "field.timer.critical"].includes(payload?.type)) {
      if (guardGameOverlay(false)) {
        const overlay = ensureOverlayWindow();
        if (!overlay.isVisible()) showOverlayHud();
      }
    }
  }
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  });
}

function showNativeOperationalAlert(payload = {}) {
  const meeting = payload?.meeting || payload?.mission || payload?.timer;
  const subject = meeting || payload?.mission || payload?.timer;
  if (!subject || !Notification.isSupported()) return;
  const alertId = String(payload.type || "operational") + ":" + String(subject.id || payload.createdAt || "alert");
  if (alertId === lastNativeOperationalAlert) return;
  lastNativeOperationalAlert = alertId;
  const expiresAt = new Date(subject.expiresAt).getTime();
  const minutes = Number.isFinite(expiresAt)
    ? Math.max(1, Math.ceil((expiresAt - Date.now()) / 60000))
    : "";
  const details = [
    payload.message || subject.descricao || subject.desc || "Operacao Jikkai",
    minutes ? `${minutes} min restantes` : "Reunião em andamento"
  ].join(" · ");
  const notification = new Notification({
    title: "JIKKAI · REUNIÃO ATIVA",
    body: `${subject.titulo || subject.nome || "Operacao de campo"}\n${details}`,
    silent: false
  });
  notification.on("click", () => showOverlayPanel(payload.type === "map.meeting" ? "mapa" : "missao"));
  notification.show();
}

function prefsFilePath() {
  return path.join(app.getPath("userData"), "jikkai-desktop-preferences.json");
}

function mergePrefs(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const next = Array.isArray(base) ? base.slice() : { ...(base || {}) };
  Object.entries(patch).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      next[key] = mergePrefs(next[key] || {}, value);
    } else {
      next[key] = value;
    }
  });
  return next;
}

function loadDesktopPrefs() {
  try {
    const raw = fs.readFileSync(prefsFilePath(), "utf8");
    return mergePrefs(structuredClone(DEFAULT_DESKTOP_PREFS), JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_DESKTOP_PREFS);
  }
}

function saveDesktopPrefs() {
  try {
    fs.mkdirSync(path.dirname(prefsFilePath()), { recursive: true });
    fs.writeFileSync(prefsFilePath(), JSON.stringify(desktopPrefs, null, 2), "utf8");
  } catch (error) {
    console.error("JIKKAI preferences save failed", error);
  }
}

function nativeOverlayStatePath() {
  const base = process.env.LOCALAPPDATA || app.getPath("userData");
  return path.join(base, "JIKKAI", "native-overlay-state.txt");
}

function nativePlayerPositionPath() {
  const base = process.env.LOCALAPPDATA || app.getPath("userData");
  return path.join(base, "JIKKAI", "native-player-position.txt");
}

function parseKeyValueFile(raw = "") {
  return Object.fromEntries(String(raw).split(/\r?\n/).map(line => {
    const index = line.indexOf("=");
    if (index < 0) return null;
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }).filter(Boolean));
}

function readNativePlayerPosition() {
  const target = nativePlayerPositionPath();
  try {
    const stat = fs.statSync(target);
    const lines = parseKeyValueFile(fs.readFileSync(target, "utf8"));
    const x = Number(lines.x);
    const y = Number(lines.y);
    const z = Number(lines.z);
    const ageMs = Math.max(0, Date.now() - stat.mtimeMs);
    const ok = lines.ok === "1" && Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && ageMs < NATIVE_POSITION_FRESH_MS;
    return {
      ok,
      x,
      y,
      z,
      source: lines.source || "native",
      pid: Number(lines.pid || 0) || null,
      updatedAt: stat.mtime.toISOString(),
      ageMs,
      path: target
    };
  } catch {
    return { ok: false, path: target, ageMs: null };
  }
}

function nativeHostPath() {
  const relative = path.join("native-overlay", "bin", "Release", "Win32", "JikkaiNativeHost.exe");
  const resourcesRoot = process.resourcesPath || path.join(path.dirname(process.execPath || ""), "resources");
  const candidates = [
    path.join(resourcesRoot, "app.asar.unpacked", relative),
    path.join(resourcesRoot, "app.asar.extracted", relative),
    path.join(path.dirname(process.execPath || ""), "resources", "app.asar.unpacked", relative),
    path.join(path.dirname(process.execPath || ""), "resources", "app.asar.extracted", relative),
    path.join(APP_ROOT, relative)
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || candidates[0];
}

function killNativeOverlayHostProcesses() {
  if (process.platform !== "win32") return;
  try {
    execFileSync("taskkill.exe", ["/IM", "JikkaiNativeHost.exe", "/F", "/T"], {
      stdio: "ignore",
      windowsHide: true,
      timeout: 1500
    });
  } catch {}
  nativeHostProcess = null;
  nativeHostMode = "";
}

function normalizeNativeHostMode(mode = "position") {
  if (mode === "position-inject") return "position-inject";
  if (mode === "inject") return "inject";
  return "position";
}

function startNativeOverlayHost({ launch = false, mode = "position", force = false } = {}) {
  if (process.platform !== "win32" || SMOKE_TEST) return { ok: false, reason: "unsupported" };
  const requestedMode = normalizeNativeHostMode(mode);
  if (force) killNativeOverlayHostProcesses();
  if (nativeHostProcess && !nativeHostProcess.killed && nativeHostProcess.exitCode == null) {
    if (!force && nativeHostMode === requestedMode) {
      return { ok: true, running: true, path: nativeHostPath(), mode: nativeHostMode, position: readNativePlayerPosition() };
    }
    try { nativeHostProcess.kill(); } catch {}
    nativeHostProcess = null;
    nativeHostMode = "";
  }
  if (!force && Date.now() - lastNativeHostStartAt < 1500) {
    return { ok: true, pending: true, throttled: true, path: nativeHostPath(), mode: requestedMode, position: readNativePlayerPosition() };
  }
  const target = nativeHostPath();
  if (!fs.existsSync(target)) return { ok: false, reason: "missing", path: target };
  lastNativeHostStartAt = Date.now();
  const safePositionMode = requestedMode !== "inject";
  const args = requestedMode === "position-inject"
    ? ["--inject-position-only", "--no-launch"]
    : (safePositionMode ? ["--position-only", "--no-launch"] : (launch ? [] : ["--no-launch"]));
  const spawned = execFile(target, args, { windowsHide: true }, (error, stdout, stderr) => {
    if (stdout) console.log("JIKKAI native host:", stdout.trim());
    if (stderr) console.error("JIKKAI native host:", stderr.trim());
    if (error && !isQuitting) console.error("JIKKAI native host failed", error.message);
  });
  nativeHostProcess = spawned;
  nativeHostMode = requestedMode;
  spawned.on("exit", () => {
    if (nativeHostProcess === spawned) {
      nativeHostProcess = null;
      nativeHostMode = "";
    }
  });
  return { ok: true, started: true, path: target, launch: safePositionMode ? false : launch, mode: requestedMode, position: readNativePlayerPosition() };
}

function maybeStartNativeOverlayHost() {
  return startNativeOverlayHost({ launch: false, mode: "position-inject" });
}

function cleanNativeValue(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/[\r\n=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function writeNativeOverlayState(payload = {}) {
  const lines = [
    ["user", cleanNativeValue(payload.user, "Leitura restrita")],
    ["role", cleanNativeValue(payload.role, "Sessao nao identificada")],
    ["mission_count", Number(payload.missionCount || 0)],
    ["mission_title", cleanNativeValue(payload.missionTitle, "Sem missao ativa")],
    ["mission_objective", cleanNativeValue(payload.missionObjective, "Aguardando app JIKKAI")],
    ["meeting_title", cleanNativeValue(payload.meetingTitle, "")],
    ["meeting_minutes", Number(payload.meetingMinutes || 0)],
    ["sync", cleanNativeValue(payload.sync, "local")],
    ["updated_at", new Date().toISOString()]
  ].map(([key, value]) => `${key}=${value}`);

  const target = nativeOverlayStatePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, lines.join("\n"), "utf8");
  return { ok: true, path: target };
}

function updateDesktopPrefs(patch = {}) {
  desktopPrefs = mergePrefs(desktopPrefs, patch);
  if (typeof patch?.overlay?.lastSection === "string" && patch.overlay.lastSection.trim()) {
    overlaySection = patch.overlay.lastSection.trim();
  }
  if (typeof patch?.overlay?.clickThrough === "boolean") {
    overlayClickThrough = patch.overlay.clickThrough;
  }
  saveDesktopPrefs();
  broadcastToWindows("desktop:preferences", desktopPrefs);
  return desktopPrefs;
}

function overlayPrefs(mode = overlayMode) {
  return desktopPrefs.overlay?.[mode] || DEFAULT_DESKTOP_PREFS.overlay[mode] || DEFAULT_DESKTOP_PREFS.overlay.panel;
}

function overlayMinimum(mode, display) {
  if (mode === "panel") return { width: PANEL_SIZE.width, height: Math.min(PANEL_SIZE.height, Math.max(560, display.workArea.height - 44)) };
  if (mode === "minimap") return { width: 260, height: 180 };
  return { width: 260, height: 150 };
}

function currentOverlayState() {
  return {
    mode: overlayMode,
    section: overlaySection,
    layout: overlayLayoutMode,
    clickThrough: overlayClickThrough,
    preferences: desktopPrefs
  };
}

function overlayPanelNeedsMouse() {
  return overlayMode === "panel" || overlayLayoutMode === "minimap";
}

function resolveAppFile(requestUrl) {
  const url = new URL(requestUrl);
  let pathname = decodeURIComponent(url.pathname || "/");
  if (pathname === "/") pathname = "/index.html";
  const target = path.normalize(path.join(APP_ROOT, pathname));
  const relative = path.relative(APP_ROOT, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}

async function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const target = resolveAppFile(request.url);
    if (!target || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      return new Response("Arquivo nao encontrado.", { status: 404 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

function applyWindowNavigationRules(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${APP_SCHEME}://`)) {
      const page = new URL(url).pathname.replace(/^\/+/, "") || "index.html";
      ensureMainWindow(page);
      return { action: "deny" };
    }
    if (/^(https?|mailto|discord):/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "JIKKAI - Portal",
    frame: false,
    autoHideMenuBar: true,
    transparent: true,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  applyWindowNavigationRules(mainWindow);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(appUrl("app.html"));
  mainWindow.once("ready-to-show", () => {
    if (!START_MINIMIZED) mainWindow.show();
  });
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function ensureMainWindow(page = "app.html") {
  const requestedPage = String(page || "app.html");
  const fullPortal = /^index\.html(?:[?#]|$)/i.test(requestedPage);
  const loadPage = fullPortal && !/[?&]desktopOverlay=1\b/.test(requestedPage)
    ? requestedPage + (requestedPage.includes("?") ? "&" : "?") + "desktopOverlay=1"
    : requestedPage;
  if (!mainWindow) createMainWindow();
  if (page) mainWindow.loadURL(appUrl(loadPage));
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (fullPortal) {
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setOpacity(0.92);
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setOpacity(1);
  }
  mainWindow.show();
  mainWindow.focus();
  return true;
}

function createOverlayWindow() {
  const bounds = overlayBounds("hud");

  overlayWindow = new BrowserWindow({
    ...bounds,
    title: "JIKKAI - Overlay",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: true,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setOpacity(overlayPrefs("hud").opacity || 0.92);
  overlayWindow.setFocusable(false);
  overlayWindow.setIgnoreMouseEvents(overlayClickThrough, { forward: true });
  applyWindowNavigationRules(overlayWindow);
  overlayWindow.loadURL(appUrl("overlay.html"));
  overlayWindow.on("moved", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayPrefs(overlayLayoutMode).locked) return;
    updateDesktopPrefs({ overlay: { [overlayLayoutMode]: { bounds: overlayWindow.getBounds(), displayId: screen.getDisplayMatching(overlayWindow.getBounds()).id } } });
  });
  overlayWindow.on("resized", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayPrefs(overlayLayoutMode).locked) return;
    updateDesktopPrefs({ overlay: { [overlayLayoutMode]: { bounds: overlayWindow.getBounds(), displayId: screen.getDisplayMatching(overlayWindow.getBounds()).id } } });
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

function ensureOverlayWindow() {
  if (!overlayWindow) createOverlayWindow();
  return overlayWindow;
}

function overlayBounds(mode = overlayMode) {
  const prefs = overlayPrefs(mode);
  const preferredDisplay = screen.getAllDisplays().find(display => display.id === prefs?.displayId) || screen.getPrimaryDisplay();
  if (mode === "panel") {
    const bounds = preferredDisplay.bounds;
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }
  if (prefs?.bounds && Number.isFinite(Number(prefs.bounds.width)) && Number.isFinite(Number(prefs.bounds.height))) {
    const display = screen.getDisplayMatching(prefs.bounds);
    const min = overlayMinimum(mode, display);
    const bounded = {
      width: Math.max(min.width, Math.round(prefs.bounds.width)),
      height: Math.max(min.height, Math.round(prefs.bounds.height)),
      x: Math.round(prefs.bounds.x),
      y: Math.round(prefs.bounds.y)
    };
    if (mode === "hud") {
      bounded.width = Math.min(bounded.width, HUD_SIZE.width);
      bounded.height = Math.min(bounded.height, HUD_SIZE.height);
    }
    if (mode === "minimap") {
      bounded.width = Math.min(bounded.width, Math.max(min.width, display.workArea.width - 30));
      bounded.height = Math.min(bounded.height, Math.max(min.height, display.workArea.height - 30));
    }
    if (bounded.x + bounded.width < display.bounds.x + 60 || bounded.x > display.bounds.x + display.bounds.width - 60) bounded.x = display.workArea.x + 20;
    if (bounded.y + bounded.height < display.bounds.y + 60 || bounded.y > display.bounds.y + display.bounds.height - 60) bounded.y = display.workArea.y + 20;
    bounded.x = Math.min(Math.max(bounded.x, display.workArea.x + 10), display.workArea.x + Math.max(10, display.workArea.width - bounded.width - 10));
    bounded.y = Math.min(Math.max(bounded.y, display.workArea.y + 10), display.workArea.y + Math.max(10, display.workArea.height - bounded.height - 10));
    return bounded;
  }
  const workArea = preferredDisplay.workArea;
  const size = mode === "panel"
    ? { width: PANEL_SIZE.width, height: Math.min(PANEL_SIZE.height, Math.max(560, workArea.height - 44)) }
    : mode === "minimap"
      ? MINIMAP_SIZE
      : HUD_SIZE;
  const side = prefs?.side === "left" ? "left" : "right";
  return {
    width: size.width,
    height: size.height,
    x: side === "left" ? workArea.x + 22 : Math.max(workArea.x + 10, workArea.x + workArea.width - size.width - 22),
    y: workArea.y + (mode === "panel" ? 24 : 34)
  };
}

function sendOverlayState() {
  if (!overlayWindow) return;
  const send = () => {
    overlayWindow.webContents.send("overlay:mode", currentOverlayState());
    overlayWindow.webContents.send("overlay:click-through", overlayClickThrough);
    overlayWindow.webContents.send("desktop:preferences", desktopPrefs);
  };
  if (overlayWindow.webContents.isLoading()) overlayWindow.webContents.once("did-finish-load", send);
  else send();
}

function sendOverlayClickThrough() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const send = () => overlayWindow.webContents.send("overlay:click-through", overlayClickThrough);
  if (overlayWindow.webContents.isLoading()) overlayWindow.webContents.once("did-finish-load", send);
  else send();
}

function applyOverlayMode(mode = "hud", section = overlaySection) {
  const overlay = ensureOverlayWindow();
  overlayMode = mode === "panel" ? "panel" : "hud";
  overlayLayoutMode = overlayMode;
  const requestedSection = section == null ? "" : String(section);
  overlaySection = overlayMode === "panel" ? requestedSection : (requestedSection || overlaySection);
  if (overlayMode === "panel" && requestedSection) updateDesktopPrefs({ overlay: { lastSection: requestedSection } });
  overlayClickThrough = overlayMode === "hud" ? Boolean(desktopPrefs.overlay?.clickThrough ?? true) : false;
  overlay.setMinimumSize(overlayMode === "panel" ? 640 : 260, overlayMode === "panel" ? 360 : 150);
  overlay.setBounds(overlayBounds(overlayLayoutMode), false);
  overlay.setOpacity(overlayMode === "panel" ? 1 : (overlayPrefs(overlayLayoutMode).opacity || 0.92));
  overlay.setFocusable(false);
  overlay.setIgnoreMouseEvents(overlayClickThrough, { forward: true });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (overlayClickThrough) stopCursorReleasePulse();
  else startCursorReleasePulse();
  sendOverlayState();
  return overlay;
}

function applyOverlayLayout(layout = "panel", options = {}) {
  if (layout !== "minimap") return applyOverlayMode(layout === "hud" ? "hud" : "panel", options.section || overlaySection);
  const overlay = ensureOverlayWindow();
  overlayMode = "panel";
  overlaySection = "mapa";
  overlayLayoutMode = "minimap";
  overlayClickThrough = false;
  updateDesktopPrefs({ overlay: { lastSection: "mapa" } });
  overlay.setMinimumSize(260, 180);
  overlay.setBounds(overlayBounds("minimap"), false);
  overlay.setOpacity(overlayPrefs("minimap").opacity || 0.9);
  overlay.setFocusable(false);
  overlay.setIgnoreMouseEvents(false);
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  startCursorReleasePulse();
  sendOverlayState();
  revealOverlayWithoutFocus(overlay);
  forceOverlayPanelMouse();
  return overlay;
}

function setOverlayBoundsFromRenderer(bounds = {}) {
  const overlay = ensureOverlayWindow();
  const targetLayout = bounds.layout === "minimap" ? "minimap" : overlayLayoutMode;
  const current = overlay.getBounds();
  const display = screen.getDisplayMatching(current);
  const min = overlayMinimum(targetLayout, display);
  const next = {
    x: Number.isFinite(Number(bounds.x)) ? Math.round(Number(bounds.x)) : current.x,
    y: Number.isFinite(Number(bounds.y)) ? Math.round(Number(bounds.y)) : current.y,
    width: Number.isFinite(Number(bounds.width)) ? Math.round(Number(bounds.width)) : current.width,
    height: Number.isFinite(Number(bounds.height)) ? Math.round(Number(bounds.height)) : current.height
  };
  next.width = Math.min(Math.max(min.width, next.width), Math.max(min.width, display.workArea.width - 20));
  next.height = Math.min(Math.max(min.height, next.height), Math.max(min.height, display.workArea.height - 20));
  next.x = Math.min(Math.max(next.x, display.workArea.x + 6), display.workArea.x + Math.max(6, display.workArea.width - next.width - 6));
  next.y = Math.min(Math.max(next.y, display.workArea.y + 6), display.workArea.y + Math.max(6, display.workArea.height - next.height - 6));
  overlay.setBounds(next, false);
  updateDesktopPrefs({ overlay: { [targetLayout]: { bounds: overlay.getBounds(), displayId: screen.getDisplayMatching(overlay.getBounds()).id } } });
  return overlay.getBounds();
}

function forceOverlayPanelMouse() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayClickThrough = false;
  overlayWindow.setFocusable(false);
  overlayWindow.setIgnoreMouseEvents(false);
  startCursorReleasePulse();
  sendOverlayClickThrough();
}

function setOverlayInputMode(enabled) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return false;
  overlayClickThrough = false;
  overlayWindow.setIgnoreMouseEvents(false);
  if (enabled) {
    overlayWindow.setFocusable(true);
    overlayWindow.focus();
    startCursorReleasePulse();
  } else {
    overlayWindow.setFocusable(false);
    if (overlayWindow.isVisible()) revealOverlayWithoutFocus(overlayWindow);
    startCursorReleasePulse();
  }
  sendOverlayClickThrough();
  return true;
}

function setOverlayClickThrough(enabled) {
  overlayClickThrough = overlayPanelNeedsMouse() ? false : Boolean(enabled);
  if (!overlayPanelNeedsMouse()) updateDesktopPrefs({ overlay: { clickThrough: overlayClickThrough } });
  if (!overlayWindow) return overlayClickThrough;
  overlayWindow.setFocusable(false);
  overlayWindow.setIgnoreMouseEvents(overlayClickThrough, { forward: true });
  if (overlayClickThrough) stopCursorReleasePulse();
  else startCursorReleasePulse();
  sendOverlayState();
  if (!overlayClickThrough && overlayWindow.isVisible()) revealOverlayWithoutFocus(overlayWindow);
  return overlayClickThrough;
}

function releaseGameCursor() {
  if (process.platform !== "win32" || SMOKE_TEST) return;
  const now = Date.now();
  if (now - lastCursorReleaseAt < 650) return;
  lastCursorReleaseAt = now;
  execFile("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-Command",
    RELEASE_CURSOR_SCRIPT
  ], { windowsHide: true, timeout: 2800 }, () => {});
}

function startCursorReleasePulse() {
  releaseGameCursor();
  if (cursorReleaseTimer || SMOKE_TEST) return;
  cursorReleaseTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible() || overlayClickThrough) {
      stopCursorReleasePulse();
      return;
    }
    releaseGameCursor();
  }, 1600);
  cursorReleaseTimer.unref?.();
}

function stopCursorReleasePulse() {
  if (!cursorReleaseTimer) return;
  clearInterval(cursorReleaseTimer);
  cursorReleaseTimer = null;
}

function revealOverlayWithoutFocus(overlay) {
  if (!overlay || overlay.isDestroyed()) return;
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.showInactive();
  overlay.moveTop();

  // Windows can defer the first reveal while Alt is still being released.
  setTimeout(() => {
    if (!overlay || overlay.isDestroyed()) return;
    if (!overlay.isVisible()) {
      overlay.showInactive();
    }
    overlay.moveTop();
  }, 80);
}

function showOverlayHud() {
  if (!guardGameOverlay(true)) return false;
  maybeStartNativeOverlayHost();
  const overlay = ensureOverlayWindow();
  applyOverlayMode("hud");
  revealOverlayWithoutFocus(overlay);
  return true;
}

function showOverlayPanel(section = "") {
  if (!guardGameOverlay(true)) return false;
  maybeStartNativeOverlayHost();
  const overlay = ensureOverlayWindow();
  applyOverlayMode("panel", section);
  revealOverlayWithoutFocus(overlay);
  forceOverlayPanelMouse();
  setTimeout(forceOverlayPanelMouse, 120);
  return true;
}

function toggleOverlayPanel(section = "") {
  if (!guardGameOverlay(true)) return false;
  const overlay = ensureOverlayWindow();
  if (overlay.isVisible() && overlayMode === "panel" && overlayLayoutMode !== "minimap") {
    overlay.hide();
    return false;
  }
  return showOverlayPanel(section);
}

function toggleOverlay() {
  if (!guardGameOverlay(true)) return false;
  const overlay = ensureOverlayWindow();
  if (overlay.isVisible()) {
    overlay.hide();
    return false;
  }
  return showOverlayHud();
}

function toggleOverlayInteraction() {
  if (!guardGameOverlay(true)) return false;
  if (!overlayWindow || !overlayWindow.isVisible()) return showOverlayPanel("");
  if (overlayPanelNeedsMouse()) {
    forceOverlayPanelMouse();
    revealOverlayWithoutFocus(overlayWindow);
    return false;
  }
  const enabled = !overlayClickThrough;
  setOverlayClickThrough(enabled);
  revealOverlayWithoutFocus(overlayWindow);
  return enabled;
}

function createMenu() {
  Menu.setApplicationMenu(null);
}

function createTray() {
  const iconPath = path.join(APP_ROOT, "assets", "jikkai-contractor-transition.png");
  let icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("JIKKAI - Portal");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Painel tatico", click: () => showOverlayPanel("") },
    { label: "Central operacional", click: () => ensureMainWindow("app.html") },
    { label: "Portal completo", click: () => ensureMainWindow("index.html") },
    { label: "Abrir mapa", click: () => ensureMainWindow("mapa.html") },
    { type: "separator" },
    { label: "HUD passivo", click: () => showOverlayHud() },
    { label: "Alternar overlay", click: () => toggleOverlay() },
    { label: "Alternar mouse do overlay", click: () => toggleOverlayInteraction() },
    { type: "separator" },
    {
      label: "Sair",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on("double-click", () => ensureMainWindow("app.html"));
}

function registerShortcutGroup(name, accelerators, handler) {
  const registered = [];
  const failed = [];
  accelerators.forEach(accelerator => {
    const ok = globalShortcut.register(accelerator, handler);
    (ok ? registered : failed).push(accelerator);
  });
  shortcutStatus[name] = { registered, failed };
}

function configuredShortcutGroups() {
  return Object.fromEntries(Object.entries(SHORTCUT_GROUPS).map(([name, defaults]) => {
    const custom = desktopPrefs.shortcuts?.[name];
    const list = custom && SHORTCUT_MODIFIER.test(String(custom).trim()) ? [String(custom).trim(), ...defaults] : defaults;
    return [name, Array.from(new Set(list))];
  }));
}

function registerShortcuts() {
  shortcutStatus = {};
  globalShortcut.unregisterAll();
  const groups = configuredShortcutGroups();
  registerShortcutGroup("overlay", groups.overlay, () => toggleOverlay());
  registerShortcutGroup("clickThrough", groups.clickThrough, () => toggleOverlayInteraction());
  registerShortcutGroup("app", groups.app, () => toggleOverlayPanel(""));
  registerShortcutGroup("search", groups.search, () => {
    showOverlayPanel("busca");
    if (overlayWindow) overlayWindow.webContents.send("overlay:search");
  });
  registerShortcutGroup("sos", groups.sos, () => {
    const overlay = ensureOverlayWindow();
    if (!overlay.isVisible()) showOverlayHud();
    const payload = { createdAt: new Date().toISOString(), source: "shortcut" };
    const send = () => broadcastToWindows("field:sos", payload);
    if (overlay.webContents.isLoading()) overlay.webContents.once("did-finish-load", send);
    else setTimeout(send, 40);
  });
  registerShortcutGroup("quickActions", groups.quickActions, () => showOverlayPanel("missao"));
  registerShortcutGroup("combat", groups.combat, () => {
    if (!overlayWindow || !overlayWindow.isVisible()) showOverlayHud();
    overlayWindow?.webContents.send("overlay:combat-toggle");
  });
  registerShortcutGroup("hide", groups.hide, () => overlayWindow?.hide());
  console.log("JIKKAI shortcuts", JSON.stringify(shortcutStatus));
}

ipcMain.handle("overlay:toggle", () => toggleOverlay());
ipcMain.handle("overlay:hide", () => {
  if (overlayWindow) overlayWindow.hide();
});
ipcMain.handle("overlay:show-hud", () => showOverlayHud());
ipcMain.handle("overlay:show-panel", (_event, section = "") => showOverlayPanel(section || ""));
ipcMain.handle("overlay:toggle-click-through", () => toggleOverlayInteraction());
ipcMain.handle("overlay:get-state", () => currentOverlayState());
ipcMain.handle("overlay:input-mode", (_event, enabled = false) => setOverlayInputMode(Boolean(enabled)));
ipcMain.handle("overlay:set-layout", (_event, layout = "panel", options = {}) => {
  applyOverlayLayout(layout, options || {});
  return currentOverlayState();
});
ipcMain.handle("overlay:set-bounds", (_event, bounds = {}) => setOverlayBoundsFromRenderer(bounds || {}));
ipcMain.handle("main:open-app", (_event, section = "") => showOverlayPanel(section || ""));
ipcMain.handle("main:open-portal", () => ensureMainWindow("app.html"));
ipcMain.handle("main:open-full-portal", () => ensureMainWindow("index.html"));
ipcMain.handle("main:open-map", () => ensureMainWindow("mapa.html"));
ipcMain.handle("main:shortcuts", () => shortcutStatus);
ipcMain.handle("desktop:update-shortcut", (_event, payload = {}) => {
  const group = String(payload.group || "");
  const accelerator = String(payload.accelerator || "").trim();
  if (!SHORTCUT_GROUPS[group]) return { ok: false, error: "Grupo de atalho invalido", status: shortcutStatus };
  if (accelerator && !SHORTCUT_MODIFIER.test(accelerator)) return { ok: false, error: "Use um atalho com modificador", status: shortcutStatus };
  updateDesktopPrefs({ shortcuts: { [group]: accelerator || null } });
  registerShortcuts();
  return { ok: true, status: shortcutStatus };
});
ipcMain.handle("desktop:reset-shortcuts", () => {
  desktopPrefs.shortcuts = {};
  saveDesktopPrefs();
  broadcastToWindows("desktop:preferences", desktopPrefs);
  registerShortcuts();
  return shortcutStatus;
});
ipcMain.handle("native-overlay:publish-state", (_event, payload = {}) => writeNativeOverlayState(payload));
ipcMain.handle("native-overlay:path", () => nativeOverlayStatePath());
ipcMain.handle("native-overlay:player-position", () => readNativePlayerPosition());
ipcMain.handle("native-overlay:position-path", () => nativePlayerPositionPath());
ipcMain.handle("native-overlay:start-host", (_event, options = {}) => startNativeOverlayHost({ launch: Boolean(options.launch), mode: options.mode || "position", force: Boolean(options.force) }));
ipcMain.handle("operational:notify", (_event, payload = {}) => {
  if (payload?.type !== "map.meeting" || !payload.meeting?.expiresAt) return false;
  broadcastToWindows("realtime:alert", payload);
  return true;
});
ipcMain.handle("desktop:get-preferences", () => desktopPrefs);
ipcMain.handle("desktop:update-preferences", (_event, patch = {}) => updateDesktopPrefs(patch));
ipcMain.handle("realtime:get-state", async () => {
  if (!realtimeService) return { data: {}, updatedAt: "", source: "offline" };
  const cached = realtimeService.getState();
  if (!cached.data || !Object.keys(cached.data).length) await realtimeService.refresh("ipc");
  return realtimeService.getState();
});
ipcMain.handle("presence:update", (_event, profile = {}) => realtimeService?.updatePresence(profile) || []);
ipcMain.handle("presence:list", () => realtimeService?.getPresence() || { users: [], updatedAt: new Date().toISOString() });
ipcMain.handle("main:reload", () => {
  if (mainWindow) mainWindow.reload();
});
ipcMain.handle("main:minimize", () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.handle("main:hide", () => {
  if (mainWindow) mainWindow.hide();
});
ipcMain.handle("main:toggle-maximize", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});

app.on("before-quit", () => {
  isQuitting = true;
  if (gameGuardTimer) clearInterval(gameGuardTimer);
  if (nativeHostProcess && nativeHostProcess.exitCode == null) {
    try { nativeHostProcess.kill(); } catch {}
    nativeHostMode = "";
  }
  realtimeService?.stop();
});

app.on("second-instance", () => {
  showOverlayPanel("");
});

app.whenReady().then(async () => {
  await registerAppProtocol();
  desktopPrefs = loadDesktopPrefs();
  overlayClickThrough = Boolean(desktopPrefs.overlay?.clickThrough ?? true);
  overlaySection = desktopPrefs.overlay?.lastSection || "missao";
  realtimeService = new RealtimeService({ broadcast: broadcastToWindows });
  realtimeService.start();
  createMenu();
  createTray();
  createMainWindow();
  createOverlayWindow();
  registerShortcuts();
  startGameOverlayGuard();
  maybeStartNativeOverlayHost();
  if (START_PANEL) setTimeout(() => showOverlayPanel(""), 350);

  if (SMOKE_TEST) {
    setTimeout(() => {
      isQuitting = true;
      app.quit();
    }, 2500);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else ensureMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isQuitting) app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

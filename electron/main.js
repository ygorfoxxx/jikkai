const { app, BrowserWindow, Menu, globalShortcut, ipcMain, protocol, net, screen, shell, Tray, nativeImage } = require("electron");
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
  search: ["Alt+F", "CommandOrControl+Alt+F"]
};
const SMOKE_TEST = process.argv.includes("--smoke-test");
const DEV_MODE = process.argv.includes("--dev");
const START_MINIMIZED = !DEV_MODE && !SMOKE_TEST && !process.argv.includes("--show");
const gotSingleInstanceLock = SMOKE_TEST || app.requestSingleInstanceLock();
const HUD_SIZE = { width: 370, height: 188 };
const PANEL_SIZE = { width: 500, height: 660 };
const DEFAULT_DESKTOP_PREFS = {
  overlay: {
    hud: { bounds: null, opacity: 0.92, scale: 1, side: "right", locked: false, displayId: null },
    panel: { bounds: null, opacity: 0.92, scale: 1, side: "right", locked: false, displayId: null },
    clickThrough: true,
    lastSection: "agora"
  }
};

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let overlayClickThrough = true;
let overlayMode = "hud";
let overlaySection = "agora";
let desktopPrefs = structuredClone(DEFAULT_DESKTOP_PREFS);
let isQuitting = false;
let shortcutStatus = {};
let realtimeService = null;

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

function broadcastToWindows(channel, payload) {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  });
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

function updateDesktopPrefs(patch = {}) {
  desktopPrefs = mergePrefs(desktopPrefs, patch);
  saveDesktopPrefs();
  broadcastToWindows("desktop:preferences", desktopPrefs);
  return desktopPrefs;
}

function overlayPrefs(mode = overlayMode) {
  return desktopPrefs.overlay?.[mode] || DEFAULT_DESKTOP_PREFS.overlay[mode];
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
    backgroundColor: "#020202",
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
  if (!mainWindow) createMainWindow();
  if (page) mainWindow.loadURL(appUrl(page));
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
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
  overlayWindow.setIgnoreMouseEvents(overlayClickThrough, { forward: true });
  applyWindowNavigationRules(overlayWindow);
  overlayWindow.loadURL(appUrl("overlay.html"));
  overlayWindow.on("moved", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayPrefs(overlayMode).locked) return;
    updateDesktopPrefs({ overlay: { [overlayMode]: { bounds: overlayWindow.getBounds(), displayId: screen.getDisplayMatching(overlayWindow.getBounds()).id } } });
  });
  overlayWindow.on("resized", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayPrefs(overlayMode).locked) return;
    updateDesktopPrefs({ overlay: { [overlayMode]: { bounds: overlayWindow.getBounds(), displayId: screen.getDisplayMatching(overlayWindow.getBounds()).id } } });
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
  if (prefs?.bounds && Number.isFinite(Number(prefs.bounds.width)) && Number.isFinite(Number(prefs.bounds.height))) {
    const display = screen.getDisplayMatching(prefs.bounds);
    const bounded = {
      width: Math.max(mode === "panel" ? 420 : 240, Math.round(prefs.bounds.width)),
      height: Math.max(mode === "panel" ? 420 : 140, Math.round(prefs.bounds.height)),
      x: Math.round(prefs.bounds.x),
      y: Math.round(prefs.bounds.y)
    };
    if (bounded.x + bounded.width < display.bounds.x + 60 || bounded.x > display.bounds.x + display.bounds.width - 60) bounded.x = display.workArea.x + 20;
    if (bounded.y + bounded.height < display.bounds.y + 60 || bounded.y > display.bounds.y + display.bounds.height - 60) bounded.y = display.workArea.y + 20;
    return bounded;
  }
  const preferredDisplay = screen.getAllDisplays().find(display => display.id === prefs?.displayId) || screen.getPrimaryDisplay();
  const workArea = preferredDisplay.workArea;
  const size = mode === "panel"
    ? { width: PANEL_SIZE.width, height: Math.min(PANEL_SIZE.height, Math.max(520, workArea.height - 56)) }
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
    overlayWindow.webContents.send("overlay:mode", { mode: overlayMode, section: overlaySection, clickThrough: overlayClickThrough, preferences: desktopPrefs });
    overlayWindow.webContents.send("overlay:click-through", overlayClickThrough);
    overlayWindow.webContents.send("desktop:preferences", desktopPrefs);
  };
  if (overlayWindow.webContents.isLoading()) overlayWindow.webContents.once("did-finish-load", send);
  else send();
}

function applyOverlayMode(mode = "hud", section = overlaySection) {
  const overlay = ensureOverlayWindow();
  overlayMode = mode === "panel" ? "panel" : "hud";
  overlaySection = section || (overlayMode === "panel" ? "agora" : overlaySection);
  if (overlayMode === "panel") updateDesktopPrefs({ overlay: { lastSection: overlaySection } });
  overlayClickThrough = overlayMode === "hud" ? Boolean(desktopPrefs.overlay?.clickThrough ?? true) : false;
  overlay.setBounds(overlayBounds(overlayMode), false);
  overlay.setOpacity(overlayPrefs(overlayMode).opacity || 0.92);
  overlay.setFocusable(!overlayClickThrough);
  overlay.setIgnoreMouseEvents(overlayClickThrough, { forward: true });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  sendOverlayState();
  return overlay;
}

function setOverlayClickThrough(enabled) {
  overlayClickThrough = Boolean(enabled);
  updateDesktopPrefs({ overlay: { clickThrough: overlayClickThrough } });
  if (!overlayWindow) return overlayClickThrough;
  overlayWindow.setFocusable(!overlayClickThrough);
  overlayWindow.setIgnoreMouseEvents(overlayClickThrough, { forward: true });
  sendOverlayState();
  if (!overlayClickThrough && overlayWindow.isVisible()) overlayWindow.focus();
  return overlayClickThrough;
}

function showOverlayHud() {
  const overlay = ensureOverlayWindow();
  applyOverlayMode("hud");
  overlay.showInactive();
  overlay.moveTop();
  return true;
}

function showOverlayPanel(section = "agora") {
  const overlay = ensureOverlayWindow();
  applyOverlayMode("panel", section);
  overlay.show();
  overlay.focus();
  overlay.moveTop();
  return true;
}

function toggleOverlay() {
  const overlay = ensureOverlayWindow();
  if (overlay.isVisible()) {
    overlay.hide();
    return false;
  }
  return showOverlayHud();
}

function toggleOverlayInteraction() {
  if (!overlayWindow || !overlayWindow.isVisible()) return showOverlayPanel(overlaySection || "agora");
  if (overlayClickThrough || overlayMode === "hud") {
    showOverlayPanel(overlaySection || "agora");
    return false;
  }
  showOverlayHud();
  return true;
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
    { label: "Painel tatico", click: () => showOverlayPanel("agora") },
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

function registerShortcuts() {
  shortcutStatus = {};
  registerShortcutGroup("overlay", SHORTCUT_GROUPS.overlay, () => toggleOverlay());
  registerShortcutGroup("clickThrough", SHORTCUT_GROUPS.clickThrough, () => toggleOverlayInteraction());
  registerShortcutGroup("app", SHORTCUT_GROUPS.app, () => showOverlayPanel(desktopPrefs.overlay?.lastSection || "agora"));
  registerShortcutGroup("search", SHORTCUT_GROUPS.search, () => {
    showOverlayPanel("busca");
    if (overlayWindow) overlayWindow.webContents.send("overlay:search");
  });
  console.log("JIKKAI shortcuts", JSON.stringify(shortcutStatus));
}

ipcMain.handle("overlay:toggle", () => toggleOverlay());
ipcMain.handle("overlay:hide", () => {
  if (overlayWindow) overlayWindow.hide();
});
ipcMain.handle("overlay:show-hud", () => showOverlayHud());
ipcMain.handle("overlay:show-panel", (_event, section = "agora") => showOverlayPanel(section || "agora"));
ipcMain.handle("overlay:toggle-click-through", () => toggleOverlayInteraction());
ipcMain.handle("main:open-app", (_event, section = "") => showOverlayPanel(section || "agora"));
ipcMain.handle("main:open-portal", () => ensureMainWindow("app.html"));
ipcMain.handle("main:open-full-portal", () => ensureMainWindow("index.html"));
ipcMain.handle("main:open-map", () => ensureMainWindow("mapa.html"));
ipcMain.handle("main:shortcuts", () => shortcutStatus);
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
  realtimeService?.stop();
});

app.on("second-instance", () => {
  ensureMainWindow("app.html");
});

app.whenReady().then(async () => {
  await registerAppProtocol();
  desktopPrefs = loadDesktopPrefs();
  overlayClickThrough = Boolean(desktopPrefs.overlay?.clickThrough ?? true);
  overlaySection = desktopPrefs.overlay?.lastSection || "agora";
  realtimeService = new RealtimeService({ broadcast: broadcastToWindows });
  realtimeService.start();
  createMenu();
  createTray();
  createMainWindow();
  createOverlayWindow();
  registerShortcuts();

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

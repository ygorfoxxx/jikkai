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
  app: ["CommandOrControl+Shift+M", "Alt+M", "CommandOrControl+Alt+M"]
};
const SMOKE_TEST = process.argv.includes("--smoke-test");
const DEV_MODE = process.argv.includes("--dev");
const START_MINIMIZED = !DEV_MODE && !SMOKE_TEST && !process.argv.includes("--show");
const gotSingleInstanceLock = SMOKE_TEST || app.requestSingleInstanceLock();
const HUD_SIZE = { width: 370, height: 188 };
const PANEL_SIZE = { width: 500, height: 660 };

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let overlayClickThrough = true;
let overlayMode = "hud";
let overlaySection = "agora";
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
    resizable: false,
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
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  applyWindowNavigationRules(overlayWindow);
  overlayWindow.loadURL(appUrl("overlay.html"));
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

function ensureOverlayWindow() {
  if (!overlayWindow) createOverlayWindow();
  return overlayWindow;
}

function overlayBounds(mode = overlayMode) {
  const workArea = screen.getPrimaryDisplay().workArea;
  const size = mode === "panel"
    ? { width: PANEL_SIZE.width, height: Math.min(PANEL_SIZE.height, Math.max(520, workArea.height - 56)) }
    : HUD_SIZE;
  return {
    width: size.width,
    height: size.height,
    x: Math.max(workArea.x + 10, workArea.x + workArea.width - size.width - 22),
    y: workArea.y + (mode === "panel" ? 24 : 34)
  };
}

function sendOverlayState() {
  if (!overlayWindow) return;
  const send = () => {
    overlayWindow.webContents.send("overlay:mode", { mode: overlayMode, section: overlaySection, clickThrough: overlayClickThrough });
    overlayWindow.webContents.send("overlay:click-through", overlayClickThrough);
  };
  if (overlayWindow.webContents.isLoading()) overlayWindow.webContents.once("did-finish-load", send);
  else send();
}

function applyOverlayMode(mode = "hud", section = overlaySection) {
  const overlay = ensureOverlayWindow();
  overlayMode = mode === "panel" ? "panel" : "hud";
  overlaySection = section || (overlayMode === "panel" ? "agora" : overlaySection);
  overlayClickThrough = overlayMode === "hud";
  overlay.setBounds(overlayBounds(overlayMode), false);
  overlay.setFocusable(!overlayClickThrough);
  overlay.setIgnoreMouseEvents(overlayClickThrough, { forward: true });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  sendOverlayState();
  return overlay;
}

function setOverlayClickThrough(enabled) {
  overlayClickThrough = Boolean(enabled);
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
  registerShortcutGroup("app", SHORTCUT_GROUPS.app, () => showOverlayPanel("agora"));
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

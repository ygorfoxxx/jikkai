const { app, BrowserWindow, Menu, globalShortcut, ipcMain, protocol, net, screen, shell, Tray, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

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
const gotSingleInstanceLock = app.requestSingleInstanceLock();

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let overlayClickThrough = false;
let isQuitting = false;
let shortcutStatus = {};

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
  const workArea = screen.getPrimaryDisplay().workArea;
  const width = 420;
  const height = Math.min(640, Math.max(520, workArea.height - 80));

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: Math.max(workArea.x + 12, workArea.x + workArea.width - width - 22),
    y: workArea.y + 28,
    title: "JIKKAI - Overlay",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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

function setOverlayClickThrough(enabled) {
  overlayClickThrough = Boolean(enabled);
  if (!overlayWindow) return overlayClickThrough;
  overlayWindow.setIgnoreMouseEvents(overlayClickThrough, { forward: true });
  overlayWindow.webContents.send("overlay:click-through", overlayClickThrough);
  return overlayClickThrough;
}

function toggleOverlay() {
  const overlay = ensureOverlayWindow();
  if (overlay.isVisible()) {
    overlay.hide();
    return false;
  }
  overlay.show();
  overlay.focus();
  overlay.moveTop();
  overlay.webContents.send("overlay:click-through", overlayClickThrough);
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
    { label: "Abrir app", click: () => ensureMainWindow("app.html") },
    { label: "Portal completo", click: () => ensureMainWindow("index.html") },
    { label: "Abrir mapa", click: () => ensureMainWindow("mapa.html") },
    { type: "separator" },
    { label: "Alternar overlay", click: () => toggleOverlay() },
    { label: "Overlay somente visual", click: () => setOverlayClickThrough(!overlayClickThrough) },
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
  registerShortcutGroup("clickThrough", SHORTCUT_GROUPS.clickThrough, () => setOverlayClickThrough(!overlayClickThrough));
  registerShortcutGroup("app", SHORTCUT_GROUPS.app, () => ensureMainWindow("app.html"));
  console.log("JIKKAI shortcuts", JSON.stringify(shortcutStatus));
}

ipcMain.handle("overlay:toggle", () => toggleOverlay());
ipcMain.handle("overlay:hide", () => {
  if (overlayWindow) overlayWindow.hide();
});
ipcMain.handle("overlay:toggle-click-through", () => setOverlayClickThrough(!overlayClickThrough));
ipcMain.handle("main:open-app", (_event, section = "") => ensureMainWindow(section ? `app.html#${String(section).replace(/^#/, "")}` : "app.html"));
ipcMain.handle("main:open-portal", () => ensureMainWindow("app.html"));
ipcMain.handle("main:open-full-portal", () => ensureMainWindow("index.html"));
ipcMain.handle("main:open-map", () => ensureMainWindow("mapa.html"));
ipcMain.handle("main:shortcuts", () => shortcutStatus);
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
});

app.on("second-instance", () => {
  ensureMainWindow("app.html");
});

app.whenReady().then(async () => {
  await registerAppProtocol();
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

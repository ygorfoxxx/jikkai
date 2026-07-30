const { BrowserWindow, globalShortcut, ipcMain } = require("electron");

const PANEL_ACCELERATORS = new Set([
  "ALT+M",
  "COMMANDORCONTROL+ALT+M",
  "COMMANDORCONTROL+SHIFT+M"
]);
const MAIN_PANEL_URL = "jikkai://app/app.html";

const originalRegister = globalShortcut.register.bind(globalShortcut);
const originalHandle = ipcMain.handle.bind(ipcMain);

function normalizeAccelerator(accelerator = "") {
  return String(accelerator).replace(/\s+/g, "").toUpperCase();
}

function isReservedPanelAccelerator(accelerator = "") {
  return PANEL_ACCELERATORS.has(normalizeAccelerator(accelerator));
}

function isLegacyAppShortcutHandler(handler) {
  if (typeof handler !== "function") return false;
  try {
    return Function.prototype.toString.call(handler).includes("toggleOverlayPanel");
  } catch {
    return false;
  }
}

function safeWindowUrl(window) {
  try {
    return window?.webContents?.getURL?.() || "";
  } catch {
    return "";
  }
}

function safeWindowTitle(window) {
  try {
    return window?.getTitle?.() || "";
  } catch {
    return "";
  }
}

function isOverlayWindow(window) {
  const url = safeWindowUrl(window);
  const title = safeWindowTitle(window);
  return /\/overlay\.html(?:[?#]|$)/i.test(url) || /JIKKAI\s*-\s*Overlay/i.test(title);
}

function isDiscordWindow(window) {
  const url = safeWindowUrl(window);
  const title = safeWindowTitle(window);
  return /discord\.com\/oauth2/i.test(url) || /JIKKAI\s*-\s*Discord/i.test(title);
}

function findMainPanelWindow() {
  const windows = BrowserWindow.getAllWindows().filter(window => window && !window.isDestroyed());
  return windows.find(window => /\/app\.html(?:[?#]|$)/i.test(safeWindowUrl(window)))
    || windows.find(window => {
      const title = safeWindowTitle(window);
      return !isOverlayWindow(window)
        && !isDiscordWindow(window)
        && (/JIKKAI\s*-\s*Portal/i.test(title) || /JIKKAI App/i.test(title));
    })
    || windows.find(window => !isOverlayWindow(window) && !isDiscordWindow(window));
}

function hideHudOverlay() {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window || window.isDestroyed() || !isOverlayWindow(window)) return;
    if (window.isVisible()) window.hide();
  });
}

function showMainPanelWindow() {
  const panel = findMainPanelWindow();
  if (!panel) {
    console.warn("JIKKAI: janela principal ainda nao esta pronta para o Alt+M.");
    return false;
  }

  hideHudOverlay();

  if (!/\/app\.html(?:[?#]|$)/i.test(safeWindowUrl(panel))) {
    panel.loadURL(MAIN_PANEL_URL).catch(error => {
      console.error("JIKKAI: nao foi possivel carregar o painel principal", error);
    });
  }

  if (panel.isMinimized()) panel.restore();
  panel.setAlwaysOnTop(true, "screen-saver");
  panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  panel.setOpacity(1);
  panel.show();
  panel.focus();
  panel.moveTop();
  return true;
}

function toggleMainPanelWindow() {
  const panel = findMainPanelWindow();
  if (panel && panel.isVisible()) {
    panel.hide();
    return false;
  }
  return showMainPanelWindow();
}

// O grupo "app" ainda chama toggleOverlayPanel no main.js legado. Nesta camada de
// entrada, trocamos esse destino pela janela principal (app.html), que e o painel
// com sidebar, mapa, minimapa, equipe e demais modulos. Alt+J continua na HUD.
globalShortcut.register = (accelerator, handler) => {
  if (isLegacyAppShortcutHandler(handler)) {
    return originalRegister(accelerator, () => toggleMainPanelWindow());
  }
  if (isReservedPanelAccelerator(accelerator)) {
    console.warn(`JIKKAI: atalho reservado ao painel principal ignorado em outro grupo: ${accelerator}`);
    return false;
  }
  return originalRegister(accelerator, handler);
};

// Impede que uma configuracao antiga ou nova entregue Alt+M para HUD, busca ou
// qualquer outro grupo. O atalho continua personalizavel dentro do grupo app.
ipcMain.handle = (channel, listener) => {
  if (channel !== "desktop:update-shortcut") {
    return originalHandle(channel, listener);
  }

  return originalHandle(channel, async (event, payload = {}) => {
    const group = String(payload.group || "");
    const accelerator = String(payload.accelerator || "").trim();
    if (group !== "app" && isReservedPanelAccelerator(accelerator)) {
      return {
        ok: false,
        error: "Alt+M e os atalhos oficiais com M sao reservados para abrir o painel principal."
      };
    }
    return listener(event, payload);
  });
};

require("./main");

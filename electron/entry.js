const { globalShortcut, ipcMain } = require("electron");

const PANEL_ACCELERATORS = new Set([
  "ALT+M",
  "COMMANDORCONTROL+ALT+M",
  "COMMANDORCONTROL+SHIFT+M"
]);

const originalRegister = globalShortcut.register.bind(globalShortcut);
const originalHandle = ipcMain.handle.bind(ipcMain);

function normalizeAccelerator(accelerator = "") {
  return String(accelerator).replace(/\s+/g, "").toUpperCase();
}

function isReservedPanelAccelerator(accelerator = "") {
  return PANEL_ACCELERATORS.has(normalizeAccelerator(accelerator));
}

function isTacticalPanelHandler(handler) {
  if (typeof handler !== "function") return false;
  try {
    return Function.prototype.toString.call(handler).includes("toggleOverlayPanel");
  } catch {
    return false;
  }
}

// Alt+M pertence ao painel tatico fullscreen renderizado pelo overlay.html.
// O handler correto ja existe em main.js e chama toggleOverlayPanel("").
// Esta camada apenas impede que HUD, busca ou atalhos antigos roubem Alt+M.
globalShortcut.register = (accelerator, handler) => {
  if (isReservedPanelAccelerator(accelerator) && !isTacticalPanelHandler(handler)) {
    console.warn(`JIKKAI: atalho reservado ao painel tatico ignorado em outro grupo: ${accelerator}`);
    return false;
  }
  return originalRegister(accelerator, handler);
};

// Bloqueia novas configuracoes conflitantes. Alt+M pode permanecer apenas no
// grupo app, cujo destino e o painel tatico fullscreen. Alt+J continua na HUD.
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
        error: "Alt+M e os atalhos oficiais com M sao reservados para abrir o painel tatico fullscreen."
      };
    }
    return listener(event, payload);
  });
};

require("./main");

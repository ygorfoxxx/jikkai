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

function isPanelShortcutHandler(handler) {
  if (typeof handler !== "function") return false;
  try {
    return Function.prototype.toString.call(handler).includes("toggleOverlayPanel");
  } catch {
    return false;
  }
}

// Alt+M e suas alternativas oficiais pertencem ao painel tático. Preferências
// antigas podiam atribuir Alt+M ao grupo da HUD; nesse caso o Electron registrava
// a HUD primeiro e o atalho correto do painel falhava por conflito.
globalShortcut.register = (accelerator, handler) => {
  if (isReservedPanelAccelerator(accelerator) && !isPanelShortcutHandler(handler)) {
    console.warn(`JIKKAI: atalho reservado ao painel ignorado em outro grupo: ${accelerator}`);
    return false;
  }
  return originalRegister(accelerator, handler);
};

// Impede que uma nova configuração volte a entregar Alt+M para HUD, busca ou
// qualquer outro grupo. O atalho continua personalizável dentro do grupo app.
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
        error: "Alt+M e os atalhos oficiais com M são reservados para abrir o painel tático."
      };
    }
    return listener(event, payload);
  });
};

require("./main");

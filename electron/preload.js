const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jikkaiDesktop", {
  isDesktop: true,
  shortcuts: {
    toggleOverlay: "Alt+J / Ctrl+Alt+J / Ctrl+Shift+J",
    toggleClickThrough: "Alt+K / Ctrl+Alt+K / Ctrl+Shift+K",
    openPortal: "Alt+M / Ctrl+Alt+M / Ctrl+Shift+M"
  },
  hideOverlay: () => ipcRenderer.invoke("overlay:hide"),
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle"),
  showOverlayHud: () => ipcRenderer.invoke("overlay:show-hud"),
  showOverlayPanel: (section) => ipcRenderer.invoke("overlay:show-panel", section || "agora"),
  toggleClickThrough: () => ipcRenderer.invoke("overlay:toggle-click-through"),
  openApp: (section) => ipcRenderer.invoke("main:open-app", section || ""),
  openPortal: () => ipcRenderer.invoke("main:open-portal"),
  openFullPortal: () => ipcRenderer.invoke("main:open-full-portal"),
  openMap: () => ipcRenderer.invoke("main:open-map"),
  reloadPortal: () => ipcRenderer.invoke("main:reload"),
  shortcutStatus: () => ipcRenderer.invoke("main:shortcuts"),
  getDesktopPreferences: () => ipcRenderer.invoke("desktop:get-preferences"),
  updateDesktopPreferences: (patch) => ipcRenderer.invoke("desktop:update-preferences", patch || {}),
  minimizePortal: () => ipcRenderer.invoke("main:minimize"),
  hidePortal: () => ipcRenderer.invoke("main:hide"),
  toggleMaximizePortal: () => ipcRenderer.invoke("main:toggle-maximize"),
  getRealtimeState: () => ipcRenderer.invoke("realtime:get-state"),
  updatePresence: (profile) => ipcRenderer.invoke("presence:update", profile || {}),
  getPresence: () => ipcRenderer.invoke("presence:list"),
  onRealtimeState: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("realtime:state", listener);
    return () => ipcRenderer.removeListener("realtime:state", listener);
  },
  onRealtimeStatus: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("realtime:status", listener);
    return () => ipcRenderer.removeListener("realtime:status", listener);
  },
  onPresenceChanged: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("presence:changed", listener);
    return () => ipcRenderer.removeListener("presence:changed", listener);
  },
  onRealtimeAlert: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("realtime:alert", listener);
    return () => ipcRenderer.removeListener("realtime:alert", listener);
  },
  onClickThroughChanged: (callback) => {
    const listener = (_event, enabled) => callback(Boolean(enabled));
    ipcRenderer.on("overlay:click-through", listener);
    return () => ipcRenderer.removeListener("overlay:click-through", listener);
  },
  onOverlayModeChanged: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("overlay:mode", listener);
    return () => ipcRenderer.removeListener("overlay:mode", listener);
  },
  onDesktopPreferencesChanged: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("desktop:preferences", listener);
    return () => ipcRenderer.removeListener("desktop:preferences", listener);
  },
  onOverlaySearch: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("overlay:search", listener);
    return () => ipcRenderer.removeListener("overlay:search", listener);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  if (location.pathname.endsWith("/overlay.html")) return;
  const style = document.createElement("style");
  style.textContent = `
    .jikkai-desktop-controls{
      position:fixed;
      top:10px;
      right:12px;
      z-index:2147483647;
      display:flex;
      align-items:center;
      gap:6px;
      padding:5px;
      border:1px solid rgba(249,115,22,.35);
      border-radius:999px;
      background:rgba(3,3,3,.78);
      box-shadow:0 12px 34px rgba(0,0,0,.45),0 0 22px rgba(249,115,22,.12);
      backdrop-filter:blur(14px);
      -webkit-app-region:no-drag;
    }
    .jikkai-desktop-drag{
      position:fixed;
      top:0;
      left:0;
      right:0;
      height:7px;
      z-index:2147483646;
      -webkit-app-region:drag;
    }
    .jikkai-desktop-controls button{
      width:28px;
      height:28px;
      border:1px solid rgba(255,255,255,.08);
      border-radius:999px;
      background:rgba(255,255,255,.045);
      color:#fed7aa;
      font:900 13px/1 system-ui,Segoe UI,Arial,sans-serif;
      cursor:pointer;
      display:grid;
      place-items:center;
      padding:0;
    }
    .jikkai-desktop-controls button:hover{border-color:rgba(249,115,22,.8);background:rgba(249,115,22,.18);color:#fff7ed}
    .jikkai-desktop-controls button[data-close]:hover{border-color:rgba(239,68,68,.8);background:rgba(127,29,29,.45)}
  `;
  const drag = document.createElement("div");
  drag.className = "jikkai-desktop-drag";
  const controls = document.createElement("div");
  controls.className = "jikkai-desktop-controls";
  controls.innerHTML = `
    <button type="button" title="Minimizar">−</button>
    <button type="button" title="Maximizar">□</button>
    <button type="button" title="Bandeja" data-close>×</button>
  `;
  const [minimize, maximize, close] = controls.querySelectorAll("button");
  minimize.addEventListener("click", () => ipcRenderer.invoke("main:minimize"));
  maximize.addEventListener("click", () => ipcRenderer.invoke("main:toggle-maximize"));
  close.addEventListener("click", () => ipcRenderer.invoke("main:hide"));
  document.documentElement.appendChild(style);
  document.body.appendChild(drag);
  document.body.appendChild(controls);
});

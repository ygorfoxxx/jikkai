const SESSION_KEY = "fox-portal-session-v2";
const STORAGE_KEY = "fox-portal-v3";
const COMMAND_POSITIONS = new Set(["lider", "conselheiro", "capitao_ramo"]);
const BLOCKED_COMMAND_ACTIONS = new Set([
  "cmd-target",
  "cmd-merit",
  "focus-map-meeting",
  "save-current-point",
  "delete-map-point"
]);
const COMMAND_ONLY_SELECTORS = [
  "#commandNav",
  "#commandTab",
  "#commandDock",
  "#comando",
  '[data-panel="comando"]',
  '[data-tab-jump="comando"]',
  '[data-dock-key="comando"]',
  '[data-action="cmd-target"]',
  '[data-action="cmd-merit"]',
  '[data-action="focus-map-meeting"]',
  '[data-action="save-current-point"]',
  '[data-action="delete-map-point"]',
  "[data-command-target]",
  "[data-overlay-merit]",
  "#cmdCreateMission",
  "#cmdSendMessage",
  "#appMapMeeting",
  "#appCreateMeetingBtn",
  "#appPointComposer",
  "#appSavedPointsPanel",
  "#ovMeetingMode",
  "#ovSavePoint"
].join(",");

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function validDesktopSession(session, runId) {
  if (!(session?.username && session?.source === "jikkai-desktop" && session?.appLoginAt)) return false;
  if (!/^jikkai-desktop-auth-v\d+$/i.test(String(session?.authVersion || ""))) return false;
  return session.remember === true || String(session.desktopRunId || "") === String(runId || "");
}

function readCurrentSession(runId) {
  const temporary = parseJson(window.sessionStorage?.getItem(SESSION_KEY));
  if (validDesktopSession(temporary, runId)) return temporary;
  const persisted = parseJson(window.localStorage?.getItem(SESSION_KEY));
  return validDesktopSession(persisted, runId) ? persisted : null;
}

function syncSharedDesktopSession(runId) {
  try {
    const temporary = parseJson(window.sessionStorage?.getItem(SESSION_KEY));
    const persisted = parseJson(window.localStorage?.getItem(SESSION_KEY));
    const trusted = validDesktopSession(temporary, runId)
      ? temporary
      : (validDesktopSession(persisted, runId) ? persisted : null);

    if (trusted) {
      const payload = JSON.stringify(trusted);
      window.sessionStorage.setItem(SESSION_KEY, payload);
      window.localStorage.setItem(SESSION_KEY, payload);
      return trusted;
    }

    if (persisted?.source === "jikkai-desktop" && persisted?.remember === false) {
      window.localStorage.removeItem(SESSION_KEY);
    }
    return null;
  } catch {
    return null;
  }
}

function rolePosition(role = {}) {
  const explicit = normalizeText(role.estruturaPosicao || role.estruturaNivel || "").replace(/[\s-]+/g, "_");
  if (explicit.includes("conselheiro")) return "conselheiro";
  if (explicit.includes("capitao") || explicit.includes("comandante") || explicit.includes("caporegime")) return "capitao_ramo";
  if (explicit.includes("lider")) return "lider";

  const text = normalizeText(`${role.id || ""} ${role.nome || ""}`);
  if (text.includes("conselheiro")) return "conselheiro";
  if (text.includes("capitao") || text.includes("comandante") || text.includes("caporegime")) return "capitao_ramo";
  if (text.includes("lider")) return "lider";
  return "operador";
}

function commandAccessAllowed(runId) {
  const session = readCurrentSession(runId);
  if (!session?.username) return false;
  if (normalizeText(session.username) === "leader") return true;

  const state = parseJson(window.localStorage?.getItem(STORAGE_KEY), {}) || {};
  const users = Array.isArray(state.users) ? state.users : [];
  const roles = Array.isArray(state.roles) ? state.roles : [];
  const username = normalizeText(session.username);
  const user = users.find(item => normalizeText(item?.username) === username);
  if (!user) return false;
  const role = roles.find(item => String(item?.id || "") === String(user.role || "")) || {};
  return COMMAND_POSITIONS.has(rolePosition(role));
}

function setPermissionHidden(node, hidden) {
  if (!(node instanceof HTMLElement)) return;
  if (hidden) {
    node.dataset.jikkaiPermissionHidden = "true";
    node.hidden = true;
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("inert", "");
    if ("disabled" in node) node.disabled = true;
    return;
  }

  if (node.dataset.jikkaiPermissionHidden !== "true") return;
  delete node.dataset.jikkaiPermissionHidden;
  node.hidden = false;
  node.removeAttribute("aria-hidden");
  node.removeAttribute("inert");
  if ("disabled" in node) node.disabled = false;
}

function redirectRestrictedCommandView() {
  if (location.hash === "#comando") location.hash = "#membros";

  if (document.querySelector("#comando.active")) {
    document.querySelector('#nav button[data-section="membros"]')?.click();
  }

  if (document.querySelector('[data-panel="comando"].active')) {
    document.querySelector('[data-tab="membros"], [data-tab-jump="membros"]')?.click();
  }
}

function installSessionPermissionGuard({ runId = "" } = {}) {
  let permissionGuardFrame = 0;

  function applyPermissionGuard() {
    permissionGuardFrame = 0;
    syncSharedDesktopSession(runId);
    const allowed = commandAccessAllowed(runId);
    document.documentElement.dataset.jikkaiCommandAccess = allowed ? "allowed" : "restricted";
    document.querySelectorAll(COMMAND_ONLY_SELECTORS).forEach(node => setPermissionHidden(node, !allowed));
    if (!allowed) redirectRestrictedCommandView();
  }

  function schedulePermissionGuard() {
    if (permissionGuardFrame) return;
    permissionGuardFrame = window.requestAnimationFrame(applyPermissionGuard);
  }

  const style = document.createElement("style");
  style.textContent = `
    html[data-jikkai-command-access="restricted"] [data-jikkai-permission-hidden="true"]{
      display:none !important;
      visibility:hidden !important;
      pointer-events:none !important;
    }
  `;
  document.documentElement.appendChild(style);

  document.addEventListener("click", event => {
    if (commandAccessAllowed(runId)) return;
    const action = event.target?.closest?.("[data-action]")?.dataset?.action || "";
    const restrictedNode = event.target?.closest?.(COMMAND_ONLY_SELECTORS);
    if (!restrictedNode && !BLOCKED_COMMAND_ACTIONS.has(action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    redirectRestrictedCommandView();
  }, true);

  const observer = new MutationObserver(schedulePermissionGuard);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", schedulePermissionGuard);
  window.addEventListener("hashchange", schedulePermissionGuard);
  window.setInterval(schedulePermissionGuard, 1200);
  applyPermissionGuard();
}

module.exports = { installSessionPermissionGuard };

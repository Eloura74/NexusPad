// macropad/ui/js/pad.js
// PAD MODE + WS (étape 1+2 + 3)
// - UI 1024x600 + touches 3D
// - Connexion WebSocket + status online/offline + latence
// - Appui court => envoi cmd WS
// - Appui long => réservé CONFIG MODE

"use strict";

/* ===== DOM ===== */
const GRID = document.getElementById("grid");
const TOAST = document.getElementById("toast");

const elLatency = document.getElementById("latency");
const elPcStatus = document.getElementById("pcStatus");
const elPcDot = document.getElementById("pcDot");

const btnConfig = document.getElementById("btnConfig");

/* ===== SETTINGS ===== */
const WS_PORT = 8765;
const PC_TTL_MS = 7000;
const DEFAULT_PC = "BureauMSI"; // fallback si plusieurs hosts

/* ===== STATE ===== */
let activeProfile = "DEFAULT";
let ws = null;

let lastStatusTs = 0;
let onlineHosts = [];
let lastPingSentAt = 0;
let latencyMs = null;

/* ===== PROFILS (prototype) ===== */
const PROFILES = {
  DEFAULT: [
    { id: "K01", title: "TaskMgr", sub: "Ctrl+Shift+Esc", accent: "cyan", action: { type: "keys", payload: "CTRL+SHIFT+ESC" } },
    { id: "K02", title: "Alt+Tab", sub: "Switch fenêtre", accent: "cyan", action: { type: "keys", payload: "ALT+TAB" } },
    { id: "K03", title: "Win+E", sub: "Explorateur", accent: "cyan", action: { type: "keys", payload: "WIN+E" } },
    { id: "K04", title: "Win+L", sub: "Verrouiller", accent: "amber", action: { type: "keys", payload: "WIN+L" } },
    { id: "K05", title: "Copy", sub: "Ctrl+C", accent: "cyan", action: { type: "keys", payload: "CTRL+C" } },
    { id: "K06", title: "Paste", sub: "Ctrl+V", accent: "cyan", action: { type: "keys", payload: "CTRL+V" } },
    { id: "K07", title: "Undo", sub: "Ctrl+Z", accent: "cyan", action: { type: "keys", payload: "CTRL+Z" } },
    { id: "K08", title: "Mute", sub: "Media", accent: "amber", action: { type: "keys", payload: "VOLUME_MUTE" } },
    { id: "K09", title: "Prev", sub: "Media", accent: "cyan", action: { type: "keys", payload: "MEDIA_PREV_TRACK" } },
    { id: "K10", title: "Play", sub: "Media", accent: "cyan", action: { type: "keys", payload: "MEDIA_PLAY_PAUSE" } },
    { id: "K11", title: "Next", sub: "Media", accent: "cyan", action: { type: "keys", payload: "MEDIA_NEXT_TRACK" } },
    { id: "K12", title: "Config", sub: "Long press", accent: "amber", action: { type: "noop", payload: "" } },
  ],
  STUDIO: [],
  GAMING: [],
};

/* ===== UI ===== */
function toast(msg) {
  TOAST.textContent = msg;
  TOAST.classList.remove("opacity-0");
  TOAST.classList.add("opacity-100");
  setTimeout(() => {
    TOAST.classList.add("opacity-0");
    TOAST.classList.remove("opacity-100");
  }, 700);
}

function setPcUi(online) {
  if (online) {
    elPcStatus.textContent = "online";
    elPcStatus.classList.remove("text-slate-300");
    elPcStatus.classList.add("text-cyan-200");
    elPcDot.classList.remove("bg-red-500");
    elPcDot.classList.add("bg-emerald-400");
  } else {
    elPcStatus.textContent = "offline";
    elPcStatus.classList.remove("text-cyan-200");
    elPcStatus.classList.add("text-slate-300");
    elPcDot.classList.remove("bg-emerald-400");
    elPcDot.classList.add("bg-red-500");
  }
}

function setLatency(ms) {
  latencyMs = ms;
  elLatency.textContent = (ms == null) ? "-- ms" : `${ms} ms`;
}

function getSelectedPc() {
  // si un seul PC online, on le prend
  if (onlineHosts.length === 1) return onlineHosts[0];
  // sinon fallback
  return DEFAULT_PC;
}

/* ===== RENDER ===== */
function render(profileName) {
  GRID.innerHTML = "";
  const keys = PROFILES[profileName] || [];
  const effective = keys.length ? keys : PROFILES.DEFAULT;

  for (const k of effective) {
    const wrap = document.createElement("div");
    wrap.className = "key-wrap";

    const key = document.createElement("button");
    key.className = "key " + (k.accent === "amber" ? "accent-amber" : "accent-cyan");
    key.setAttribute("data-id", k.id);

    key.innerHTML = `
      <div class="key-face key-side"></div>
      <div class="key-face key-top"></div>
      <div class="key-content">
        <div class="key-title">${k.title}</div>
        <div class="key-sub">${k.sub}</div>
      </div>
    `;

    attachTouchHandlers(key, k);
    wrap.appendChild(key);
    GRID.appendChild(wrap);
  }
}

/* ===== ACTION -> WS CMD ===== */
function makeCmdFromAction(action) {
  const type = action?.type ?? "noop";
  const payload = action?.payload ?? "";

  if (type === "keys" || type === "hotkey") return { cmd: "keys", keys: String(payload) };
  if (type === "run") return { cmd: "run", path: String(payload), args: [] };
  if (type === "shell") return { cmd: "shell", command: String(payload) };

  return { cmd: "noop" };
}

function sendCmdToPc(action, keyMeta) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    toast("WS non connecté");
    return;
  }

  const pc = getSelectedPc();
  const mapped = makeCmdFromAction(action);

  // touche "Config" => rien en short press
  if (mapped.cmd === "noop") {
    toast(`EXEC ${keyMeta.title}`);
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const payload = { type: "cmd", target: pc, id, cmd: mapped.cmd };

  if (mapped.cmd === "keys") payload.keys = mapped.keys ?? "";
  if (mapped.cmd === "run") { payload.path = mapped.path ?? ""; payload.args = mapped.args ?? []; }
  if (mapped.cmd === "shell") payload.command = mapped.command ?? "";

  ws.send(JSON.stringify(payload));
  toast(`→ ${pc} : ${mapped.cmd}`);
}

/* ===== TOUCH / CLICK HANDLERS ===== */
function attachTouchHandlers(el, k) {
  let pressTimer = null;
  let longPressed = false;

  const press = () => {
    longPressed = false;
    el.classList.add("pressed");

    pressTimer = setTimeout(() => {
      longPressed = true;
      toast(`CONFIG ${k.id} (à venir)`);
      // futur : ouvrir overlay config
    }, 650);
  };

  const release = () => {
    el.classList.remove("pressed");
    if (pressTimer) clearTimeout(pressTimer);

    if (!longPressed) {
      // short press => WS
      sendCmdToPc(k.action, k);
    }
  };

  // Touch
  el.addEventListener("touchstart", (e) => { e.preventDefault(); press(); }, { passive: false });
  el.addEventListener("touchend",   (e) => { e.preventDefault(); release(); }, { passive: false });

  // Mouse (debug PC)
  el.addEventListener("mousedown", press);
  el.addEventListener("mouseup", release);
  el.addEventListener("mouseleave", () => el.classList.remove("pressed"));
}

/* ===== WEBSOCKET ===== */
function wsUrl() {
  // IMPORTANT : si UI en HTTPS via NPM => wss obligatoire
  const proto = (location.protocol === "https:") ? "wss" : "ws";
  return `${proto}://${location.hostname}:${WS_PORT}`;
}

function connectWs() {
  const url = wsUrl();
  ws = new WebSocket(url);

  ws.onopen = () => {
    // HELLO UI obligatoire pour que le serveur t'ajoute à ui_clients
    ws.send(JSON.stringify({ type: "hello", client: "ui" }));

    // petite sonde pour latence (mesure locale côté UI)
    lastPingSentAt = Date.now();
    setLatency(null);
  };

  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.type === "status") {
      lastStatusTs = Date.now();
      onlineHosts = Array.isArray(msg.hosts) ? msg.hosts : [];

      setPcUi(!!msg.online);

      // latence “approx” : on mesure le temps jusqu’au premier status reçu après open
      if (lastPingSentAt) {
        const ms = Date.now() - lastPingSentAt;
        if (latencyMs == null) setLatency(ms);
      }
      return;
    }

    if (msg.type === "ack") {
      toast(msg.message ?? "ACK");
      return;
    }

    if (msg.type === "error") {
      toast(`ERR: ${msg.message ?? "?"}`);
      return;
    }
  };

  ws.onclose = () => {
    setPcUi(false);
    setTimeout(connectWs, 800);
  };

  ws.onerror = () => {
    try { ws.close(); } catch {}
  };
}

/* ===== WATCHDOG OFFLINE ===== */
setInterval(() => {
  if (!lastStatusTs) return;
  if (Date.now() - lastStatusTs > PC_TTL_MS) setPcUi(false);
}, 1000);

/* ===== PROFILS ===== */
document.querySelectorAll(".profile-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".profile-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeProfile = btn.dataset.profile;
    render(activeProfile);
    toast(`PROFILE ${activeProfile}`);
  });
});

btnConfig.addEventListener("click", () => {
  toast("CONFIG MODE (étape 5)");
});

/* ===== INIT ===== */
setPcUi(false);
setLatency(null);
render(activeProfile);
connectWs();

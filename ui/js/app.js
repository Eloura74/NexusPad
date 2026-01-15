// macropad/ui/app.js

"use strict";

/* ========= DOM ========= */
const elGrid     = document.getElementById("grid");
const elProfileList = document.getElementById("profileList");
const elDot      = document.getElementById("pcStatusDot");
const elText     = document.getElementById("pcStatusText");
const elToast    = document.getElementById("toast");
const elPcSelect = document.getElementById("pcSelect");
const btnConfig  = document.getElementById("btnConfig");
const btnSleep   = document.getElementById("btnSleep");
const elSleepOverlay = document.getElementById("sleepOverlay");

/* ========= CONFIG OVERLAY DOM ========= */
const elOverlay = document.getElementById("configOverlay");
const elModal   = document.getElementById("configModal");
const elForm    = document.getElementById("configForm");
const btnCancel = document.getElementById("btnCancel");
const btnDelete = document.getElementById("btnDelete");

/* ========= CONFIG ========= */
const WS_PORT = 8765;
const PC_TTL_MS = 7000;               // offline si pas de status depuis 7s
const WS_RECONNECT_MIN_MS = 800;
const WS_RECONNECT_MAX_MS = 4000;
const DEFAULT_PC = "BureauMSI";

// Debug console (mets true si besoin)
const DEBUG = false;
const dbg = (...args) => { if (DEBUG) console.log("[UI]", ...args); };

/* ========= STATE ========= */
let cfg = null;
let currentProfile = null;
let editingButton = null; // { profileId, index }
let isEditMode = false; // Default Locked

let ws = null;
let wsReconnectTimer = null;
let wsReconnectDelay = WS_RECONNECT_MIN_MS;

let lastStatusTs = 0;
let onlineHosts = [];

/* ========= UI HELPERS ========= */
function toast(msg, ms = 1200) {
  if (!elToast) return;
  elToast.textContent = msg;
  elToast.classList.remove("hidden");
  setTimeout(() => elToast.classList.add("hidden"), ms);
}

function setPcStatus(online, hosts = []) {
  if (elDot) {
    elDot.classList.toggle("dot-on", !!online);
    elDot.classList.toggle("dot-off", !online);
  }

  if (!elText) return;

  if (online && hosts.length) elText.textContent = `PC : en ligne (${hosts.join(", ")})`;
  else elText.textContent = online ? "PC : en ligne" : "PC : hors ligne";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

/* ========= CONFIG LOADING ========= */
/* ========= CONFIG LOADING ========= */
async function loadConfig() {
  // 1. Try localStorage
  const local = localStorage.getItem("nexuspad_config");
  if (local) {
    try {
      dbg("Loaded config from localStorage");
      return JSON.parse(local);
    } catch (e) {
      console.error("Error parsing localStorage config", e);
    }
  }

  // 2. Fallback to server JSON
  const res = await fetch("profiles.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de charger profiles.json");
  return await res.json();
}

function saveConfig() {
  if (!cfg) return;
  localStorage.setItem("nexuspad_config", JSON.stringify(cfg));
  dbg("Saved config to localStorage");
}

/* ========= PROFILES / GRID ========= */
function applyGrid(profile) {
  const cols = profile?.grid?.cols ?? 4;
  if (elGrid) elGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  if (elGrid) elGrid.innerHTML = "";
}

function renderProfileButtons() {
  if (!elProfileList) return;
  elProfileList.innerHTML = "";

  const profiles = cfg?.profiles ?? [];
  if (profiles.length === 0) return;

  // Set default if none selected
  if (!currentProfile) {
    currentProfile = profiles[0];
  }

  for (const p of profiles) {
    const btn = document.createElement("button");
    btn.className = "profile-btn";
    btn.textContent = p.label ?? p.id;
    btn.dataset.profile = p.id;
    
    if (currentProfile && p.id === currentProfile.id) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => switchProfile(p.id));
    elProfileList.appendChild(btn);
  }
}

function switchProfile(profileId) {
  const found = (cfg?.profiles ?? []).find(p => p.id === profileId);
  if (!found) return;

  currentProfile = found;
  
  // Update buttons active state
  const btns = elProfileList.querySelectorAll(".profile-btn");
  btns.forEach(b => {
    if (b.dataset.profile === profileId) b.classList.add("active");
    else b.classList.remove("active");
  });

  renderButtons(currentProfile);
}

function setCurrentProfileById(id) {
  const found = (cfg?.profiles ?? []).find(p => p.id === id);
  currentProfile = found ?? (cfg?.profiles?.[0] ?? null);
  return currentProfile;
}

/* ========= TARGET PC ========= */
function getSelectedPc() {
  // 1) dropdown explicite
  if (elPcSelect && elPcSelect.value) return elPcSelect.value.trim();

  // 2) auto si un seul host online
  if (onlineHosts.length === 1) return onlineHosts[0];

  // 3) fallback
  return DEFAULT_PC;
}

/* ========= ACTION -> CMD ========= */
function makeCmdFromAction(action) {
  const type = action?.type ?? "noop";
  const payload = action?.payload ?? "";

  // profil: {type:"hotkey", payload:"CTRL+SHIFT+ESC"}
  if (type === "hotkey" || type === "keys") {
    return { cmd: "keys", keys: String(payload) };
  }

  // profil: {type:"run", payload:"notepad.exe"}
  if (type === "run") {
    return { cmd: "run", path: String(payload), args: [] };
  }

  // profil: {type:"shell", payload:"start chrome https://..."}
  if (type === "shell") {
    return { cmd: "shell", command: String(payload) };
  }

  // noop / fallback
  return { cmd: "keys", keys: String(payload) };
}

/* ========= RENDER BUTTONS ========= */
/* ========= RENDER BUTTONS ========= */
function renderButtons(profile) {
  if (!elGrid) return;

  applyGrid(profile);

  const buttons = profile?.buttons ?? [];
  // Icon Map (simple heuristic for now)
  const getIcon = (label) => {
    const l = label.toLowerCase();
    if (l.includes("obs")) return "fa-video";
    if (l.includes("rec")) return "fa-circle-dot";
    if (l.includes("mic")) return "fa-microphone-slash";
    if (l.includes("scene")) return "fa-clapperboard";
    if (l.includes("steam")) return "fa-steam";
    if (l.includes("discord")) return "fa-discord";
    if (l.includes("play")) return "fa-play";
    if (l.includes("pause")) return "fa-pause";
    if (l.includes("next")) return "fa-forward-step";
    if (l.includes("prev")) return "fa-backward-step";
    if (l.includes("mute")) return "fa-volume-xmark";
    if (l.includes("copy")) return "fa-copy";
    if (l.includes("paste")) return "fa-paste";
    if (l.includes("undo")) return "fa-rotate-left";
    if (l.includes("lock")) return "fa-lock";
    if (l.includes("task")) return "fa-list-check";
    if (l.includes("term")) return "fa-terminal";
    if (l.includes("explor")) return "fa-folder-open";
    if (l.includes("snip")) return "fa-crop-simple";
    if (l.includes("enter")) return "fa-arrow-turn-down";
    return "fa-cube"; // default
  };

  // Render buttons from the current profile
  elGrid.innerHTML = ""; // Clear existing buttons
  let isDragging = false; // Local state for drag operation

  buttons.forEach((b, index) => {
    // 1. The Wrapper (corresponds to .wrap)
    const wrap = document.createElement("div");
    wrap.className = "key-wrap"; // We'll use .key-wrap instead of .wrap to match existing logic
    wrap.draggable = isEditMode; // Only draggable in edit mode
    wrap.dataset.index = index;

    // 2. The Button (corresponds to .button)
    const btn = document.createElement("div");
    btn.className = "key"; 
    btn.dataset.accent = b.accent || "cyan";

    // 3. The Corner (Decorative)
    const corner = document.createElement("div");
    corner.className = "corner";
    btn.appendChild(corner);

    // 4. The Inner Content (Icon/Label)
    const inner = document.createElement("div");
    inner.className = "inner";
    
    // Icon Logic
    const iconClass = b.icon || getIcon(b.label || "");
    let innerContent = "";
    if (b.image) {
       innerContent += `<div class="key-bg" style="background-image: url('${b.image}')"></div>`;
    }
    // We use FontAwesome instead of the complex SVG for now, adapted to the style
    innerContent += `<i class="key-icon fa-solid ${iconClass}"></i>`;
    if (b.label) {
      innerContent += `<div class="key-label">${escapeHtml(b.label)}</div>`;
    }
    
    inner.innerHTML = innerContent;
    btn.appendChild(inner);
    
    wrap.appendChild(btn);

    // 5. The LED
    const led = document.createElement("div");
    led.className = "led";
    wrap.appendChild(led);

    // 6. The Background (Shine effects)
    const bg = document.createElement("div");
    bg.className = "bg";
    bg.innerHTML = `<div class="shine-1"></div><div class="shine-2"></div>`;
    wrap.appendChild(bg);

    // 7. The Background Glow
    const bgGlow = document.createElement("div");
    bgGlow.className = "bg-glow";
    wrap.appendChild(bgGlow);

    // --- Interaction Logic ---
    
    // Handle Click
    // Handle Click
    wrap.addEventListener("click", (e) => {
      if (isDragging) return;
      
      // Visual Feedback (Active State)
      wrap.classList.add("active");
      setTimeout(() => wrap.classList.remove("active"), 200);

      if (isEditMode) {
        // Edit Mode: Open Editor
        openEditor(profile.id, index);
      } else {
        // Run Mode: Execute Action
        executeAction(b);
      }
    });

    // Drag Events (Only in edit mode)
    if (isEditMode) {
      wrap.addEventListener("dragstart", (e) => {
        isDragging = true;
        e.dataTransfer.setData("text/plain", index);
        e.dataTransfer.effectAllowed = "move";
        wrap.classList.add("dragging");
        
        // Add visual feedback to all other buttons
        setTimeout(() => {
          document.querySelectorAll(".key-wrap").forEach(w => {
            if (w !== wrap) {
              w.classList.add("drop-target");
            }
          });
        }, 50);
      });

      wrap.addEventListener("dragend", () => {
        isDragging = false;
        wrap.classList.remove("dragging");
        document.querySelectorAll(".key-wrap").forEach(w => {
          w.classList.remove("drag-over", "drop-target");
        });
      });

      wrap.addEventListener("dragover", (e) => {
        if (!isDragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        wrap.classList.add("drag-over");
      });

      wrap.addEventListener("dragleave", (e) => {
        // Check if we're actually leaving the element (not just moving to a child)
        if (!wrap.contains(e.relatedTarget)) {
          wrap.classList.remove("drag-over");
        }
      });

      wrap.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrap.classList.remove("drag-over");
        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
        const toIndex = index;

        if (fromIndex === toIndex || isNaN(fromIndex)) return;

        // Swap in data
        const buttons = profile.buttons;
        if (!buttons[fromIndex] || !buttons[toIndex]) return;

        const temp = buttons[fromIndex];
        buttons[fromIndex] = buttons[toIndex];
        buttons[toIndex] = temp;

        saveConfig();
        renderButtons(profile); // Re-render the grid after swap
        toast(`Touches ${fromIndex + 1} ↔ ${toIndex + 1} échangées`, 1500);
      });
    }

    elGrid.appendChild(wrap);

  });
  
  // Add "New Button" placeholder (Only in Edit Mode)
  if (isEditMode) {
      const wrapAdd = document.createElement("div");
      wrapAdd.className = "key-wrap editable";
      const btnAdd = document.createElement("button");
      btnAdd.className = "key btn-ghost opacity-50 hover:opacity-100 flex items-center justify-center border-dashed border-2 border-slate-700";
      btnAdd.innerHTML = `<div class="text-2xl text-slate-500">+</div>`;
      
      btnAdd.addEventListener("click", () => {
        if (!profile.buttons) profile.buttons = [];
        profile.buttons.push({ label: "New", action: { type: "noop" } });
        saveConfig();
        renderButtons(profile);
        openEditor(profile.id, profile.buttons.length - 1);
      });
      
      wrapAdd.appendChild(btnAdd);
      elGrid.appendChild(wrapAdd);
  }
}

function executeAction(b) {
  const pc = getSelectedPc();
  const action = b.action ?? { type: "noop", payload: "" };
  const mapped = makeCmdFromAction(action);

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  
  // Visual feedback
  toast(`Envoi -> ${pc}: ${mapped.cmd}`, 900);
  
  sendCmd({ ...mapped, target: pc, id });
}

/* ========= EDITOR ========= */
function openEditor(profileId, index) {
  const profile = (cfg?.profiles ?? []).find(p => p.id === profileId);
  if (!profile) return;
  
  const btnData = profile.buttons[index];
  if (!btnData) return;

  editingButton = { profileId, index };

  // Fill form
  if (elForm) {
    elForm.label.value = btnData.label ?? "";
    elForm.hint.value = btnData.hint ?? "";
    elForm.type.value = btnData.action?.type ?? "keys";
    
    // Handle payload input type
    updatePayloadInput(elForm.type.value, btnData.action?.payload ?? "");

    // Color radio
    const accent = btnData.accent ?? "cyan";
    const radio = elForm.querySelector(`input[name="accent"][value="${accent}"]`);
    if (radio) radio.checked = true;

    // Image Preview
    const imgPreview = document.getElementById("imgPreview");
    if (imgPreview) {
      if (btnData.image) {
        imgPreview.innerHTML = `<img src="${btnData.image}" class="w-full h-full object-cover">`;
      } else {
        imgPreview.innerHTML = `<i class="fa-solid fa-image text-slate-500 text-xs"></i>`;
      }
    }
  }

  // Show overlay
  elOverlay.classList.remove("hidden");
  // Small delay for animation
  requestAnimationFrame(() => {
    elModal.classList.remove("scale-95", "opacity-0");
    elModal.classList.add("scale-100", "opacity-100");
  });
}

function closeEditor() {
  elModal.classList.remove("scale-100", "opacity-100");
  elModal.classList.add("scale-95", "opacity-0");
  
  setTimeout(() => {
    elOverlay.classList.add("hidden");
    editingButton = null;
  }, 200);
}

function saveEditor() {
  if (!editingButton || !cfg) return;
  const { profileId, index } = editingButton;
  const profile = cfg.profiles.find(p => p.id === profileId);
  if (!profile) return;

  const formData = new FormData(elForm);
  
  const newBtn = {
    label: formData.get("label"),
    hint: formData.get("hint"),
    accent: formData.get("accent"),
    action: {
      type: formData.get("type"),
      payload: formData.get("payload")
    },
    image: editingButton.tempImage ?? profile.buttons[index].image // Keep existing or new
  };

  profile.buttons[index] = newBtn;
  saveConfig();
  renderButtons(profile);
  closeEditor();
  toast("Sauvegardé", 1000);
}

// Image Handling
const fileInput = document.getElementById("fileInput");
const btnUpload = document.getElementById("btnUpload");
const btnClearImg = document.getElementById("btnClearImg");

if (btnUpload && fileInput) {
  btnUpload.addEventListener("click", () => fileInput.click());
  
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      // Resize image
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_SIZE = 128; // Resize to max 128px
        let w = img.width;
        let h = img.height;
        
        if (w > h) {
          if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
        } else {
          if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }
        }
        
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        
        const base64 = canvas.toDataURL("image/jpeg", 0.8);
        
        // Update preview
        const imgPreview = document.getElementById("imgPreview");
        if (imgPreview) imgPreview.innerHTML = `<img src="${base64}" class="w-full h-full object-cover">`;
        
        // Store temp
        if (editingButton) editingButton.tempImage = base64;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

if (btnClearImg) {
  btnClearImg.addEventListener("click", () => {
    if (editingButton) editingButton.tempImage = null; // Mark for removal? 
    // Actually we need a way to say "remove image". 
    // Let's set it to empty string.
    if (editingButton) editingButton.tempImage = "";
    const imgPreview = document.getElementById("imgPreview");
    if (imgPreview) imgPreview.innerHTML = `<i class="fa-solid fa-image text-slate-500 text-xs"></i>`;
  });
}

function deleteEditor() {
  if (!editingButton || !cfg) return;
  if (!confirm("Supprimer ce bouton ?")) return;

  const { profileId, index } = editingButton;
  const profile = cfg.profiles.find(p => p.id === profileId);
  
  if (profile) {
    profile.buttons.splice(index, 1);
    saveConfig();
    renderButtons(profile);
  }
  closeEditor();
}

/* ========= EDITOR EVENTS ========= */
function updatePayloadInput(type, value = "") {
  const container = elForm.querySelector(".payload-container");
  if (!container) return;

  container.innerHTML = ""; // Clear

  if (type === "keys") {
    container.innerHTML = `
      <div class="flex gap-2">
        <input type="text" name="payload" class="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-slate-100 font-mono text-sm focus:border-cyan-400 outline-none transition-colors" placeholder="Press keys..." value="${escapeHtml(value)}" readonly>
        <button type="button" id="btnRecord" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs uppercase tracking-wider">REC</button>
      </div>
    `;
    
    const input = container.querySelector("input");
    const btnRec = container.querySelector("#btnRecord");
    
    let recording = false;
    
    btnRec.addEventListener("click", () => {
      recording = !recording;
      if (recording) {
        btnRec.classList.add("bg-red-500", "text-white");
        btnRec.textContent = "STOP";
        input.value = "Press keys...";
        input.focus();
      } else {
        btnRec.classList.remove("bg-red-500", "text-white");
        btnRec.textContent = "REC";
      }
    });

    // Keydown capture
    input.addEventListener("keydown", (e) => {
      if (!recording) return;
      e.preventDefault();
      
      const keys = [];
      if (e.ctrlKey) keys.push("CTRL");
      if (e.shiftKey) keys.push("SHIFT");
      if (e.altKey) keys.push("ALT");
      if (e.metaKey) keys.push("WIN");
      
      // Ignore modifier keys themselves as the "main" key
      if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        keys.push(e.key.toUpperCase());
      }
      
      // Update input even if just modifiers (to show progress)
      if (keys.length > 0) {
          input.value = keys.join("+");
      }
    });
    
  } else if (type === "shell") {
    container.innerHTML = `
      <textarea name="payload" rows="3" class="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-slate-100 font-mono text-sm focus:border-cyan-400 outline-none transition-colors" placeholder="echo 'Hello'">${escapeHtml(value)}</textarea>
    `;
  } else {
    // Run / Default
    container.innerHTML = `
      <input type="text" name="payload" class="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-slate-100 font-mono text-sm focus:border-cyan-400 outline-none transition-colors" placeholder="Ex: notepad.exe" value="${escapeHtml(value)}">
    `;
  }
}

if (elForm) {
  elForm.type.addEventListener("change", (e) => {
    updatePayloadInput(e.target.value);
  });
}

if (btnCancel) btnCancel.addEventListener("click", closeEditor);
if (btnDelete) btnDelete.addEventListener("click", deleteEditor);
if (elForm) {
  elForm.addEventListener("submit", (e) => {
    e.preventDefault();
    saveEditor();
  });
}
// Close on click outside
if (elOverlay) {
  elOverlay.addEventListener("click", (e) => {
    if (e.target === elOverlay) closeEditor();
  });
}

/* ========= WS ========= */
function wsUrl() {
  // IMPORTANT : location.hostname => macropad.lan, pas localhost
  // Si un jour tu passes en https via NPM, ça passera en wss automatiquement si tu changes ici.
  const isHttps = location.protocol === "https:";
  const proto = isHttps ? "wss" : "ws";
  return `${proto}://${location.hostname}:${WS_PORT}`;
}

function clearReconnectTimer() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnectTimer();

  // backoff léger
  const delay = wsReconnectDelay;
  wsReconnectDelay = Math.min(WS_RECONNECT_MAX_MS, Math.floor(wsReconnectDelay * 1.4));

  dbg("reconnect in", delay, "ms");
  wsReconnectTimer = setTimeout(connectWs, delay);
}

function resetReconnectDelay() {
  wsReconnectDelay = WS_RECONNECT_MIN_MS;
}

function connectWs() {
  clearReconnectTimer();

  const url = wsUrl();
  dbg("connect", url);

  try {
    ws = new WebSocket(url);
  } catch (e) {
    dbg("ws ctor error", e);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    resetReconnectDelay();
    dbg("open");

    // HELLO UI obligatoire
    try {
      ws.send(JSON.stringify({ type: "hello", client: "ui" }));
    } catch (e) {
      dbg("hello send error", e);
    }
  });

  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch (_) {
      return;
    }

    if (msg?.type === "status") {
      lastStatusTs = Date.now();
      onlineHosts = Array.isArray(msg.hosts) ? msg.hosts : [];
      setPcStatus(!!msg.online, onlineHosts);
      return;
    }

    if (msg?.type === "ack") {
      toast(msg.message ?? "ACK", 1000);
      return;
    }

    if (msg?.type === "error") {
      toast(`ERR: ${msg.message ?? "?"}`, 1600);
      return;
    }
  });

  ws.addEventListener("close", () => {
    dbg("close");
    setPcStatus(false);
    scheduleReconnect();
  });

  ws.addEventListener("error", () => {
    // force close -> déclenche close + reconnect
    dbg("error");
    try { ws.close(); } catch (_) {}
  });
}

/* ========= SEND CMD ========= */
function sendCmd({ cmd, keys, path, args, command, target, id }) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    toast("WS non connecté", 1400);
    return;
  }

  if (!target) {
    toast("PC cible manquant", 1400);
    return;
  }

  const payload = { type: "cmd", cmd, target, id };

  if (cmd === "keys") payload.keys = keys ?? "";
  if (cmd === "run")  { payload.path = path ?? ""; payload.args = Array.isArray(args) ? args : []; }
  if (cmd === "shell") payload.command = command ?? "";

  try {
    ws.send(JSON.stringify(payload));
  } catch (e) {
    toast("Erreur envoi WS", 1400);
    try { ws.close(); } catch (_) {}
  }
}

/* ========= WATCHDOG STATUS ========= */
setInterval(() => {
  if (!lastStatusTs) return;
  if (Date.now() - lastStatusTs > PC_TTL_MS) {
    setPcStatus(false);
  }
}, 1000);

/* ========= CONFIG BUTTON ========= */
/* ========= CONFIG BUTTON ========= */
/* ========= CONFIG BUTTON (Now Edit Mode Toggle) ========= */
const btnEditMode = document.getElementById("btnEditMode");
if (btnEditMode) {
    btnEditMode.addEventListener("click", () => {
        isEditMode = !isEditMode;
        
        // Update Icon
        const icon = btnEditMode.querySelector("i");
        if (isEditMode) {
            icon.className = "fa-solid fa-lock-open text-cyan-400";
            btnEditMode.classList.add("border-cyan-500/50", "bg-cyan-500/10");
            document.body.classList.add("edit-mode");
            toast("Mode Édition ACTIVÉ - Drag & Drop disponible", 2000);
        } else {
            icon.className = "fa-solid fa-lock";
            btnEditMode.classList.remove("border-cyan-500/50", "bg-cyan-500/10");
            document.body.classList.remove("edit-mode");
            toast("Mode Édition DÉSACTIVÉ", 1000);
        }
        
        // Re-render to update drag handlers and click logic
        if (currentProfile) renderButtons(currentProfile);
    });
}

// Old Config Button (Top Right) - maybe keep as a shortcut or remove?
// Let's make it also toggle edit mode for now
if (btnConfig) {
  btnConfig.addEventListener("click", () => {
      if (btnEditMode) btnEditMode.click();
  });
}

/* ========= SLEEP MODE ========= */
if (btnSleep && elSleepOverlay) {
  let sleepActiveTimestamp = 0;

  btnSleep.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent bubbling to document
    elSleepOverlay.classList.remove("hidden");
    sleepActiveTimestamp = Date.now();
  });
  
  // Wake on ANY interaction
  const wakeUp = (e) => {
    if (elSleepOverlay.classList.contains("hidden")) return;

    // Debounce: ignore interactions in the first 500ms after sleep
    if (Date.now() - sleepActiveTimestamp < 500) return;

    elSleepOverlay.classList.add("hidden");
    
    // Prevent this click from triggering anything else
    if (e.type === "click" || e.type === "touchstart") {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // Use capture to catch it early
  ["click", "touchstart", "mousemove", "keydown"].forEach(evt => {
    document.addEventListener(evt, wakeUp, { capture: true, passive: false });
  });
}

/* ========= AUTO-SYNC ========= */
let lastConfigHash = null;
let syncInterval = null;

async function startAutoSync() {
  let consecutiveErrors = 0;
  const maxErrors = 3;
  
  // Synchronisation plus aggressive : toutes les 2 secondes
  syncInterval = setInterval(async () => {
    try {
      // Essayer plusieurs URLs pour la sync cross-device
      const urls = [
        './profiles.json?t=' + Date.now(),
        `http://192.168.1.86:8091/profiles.json?t=${Date.now()}`,
        `http://macropad.lan/profiles.json?t=${Date.now()}`
      ];
      
      let response = null;
      for (const url of urls) {
        try {
          response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          if (response.ok) break;
        } catch (e) {
          continue; // Essayer l'URL suivante
        }
      }
      
      if (!response || !response.ok) {
        throw new Error('Aucune URL accessible');
      }
      
      const newConfig = await response.json();
      const newHash = JSON.stringify(newConfig);
      
      if (lastConfigHash && lastConfigHash !== newHash) {
        console.log("🔄 Configuration changée détectée - Mise à jour de l'interface");
        cfg = newConfig;
        
        // Détecter si c'est un signal de reload (bouton spécial)
        const hasReloadSignal = newConfig.profiles.some(p => 
          p.buttons && p.buttons.some(b => 
            b.label && (b.label.includes('RELOAD') || b.label.includes('UPDATE'))
          )
        );
        
        if (hasReloadSignal) {
          toast("🔄 Signal de mise à jour détecté - Rechargement...", 3000);
          setTimeout(() => {
            window.location.href = window.location.href + '?force=' + Date.now();
          }, 2000);
          return;
        }
        
        // Force le re-render complet pour les écrans tactiles
        renderProfileButtons();
        if (currentProfile) {
          const updatedProfile = cfg.profiles.find(p => p.id === currentProfile.id);
          if (updatedProfile) {
            currentProfile = updatedProfile;
            renderButtons(currentProfile);
            
            // Animation de mise à jour pour feedback visuel
            const grid = document.getElementById('grid');
            if (grid) {
              grid.style.opacity = '0.7';
              grid.style.transform = 'scale(0.98)';
              setTimeout(() => {
                grid.style.opacity = '1';
                grid.style.transform = 'scale(1)';
              }, 200);
            }
            
            toast("🔄 Écran tactile mis à jour automatiquement", 2500);
          }
        }
      }
      lastConfigHash = newHash;
      consecutiveErrors = 0; // Reset sur succès
      
    } catch (error) {
      consecutiveErrors++;
      if (consecutiveErrors >= maxErrors) {
        console.warn("Sync failed after", maxErrors, "attempts:", error);
        toast("⚠️ Synchronisation échouée", 1000);
        consecutiveErrors = 0; // Reset pour réessayer
      }
    }
  }, 2000); // Plus fréquent pour une meilleure réactivité
}

function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/* ========= AUTO-UPDATE DETECTION ========= */
let updateCheckInterval = null;
const CURRENT_VERSION = "0.23"; // Version actuelle

async function checkForUpdates() {
  // Détecter si c'est un écran tactile ou un PC normal
  const isTouchDevice = ('ontouchstart' in window) || 
                       (navigator.maxTouchPoints > 0) ||
                       window.location.hostname.includes('109'); // IP du pad7
  
  if (isTouchDevice) {
    // Écran tactile : Auto-update fréquent 
    setTimeout(checkVersionNow, 1000);
    updateCheckInterval = setInterval(checkVersionNow, 5000);
    console.log("🔄 Auto-update TACTILE activé (5s interval)");
  } else {
    // PC normal : Check moins fréquent pour éviter les glitches
    updateCheckInterval = setInterval(checkVersionNow, 60000); // 1 minute
    console.log("🔄 Auto-update PC activé (60s interval)");
  }
}

async function checkVersionNow() {
    try {
      // Requête ultra-aggressive anti-cache pour écrans tactiles
      const response = await fetch('./?nocache=' + Date.now() + '&v=' + Math.random(), {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        // Chercher la version dans le HTML
        const versionMatch = html.match(/NEXUSPAD.*?v(\d+\.\d+)/);
        if (versionMatch) {
          const serverVersion = versionMatch[1];
          
          if (serverVersion !== CURRENT_VERSION) {
            console.log(`🔄 Nouvelle version détectée: ${CURRENT_VERSION} → ${serverVersion}`);
            toast("🔄 Mise à jour détectée - Rechargement...", 3000);
            
            // Attendre 2 secondes pour que l'utilisateur voie le message
            setTimeout(() => {
              window.location.reload(true); // Force reload
            }, 2000);
          }
        }
      }
    } catch (error) {
      // Pas grave, on réessaiera
      console.log("Update check failed (normal):", error);
    }
}

/* ========= INIT ========= */
// Removed elSelect listener


(async function main() {
  try {
    cfg = await loadConfig();
    lastConfigHash = JSON.stringify(cfg);
    renderProfileButtons();

    if (!currentProfile) {
      setPcStatus(false);
      toast("Aucun profil dans profiles.json", 2500);
      return;
    }

    renderButtons(currentProfile);
    setPcStatus(false);
    connectWs();
    
    // Démarrer la synchronisation automatique
    startAutoSync();
    
    // Auto-reload pour écrans tactiles (détection de nouvelle version)
    checkForUpdates();
    toast("🔄 Synchronisation automatique activée", 2000);

  } catch (e) {
    toast(String(e?.message ?? e), 2500);
  }
})();

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
let isEditMode = false;
let isReorganizeMode = false;

function setMode(mode) {
  // Nettoyer les modes précédents
  document.body.classList.remove('mode-edit', 'mode-reorg');
  isEditMode = false;
  isReorganizeMode = false;
  
  // Appliquer le nouveau mode
  if (mode === 'edit') {
    isEditMode = true;
    document.body.classList.add('mode-edit');
    
    // Désactiver draggable en mode édition
    document.querySelectorAll('.wrap').forEach(wrap => {
      wrap.draggable = false;
    });
    
    toast("Mode ÉDITION activé - Cliquez sur une touche pour l'éditer", 3000);
    
  } else if (mode === 'reorg') {
    isReorganizeMode = true;
    document.body.classList.add('mode-reorg');
    
    // Activer draggable en mode réorganisation
    document.querySelectorAll('.wrap').forEach(wrap => {
      wrap.draggable = true;
    });
    
    toast("Mode RÉORGANISATION activé - Glissez pour réorganiser", 3000);
    
  } else {
    // Mode normal
    document.querySelectorAll('.wrap').forEach(wrap => {
      wrap.draggable = false;
    });
    
    toast("Mode NORMAL - Actions directes", 2000);
  }
  
  // Mettre à jour l'apparence des boutons mode
  updateModeButtons();
}

function updateModeButtons() {
  const btnEdit = document.getElementById('btnEditMode');
  const btnReorg = document.getElementById('btnReorganizeMode');
  
  if (btnEdit) {
    if (isEditMode) {
      btnEdit.classList.add('bg-cyan-500/20', 'text-cyan-400', 'border-cyan-400/50');
      btnEdit.classList.remove('text-slate-400');
    } else {
      btnEdit.classList.remove('bg-cyan-500/20', 'text-cyan-400', 'border-cyan-400/50');
      btnEdit.classList.add('text-slate-400');
    }
  }
  
  if (btnReorg) {
    if (isReorganizeMode) {
      btnReorg.classList.add('bg-purple-500/20', 'text-purple-400', 'border-purple-400/50');
      btnReorg.classList.remove('text-slate-400');
    } else {
      btnReorg.classList.remove('bg-purple-500/20', 'text-purple-400', 'border-purple-400/50');
      btnReorg.classList.add('text-slate-400');
    }
  }
}

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
  
  // 1. Save to LocalStorage (Backup/Fast)
  localStorage.setItem("nexuspad_config", JSON.stringify(cfg));
  dbg("Saved config to localStorage");
  
  // 2. Save to Server (Persistence)
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: "save_config",
        config: cfg
      }));
      dbg("Sent config to server");
      toast("📤 Sauvegarde envoyée...", 1000);
    } catch (e) {
      console.error("Send error:", e);
      toast("❌ Erreur envoi: " + e.message, 3000);
    }
  } else {
    console.warn("WebSocket not connected, cannot save to server");
    toast("⚠️ Hors ligne : Sauvegarde locale uniquement", 3000);
  }
  
  // Déclencher sync manuelle après sauvegarde
  // setTimeout(syncConfigOnDemand, 100); // Removed as we rely on server now
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
    // 1. Structure Pro avec Cellule Container
    const cell = document.createElement("div");
    cell.className = "key-cell";
    cell.dataset.index = index;
    
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.dataset.index = index;

    // Hidden Input pour les états CSS (:checked, :hover, etc.)
    const input = document.createElement("input");
    input.type = "checkbox";
    input.style.position = "absolute";
    input.style.opacity = "0";
    wrap.appendChild(input);

    // 2. Button avec la structure exacte du CSS
    const btn = document.createElement("div");
    btn.className = "button";
    
    // Move accent to wrap for shared scope
    wrap.dataset.accent = b.accent || "cyan";

    // 3. Corner Effects
    const corner = document.createElement("div");
    corner.className = "corner";
    btn.appendChild(corner);

    // 4. Inner Content avec SVG Support
    const inner = document.createElement("div");
    inner.className = "inner";
    
    // Créer le contenu avec SVG ou FontAwesome
    const iconClass = b.icon || getIcon(b.label || "");
    let innerContent = "";
    
    // Si image custom
    if (b.image) {
       innerContent += `<div class="key-bg" style="background-image: url('${b.image}')"></div>`;
    }
    
    // Icône FontAwesome directe (plus simple que SVG)
    innerContent += `<i class="fa-solid ${iconClass}"></i>`;
    
    if (b.label) {
      innerContent += `<div class="key-label">${escapeHtml(b.label)}</div>`;
    }
    
    inner.innerHTML = innerContent;
    btn.appendChild(inner);
    wrap.appendChild(btn);

    // 5. LED Réaliste
    const led = document.createElement("div");
    led.className = "led";
    wrap.appendChild(led);

    // 6. Background avec Shine Effects
    const bg = document.createElement("div");
    bg.className = "bg";
    bg.innerHTML = `<div class="shine-1"></div><div class="shine-2"></div>`;
    wrap.appendChild(bg);

    // 7. Background Glow
    const bgGlow = document.createElement("div");
    bgGlow.className = "bg-glow";
    wrap.appendChild(bgGlow);

    // --- Interaction Logic ---
    
    // Handle Click
    // Handle Click avec délai pour distinguer du drag
    let clickTimeout = null;
    let hasStartedDrag = false;
    
    // Handle Click & Touch Events - Instant Feedback
    
    const activate = () => {
      if (isReorganizeMode || isEditMode) return;
      wrap.classList.add("active");
      // Backlight effect
      const bgGlow = wrap.querySelector('.bg-glow');
      if (bgGlow) bgGlow.style.opacity = '1';
    };

    const deactivate = () => {
      wrap.classList.remove("active");
      const bgGlow = wrap.querySelector('.bg-glow');
      if (bgGlow) bgGlow.style.opacity = '';
    };

    // Pointer Events for low latency
    wrap.addEventListener("pointerdown", (e) => {
      if (hasStartedDrag || isReorganizeMode) return;
      wrap.setPointerCapture(e.pointerId);
      activate();
    });

    wrap.addEventListener("pointerup", (e) => {
      wrap.releasePointerCapture(e.pointerId);
      deactivate();
    });

    wrap.addEventListener("pointercancel", (e) => {
      wrap.releasePointerCapture(e.pointerId);
      deactivate();
    });
    
    wrap.addEventListener("pointerleave", deactivate);

    // Click for Action Execution
    input.addEventListener("click", (e) => {
      e.preventDefault();
      
      if (hasStartedDrag) return;
      
      if (isEditMode) {
        openEditor(profile.id, index);
        return;
      }
      
      if (isReorganizeMode) {
        toast("🤏 Glissez pour réorganiser cette touche", 1500);
        return;
      }
      
      // Visual feedback fallback (if pointer events failed)
      activate();
      setTimeout(deactivate, 150);

      executeAction(b);
    });
    
    // Plus besoin des event listeners mousedown/touchstart/mouseup/touchend
    // car on utilise maintenant directement "click"

    // Drag Events (Toujours configurés, mais conditionnés)
    wrap.addEventListener("dragstart", (e) => {
      if (!isReorganizeMode) {
        e.preventDefault();
        return false;
      }
      
      hasStartedDrag = true;
      isDragging = true;
      
      console.log("Drag started for button:", b.label);
      
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
      
      // Délai avant de permettre les clics pour éviter les conflits
      setTimeout(() => {
        hasStartedDrag = false;
      }, 100);
    });

    // Optimized Dragover with Throttling
    let dragOverThrottle = false;
    wrap.addEventListener("dragover", (e) => {
      if (!isDragging || !isReorganizeMode) return;
      e.preventDefault(); // CRITICAL for drop
      e.dataTransfer.dropEffect = "move";
      
      if (!dragOverThrottle) {
        dragOverThrottle = true;
        requestAnimationFrame(() => {
          wrap.classList.add("drag-over");
          dragOverThrottle = false;
        });
      }
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
      
      if (!isDragging || !isReorganizeMode) return;
      
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
      const toIndex = index;
      
      if (fromIndex !== toIndex) {
        // Approche par insertion (plus naturel que swap)
        const movedItem = profile.buttons.splice(fromIndex, 1)[0];
        profile.buttons.splice(toIndex, 0, movedItem);
        
        saveConfig();
        renderButtons(profile);
        toast("Position mise à jour", 1500);
      }
    });
    
    // IMPORTANT : Définir draggable selon le mode ACTUEL
    wrap.draggable = isReorganizeMode;

    cell.appendChild(wrap);
    elGrid.appendChild(cell);

  });
  
  // Add "New Button" placeholder (Only in Edit Mode)
  if (isEditMode || isReorganizeMode) {
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
    // Run / Default - Ajouter bouton parcourir
    container.innerHTML = `
      <div class="flex gap-2">
        <input type="text" name="payload" class="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-slate-100 font-mono text-sm focus:border-cyan-400 outline-none transition-colors" placeholder="Ex: C:\\Program Files\\..." value="${escapeHtml(value)}">
        <button type="button" id="btnBrowseProgram" class="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs uppercase tracking-wider whitespace-nowrap">
          <i class="fa-solid fa-folder-open mr-1"></i>Parcourir
        </button>
        <input type="file" id="programFileInput" accept=".exe,.bat,.cmd,.msi" class="hidden">
      </div>
      <div class="text-[9px] text-slate-500 mt-1 italic">Cliquez sur "Parcourir" pour sélectionner un programme depuis votre PC</div>
      <div class="mt-2 flex gap-1 flex-wrap">
        <button type="button" class="program-shortcut px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-[9px] uppercase tracking-wider" data-path="C:\\Windows\\System32\\notepad.exe">Notepad</button>
        <button type="button" class="program-shortcut px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-[9px] uppercase tracking-wider" data-path="C:\\Windows\\System32\\calc.exe">Calculette</button>
        <button type="button" class="program-shortcut px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-[9px] uppercase tracking-wider" data-path="chrome.exe --app=https://google.com">Chrome</button>
        <button type="button" class="program-shortcut px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-[9px] uppercase tracking-wider" data-path="explorer.exe">Explorateur</button>
      </div>
    `;
    
    // Ajouter l'événement pour le bouton parcourir
    const btnBrowse = container.querySelector("#btnBrowseProgram");
    const fileInputProgram = container.querySelector("#programFileInput");
    const payloadInput = container.querySelector("input[name='payload']");
    
    if (btnBrowse && fileInputProgram && payloadInput) {
      btnBrowse.addEventListener("click", () => {
        fileInputProgram.click();
      });
      
      fileInputProgram.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          // Sur Windows, on peut récupérer le chemin complet
          // Note: Pour des raisons de sécurité, les navigateurs modernes ne donnent pas le chemin complet
          // On va utiliser le nom du fichier et demander à l'utilisateur de compléter
          const fileName = file.name;
          
          // Si c'est un .exe connu, on peut suggérer des chemins courants
          if (fileName.toLowerCase().includes('notepad')) {
            payloadInput.value = 'C:\\Windows\\System32\\notepad.exe';
          } else if (fileName.toLowerCase().includes('calc')) {
            payloadInput.value = 'C:\\Windows\\System32\\calc.exe';
          } else if (fileName.toLowerCase().includes('chrome')) {
            payloadInput.value = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
          } else if (fileName.toLowerCase().includes('firefox')) {
            payloadInput.value = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
          } else if (fileName.toLowerCase().includes('code')) {
            payloadInput.value = 'C:\\Users\\' + (navigator.userAgent.includes('Windows') ? '%USERNAME%' : 'user') + '\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
          } else {
            // Pour les autres, suggérer le nom et demander de compléter
            payloadInput.value = fileName;
            toast("Complétez le chemin complet du programme", 3000);
          }
        }
      });
      
      // Ajouter les événements pour les raccourcis programmes
      const shortcuts = container.querySelectorAll(".program-shortcut");
      shortcuts.forEach(btn => {
        btn.addEventListener("click", () => {
          const path = btn.getAttribute("data-path");
          payloadInput.value = path;
          toast(`Programme sélectionné: ${btn.textContent}`, 1500);
        });
      });
    }
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

    if (msg?.type === "config_updated") {
      dbg("Config updated from server");
      if (msg.config) {
        cfg = msg.config;
        // Refresh current profile if it exists
        if (currentProfile) {
          const updatedProfile = cfg.profiles.find(p => p.id === currentProfile.id);
          if (updatedProfile) {
            currentProfile = updatedProfile;
            renderButtons(currentProfile);
          } else {
             // Profile deleted? fallback to first
             currentProfile = cfg.profiles[0];
             renderButtons(currentProfile);
          }
        } else {
           renderProfileButtons();
        }
        toast("Configuration synchronisée", 1500);
      }
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

/* ========= MODE BUTTONS PROFESSIONNELS ========= */
function setupModeButtons() {
  const btnEditMode = document.getElementById("btnEditMode");
  const btnReorganizeMode = document.getElementById("btnReorganizeMode");

  if (btnEditMode) {
    btnEditMode.addEventListener("click", () => {
      if (isEditMode) {
        setMode('normal');
      } else {
        setMode('edit');
        // Re-render pour appliquer draggable
        renderButtons(currentProfile);
      }
    });
  }

  if (btnReorganizeMode) {
    btnReorganizeMode.addEventListener("click", () => {
      if (isReorganizeMode) {
        setMode('normal');
      } else {
        setMode('reorg');
        // Re-render pour appliquer draggable
        renderButtons(currentProfile);
      }
    });
  }
}

/* ========= CONFIG BUTTON ========= */
function setupConfigButton() {
  const btnConfig = document.getElementById("btnConfig");
  
  if (btnConfig) {
    btnConfig.addEventListener("click", () => {
      // Ouvrir la modale de configuration
      const overlay = document.getElementById("configOverlay");
      if (overlay) {
        overlay.classList.remove("hidden");
        const modal = document.getElementById("configModal");
        if (modal) {
          setTimeout(() => {
            modal.classList.remove("scale-95", "opacity-0");
          }, 50);
        }
      }
    });
  }
}

/* ========= INITIALIZATION ========= */
function init() {
  setupModeButtons();
  setupConfigButton();
  // ... autres initialisations
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

async function syncConfigOnDemand() {
  // Synchronisation UNIQUEMENT à la demande (après sauvegarde)
  console.log("🔄 Synchronisation manuelle de la configuration...");
  
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
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        if (response.ok) break;
      } catch (e) {
        // Try next URL
      }
    }
    
    if (response && response.ok) {
      const remoteConfig = await response.text();
      const newHash = JSON.stringify(remoteConfig);
      
      if (lastConfigHash && newHash !== lastConfigHash) {
        console.log("🔄 Configuration mise à jour détectée, rechargement...");
        
        try {
          const parsedConfig = JSON.parse(remoteConfig);
          cfg = parsedConfig;
          
          // Preserve current profile if it still exists
          const currentProfileId = currentProfile?.id;
          renderProfileButtons();
          
          if (currentProfileId) {
            const stillExists = cfg.profiles?.find(p => p.id === currentProfileId);
            if (stillExists) {
              currentProfile = stillExists;
            } else if (cfg.profiles?.length > 0) {
              currentProfile = cfg.profiles[0];
            }
          }
          
          if (currentProfile) {
            renderButtons(currentProfile);
          }
          
          toast("Configuration synchronisée", 1000);
        } catch (parseError) {
          console.error("Erreur parsing remote config:", parseError);
        }
      }
      lastConfigHash = newHash;
    }
    
  } catch (error) {
    console.warn("Sync manuelle échouée:", error);
  }
}

async function startAutoSync() {
  if (syncInterval) return; // Déjà actif
  
  console.log("🔄 Démarrage de la synchronisation automatique (10s)");
  
  // Sync immédiate puis toutes les 10 secondes (moins agressif)
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
      
      if (lastConfigHash && newHash !== lastConfigHash) {
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
        stopAutoSync();
      }
    }
  }, 10000); // Toutes les 10 secondes (moins de clignotement)
}

function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/* ========= AUTO-UPDATE DETECTION ========= */
let updateCheckInterval = null;
const CURRENT_VERSION = "0.76"; // Version actuelle

async function checkForUpdates() {
  // Détecter si c'est un écran tactile ou un PC normal
  const isTouchDevice = ('ontouchstart' in window) || 
                       (navigator.maxTouchPoints > 0) ||
                       window.location.hostname.includes('109'); // IP du pad7
  
  if (isTouchDevice) {
    // Écran tactile : Auto-update RAPIDE pour tests
    setTimeout(checkVersionNow, 3000); // 3 secondes au démarrage
    updateCheckInterval = setInterval(checkVersionNow, 15000); // 15 secondes
    console.log("🔄 Auto-update TACTILE activé (15s interval)");
  } else {
    // PC normal : Check plus fréquent pour tests
    setTimeout(checkVersionNow, 5000); // 5 secondes au démarrage
    updateCheckInterval = setInterval(checkVersionNow, 30000); // 30 secondes
    console.log("🔄 Auto-update PC activé (30s interval)");
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
            // Vider le cache localStorage pour forcer le rechargement de la config
            localStorage.removeItem("nexuspad_config");
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

/* ========= TOUCH DRAG SUPPORT ========= */
let touchDragData = null;

function enableTouchDrag() {
    console.log("🤏 Activation du support tactile pour le Drag & Drop");
    
    document.addEventListener("touchstart", function(e) {
        if (!isReorganizeMode) return;
        const target = e.target.closest('.wrap');
        if (target && target.draggable) {
            // Empêcher le comportement par défaut (scroll)
            e.preventDefault();
            
            // Simuler le dragstart
            target.style.opacity = "0.6";
            target.classList.add("dragging");
            
            // Stocker les données de drag
            touchDragData = {
                element: target,
                fromIndex: parseInt(target.dataset.index),
                startY: e.touches[0].clientY,
                startX: e.touches[0].clientX
            };
            
            // Feedback visuel pour les autres boutons
            document.querySelectorAll(".key-wrap").forEach(w => {
                if (w !== target) {
                    w.classList.add("drop-target");
                }
            });
            
            toast("Déplacement en cours...", 1000);
        }
    }, { passive: false });

    document.addEventListener("touchmove", function(e) {
        if (isReorganizeMode && touchDragData) {
            e.preventDefault(); // Empêche le scroll de la page
            
            const touch = e.touches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetWrap = elementBelow ? elementBelow.closest('.wrap') : null;
            
            // Nettoyer les anciens highlights
            document.querySelectorAll(".wrap").forEach(w => {
                w.classList.remove("drag-over");
            });
            
            // Highlight la cible actuelle
            if (targetWrap && targetWrap !== touchDragData.element) {
                targetWrap.classList.add("drag-over");
            }
        }
    }, { passive: false });

    document.addEventListener("touchend", function(e) {
        if (!touchDragData) return;
        
        const touch = e.changedTouches[0];
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetWrap = elementBelow ? elementBelow.closest('.wrap') : null;
        
        if (targetWrap && targetWrap !== touchDragData.element && targetWrap.dataset.index !== undefined) {
            const toIndex = parseInt(targetWrap.dataset.index);
            const fromIndex = touchDragData.fromIndex;
            
            if (fromIndex !== toIndex && currentProfile) {
                // Approche par insertion (plus naturel)
                const movedItem = currentProfile.buttons.splice(fromIndex, 1)[0];
                currentProfile.buttons.splice(toIndex, 0, movedItem);
                
                saveConfig();
                renderButtons(currentProfile);
                toast("Position mise à jour", 1500);
            }
        }
        
        // Nettoyer les états visuels
        document.querySelectorAll(".wrap").forEach(w => {
            w.classList.remove("dragging", "drop-target", "drag-over");
            w.style.opacity = "";
        });
        
        touchDragData = null;
    }, { passive: false });
}

/* ========= ANIMATIONS TACTILES OPTIMISÉES ========= */
function enableTouchAnimations() {
  let currentTouch = null;
  
  // TOUCHSTART : Animation simple et fluide
  document.addEventListener('touchstart', (e) => {
    const wrap = e.target.closest('.wrap');
    if (!wrap) return;
    
    currentTouch = wrap;
    
    // Animation CSS SIMPLE et performante
    wrap.classList.add('touch-pressed');
    
  }, { passive: true });
  
  // TOUCHEND : Retour immédiat
  document.addEventListener('touchend', (e) => {
    if (currentTouch) {
      currentTouch.classList.remove('touch-pressed');
      currentTouch = null;
    }
  }, { passive: true });
  
  // TOUCHCANCEL : Nettoyage rapide
  document.addEventListener('touchcancel', (e) => {
    if (currentTouch) {
      currentTouch.classList.remove('touch-pressed');
      currentTouch = null;
    }
  }, { passive: true });
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
    
    // Setup edit mode après que le DOM soit prêt
    setupModeButtons(); // Corriger le nom de fonction
    
    // Activer le support tactile pour le drag & drop
    enableTouchDrag();
    
    // Activer les animations tactiles
    enableTouchAnimations();
    
    // Auto-reload pour écrans tactiles (détection de nouvelle version) - RÉDUIT
    checkForUpdates();

    // Démarrer la synchro auto (polling) car le serveur ne peut pas être redémarré
    // DÉSACTIVÉ car le WebSocket broadcast fonctionne maintenant
    // startAutoSync();
    
    // DEBUG: Synchronisation manuelle avec Ctrl+U
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        console.log("🔄 Synchronisation manuelle forcée...");
        checkVersionNow();
      }
    });
    
    toast("Interface initialisée", 1500);

  } catch (e) {
    toast(String(e?.message ?? e), 2500);
  }
})();

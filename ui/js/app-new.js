/**
 * NexusPad - Main Application Entry Point
 * Simplified and modular architecture
 */

import { config, dbg } from './config.js';
import { dom, toast, setPcStatus, renderButtonsOptimized, enableSleepMode, disableSleepMode } from './modules/ui-helpers.js';
import { connectWs, onMessage, sendCommand, getOnlineHosts, isPcOnline } from './modules/websocket.js';
import * as Profiles from './modules/profiles.js';

// Application State
let isEditMode = false;
let isReorganizeMode = false;
let editingButton = null;

/**
 * Initialize Application
 */
async function init() {
    dbg("Initializing NexusPad...");
    
    try {
        // Load configuration
        await Profiles.loadConfig();
        
        // Setup WebSocket message handlers
        setupWebSocketHandlers();
        
        // Connect to WebSocket server
        connectWs();
        
        // Setup UI event listeners
        setupUIEventListeners();
        
        // Register profile callbacks
        Profiles.onProfilesLoaded(onConfigLoaded);
        Profiles.onProfileSwitch(onProfileSwitch);
        
        // Initial render
        const currentProfile = Profiles.getCurrentProfile();
        if (currentProfile) {
            renderProfile(currentProfile);
        }
        
        dbg("Initialization complete");
    } catch (e) {
        console.error("Initialization error:", e);
        toast("❌ Erreur d'initialisation", 3000);
    }
}

/**
 * Setup WebSocket message handlers
 */
function setupWebSocketHandlers() {
    // Handle config updates from server
    onMessage('config_updated', (config) => {
        Profiles.updateConfig(config);
        const currentProfile = Profiles.getCurrentProfile();
        if (currentProfile) {
            renderProfile(currentProfile);
        }
    });
}

/**
 * Setup UI event listeners
 */
function setupUIEventListeners() {
    // Mode buttons
    if (dom.btnEditMode) {
        dom.btnEditMode.addEventListener('click', () => {
            toggleMode('edit');
        });
    }
    
    if (dom.btnReorganizeMode) {
        dom.btnReorganizeMode.addEventListener('click', () => {
            toggleMode('reorg');
        });
    }
    
    // Sleep mode
    if (dom.btnSleep) {
        dom.btnSleep.addEventListener('click', enableSleepMode);
    }
    
    if (dom.sleepOverlay) {
        dom.sleepOverlay.addEventListener('click', disableSleepMode);
    }
}

/**
 * Toggle application mode (normal/edit/reorg)
 */
function toggleMode(mode) {
    // Reset all modes
    document.body.classList.remove('mode-edit', 'mode-reorg');
    isEditMode = false;
    isReorganizeMode = false;
    
    // Apply new mode
    if (mode === 'edit' && !isEditMode) {
        isEditMode = true;
        document.body.classList.add('mode-edit');
        toast("Mode ÉDITION activé", 2000);
    } else if (mode === 'reorg' && !isReorganizeMode) {
        isReorganizeMode = true;
        document.body.classList.add('mode-reorg');
        toast("Mode RÉORGANISATION activé", 2000);
    } else {
        toast("Mode NORMAL", 1500);
    }
    
    updateModeButtons();
    
    // Re-render with new mode
    const currentProfile = Profiles.getCurrentProfile();
    if (currentProfile) {
        renderProfile(currentProfile);
    }
}

/**
 * Update mode button visual states
 */
function updateModeButtons() {
    if (dom.btnEditMode) {
        dom.btnEditMode.classList.toggle('bg-cyan-500/20', isEditMode);
        dom.btnEditMode.classList.toggle('text-cyan-400', isEditMode);
    }
    
    if (dom.btnReorganizeMode) {
        dom.btnReorganizeMode.classList.toggle('bg-purple-500/20', isReorganizeMode);
        dom.btnReorganizeMode.classList.toggle('text-purple-400', isReorganizeMode);
    }
}

/**
 * Callback when config is loaded
 */
function onConfigLoaded(config) {
    dbg("Config loaded, rendering profiles");
    renderProfileButtons();
}

/**
 * Callback when profile is switched
 */
function onProfileSwitch(profile) {
    dbg("Switched to profile:", profile.id);
    renderProfile(profile);
}

/**
 * Render profile selector buttons
 */
function renderProfileButtons() {
    if (!dom.profileList) return;
    
    dom.profileList.innerHTML = "";
    const profiles = Profiles.getAllProfiles();
    const currentProfile = Profiles.getCurrentProfile();
    
    profiles.forEach(profile => {
        const btn = document.createElement("button");
        btn.className = "profile-btn w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all";
        btn.innerHTML = `<div class="text-lg">${profile.label || profile.id}</div>`;
        btn.dataset.profileId = profile.id;
        
        if (currentProfile && profile.id === currentProfile.id) {
            btn.classList.add("bg-cyan-500/20", "text-cyan-400");
        } else {
            btn.classList.add("hover:bg-white/5", "text-slate-400");
        }
        
        btn.addEventListener("click", () => {
            Profiles.switchProfile(profile.id);
            // Update button states
            dom.profileList.querySelectorAll('.profile-btn').forEach(b => {
                b.classList.remove("bg-cyan-500/20", "text-cyan-400");
                b.classList.add("hover:bg-white/5", "text-slate-400");
            });
            btn.classList.remove("hover:bg-white/5", "text-slate-400");
            btn.classList.add("bg-cyan-500/20", "text-cyan-400");
        });
        
        dom.profileList.appendChild(btn);
    });
}

/**
 * Render a profile's buttons
 */
function renderProfile(profile) {
    if (!profile || !dom.grid) return;
    
    // Apply grid layout
    const cols = profile.grid?.cols || 4;
    dom.grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    
    // Build button elements
    const buttons = profile.buttons || [];
    const buttonElements = buttons.map((btnData, index) => createButtonElement(btnData, index, profile));
    
    // Use optimized rendering
    renderButtonsOptimized(buttonElements, (el) => el);
}

/**
 * Create a button DOM element
 * NOTE: This is simplified - full implementation would include all the visual effects
 */
function createButtonElement(btnData, index, profile) {
    const wrap = document.createElement("div");
    wrap.className = "wrap relative rounded-lg bg-slate-800 p-4 cursor-pointer hover:scale-105 transition-transform";
    wrap.dataset.index = index;
    wrap.draggable = isReorganizeMode;
    
    // Button content
    const icon = btnData.icon || "fa-cube";
    wrap.innerHTML = `
        <div class="flex flex-col items-center gap-2">
            <i class="fa-solid ${icon} text-3xl"></i>
            ${btnData.label ? `<div class="text-sm">${btnData.label}</div>` : ''}
        </div>
    `;
    
    // Click handler
    wrap.addEventListener('click', () => handleButtonClick(btnData, index, profile));
    
    // Drag & drop (if reorg mode)
    if (isReorganizeMode) {
        setupDragAndDrop(wrap, index, profile);
    }
    
    return wrap;
}

/**
 * Handle button click based on current mode
 */
function handleButtonClick(btnData, index, profile) {
    if (isEditMode) {
        // Open editor (simplified - would need full editor implementation)
        toast("Édition: " + btnData.label, 1500);
        return;
    }
    
    if (isReorganizeMode) {
        toast("Glissez pour réorganiser", 1500);
        return;
    }
    
    // Execute action
    executeAction(btnData);
}

/**
 * Setup drag and drop for button reorganization
 */
function setupDragAndDrop(element, index, profile) {
    element.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index);
        element.classList.add('opacity-50');
    });
    
    element.addEventListener('dragend', () => {
        element.classList.remove('opacity-50');
    });
    
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = index;
        
        if (fromIndex !== toIndex) {
            Profiles.swapButtons(fromIndex, toIndex);
            Profiles.saveConfig();
            renderProfile(profile);
            toast("✓ Position mise à jour", 1500);
        }
    });
}

/**
 * Execute a button action
 */
function executeAction(btnData) {
    const action = btnData.action;
    if (!action) {
        toast("Aucune action définie", 1500);
        return;
    }
    
    // Visual feedback
    toast(`→ ${btnData.label || 'Action'}`, 1000);
    
    // Send command via WebSocket
    const hosts = getOnlineHosts();
    const target = hosts.length > 0 ? hosts[0] : config.defaultPc;
    
    sendCommand(action, target);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

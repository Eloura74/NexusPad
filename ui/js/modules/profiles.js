/**
 * Profile Management Module
 * Handles loading, saving, and switching between profiles
 */

import { config, dbg } from '../config.js';
import { toast } from './ui-helpers.js';
import { sendWs } from './websocket.js';

let cfg = null;
let currentProfile = null;

// Callback for when profiles are loaded/updated
let onProfilesLoadedCallback = null;
let onProfileSwitchCallback = null;

/**
 * Register callbacks
 */
export function onProfilesLoaded(callback) {
    onProfilesLoadedCallback = callback;
}

export function onProfileSwitch(callback) {
    onProfileSwitchCallback = callback;
}

/**
 * Load configuration from server
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig() {
    try {
        const response = await fetch('./profiles.json?nocache=' + Date.now());
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        cfg = await response.json();
        dbg("Config loaded:", cfg);
        
        // Auto-select first profile
        if (cfg && cfg.profiles && cfg.profiles.length > 0) {
            currentProfile = cfg.profiles[0];
        }
        
        if (onProfilesLoadedCallback) {
            onProfilesLoadedCallback(cfg);
        }
        
        return cfg;
    } catch (e) {
        console.error("Erreur chargement config:", e);
        toast("❌ Erreur chargement config", 3000);
        throw e;
    }
}

/**
 * Save configuration to server via WebSocket
 */
export function saveConfig() {
    if (!cfg) {
        console.error("No config to save");
        return false;
    }
    
    dbg("Saving config:", cfg);
    const success = sendWs({
        type: "save_config",
        config: cfg
    });
    
    if (success) {
        toast("💾 Sauvegarde en cours...", 1500);
    } else {
        toast("❌ Erreur de connexion", 2000);
    }
    
    return success;
}

/**
 * Update configuration from server broadcast
 * @param {Object} newConfig - New configuration
 */
export function updateConfig(newConfig) {
    if (!newConfig) return;
    
    cfg = newConfig;
    dbg("Config updated from server:", cfg);
    
    // Refresh current profile reference
    if (currentProfile && cfg.profiles) {
        const updated = cfg.profiles.find(p => p.id === currentProfile.id);
        if (updated) {
            currentProfile = updated;
        }
    }
    
    if (onProfilesLoadedCallback) {
        onProfilesLoadedCallback(cfg);
    }
}

/**
 * Switch to a different profile
 * @param {string} profileId - Profile ID to switch to
 */
export function switchProfile(profileId) {
    if (!cfg || !cfg.profiles) {
        console.error("No profiles loaded");
        return false;
    }
    
    const profile = cfg.profiles.find(p => p.id === profileId);
    if (!profile) {
        console.error("Profile not found:", profileId);
        return false;
    }
    
    currentProfile = profile;
    dbg("Switched to profile:", profileId);
    
    if (onProfileSwitchCallback) {
        onProfileSwitchCallback(currentProfile);
    }
    
    return true;
}

/**
 * Get current profile
 * @returns {Object|null} Current profile
 */
export function getCurrentProfile() {
    return currentProfile;
}

/**
 * Get all profiles
 * @returns {Array} All profiles
 */
export function getAllProfiles() {
    return cfg ? (cfg.profiles || []) : [];
}

/**
 * Get configuration object
 * @returns {Object|null} Configuration
 */
export function getConfig() {
    return cfg;
}

/**
 * Update a button in current profile
 * @param {number} index - Button index
 * @param {Object} buttonData - Button data
 */
export function updateButton(index, buttonData) {
    if (!currentProfile || !currentProfile.buttons) {
        console.error("No current profile");
        return false;
    }
    
    if (index < 0 || index >= currentProfile.buttons.length) {
        console.error("Invalid button index:", index);
        return false;
    }
    
    currentProfile.buttons[index] = { ...buttonData };
    dbg("Button updated:", index, buttonData);
    
    return true;
}

/**
 * Delete a button from current profile
 * @param {number} index - Button index
 */
export function deleteButton(index) {
    if (!currentProfile || !currentProfile.buttons) {
        console.error("No current profile");
        return false;
    }
    
    if (index < 0 || index >= currentProfile.buttons.length) {
        console.error("Invalid button index:", index);
        return false;
    }
    
    currentProfile.buttons.splice(index, 1);
    dbg("Button deleted:", index);
    
    return true;
}

/**
 * Swap two buttons (for drag & drop)
 * @param {number} fromIndex - Source index
 * @param {number} toIndex - Destination index
 */
export function swapButtons(fromIndex, toIndex) {
    if (!currentProfile || !currentProfile.buttons) {
        console.error("No current profile");
        return false;
    }
    
    const buttons = currentProfile.buttons;
    if (fromIndex < 0 || fromIndex >= buttons.length || 
        toIndex < 0 || toIndex >= buttons.length) {
        console.error("Invalid indices:", fromIndex, toIndex);
        return false;
    }
    
    const temp = buttons[fromIndex];
    buttons[fromIndex] = buttons[toIndex];
    buttons[toIndex] = temp;
    
    dbg("Buttons swapped:", fromIndex, "↔", toIndex);
    
    return true;
}

/**
 * UI Helper Functions
 * Toast notifications, status updates, and DOM utilities
 */

import { config } from '../config.js';

// DOM Elements
export const dom = {
    grid: document.getElementById("grid"),
    profileList: document.getElementById("profileList"),
    dot: document.getElementById("pcStatusDot"),
    dotText: document.getElementById("pcStatusText"),
    toast: document.getElementById("toast"),
    overlay: document.getElementById("configOverlay"),
    modal: document.getElementById("configModal"),
    form: document.getElementById("configForm"),
    btnEditMode: document.getElementById("btnEditMode"),
    btnReorganizeMode: document.getElementById("btnReorganizeMode"),
    btnSleep: document.getElementById("btnSleep"),
    sleepOverlay: document.getElementById("sleepOverlay")
};

/**
 * Display a toast notification
 * @param {string} msg - Message to display
 * @param {number} ms - Duration in milliseconds
 */
export function toast(msg, ms = 1200) {
    const el = dom.toast;
    if (!el) return;
    
    el.textContent = msg;
    el.classList.remove("hidden");
    
    setTimeout(() => {
        el.classList.add("hidden");
    }, ms);
}

/**
 * Update PC connection status indicator
 * @param {boolean} online - Whether PC is online
 * @param {Array<string>} hosts - List of connected hosts
 */
export function setPcStatus(online, hosts = []) {
    if (!dom.dot || !dom.dotText) return;
    
    if (online) {
        dom.dot.classList.remove("dot-off");
        dom.dot.classList.add("dot-on");
        dom.dotText.textContent = hosts.length > 0 ? `PC: ${hosts.join(', ')}` : "PC online";
    } else {
        dom.dot.classList.add("dot-off");
        dom.dot.classList.remove("dot-on");
        dom.dotText.textContent = "PC offline";
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} s - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

/**
 * Render buttons with optimized DOM manipulation
 * @param {Array} buttons - Array of button configurations
 * @param {Function} buildButtonHtml - Function to build button HTML
 */
export function renderButtonsOptimized(buttons, buildButtonHtml) {
    if (!dom.grid) return;
    
    // Use DocumentFragment to minimize reflows
    const fragment = document.createDocumentFragment();
    
    buttons.forEach((btn, index) => {
        const buttonElement = buildButtonHtml(btn, index);
        fragment.appendChild(buttonElement);
    });
    
    // Clear and append in one operation
    dom.grid.innerHTML = "";
    dom.grid.appendChild(fragment);
}

/**
 * Debounce function to limit execution frequency
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Sleep mode handlers
 */
export function enableSleepMode() {
    if (dom.sleepOverlay) {
        dom.sleepOverlay.classList.remove("hidden");
    }
}

export function disableSleepMode() {
    if (dom.sleepOverlay) {
        dom.sleepOverlay.classList.add("hidden");
    }
}

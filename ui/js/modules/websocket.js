/**
 * WebSocket Connection Manager
 * Handles connection, reconnection, and message routing
 */

import { config, dbg } from '../config.js';
import { toast, setPcStatus } from './ui-helpers.js';

let ws = null;
let wsReconnectTimer = null;
let wsReconnectDelay = config.wsReconnectMinMs;
let lastStatusTs = 0;
let onlineHosts = [];

// Callbacks for message handling
let messageHandlers = {
    status: null,
    config_updated: null,
    ack: null,
    error: null
};

/**
 * Register a message handler for a specific type
 * @param {string} type - Message type
 * @param {Function} handler - Handler function
 */
export function onMessage(type, handler) {
    messageHandlers[type] = handler;
}

/**
 * Get WebSocket URL based on environment
 * @returns {string} WebSocket URL
 */
function wsUrl() {
    return config.wsUrl;
}

/**
 * Clear reconnection timer
 */
function clearReconnectTimer() {
    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
    }
}

/**
 * Schedule WebSocket reconnection with exponential backoff
 */
function scheduleReconnect() {
    clearReconnectTimer();
    dbg(`Reconnect in ${wsReconnectDelay}ms`);
    wsReconnectTimer = setTimeout(() => {
        connectWs();
        wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, config.wsReconnectMaxMs);
    }, wsReconnectDelay);
}

/**
 * Reset reconnection delay to minimum
 */
function resetReconnectDelay() {
    wsReconnectDelay = config.wsReconnectMinMs;
}

/**
 * Connect to WebSocket server
 */
export function connectWs() {
    clearReconnectTimer();
    
    if (ws) {
        try {
            ws.close();
        } catch (e) {
            // Ignore
        }
        ws = null;
    }

    const url = wsUrl();
    dbg("Connecting WS:", url);
    ws = new WebSocket(url);

    ws.onopen = () => {
        dbg("WS connected");
        resetReconnectDelay();
        // Send hello message
        sendWs({ type: "hello", client: "ui" });
    };

    ws.onmessage = (e) => {
        try {
            const msg = JSON.parse(e.data);
            handleWsMessage(msg);
        } catch (err) {
            console.error("WS parse error:", err);
        }
    };

    ws.onerror = (e) => {
        dbg("WS error:", e);
    };

    ws.onclose = () => {
        dbg("WS closed");
        ws = null;
        setPcStatus(false, []);
        scheduleReconnect();
    };
}

/**
 * Handle incoming WebSocket message
 * @param {Object} msg - Parsed message
 */
function handleWsMessage(msg) {
    const type = msg.type;
    
    // Status updates
    if (type === "status") {
        lastStatusTs = Date.now();
        onlineHosts = msg.hosts || [];
        setPcStatus(msg.online, onlineHosts);
        
        if (messageHandlers.status) {
            messageHandlers.status(msg);
        }
        return;
    }

    // Config updates
    if (type === "config_updated") {
        toast("⚡ Configuration mise à jour", 2000);
        if (messageHandlers.config_updated) {
            messageHandlers.config_updated(msg.config);
        }
        return;
    }

    // Acknowledgments
    if (type === "ack") {
        const text = msg.message || "OK";
        toast(`✓ ${text}`, 1500);
        if (messageHandlers.ack) {
            messageHandlers.ack(msg);
        }
        return;
    }

    // Errors
    if (type === "error") {
        const text = msg.message || "Erreur";
        toast(`⚠ ${text}`, 2000);
        if (messageHandlers.error) {
            messageHandlers.error(msg);
        }
        return;
    }
}

/**
 * Send message through WebSocket
 * @param {Object} payload - Message to send
 * @returns {boolean} Success status
 */
export function sendWs(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        dbg("WS not ready");
        return false;
    }
    
    try {
        ws.send(JSON.stringify(payload));
        return true;
    } catch (e) {
        console.error("Send error:", e);
        return false;
    }
}

/**
 * Send command to PC
 * @param {Object} action - Action object
 * @param {string} target - Target PC (optional)
 */
export function sendCommand(action, target = null) {
    const cmd = {
        type: "cmd",
        action: action,
        id: Date.now().toString()
    };
    
    if (target) {
        cmd.target = target;
    }
    
    return sendWs(cmd);
}

/**
 * Get list of online hosts
 * @returns {Array<string>} Online hosts
 */
export function getOnlineHosts() {
    return [...onlineHosts];
}

/**
 * Check if any PC is online
 * @returns {boolean} Online status
 */
export function isPcOnline() {
    return onlineHosts.length > 0;
}

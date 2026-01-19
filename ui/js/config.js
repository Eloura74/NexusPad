/**
 * Configuration centrale de l'application NexusPad
 */

// Détection automatique environnement
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const hostname = window.location.hostname;

export const config = {
    // WebSocket
    wsUrl: isProduction 
        ? `ws://${hostname}:8765` 
        : 'ws://192.168.1.86:8765',
    
    // Timing
    pcTtlMs: 7000,                  // Offline si pas de status depuis 7s
    wsReconnectMinMs: 800,
    wsReconnectMaxMs: 4000,
    updateCheckInterval: 300000,    // 5 minutes
    
    // PC par défaut
    defaultPc: "BureauMSI",
    
    // Debug
    debug: false,
    
    // Version
    currentVersion: "0.76"
};

// Helper de logging si debug activé
export function dbg(...args) {
    if (config.debug) {
        console.log('[DEBUG]', ...args);
    }
}

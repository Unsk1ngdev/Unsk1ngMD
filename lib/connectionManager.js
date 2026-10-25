'use strict';

const { DisconnectReason } = require('@whiskeysockets/baileys');

/**
 * Gestor avanzado de estado y reconexión para Baileys (WhatsApp Web Socket)
 * Implementa:
 * - Exponential backoff con Jitter aleatorio
 * - Prevención de bucles infinitos con límite configurable de reintentos
 * - Clasificación estricta de códigos de desconexión oficiales de Baileys
 * - Mutex para evitar invocaciones simultáneas de startBot()
 * - Limpieza profunda de listeners y sockets huérfanos
 * - Restablecimiento de reintentos tras estabilidad comprobada
 */

const BASE_RECONNECT_DELAY_MS = 2500;
const MAX_RECONNECT_DELAY_MS = 60000;
const DEFAULT_MAX_RETRIES = 10;
const STABILITY_THRESHOLD_MS = 15000; // 15s de conexión ininterrumpida para considerar la sesión estable

class ConnectionManager {
    constructor() {
        this.retryCount = 0;
        this.fastRestartCount = 0;
        this.isStarting = false;
        this.reconnectTimer = null;
        this.stabilityTimer = null;
        this.activeSock = null;
        this.maxRetries = parseInt(process.env.MAX_RECONNECT_RETRIES || DEFAULT_MAX_RETRIES, 10);
    }

    /**
     * Evalúa si una desconexión admite reconexión automática según los códigos reales de Baileys
     * @param {number|undefined} statusCode - Código HTTP/WebSocket devuelto por lastDisconnect
     * @returns {Object} { canReconnect: boolean, action: string, reasonText: string }
     */
    evaluateDisconnection(statusCode) {
        // 1. Cierre definitivo solicitado desde el teléfono
        if (statusCode === DisconnectReason.loggedOut) {
            return {
                canReconnect: false,
                action: 'LOGGED_OUT',
                reasonText: 'Sesión cerrada desde el teléfono. Credenciales invalidadas (401).'
            };
        }

        // 2. Prohibido / cuenta suspendida
        if (statusCode === DisconnectReason.forbidden) {
            return {
                canReconnect: false,
                action: 'FORBIDDEN',
                reasonText: 'Acceso prohibido por WhatsApp (403).'
            };
        }

        // 3. Sesión reemplazada (abierta en otro cliente al mismo tiempo)
        if (statusCode === DisconnectReason.connectionReplaced) {
            return {
                canReconnect: false,
                action: 'CONFLICT',
                reasonText: 'La sesión fue abierta en otra instancia o cliente (440). Evitando bucle de conflicto.'
            };
        }

        // 4. Incompatibilidad de versión de multi-dispositivo
        if (statusCode === DisconnectReason.multideviceMismatch) {
            return {
                canReconnect: false,
                action: 'MISMATCH',
                reasonText: 'Incompatibilidad de versión de multi-dispositivo (411).'
            };
        }

        // 5. Sesión corrupta (badSession): permitir hasta 2 reintentos por si es transitorio
        if (statusCode === DisconnectReason.badSession) {
            if (this.retryCount >= 2) {
                return {
                    canReconnect: false,
                    action: 'BAD_SESSION',
                    reasonText: 'Archivos de sesión corruptos (500) persistentes tras varios intentos.'
                };
            }
            return {
                canReconnect: true,
                action: 'BAD_SESSION_RETRY',
                reasonText: 'Fallo interno de sesión (500). Reintentando recuperación...'
            };
        }

        // 6. Reinicio de stream solicitado por Baileys (frecuente y normal)
        if (statusCode === DisconnectReason.restartRequired) {
            return {
                canReconnect: true,
                isFastRestart: true,
                action: 'RESTART_REQUIRED',
                reasonText: 'Reinicio de stream solicitado por WhatsApp (515).'
            };
        }

        // 7. Límite de reintentos consecutivos alcanzado
        if (this.retryCount >= this.maxRetries) {
            return {
                canReconnect: false,
                action: 'MAX_RETRIES_EXCEEDED',
                reasonText: `Se superó el límite máximo de ${this.maxRetries} reintentos consecutivos sin éxito.`
            };
        }

        // 8. Desconexiones transitorias de red (timedOut, connectionClosed, unavailableService, etc.)
        const reasonName = Object.keys(DisconnectReason).find(k => DisconnectReason[k] === statusCode) || 'Desconocida';
        return {
            canReconnect: true,
            action: 'TRANSIENT',
            reasonText: `Desconexión transitoria: ${reasonName} (${statusCode || 'red'}).`
        };
    }

    /**
     * Calcula el tiempo de espera con Exponential Backoff y Jitter aleatorio
     * @param {boolean} isFastRestart - Si fue un código 515 (restartRequired)
     * @returns {number} Milisegundos a esperar antes de reconectar
     */
    calculateBackoffDelay(isFastRestart = false) {
        if (isFastRestart) {
            this.fastRestartCount = (this.fastRestartCount || 0) + 1;
            // Si ocurren hasta 3 reinicios 515 consecutivos, hacer reinicio rápido
            if (this.fastRestartCount <= 3) {
                return 1200; // Reinicio casi inmediato para 515 transitorio
            }
        } else {
            this.fastRestartCount = 0;
        }

        this.retryCount++;
        // Fórmula de retroceso exponencial: base * 1.8^(intentos - 1)
        const exponential = Math.min(
            BASE_RECONNECT_DELAY_MS * Math.pow(1.8, Math.max(0, this.retryCount - 1)),
            MAX_RECONNECT_DELAY_MS
        );

        // Jitter aleatorio (+/- 15%) para desincronizar reconexiones
        const jitter = Math.floor((Math.random() * 0.3 - 0.15) * exponential);
        return Math.max(1500, Math.floor(exponential + jitter));
    }

    /**
     * Marca el socket activo y configura la comprobación de estabilidad
     * @param {Object} sock - Instancia de Baileys
     */
    onConnectionOpen(sock) {
        this.activeSock = sock;
        this.isStarting = false;
        this.fastRestartCount = 0;

        // Cancelar temporizador previo si existía
        if (this.stabilityTimer) {
            clearTimeout(this.stabilityTimer);
        }

        // Una vez que la conexión permanezca abierta durante el umbral, restablecer fallos a 0
        this.stabilityTimer = setTimeout(() => {
            if (this.retryCount > 0) {
                this.retryCount = 0;
            }
            this.fastRestartCount = 0;
            this.stabilityTimer = null;
        }, STABILITY_THRESHOLD_MS);
    }

    /**
     * Cierra de forma segura el socket anterior eliminando todos los listeners
     * para evitar duplicación de eventos y fugas de memoria
     * @param {Object} sock - Socket a limpiar
     */
    cleanupSocket(sock = this.activeSock) {
        if (!sock) return;

        try {
            if (sock.ev && typeof sock.ev.removeAllListeners === 'function') {
                sock.ev.removeAllListeners();
            }

            if (sock.ws && typeof sock.ws.close === 'function') {
                sock.ws.close();
            }

            if (typeof sock.end === 'function') {
                sock.end(undefined);
            }
        } catch (_) {}

        if (sock === this.activeSock) {
            this.activeSock = null;
        }
        this.isStarting = false;
    }

    /**
     * Cancela temporizadores de reconexión activos
     */
    cancelPendingReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.stabilityTimer) {
            clearTimeout(this.stabilityTimer);
            this.stabilityTimer = null;
        }
    }

    /**
     * Agenda una reconexión controlada asegurando no duplicar temporizadores
     * @param {number} delayMs - Milisegundos a esperar
     * @param {Function} callback - Función a ejecutar (startBot)
     */
    scheduleReconnect(delayMs, callback) {
        this.cancelPendingReconnect();
        this.isStarting = false;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            callback();
        }, delayMs);
    }
}

module.exports = new ConnectionManager();

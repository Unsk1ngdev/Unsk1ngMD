'use strict';

/**
 * lib/stalkear.js
 * Gestor en memoria de sesiones de monitoreo de presencia.
 * El handler de presence.update en index.js llama a stalkear.handlePresence().
 */

// Map<targetJid, { ownerJid, lastStatus }>
const sessions = new Map();

const stalkear = {
    /** Activa el monitoreo de un JID para notificar al owner */
    add: (targetJid, ownerJid) => {
        const clean = targetJid.replace(/:\d+@/, '@');
        sessions.set(clean, { ownerJid, lastStatus: null });
    },

    /** Desactiva el monitoreo de un JID */
    remove: (targetJid) => {
        const clean = targetJid.replace(/:\d+@/, '@');
        return sessions.delete(clean);
    },

    /** Verifica si un JID está siendo monitoreado */
    isActive: (targetJid) => {
        const clean = targetJid.replace(/:\d+@/, '@');
        return sessions.has(clean);
    },

    /** Lista todos los JIDs monitoreados */
    all: () => [...sessions.entries()],

    /**
     * Maneja un evento de presencia de Baileys.
     * Llamar desde index.js: sock.ev.on('presence.update', ...)
     *
     * @param {object} sock     - Instancia de Baileys
     * @param {object} update   - { id, presences }
     */
    handlePresence: async (sock, update) => {
        try {
            const { id: targetJid, presences } = update;
            if (!targetJid || !presences) return;

            const clean   = targetJid.replace(/:\d+@/, '@');
            const session = sessions.get(clean);
            if (!session) return;

            const presence = presences[targetJid] || presences[clean];
            if (!presence) return;

            const status     = presence.lastKnownPresence; // 'available' | 'unavailable' | 'composing' ...
            const lastSeen   = presence.lastSeen ? new Date(presence.lastSeen * 1000).toLocaleString('es-DO', {
                timeZone: 'America/Santo_Domingo',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            }) : null;

            // Evitar spam: notificar solo si cambió el estado
            if (status === session.lastStatus) return;
            sessions.get(clean).lastStatus = status;

            const number = clean.split('@')[0];
            const hora   = new Date().toLocaleString('es-DO', {
                timeZone: 'America/Santo_Domingo',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            });

            let mensaje;
            if (status === 'available') {
                mensaje = [
                    `👁️ *STALKEAR — Conexión detectada*`,
                    ``,
                    `📱 Número: *+${number}*`,
                    `🟢 Estado: *En línea*`,
                    `🕐 Hora: *${hora}*`,
                    ``,
                    `_Unknown Codexツ</>_`
                ].join('\n');
            } else if (status === 'unavailable') {
                mensaje = [
                    `👁️ *STALKEAR — Desconexión detectada*`,
                    ``,
                    `📱 Número: *+${number}*`,
                    `🔴 Estado: *Desconectado*`,
                    `🕐 Hora: *${hora}*`,
                    lastSeen ? `👁️ Última vez: *${lastSeen}*` : '',
                    ``,
                    `_Unknown Codexツ</>_`
                ].filter(Boolean).join('\n');
            } else {
                return; // Ignorar composing, recording, etc.
            }

            await sock.sendMessage(session.ownerJid, { text: mensaje });

        } catch (err) {
            console.error('[stalkear] Error en handlePresence:', err.message);
        }
    }
};

module.exports = stalkear;

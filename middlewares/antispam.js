'use strict';

require('dotenv').config();
const database = require('../lib/database');
const groupSettings = require('../lib/groupSettings');
const logger = require('../lib/logger');

// Inicialización en memoria del tracker de spam global
global.spamTracker = global.spamTracker || new Map();

// Caché ligera de metadatos de grupo (30 segundos) con fallback ultra-rápido
const groupMetadataCache = new Map();

const getCachedGroupMetadata = async (sock, jid) => {
    const cached = groupMetadataCache.get(jid);
    const now = Date.now();
    if (cached && now - cached.timestamp < 30000) {
        return cached.data;
    }
    try {
        const metadata = await Promise.race([
            sock.groupMetadata(jid),
            new Promise((_, reject) => setTimeout(() => reject(new Error('groupMetadata timeout')), 3500))
        ]);
        if (metadata) {
            groupMetadataCache.set(jid, { data: metadata, timestamp: now });
            return metadata;
        }
    } catch (_) {
        if (cached?.data) return cached.data;
    }
    return cached?.data || null;
};

const cleanDigits = (id) => (id ? String(id).replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '') : '');
const cleanJid = (id) => (id ? String(id).replace(/:.*@/, '@').trim().toLowerCase() : '');

/**
 * Middleware de detección y mitigación de ráfagas de spam
 *
 * Modo estándar (antispam): Borra mensajes y advierte con mención (NUNCA expulsa a nadie).
 * Modo estricto (antispamkick): Solo expulsa si antispamkick está explícitamente activado.
 *
 * @param {import('@whiskeysockets/baileys').WASocket} sock - Instancia activa del socket de Baileys
 * @param {object} rawMsg - Mensaje recibido en messages.upsert
 * @returns {Promise<boolean>} true si el mensaje fue interceptado/bloqueado por spam; false si continúa normalmente
 */
const antispamMiddleware = async (sock, rawMsg) => {
    try {
        if (!rawMsg || !rawMsg.message) return false;

        const chatJid = cleanJid(rawMsg.chat || rawMsg.key?.remoteJid || '');

        // 1. EXCLUSIÓN: Solo opera en grupos
        if (!chatJid || !chatJid.endsWith('@g.us')) {
            return false;
        }

        // 2. VERIFICACIÓN CRÍTICA: ¿Está activado el antispam en este grupo?
        // Si está en 'off' o desactivado, ignorar completamente
        if (!groupSettings.isAntispamEnabled(chatJid)) {
            return false;
        }

        // 3. EXCLUSIONES DE EMISOR (BYPASS):
        // a) Mensajes del propio bot
        if (rawMsg.key?.fromMe) {
            return false;
        }

        const senderJid = cleanJid(rawMsg.sender || rawMsg.key?.participant || rawMsg.participant || '');
        const numero = cleanDigits(senderJid);
        const ownerNumber = cleanDigits(process.env.OWNER_NUMBER || '');

        // b) Creador o Dueños del bot
        if ((ownerNumber && numero === ownerNumber) || database.isOwner(senderJid, sock)) {
            return false;
        }

        // c) Administradores del grupo
        const groupMetadata = await getCachedGroupMetadata(sock, chatJid);
        const participants = groupMetadata?.participants || [];

        const senderParticipant = participants.find(p => {
            const pId = cleanDigits(p.id);
            const pLid = cleanDigits(p.lid);
            return (pId && pId === numero) || (pLid && pLid === numero);
        });

        const isSenderAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
        if (isSenderAdmin) {
            return false;
        }

        // 4. LÓGICA DE VENTANA DE RÁFAGA (5 mensajes en 5 segundos)
        const trackerKey = `${chatJid}_${numero || senderJid}`;
        const now = Date.now();
        const windowMs = 5000; // 5 segundos

        let record = global.spamTracker.get(trackerKey);

        if (!record || (now - record.firstMessage) > windowMs) {
            record = {
                count: 1,
                firstMessage: now,
                lastWarnTime: 0,
                warned: false,
                locked: false
            };
            global.spamTracker.set(trackerKey, record);
            return false; // Mensaje 1 dentro de ventana normal
        }

        // Incrementar conteo dentro de la ventana activa
        record.count += 1;

        // Mensajes del 2 al 4: flujo normal
        if (record.count < 5) {
            return false;
        }

        // 5. UMBRAL ALCANZADO (Mensaje 5 o posterior): SPAM CONFIRMADO
        const targetMention = `${numero}@s.whatsapp.net`;
        const mentions = [senderJid, targetMention];

        // Siempre borrar el mensaje que sobrepasa el límite
        try {
            await sock.sendMessage(chatJid, { delete: rawMsg.key });
        } catch (_) {}

        if (record.locked) {
            return true;
        }

        // Comprobar si este grupo tiene activado el modo expulsión (antispamkick)
        const isKickActive = groupSettings.isAntispamKickEnabled(chatJid);

        // A) MODO ANTISPAM ESTÁNDAR (O PRIMERA ADVERTENCIA):
        // Si antispamkick NO está activado, NUNCA expulsar a nadie. Solo avisar y borrar mensajes.
        if (!isKickActive || record.count < 7) {
            if (!record.warned || (now - record.lastWarnTime > 10000)) {
                record.locked = true;
                record.warned = true;
                record.lastWarnTime = now;

                try {
                    const kickWarning = isKickActive
                        ? ' Si continúas serás expulsado del grupo.'
                        : '';
                    await sock.sendMessage(chatJid, {
                        text: `⚠️ @${numero}, deja el spam. Envía tus mensajes con calma. Los mensajes excesivos serán eliminados.${kickWarning}`,
                        mentions
                    });
                } catch (err) {
                    logger.error('[ANTISPAM] Error enviando advertencia:', err.message);
                } finally {
                    record.locked = false;
                }
            }
            return true; // Mensaje interceptado y borrado
        }

        // B) MODO ANTISPAMKICK (Solo si antispamkick está ACTIVO y el usuario continuó tras ser advertido, count >= 7):
        if (isKickActive && record.count >= 7) {
            record.locked = true;

            const botNum = cleanDigits(sock.user?.id || sock.user?.jid);
            const botLid = cleanDigits(sock.user?.lid);

            const botParticipant = participants.find(p => {
                const pId = cleanDigits(p.id);
                const pLid = cleanDigits(p.lid);
                return (botNum && (pId === botNum || pLid === botNum)) ||
                       (botLid && (pId === botLid || pLid === botLid));
            });

            const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

            if (isBotAdmin) {
                try {
                    await sock.sendMessage(chatJid, {
                        text: `⛔ @${numero} ha sido expulsado del grupo por spam continuo tras ser advertido.`,
                        mentions
                    });

                    const expelJid = senderJid.replace(/:.*@/, '@');
                    await sock.groupParticipantsUpdate(chatJid, [expelJid], 'remove');
                    global.spamTracker.delete(trackerKey);
                } catch (expelErr) {
                    logger.error('[ANTISPAM] Error expulsando infractor de spam:', expelErr.message);
                } finally {
                    record.locked = false;
                }
            } else {
                try {
                    await sock.sendMessage(chatJid, {
                        text: `⚠️ @${numero} continúa haciendo spam, pero no tengo permisos de administrador para expulsarlo.`,
                        mentions
                    });
                } catch (warnErr) {
                    logger.error('[ANTISPAM] Error enviando aviso sin admin:', warnErr.message);
                } finally {
                    record.locked = false;
                }
            }

            return true;
        }

        return true;
    } catch (globalErr) {
        logger.error('[ANTISPAM MIDDLEWARE ERROR]:', globalErr.message);
        return false;
    }
};

/**
 * Limpia los registros de memoria de un grupo específico
 */
antispamMiddleware.resetChat = (chatJid) => {
    if (!global.spamTracker) return;
    const clean = cleanJid(chatJid);
    for (const key of global.spamTracker.keys()) {
        if (key.startsWith(clean)) {
            global.spamTracker.delete(key);
        }
    }
};

module.exports = antispamMiddleware;

require('dotenv').config();
const database = require('../lib/database');
const logger = require('../lib/logger');

// 1. Inicialización en memoria del tracker de spam global
global.spamTracker = global.spamTracker || new Map();

// Caché ligera de metadatos de grupo (30 segundos) para no saturar peticiones a WhatsApp
const groupMetadataCache = new Map();

const getCachedGroupMetadata = async (sock, jid) => {
    const cached = groupMetadataCache.get(jid);
    const now = Date.now();
    if (cached && now - cached.timestamp < 30000) {
        return cached.data;
    }
    try {
        const metadata = await sock.groupMetadata(jid);
        groupMetadataCache.set(jid, { data: metadata, timestamp: now });
        return metadata;
    } catch (_) {
        return null;
    }
};

/**
 * Normaliza cualquier JID extrayendo únicamente los dígitos numéricos
 */
const cleanDigits = (id) => (id ? String(id).replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '') : '');

/**
 * Middleware de detección y mitigación de ráfagas de spam
 * Regla: Máximo 3 mensajes en 10 segundos
 * 
 * @param {import('@whiskeysockets/baileys').WASocket} sock - Instancia activa del socket de Baileys
 * @param {object} rawMsg - Mensaje sin procesar recibido en messages.upsert
 * @returns {Promise<boolean>} true si el mensaje fue interceptado/bloqueado por spam; false si continúa normalmente
 */
const antispamMiddleware = async (sock, rawMsg) => {
    try {
        // Validar que sea un mensaje entrante real y no un evento de protocolo/reacción vacío
        if (!rawMsg || !rawMsg.message) return false;

        const chatJid = rawMsg.chat || rawMsg.key?.remoteJid || '';
        const senderJid = rawMsg.sender || rawMsg.key?.participant || rawMsg.participant || chatJid;

        // 3. EXCLUSIONES INMEDIATAS (BYPASS):

        // a) Ignorar chats privados (solo opera en grupos)
        if (!chatJid || !chatJid.endsWith('@g.us')) {
            return false;
        }

        // b) Ignorar mensajes generados por el propio bot
        if (rawMsg.key?.fromMe) {
            return false;
        }

        const numero = cleanDigits(senderJid);
        const ownerNumber = cleanDigits(process.env.OWNER_NUMBER || '');

        // c) Ignorar al creador del bot
        if ((ownerNumber && numero === ownerNumber) || database.isOwner(senderJid)) {
            return false;
        }

        // Obtener metadatos del grupo para verificar roles
        const groupMetadata = await getCachedGroupMetadata(sock, chatJid);
        const participants = groupMetadata?.participants || [];

        // d) Ignorar administradores del grupo
        const senderParticipant = participants.find(p => {
            const pId = cleanDigits(p.id);
            const pLid = cleanDigits(p.lid);
            return pId === numero || pLid === numero;
        });

        const isSenderAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
        if (isSenderAdmin) {
            return false;
        }

        // 1 & 2. LÓGICA DE VENTANA DESLIZANTE (3 mensajes en 10 segundos)
        const trackerKey = `${chatJid}_${senderJid}`;
        const now = Date.now();
        const windowMs = 10000; // 10 segundos

        let record = global.spamTracker.get(trackerKey);

        if (!record || now - record.firstMessage > windowMs) {
            // Reiniciar o iniciar nueva ventana de 10 segundos
            record = {
                count: 1,
                firstMessage: now,
                warned: false,
                locked: false
            };
            global.spamTracker.set(trackerKey, record);
            return false; // Mensaje 1: Permitir flujo normal
        }

        // Incrementar conteo dentro de la ventana activa
        record.count += 1;

        // Mensaje 2: Permitir flujo normal sin advertencia
        if (record.count === 2) {
            return false;
        }

        const targetMention = `${numero}@s.whatsapp.net`;
        const mentions = [senderJid, targetMention];

        // Intentar eliminar el mensaje de spam para mantener limpio el grupo
        try {
            await sock.sendMessage(chatJid, { delete: rawMsg.key });
        } catch (_) {}

        // Mutex para evitar envíos dobles por asincronía en ráfagas muy veloces
        if (record.locked) {
            return true;
        }

        // MENSAJE 3: Advertencia en el chat
        if (record.count === 3 && !record.warned) {
            record.locked = true;
            record.warned = true;

            try {
                await sock.sendMessage(chatJid, {
                    text: `⚠️ @${numero}, relájate. Límite de mensajes alcanzado (3 en 10s). El próximo provocará tu expulsión.`,
                    mentions
                });
            } catch (err) {
                logger.error('[ANTISPAM] Error enviando advertencia:', err.message);
            } finally {
                record.locked = false;
            }

            return true; // Interceptar mensaje
        }

        // MENSAJE 4 O POSTERIOR: Expulsión directa (antispamkick)
        if (record.count >= 4) {
            record.locked = true;

            // Determinar si el bot cuenta con permisos de administrador en el grupo
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
                    // 1. Notificar en el chat la expulsión
                    await sock.sendMessage(chatJid, {
                        text: `⛔ @${numero} ha sido expulsado por ignorar la advertencia de spam.`,
                        mentions
                    });

                    // 2. Normalizar JID primario para groupParticipantsUpdate (sin sufijos :device)
                    const expelJid = senderJid.replace(/:.*@/, '@');
                    await sock.groupParticipantsUpdate(chatJid, [expelJid], 'remove');

                    // 3. Limpiar registro del mapa de memoria
                    global.spamTracker.delete(trackerKey);
                } catch (expelErr) {
                    logger.error('[ANTISPAM] Error expulsando infractor de spam:', expelErr.message);
                } finally {
                    record.locked = false;
                }
            } else {
                // Si el bot NO es admin
                try {
                    await sock.sendMessage(chatJid, {
                        text: `⚠️ @${numero} superó el límite de spam, pero no tengo permisos de administrador para expulsarlo.`,
                        mentions
                    });
                } catch (warnErr) {
                    logger.error('[ANTISPAM] Error enviando aviso sin admin:', warnErr.message);
                } finally {
                    record.locked = false;
                }
            }

            return true; // Interceptar mensaje
        }

        return false;
    } catch (globalErr) {
        logger.error('[ANTISPAM MIDDLEWARE ERROR]:', globalErr.message);
        return false; // Ante cualquier error inesperado, no detener el bot
    }
};

module.exports = antispamMiddleware;


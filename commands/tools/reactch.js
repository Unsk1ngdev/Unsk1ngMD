'use strict';

/**
 * Comando: .reactch [url] [emoji/texto] [cantidad?]
 *
 * WhatsApp canales: el mismo emoji enviado N veces por la misma cuenta solo cuenta como 1
 * (WhatsApp colapsa reacciones iguales). Para lograr múltiples reacciones visibles
 * este comando ROTA emojis distintos en cada envío y distribuye entre Sub-Bots si están activos.
 *
 * Uso:
 *   .reactch https://whatsapp.com/channel/xxx/yyy 🔥       → 1 reacción
 *   .reactch https://whatsapp.com/channel/xxx/yyy 🔥 10    → rota 10 emojis distintos
 *   .reactch https://whatsapp.com/channel/xxx/yyy hola     → texto estilizado
 *   .reactch https://whatsapp.com/channel/xxx/yyy hola 5   → texto estilizado + rotación de emojis
 *   (O citando un mensaje reenviado de canal con .reactch 🔥 o .reactch hola 5)
 *
 * Permisos: Owner + Premium
 */

const database = require('../../lib/database');
const premium  = require('../../lib/premium');
const logger   = require('../../lib/logger');

// ── Pool de emojis para rotar en modo spam ──
// Se usan en orden circular para que cada reacción sea distinta
const EMOJI_POOL = [
    '🔥','❤️','😂','👍','😮','😢','🎉','💯','🤩','🥰',
    '👏','💪','🙏','✨','💥','🫶','😍','🤣','😱','🥳',
    '👀','💀','🤯','🫡','😎','🤙','💫','⚡','🌟','🎯',
    '🫠','😤','🤌','💣','🔑','👑','🍀','🎊','🚀','🛸'
];

// ── Fuente de texto estilizado (círculos negros) ──
const FUENTE = {
    a:'🅐',b:'🅑',c:'🅒',d:'🅓',e:'🅔',f:'🅕',g:'🅖',
    h:'🅗',i:'🅘',j:'🅙',k:'🅚',l:'🅛',m:'🅜',n:'🅝',
    o:'🅞',p:'🅟',q:'🅠',r:'🅡',s:'🅢',t:'🅣',u:'🅤',
    v:'🅥',w:'🅦',x:'🅧',y:'🅨',z:'🅩',
    á:'🅐',é:'🅔',í:'🅘',ó:'🅞',ú:'🅤',ñ:'🅝',
    '0':'⓿','1':'➊','2':'➋','3':'➌','4':'➍',
    '5':'➎','6':'➏','7':'➐','8':'➑','9':'➒'
};

const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;

function esEmoji(str) {
    return EMOJI_RE.test(String(str || '').trim());
}

function toEstilizado(texto) {
    return String(texto || '').toLowerCase().split('').map(c =>
        c === ' ' ? '␣' : (FUENTE[c] || c)
    ).join('');
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Genera el array de reacciones a enviar
// Si es emoji único + cantidad > 1 → rota desde ese emoji en el pool
// Si es texto → estilizado en la primera y rota el pool en las siguientes
function buildReacciones(textoRaw, cantidad) {
    if (cantidad <= 1) {
        return [esEmoji(textoRaw) ? textoRaw : toEstilizado(textoRaw)];
    }

    if (esEmoji(textoRaw)) {
        const base = String(textoRaw).trim();
        const idxBase = EMOJI_POOL.indexOf(base);
        const inicio  = idxBase >= 0 ? idxBase : 0;
        const lista   = [];
        for (let i = 0; i < cantidad; i++) {
            lista.push(EMOJI_POOL[(inicio + i) % EMOJI_POOL.length]);
        }
        return lista;
    } else {
        const base  = toEstilizado(textoRaw);
        const lista = [base];
        for (let i = 1; i < cantidad; i++) {
            lista.push(EMOJI_POOL[(i - 1) % EMOJI_POOL.length]);
        }
        return lista;
    }
}

const SPAM_MAX_OWNER   = 40;   // Máximo para Owner
const SPAM_MAX_PREMIUM = 15;   // Máximo para Premium
const SPAM_DELAY_MS    = 1000; // 1 s entre reacciones (anti-ban)

/**
 * Busca recursivamente el server_id dentro de los nodos XML de Baileys
 */
function extractServerId(node) {
    if (!node) return null;
    if (node.attrs?.server_id) return node.attrs.server_id;
    if (Array.isArray(node.content)) {
        for (const child of node.content) {
            const found = extractServerId(child);
            if (found) return found;
        }
    }
    return null;
}

module.exports = {
    name: 'reactch',
    alias: ['reaccionarcanal', 'chreact', 'rch', 'fakereact', 'boostch'],
    category: 'tools',
    desc: 'Reacciona a mensajes de canales de WhatsApp rotando emojis para múltiples reacciones visibles.',
    usage: '.reactch [url] [emoji/texto] [cantidad opcional]',
    groupOnly: false,
    adminOnly: false,
    ownerOnly: false,

    execute: async ({ sock, m, args, text, isOwner: paramOwner }) => {
        const jid    = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const isOwner = Boolean(
            paramOwner ||
            m.isOwner ||
            database.isOwner(sender, sock) ||
            database.isOwner(m.key?.participant, sock) ||
            Boolean(m.fromMe)
        );
        const isPremium = premium.isPremium(sender, sock) || isOwner;

        if (!isOwner && !isPremium) {
            return; // Silencioso
        }

        const rawInput = (text || (args && args.join(' ')) || '').trim();

        let targetJid = null;
        let targetServerId = null;
        let targetChannelName = null;
        let inviteCode = null;

        // 1. Detección automática si el usuario cita un mensaje reenviado de un canal
        const fwdInfo = m.quoted?.message?.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
                        m.quoted?.message?.contextInfo?.forwardedNewsletterMessageInfo ||
                        m.message?.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo;

        if (fwdInfo?.newsletterJid && fwdInfo?.serverMessageId) {
            targetJid = fwdInfo.newsletterJid;
            targetServerId = String(fwdInfo.serverMessageId);
            targetChannelName = fwdInfo.newsletterName || 'Canal de WhatsApp';
        }

        // 2. Extraer URL de WhatsApp Channel si está presente
        const urlMatch = rawInput.match(/https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/([0-9]+))?/i);
        let restoTexto = rawInput;

        if (urlMatch) {
            inviteCode = urlMatch[1];
            if (urlMatch[2]) {
                targetServerId = urlMatch[2];
            }
            restoTexto = rawInput.replace(urlMatch[0], '').trim();
        }

        // 3. Menú de ayuda si no se especificó URL ni mensaje citado
        if (!targetJid && !inviteCode) {
            const maxCant = isOwner ? SPAM_MAX_OWNER : SPAM_MAX_PREMIUM;
            return await sock.sendMessage(jid, {
                text:
                    `┏❐ 《 📡 REACT CANAL — REACCIONES PARA CANALES 》 ❐\n` +
                    `┃\n` +
                    `┃├◆ 📋 *Uso:* \`.reactch [url] [reacción] [cantidad]\`\n` +
                    `┃\n` +
                    `┃├◆ 🔥 *Un emoji:*\n` +
                    `┃  \`.reactch https://whatsapp.com/channel/xxx/yyy 🔥\`\n` +
                    `┃\n` +
                    `┃├◆ 💥 *Spam (rota emojis distintos, máx ${maxCant}):*\n` +
                    `┃  \`.reactch https://whatsapp.com/channel/xxx/yyy 🔥 15\`\n` +
                    `┃\n` +
                    `┃├◆ 🅐 *Texto estilizado:*\n` +
                    `┃  \`.reactch https://whatsapp.com/channel/xxx/yyy hola 5\`\n` +
                    `┃\n` +
                    `┃├◆ 💬 *Citando un post de canal:*\n` +
                    `┃  Responde al mensaje con: \`.reactch 🔥\` o \`.reactch hola 5\`\n` +
                    `┃\n` +
                    `┃├◆ ⚠️ *Nota:* El mismo emoji repetido solo cuenta\n` +
                    `┃  como 1 en WhatsApp. Al poner cantidad > 1\n` +
                    `┃  se rotan emojis distintos automáticamente.\n` +
                    `┃\n` +
                    `┃├◆ 🤖 *Red Multi-Cuenta:* Rota reacciones entre\n` +
                    `┃  el bot principal y los Sub-Bots conectados.\n` +
                    `┗❐\n\n` +
                    `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 4. Parsear reacción deseada y cantidad
        let cantidad = 1;
        let textoRaw = restoTexto;

        if (restoTexto) {
            const tokens = restoTexto.split(/\s+/).filter(Boolean);
            const ultimo = tokens[tokens.length - 1];

            if (/^\d+$/.test(ultimo) && tokens.length > 1) {
                const n = parseInt(ultimo, 10);
                if (n >= 1) {
                    cantidad = n;
                    textoRaw = tokens.slice(0, -1).join(' ').trim();
                }
            } else if (/^\d+$/.test(restoTexto)) {
                cantidad = parseInt(restoTexto, 10);
                textoRaw = '';
            }
        }

        if (!textoRaw) {
            textoRaw = '🔥';
        }

        // Limitar cantidad según permisos
        const maxCantidad = isOwner ? SPAM_MAX_OWNER : SPAM_MAX_PREMIUM;
        if (cantidad > maxCantidad) cantidad = maxCantidad;
        if (cantidad < 1) cantidad = 1;

        // Construir la lista de reacciones a enviar (con rotación inteligente)
        const reacciones = buildReacciones(textoRaw, cantidad);

        await m.react('⏳');

        // 5. Resolver metadata del canal mediante invite code
        if (inviteCode && !targetJid) {
            try {
                const datosCanal = await sock.newsletterMetadata('invite', inviteCode);
                if (!datosCanal?.id) {
                    await m.react('❌');
                    return await sock.sendMessage(jid, {
                        text: `❌ No se pudo resolver la información del canal.\n` +
                              `💡 Verifica que el link sea de un canal válido.\n\n` +
                              `_Unknown Codexツ</>_`
                    }, { quoted: m });
                }
                targetJid = datosCanal.id;
                targetChannelName = datosCanal.name || inviteCode;
            } catch (err) {
                logger.error('[REACTCH] Error obteniendo info del canal:', err.message);
                await m.react('❌');
                return await sock.sendMessage(jid, {
                    text: `❌ No se pudo acceder al canal.\n` +
                          `📋 Error: ${err.message || 'Canal no encontrado'}\n\n` +
                          `💡 Verifica que el link sea de un canal válido.\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }
        }

        // 6. Autodetectar ID del último post si no se especificó
        if (!targetServerId && targetJid) {
            try {
                const fetchRes = await sock.newsletterFetchMessages(targetJid, 1);
                targetServerId = extractServerId(fetchRes);
            } catch (_) {}

            if (!targetServerId) {
                await m.react('❌');
                return await sock.sendMessage(jid, {
                    text: `❌ URL incompleta o ID de mensaje no detectado.\n` +
                          `📌 Formato: *https://whatsapp.com/channel/ID_CANAL/ID_MENSAJE*\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }
        }

        // 7. Detectar sockets disponibles (Bot Principal + Sub-Bots activos)
        const availableSockets = [{ label: 'Bot Principal', sock }];
        if (global.subBots && global.subBots.size > 0) {
            for (const [phone, botData] of global.subBots.entries()) {
                if (botData?.sock && typeof botData.sock.newsletterReactMessage === 'function') {
                    availableSockets.push({
                        label: `Sub-Bot (+${phone})`,
                        sock: botData.sock
                    });
                }
            }
        }

        // 8. Envío de reacciones con rotación y delay
        let enviadas = 0;
        let errores  = 0;

        if (cantidad === 1) {
            for (let i = 0; i < availableSockets.length; i++) {
                const current = availableSockets[i];
                try {
                    await current.sock.newsletterReactMessage(targetJid, targetServerId, reacciones[0]);
                    enviadas++;
                } catch (err) {
                    errores++;
                    logger.warn(`[REACTCH] Error enviando reacción desde ${current.label}:`, err.message);
                }
            }
        } else {
            for (let i = 0; i < reacciones.length; i++) {
                const current = availableSockets[i % availableSockets.length];
                try {
                    await current.sock.newsletterReactMessage(targetJid, targetServerId, reacciones[i]);
                    enviadas++;
                } catch (err) {
                    errores++;
                    logger.warn(`[REACTCH] Error en rotación reacción ${i + 1}:`, err.message);
                }

                if (i < reacciones.length - 1) {
                    await sleep(SPAM_DELAY_MS);
                }
            }
        }

        await m.react(enviadas > 0 ? '✅' : '❌');

        if (enviadas === 0) {
            return await sock.sendMessage(jid, {
                text: `❌ No se pudo enviar ninguna reacción al canal.\n\n` +
                      `💡 *Posibles causas:*\n` +
                      `1. El canal tiene las reacciones desactivadas por el creador.\n` +
                      `2. El mensaje especificado no existe o fue eliminado.\n` +
                      `3. Restricción temporal de WhatsApp para reacciones en este canal.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        const nombreCanal = targetChannelName || 'Canal de WhatsApp';
        const subBotsCount = availableSockets.length - 1;
        const subBotDetail = subBotsCount > 0 ? ` (1 Principal + ${subBotsCount} Sub-Bots)` : '';

        const resumen = cantidad === 1
            ? `┏❐ 《 ⚡ *REACCIÓN ENVIADA A CANAL* 》 ❐\n` +
              `┃\n` +
              `┃├◆ 📢 *Canal:* ${nombreCanal}\n` +
              `┃├◆ 🆔 *Post ID:* #${targetServerId}\n` +
              `┃├◆ 🎭 *Reacción:* ${reacciones[0]}\n` +
              `┃├◆ 🤖 *Cuentas:* ${enviadas}${subBotDetail}\n` +
              `┃├◆ 📡 *Estado:* ✅ Inyección exitosa\n` +
              `┃\n` +
              `┗❐`
            : `┏❐ 《 💥 *SPAM DE REACCIONES ENVIADO* 》 ❐\n` +
              `┃\n` +
              `┃├◆ 📢 *Canal:* ${nombreCanal}\n` +
              `┃├◆ 🆔 *Post ID:* #${targetServerId}\n` +
              `┃├◆ 📊 *Enviadas:* ${enviadas}/${reacciones.length}${errores > 0 ? ` (${errores} fallaron)` : ''}\n` +
              `┃├◆ 🎭 *Emojis rotados:* ${reacciones.slice(0, 5).join(' ')}${reacciones.length > 5 ? ' ...' : ''}\n` +
              `┃├◆ ⏱️ *Intervalo:* 1.0s (Protección Anti-Ban)\n` +
              `┃\n` +
              `┗❐`;

        return await sock.sendMessage(jid, {
            text: `${resumen}\n\n_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

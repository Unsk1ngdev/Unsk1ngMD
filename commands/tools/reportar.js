'use strict';

/**
 * Comando: .reportar [@usuario | número] [cantidad]
 * Alias: .reporta, .report, .spam
 * Solo el OWNER y Sub-Bots autorizados pueden ejecutarlo.
 *
 * Flujo:
 *  1. El bot principal envía N reportes IQ spam.
 *  2. Cada sub-bot conectado (global.subBots Map) también envía N reportes.
 *  3. Cada bot/sub-bot manda una notificación privada al owner (+1).
 *  4. Se envía un resumen final privado al owner (+1) con el gran total.
 *  5. Se confirma en el grupo/chat con el total combinado.
 */

const DEFAULT_AMT = 10;
const MAX_AMT     = 50;
const DELAY_MS    = 1000;

const config   = require('../../config');
const database = require('../../lib/database');

// Propietario objetivo prioritario (+1) para recibir los reportes y notificaciones
const PRIMARY_PLUS1_OWNER = config.ownerNumbers?.find(n => n.startsWith('1')) || '18494509905';
const TARGET_OWNER_JID = `${PRIMARY_PLUS1_OWNER}@s.whatsapp.net`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ID de mensaje aleatorio de 20 chars (mayúsculas + dígitos) */
const randomMsgId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < 20; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
};

/** Hora formateada para República Dominicana */
const horaRD = () =>
    new Date().toLocaleString('es-DO', {
        timeZone: 'America/Santo_Domingo',
        hour:   '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

/**
 * Envía un reporte de spam usando el IQ de WhatsApp vía sock.query().
 * Devuelve true si tuvo éxito.
 */
async function enviarReporte(sockInst, targetJid) {
    if (!sockInst || typeof sockInst.query !== 'function') return false;
    const encoder    = new TextEncoder();
    const uint8Array = encoder.encode('texto do report');

    try {
        await sockInst.query({
            tag: 'iq',
            attrs: {
                id:    sockInst.generateMessageTag(),
                type:  'set',
                to:    '@s.whatsapp.net',
                xmlns: 'spam'
            },
            content: [{
                tag: 'spam_list',
                attrs: {
                    jid:       targetJid,
                    spam_flow: 'message_menu'
                },
                content: [{
                    tag: 'message',
                    attrs: {
                        t:    (Date.now() - 10_000).toString(),
                        id:   randomMsgId(),
                        type: 'text',
                        from: targetJid
                    },
                    content: [{
                        tag:     'raw',
                        attrs:   { v: '2' },
                        content: uint8Array
                    }]
                }]
            }]
        }, 3500);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Ejecuta una ronda de reportes con un sock dado.
 * Devuelve la cantidad de reportes exitosos.
 */
async function ejecutarReportes(sockInst, targetJid, cantidad) {
    let exitosos = 0;
    for (let i = 0; i < cantidad; i++) {
        const ok = await enviarReporte(sockInst, targetJid);
        if (ok) exitosos++;
        await sleep(DELAY_MS);
    }
    return exitosos;
}

module.exports = {
    name: 'reportar',
    alias: ['report', 'spam', 'reporta'],
    category: 'tools',
    desc: 'Envía reportes de spam a un número usando el protocolo IQ de WhatsApp (Owner y Sub-bots)',
    usage: '.reportar [@usuario | número] [cantidad]',
    groupOnly: false,
    adminOnly: false,
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        // Validación de permisos: admitir owner principal, sub-bots registrados y mensajes propios
        const cleanSender = (m.sender || '').replace(/[^0-9]/g, '');
        const isSubBotSender = global.subBots && Array.from(global.subBots.keys()).some(k => cleanSender.includes(k));
        const isAllowed = isOwner || m.fromMe || isSubBotSender || database.isOwner(m.sender, sock);
        if (!isAllowed) return; // Silencioso si no está autorizado

        // ── Mutex de Concurrencia (Evita tormentas concurrentes si Main Bot y Sub-bot reciben el comando) ──
        if (global.isReportingActive) {
            try {
                await sock.sendMessage(m.chat, {
                    text: '⏳ *[EN PROCESO]* Ya hay una ronda de reportes en ejecución. Por favor espera a que finalice.'
                }, { quoted: m });
            } catch (_) {}
            return;
        }

        // ── 1. Resolver JID del objetivo ──────────────────────────────────────
        let targetJid = null;

        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        }

        if (!targetJid && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) targetJid = `${raw}@s.whatsapp.net`;
        }

        if (!targetJid || targetJid === 'undefined@s.whatsapp.net') {
            return await sock.sendMessage(m.chat, {
                text: '❌ Menciona a alguien o proporciona un número.\n\n*Uso:* `.reportar @usuario 10` o `.reporta 1849xxxxxxx 10`'
            }, { quoted: m });
        }

        // ── 2. Resolver cantidad ──────────────────────────────────────────────
        const hasMention = m.mentionedJid?.length > 0;
        const rawAmt     = hasMention ? args[1] : (args[1] ?? args[0]);
        let cantidad = parseInt(rawAmt, 10);
        if (isNaN(cantidad) || cantidad < 1) cantidad = DEFAULT_AMT;
        if (cantidad > MAX_AMT) cantidad = MAX_AMT;

        const targetDisplay = targetJid.split('@')[0];

        // JID del owner al que SIEMPRE deben llegar los mensajes (+1)
        const primaryOwnerJid = TARGET_OWNER_JID;
        const callerJid = m.sender && m.sender.includes('@') ? m.sender : `${cleanSender}@s.whatsapp.net`;

        global.isReportingActive = true;
        try {
            // ── 3. Anuncio en el grupo / chat ─────────────────────────────────────
            try {
                await m.react('⏳');
            } catch (_) {}

            await sock.sendMessage(m.chat, {
                text: [
                    `📤 *Enviando ${cantidad} reportes a* \`${targetDisplay}\``,
                    `🔄 Procesando con socket activo y sub-bots disponibles...`
                ].join('\n')
            }, { quoted: m });

            // Identificar si el socket que ejecuta es el bot principal o un sub-bot
            const mainSock = global.mainSock || sock;
            const isExecutingFromSubBot = Boolean(global.mainSock && sock !== global.mainSock);

            // ── 4. Ejecución del primer socket (el que recibió el comando) ────────
            const firstSocketName = isExecutingFromSubBot ? `Sub-Bot (+${cleanSender})` : 'Bot Principal';
            const exitososPrimero = await ejecutarReportes(sock, targetJid, cantidad);
            const hora = horaRD();

            // Notificación privada directa al Owner (+1)
            const notificarOwner = async (socketInst, texto) => {
                try {
                    await socketInst.sendMessage(primaryOwnerJid, { text: texto });
                } catch (_) {
                    // Intento de fallback con el socket principal si el sub-bot no pudo enviar
                    if (mainSock && socketInst !== mainSock) {
                        try {
                            await mainSock.sendMessage(primaryOwnerJid, { text: texto });
                        } catch (_) {}
                    }
                }
            };

            await notificarOwner(sock, [
                `📊 *Reporte - ${firstSocketName}*`,
                ``,
                `👤 Número reportado: *${targetDisplay}*`,
                `✅ Reportes enviados: *${exitososPrimero}/${cantidad}*`,
                `🕐 Hora: *${hora}*`,
                ``,
                `_Unknown Codexツ</>_`
            ].join('\n'));

            // ── 5. Coordinación con sockets adicionales (Main Bot y otros Sub-bots) ──
            let totalOtros = 0;
            let resumenOtros = '';
            const subBots = global.subBots; // Map<number, { sock, ... }>

            // Si fue ejecutado desde un sub-bot, el bot principal también aporta su ronda si está disponible
            if (isExecutingFromSubBot && global.mainSock) {
                let exitososMain = 0;
                try {
                    exitososMain = await ejecutarReportes(global.mainSock, targetJid, cantidad);
                    totalOtros += exitososMain;
                    resumenOtros += `\n  • Bot Principal: *${exitososMain}* reportes`;

                    await sleep(350);
                    await notificarOwner(global.mainSock, [
                        `📊 *Reporte - Bot Principal*`,
                        ``,
                        `👤 Número reportado: *${targetDisplay}*`,
                        `✅ Reportes enviados: *${exitososMain}/${cantidad}*`,
                        `🕐 Hora: *${horaRD()}*`,
                        ``,
                        `_Unknown Codexツ</>_`
                    ].join('\n'));
                } catch (_) {}
            }

            // Ejecutar con todos los sub-bots conectados restantes (evitando duplicar el que ya reportó)
            if (subBots && subBots.size > 0) {
                let idx = 1;
                for (const [subNum, data] of subBots.entries()) {
                    const subSock = data?.sock;
                    if (!subSock || subSock === sock) {
                        idx++;
                        continue;
                    }

                    // Verificar si el socket del sub-bot sigue conectado y abierto
                    if (subSock.ws && typeof subSock.ws.isOpen === 'boolean' && !subSock.ws.isOpen) {
                        idx++;
                        continue;
                    }

                    let exitososSub = 0;
                    try {
                        exitososSub = await ejecutarReportes(subSock, targetJid, cantidad);
                    } catch (_) {}

                    totalOtros += exitososSub;
                    resumenOtros += `\n  • Sub-Bot #${idx} (+${subNum}): *${exitososSub}* reportes`;

                    // Cada sub-bot envía su reporte directamente al Owner (+1) con intervalo seguro
                    try {
                        await sleep(350);
                        await notificarOwner(subSock, [
                            `📊 *Reporte - Sub-Bot #${idx} (+${subNum})*`,
                            ``,
                            `👤 Número reportado: *${targetDisplay}*`,
                            `✅ Reportes enviados: *${exitososSub}/${cantidad}*`,
                            `🕐 Hora: *${horaRD()}*`,
                            ``,
                            `_Unknown Codexツ</>_`
                        ].join('\n'));
                    } catch (_) {}

                    idx++;
                }
            }

            // ── 6. Resumen final privado al Owner (+1) ────────────────────────────
            const granTotal = exitososPrimero + totalOtros;
            const horaFinal = horaRD();

            const resumenFinalMsg = [
                `━━━━━━━━━━━━━━━`,
                `📋 *RESUMEN FINAL DE REPORTES*`,
                `━━━━━━━━━━━━━━━`,
                ``,
                `👤 Número reportado: *${targetDisplay}*`,
                `⚡ Solicitado desde: *${firstSocketName}*`,
                ``,
                `🤖 ${firstSocketName}: *${exitososPrimero}* reportes` +
                (resumenOtros || '\n  • Sin otros sockets/sub-bots conectados'),
                ``,
                `🔥 *Gran total: ${granTotal} reportes*`,
                `🕐 Completado: *${horaFinal}*`,
                ``,
                `━━━━━━━━━━━━━━━`,
                `_Unknown Codexツ</>_`
            ].join('\n');

            await sleep(350);
            // Notificar siempre al Owner +1
            await notificarOwner(sock, resumenFinalMsg);

            // Si el ejecutor es otro Owner distinto a +1 (ej: 584160666286), enviarle copia también
            if (callerJid && callerJid !== primaryOwnerJid && isOwner) {
                try {
                    await sleep(350);
                    await sock.sendMessage(callerJid, { text: resumenFinalMsg });
                } catch (_) {}
            }

            // ── 7. Confirmación pública en el grupo / chat ────────────────────────
            try {
                await m.react('✅');
            } catch (_) {}

            await sock.sendMessage(m.chat, {
                text: [
                    `✅ *Reportes completados*`,
                    ``,
                    `📊 Total: *${granTotal}* reportes enviados`,
                    `👤 Número: *${targetDisplay}*`,
                    `📩 Notificaciones enviadas al Owner (+1)`,
                    ``,
                    `_Unknown Codexツ</>_`
                ].join('\n')
            }, { quoted: m });
        } finally {
            global.isReportingActive = false;
        }
    }
};

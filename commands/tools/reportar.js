'use strict';

/**
 * Comando: .reportar [@usuario | número] [cantidad]
 * Solo el OWNER puede ejecutarlo.
 *
 * Flujo:
 *  1. El bot principal envía N reportes IQ spam.
 *  2. Cada sub-bot conectado (global.subBots Map) también envía N reportes.
 *  3. Cada sub-bot manda un MP privado al owner con su resultado.
 *  4. El bot principal manda un resumen final privado con el gran total.
 *  5. Se confirma en el grupo con el total combinado.
 */

const DEFAULT_AMT = 10;
const MAX_AMT     = 50;
const DELAY_MS    = 500;

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
        });
        return true;
    } catch (err) {
        console.log('[reportar] Error reporte:', err.message);
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
    alias: ['report', 'spam'],
    category: 'tools',
    desc: 'Envía reportes de spam a un número usando el protocolo IQ de WhatsApp (solo owner)',
    usage: '.reportar [@usuario | número] [cantidad]',
    groupOnly: false,
    adminOnly: false,
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner) return; // Silencioso si no es owner

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
                text: '❌ Menciona a alguien o proporciona un número.\n\n*Uso:* `.reportar @usuario 10`'
            }, { quoted: m });
        }

        // ── 2. Resolver cantidad ──────────────────────────────────────────────
        const hasMention = m.mentionedJid?.length > 0;
        const rawAmt     = hasMention ? args[1] : (args[1] ?? args[0]);
        let cantidad = parseInt(rawAmt, 10);
        if (isNaN(cantidad) || cantidad < 1) cantidad = DEFAULT_AMT;
        if (cantidad > MAX_AMT) cantidad = MAX_AMT;

        const targetDisplay = targetJid.split('@')[0];

        // JID del owner para mensajes privados
        const ownerJid = m.sender.includes('@') ? m.sender : `${m.sender}@s.whatsapp.net`;

        // ── 3. Anuncio en el grupo / chat ─────────────────────────────────────
        await m.react('⏳');
        await sock.sendMessage(m.chat, {
            text: [
                `📤 *Enviando ${cantidad} reportes a* \`${targetDisplay}\``,
                `🔄 Procesando...`
            ].join('\n')
        }, { quoted: m });

        // ── 4. Bot principal reportando ───────────────────────────────────────
        const exitososPrincipal = await ejecutarReportes(sock, targetJid, cantidad);
        const hora              = horaRD();

        // Notificación privada del bot principal al owner
        await sock.sendMessage(ownerJid, {
            text: [
                `📊 *Reporte - Bot Principal*`,
                ``,
                `👤 Número reportado: *${targetDisplay}*`,
                `✅ Reportes enviados: *${exitososPrincipal}/${cantidad}*`,
                `🕐 Hora: *${hora}*`,
                ``,
                `_Unknown Codexツ</>_`
            ].join('\n')
        });

        // ── 5. Sub-bots reportando ────────────────────────────────────────────
        let totalSubBots    = 0;
        let resumenSubBots  = '';
        const subBots       = global.subBots; // Map<number, { sock, ... }>

        if (subBots && subBots.size > 0) {
            let idx = 1;
            for (const [, data] of subBots.entries()) {
                const subSock = data?.sock;
                if (!subSock) { idx++; continue; }

                let exitososSub = 0;
                try {
                    exitososSub = await ejecutarReportes(subSock, targetJid, cantidad);
                } catch (err) {
                    console.warn(`[reportar] Sub-Bot #${idx} falló:`, err.message);
                }

                totalSubBots   += exitososSub;
                resumenSubBots += `\n  • Sub-Bot #${idx}: *${exitososSub}* reportes`;

                // Cada sub-bot notifica al owner directamente
                try {
                    await subSock.sendMessage(ownerJid, {
                        text: [
                            `📊 *Reporte - Sub-Bot #${idx}*`,
                            ``,
                            `👤 Número reportado: *${targetDisplay}*`,
                            `✅ Reportes enviados: *${exitososSub}/${cantidad}*`,
                            `🕐 Hora: *${horaRD()}*`,
                            ``,
                            `_Unknown Codexツ</>_`
                        ].join('\n')
                    });
                } catch (err) {
                    console.warn(`[reportar] Sub-Bot #${idx} no pudo notificar al owner:`, err.message);
                }

                idx++;
            }
        }

        // ── 6. Resumen final privado al owner ─────────────────────────────────
        const granTotal     = exitososPrincipal + totalSubBots;
        const sinSubBots    = !subBots || subBots.size === 0;
        const horaFinal     = horaRD();

        await sock.sendMessage(ownerJid, {
            text: [
                `━━━━━━━━━━━━━━━`,
                `📋 *RESUMEN FINAL*`,
                `━━━━━━━━━━━━━━━`,
                ``,
                `👤 Número reportado: *${targetDisplay}*`,
                ``,
                `🤖 Bot principal: *${exitososPrincipal}* reportes` +
                (sinSubBots
                    ? '\n  • Sin sub-bots conectados'
                    : resumenSubBots),
                ``,
                `🔥 *Gran total: ${granTotal} reportes*`,
                `🕐 Completado: *${horaFinal}*`,
                ``,
                `━━━━━━━━━━━━━━━`,
                `_Unknown Codexツ</>_`
            ].join('\n')
        });

        // ── 7. Confirmación pública en el grupo / chat ────────────────────────
        await m.react('✅');
        await sock.sendMessage(m.chat, {
            text: [
                `✅ *Reportes completados*`,
                ``,
                `📊 Total: *${granTotal}* reportes enviados`,
                `👤 Número: *${targetDisplay}*`,
                ``,
                `_Unknown Codexツ</>_`
            ].join('\n')
        }, { quoted: m });
    }
};

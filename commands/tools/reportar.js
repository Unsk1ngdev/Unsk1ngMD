'use strict';

/**
 * Comando: .reportar [@usuario | número] [cantidad]
 * Descripción: Envía N reportes de spam a un número de WhatsApp.
 *
 * Uso:
 *   .reportar @usuario          → 10 reportes (por defecto)
 *   .reportar @usuario 20       → 20 reportes
 *   .reportar 5491134567890 15  → 15 reportes al número indicado
 *
 * Nota: La efectividad del reporte depende de la API interna de WhatsApp
 *       y de la versión de Baileys. Los fallos individuales se contabilizan
 *       y se informan al final sin interrumpir el proceso.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Genera una cadena aleatoria de N caracteres (mayúsculas + dígitos) */
const randomId = (len = 20) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
};

const MAX_REPORTS  = 50;  // límite de seguridad para evitar abusos
const DEFAULT_AMT  = 10;
const DELAY_MS     = 500; // ms entre cada reporte

/**
 * Intenta enviar un reporte de spam mediante IQ de Baileys.
 * Devuelve true si tuvo éxito, false si falló.
 */
async function sendSpamReport(sock, targetJid) {
    try {
        const msgId = randomId(20);
        const enc   = new TextEncoder();
        await sock.query({
            tag: 'iq',
            attrs: {
                id:   sock.generateMessageTag(),
                type: 'set',
                xmlns: 'spam',
                to:   'spam@v.whatsapp.net'
            },
            content: [
                {
                    tag: 'report',
                    attrs: { jid: targetJid, type: 'spam' },
                    content: enc.encode(msgId)
                }
            ]
        });
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    name: 'reportar',
    alias: ['report', 'spam'],
    category: 'tools',
    desc: 'Envía múltiples reportes de spam a un número de WhatsApp',
    usage: '.reportar [@usuario | número] [cantidad]',
    groupOnly: false,
    adminOnly: false,

    execute: async ({ sock, m, args, isOwner }) => {
        // ── 1. Solo el owner puede usar este comando ─────────────────────────
        if (!isOwner) {
            return await sock.sendMessage(m.chat, {
                text: '🚫 Solo el dueño del bot puede usar este comando.'
            }, { quoted: m });
        }

        // ── 2. Resolver JID del objetivo ──────────────────────────────────────
        let targetJid = null;

        // Prioridad: mención en el mensaje
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        }

        // Si no hay mención, usar el primer argumento como número
        if (!targetJid && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                targetJid = `${raw}@s.whatsapp.net`;
            }
        }

        if (!targetJid) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Debes mencionar a alguien o indicar un número.\n\n*Uso:* `.reportar @usuario [cantidad]`'
            }, { quoted: m });
        }

        // ── 3. Resolver cantidad ──────────────────────────────────────────────
        // El segundo argumento (o primero si no hay mención) es la cantidad
        const rawAmount = m.mentionedJid?.length > 0 ? args[1] : args[1] ?? args[0];
        let amount = parseInt(rawAmount, 10);
        if (isNaN(amount) || amount < 1) amount = DEFAULT_AMT;
        if (amount > MAX_REPORTS) amount = MAX_REPORTS;

        // ── 4. Informar inicio ────────────────────────────────────────────────
        await m.react('⏳');
        await sock.sendMessage(m.chat, {
            text: `🚨 Enviando *${amount}* reportes a \`${targetJid.split('@')[0]}\`...\n_Por favor espera._`
        }, { quoted: m });

        // ── 5. Enviar reportes ────────────────────────────────────────────────
        let success = 0;
        let failed  = 0;

        for (let i = 0; i < amount; i++) {
            const ok = await sendSpamReport(sock, targetJid);
            if (ok) success++;
            else    failed++;
            await sleep(DELAY_MS);
        }

        // ── 6. Resumen ────────────────────────────────────────────────────────
        await m.react(success > 0 ? '✅' : '❌');

        const summary = [
            `📊 *Reporte finalizado*`,
            `👤 Objetivo: \`${targetJid.split('@')[0]}\``,
            `✅ Enviados con éxito: *${success}*`,
            `❌ Fallidos: *${failed}*`,
            success === 0
                ? '\n⚠️ Ningún reporte fue aceptado. Puede deberse a limitaciones de la API de WhatsApp.'
                : ''
        ].filter(Boolean).join('\n');

        await sock.sendMessage(m.chat, { text: summary }, { quoted: m });
    }
};

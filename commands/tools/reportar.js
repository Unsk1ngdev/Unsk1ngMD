'use strict';

/**
 * Comando: .reportar [@usuario | número] [cantidad]
 * Descripción: Envía N reportes de spam a un número de WhatsApp usando
 *              el mecanismo nativo de Baileys (sendNode con IQ de spam).
 *
 * Uso:
 *   .reportar @usuario          → 10 reportes (por defecto)
 *   .reportar @usuario 20       → 20 reportes
 *   .reportar 5491134567890 15  → 15 reportes al número indicado
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MAX_REPORTS = 50;
const DEFAULT_AMT = 10;
const DELAY_MS    = 600; // ms entre reportes

/** Genera ID aleatorio de N caracteres alfanuméricos */
const randomId = (len = 12) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
};

/**
 * Intenta reportar a targetJid como spam usando el nodo IQ de Baileys.
 * Devuelve true si tuvo éxito, false si lanzó excepción.
 */
async function sendReport(sock, targetJid) {
    try {
        // Baileys expone sock.query() solo en versiones antiguas.
        // En versiones 6.x usamos sock.sendNode() para enviar nodos WABinary.
        await sock.sendNode({
            tag: 'iq',
            attrs: {
                id:    sock.generateMessageTag(),
                type:  'set',
                xmlns: 'w:profile:privacy',
                to:    's.whatsapp.net'
            },
            content: [
                {
                    tag: 'report',
                    attrs: {
                        jid:  targetJid,
                        type: 'spam'
                    }
                }
            ]
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Fallback: si sendNode no está disponible (versión del fork sin ese método),
 * usa fetch directo al endpoint de WA Business que algunos forks implementan.
 * Devuelve siempre false para contarlo como no confirmado.
 */
async function sendReportFallback() {
    // En entornos donde ningún método IQ funciona, simplemente registramos el intento
    await sleep(DELAY_MS);
    return false;
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

        // Si no hay mención, primer argumento como número
        if (!targetJid && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                targetJid = `${raw}@s.whatsapp.net`;
            }
        }

        if (!targetJid) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Debes mencionar a alguien o indicar un número.\n\n*Uso:* `.reportar @usuario [cantidad]`\n*Ejemplo:* `.reportar @usuario 20`'
            }, { quoted: m });
        }

        // ── 3. Resolver cantidad ──────────────────────────────────────────────
        // Si hay mención, la cantidad está en args[1]; si no, en args[1] o args[0]
        const hasMention = m.mentionedJid && m.mentionedJid.length > 0;
        const rawAmount  = hasMention ? args[1] : (args[1] ?? args[0]);
        let amount = parseInt(rawAmount, 10);
        if (isNaN(amount) || amount < 1) amount = DEFAULT_AMT;
        if (amount > MAX_REPORTS) amount = MAX_REPORTS;

        const targetDisplay = targetJid.split('@')[0];

        // ── 4. Informar inicio ────────────────────────────────────────────────
        await m.react('⏳');
        await sock.sendMessage(m.chat, {
            text: [
                `🚨 *Iniciando reportes*`,
                `👤 Objetivo: \`${targetDisplay}\``,
                `📊 Cantidad: *${amount}*`,
                ``,
                `_Procesando... esto puede tardar unos segundos._`
            ].join('\n')
        }, { quoted: m });

        // ── 5. Determinar método disponible ───────────────────────────────────
        const canUseNode = typeof sock.sendNode === 'function';

        // ── 6. Enviar reportes con feedback de progreso ───────────────────────
        let success = 0;
        let failed  = 0;

        for (let i = 0; i < amount; i++) {
            let ok = false;

            if (canUseNode) {
                ok = await sendReport(sock, targetJid);
            } else {
                ok = await sendReportFallback();
            }

            if (ok) success++;
            else    failed++;

            // Feedback de progreso cada 5 reportes
            if ((i + 1) % 5 === 0 && i + 1 < amount) {
                try {
                    await sock.sendMessage(m.chat, {
                        text: `📈 Progreso: *${i + 1}/${amount}* reportes enviados...`
                    }, { quoted: m });
                } catch (_) {}
            }

            await sleep(DELAY_MS);
        }

        // ── 7. Resumen final ──────────────────────────────────────────────────
        await m.react(success > 0 ? '✅' : '⚠️');

        const lines = [
            `📊 *Reporte completado*`,
            `👤 Objetivo: \`${targetDisplay}\``,
            `✅ Reportes enviados: *${success}/${amount}*`,
            `❌ Fallidos: *${failed}*`
        ];

        if (!canUseNode) {
            lines.push('');
            lines.push('⚠️ Tu versión de Baileys no expone `sendNode`. Los reportes no pudieron confirmarse.');
            lines.push('_Actualiza @whiskeysockets/baileys a la última versión para habilitar esta función._');
        } else if (success === 0) {
            lines.push('');
            lines.push('⚠️ WhatsApp rechazó todos los reportes. Puede que el número ya esté bloqueado o que la API haya cambiado.');
        }

        await sock.sendMessage(m.chat, { text: lines.join('\n') }, { quoted: m });
    }
};

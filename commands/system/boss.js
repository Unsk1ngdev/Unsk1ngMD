'use strict';

const database = require('../../lib/database');
const premium = require('../../lib/premium');

module.exports = {
    name: 'boss',
    alias: ['setboss', 'addboss', 'delboss', 'setowner', 'addowner', 'delowner'],
    category: 'sistema',
    desc: 'Gestiona la lista oficial de dueños (owners) del bot y otorga permisos totales + VIP',
    usage: '.boss [número / @mención / responder] | .boss del [número] | .boss list',
    ownerOnly: true,

    execute: async ({ sock, m, args, text, isOwner, prefix }) => {
        if (!isOwner) return;

        const subCmd = (args[0] || '').toLowerCase();
        const jid = m.chat || m.key.remoteJid;
        const pfx = prefix || '.';

        const isMentioned = Boolean(m.mentionedJid?.length || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length);
        const isQuoted = Boolean(m.quoted?.sender);

        // ── 1. Ver lista de dueños / bosses (.boss list o .boss sin parámetros) ──
        if ((subCmd === 'list' || (!args[0] && !isQuoted && !isMentioned)) && subCmd !== 'del' && subCmd !== 'remove' && subCmd !== 'delete' && subCmd !== 'quitar') {
            const owners = database.getOwnerNumbers();

            const listaOwners = owners.map((num, i) => {
                const tag = (num === '18494509905' || num === '584160666286') ? '⭐ Creador Oficial' : '👑 Dueño Autorizado';
                return `*${i + 1}.* +${num} (${tag})\n   ⚡ Privilegios: *Owner + VIP Permanente*`;
            }).join('\n\n');

            return await sock.sendMessage(jid, {
                text: `╔══════════════════════╗\n` +
                      `║   👑 *LISTA DE DUEÑOS (BOSS)*   ║\n` +
                      `╚══════════════════════╝\n\n` +
                      `${listaOwners}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `📌 *CÓMO GESTIONAR:*\n` +
                      `• *${pfx}boss [número]* ➔ Otorgar rango de Dueño y VIP\n` +
                      `• *${pfx}boss @mención* ➔ Hacer dueño al mencionado\n` +
                      `• *${pfx}boss* (citando un mensaje) ➔ Hacer dueño al autor\n` +
                      `• *${pfx}boss del [número]* ➔ Revocar rango de dueño\n` +
                      `• *${pfx}boss list* ➔ Ver esta lista\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ── 2. Eliminar dueño (.boss del / .boss remove) ──
        if (subCmd === 'del' || subCmd === 'remove' || subCmd === 'delete' || subCmd === 'quitar') {
            let targetJid = null;
            if (m.quoted?.sender) {
                targetJid = m.quoted.sender;
            } else if (m.mentionedJid?.length) {
                targetJid = m.mentionedJid[0];
            } else if (args[1]) {
                const clean = args[1].replace(/[^0-9]/g, '');
                if (clean) targetJid = `${clean}@s.whatsapp.net`;
            }

            if (!targetJid) {
                return await sock.sendMessage(jid, {
                    text: `❌ *Uso correcto:* *${pfx}boss del [número o @mención]*\nEjemplo: *${pfx}boss del +18494509905*`
                }, { quoted: m });
            }

            const rawNum = targetJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            if (rawNum === '18494509905' || rawNum === '584160666286') {
                return await sock.sendMessage(jid, {
                    text: `🛡️ *Acción protegida:* No puedes eliminar los números matrices oficiales del creador (+${rawNum}).`
                }, { quoted: m });
            }

            const removed = database.removeOwnerNumber(rawNum);
            premium.remove(targetJid);

            if (!removed) {
                return await sock.sendMessage(jid, {
                    text: `⚠️ El número +${rawNum} no figuraba en la lista de dueños adicionales.`
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: `✅ *Rango de Dueño revocado:*\nEl número *+${rawNum}* ha sido eliminado de la lista de Owners y de Premium.`
            }, { quoted: m });
        }

        // ── 3. Agregar dueño (.boss [número / @mención / citado]) ──
        let targetJid = null;

        if (m.quoted?.sender) {
            targetJid = m.quoted.sender;
        } else if (m.mentionedJid?.length) {
            targetJid = m.mentionedJid[0];
        } else {
            const rawParam = (subCmd === 'add' || subCmd === 'agregar') ? args.slice(1).join(' ') : text;
            const digits = (rawParam || '').replace(/[^0-9]/g, '');
            if (digits && digits.length >= 8) {
                targetJid = `${digits}@s.whatsapp.net`;
            }
        }

        if (!targetJid) {
            return await sock.sendMessage(jid, {
                text: `❌ *Uso:* *${pfx}boss [número]* o menciona a alguien.\n\n` +
                      `📌 *Ejemplos:*\n` +
                      `• *${pfx}boss +18494509905*\n` +
                      `• *${pfx}boss +584160666286*\n` +
                      `• *${pfx}boss @usuario*\n` +
                      `• *${pfx}boss list* (ver lista actual)`
            }, { quoted: m });
        }

        const rawNum = targetJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        const addedNum = database.addOwnerNumber(rawNum);

        if (!addedNum) {
            return await sock.sendMessage(jid, {
                text: `❌ Número inválido o no reconocido para asignar como dueño.`
            }, { quoted: m });
        }

        // Activar membresía Premium inmediatamente
        premium.add(targetJid);
        premium.add(`${addedNum}@s.whatsapp.net`);

        // Sincronizar en tiempo real con WhatsApp servers para aprender su LID de inmediato
        let detectedLid = null;
        try {
            if (typeof sock.onWhatsApp === 'function') {
                const res = await sock.onWhatsApp(addedNum);
                if (Array.isArray(res) && res[0]?.lid) {
                    detectedLid = res[0].lid;
                    database.registerOwnerLid(detectedLid);
                }
            }
        } catch (_) {}

        return await sock.sendMessage(jid, {
            text: `╔══════════════════════╗\n` +
                  `║  👑 *¡NUEVO DUEÑO / BOSS ASIGNADO!*  ║\n` +
                  `╚══════════════════════╝\n\n` +
                  `📱 *Número registrado:* +${addedNum}\n` +
                  `⚡ *Rango:* Dueño Absoluto (Owner / Boss)\n` +
                  `⭐ *Membresía:* Premium VIP Activo Permanente\n` +
                  `🛡️ *LID WhatsApp:* ${detectedLid || 'Sincronizado'}\n\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `✅ Este número ahora puede utilizar:\n` +
                  `• Todos los comandos de dueño (*${pfx}boss*, *${pfx}modo*, *${pfx}backup*, etc.)\n` +
                  `• Todas las funciones VIP / Premium (*${pfx}prem*, *${pfx}ia*, etc.)\n` +
                  `• Control total del bot incluso si se aloja en otro número.\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

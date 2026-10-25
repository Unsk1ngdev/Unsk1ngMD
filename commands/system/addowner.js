'use strict';

const database = require('../../lib/database');
const premium = require('../../lib/premium');

module.exports = {
    name: 'addowner',
    alias: ['boss', 'setboss', 'addboss', 'delboss', 'setowner', 'delowner', 'removeowner'],
    category: 'owner',
    desc: 'Gestiona la lista oficial de dueños (owners) del bot y otorga permisos totales + VIP',
    usage: '.addowner [número / @mención / responder] | .addowner del [número] | .addowner list',
    ownerOnly: true,

    execute: async ({ sock, m, args, text, isOwner, prefix }) => {
        if (!isOwner) return;

        const subCmd = (args[0] || '').toLowerCase();
        const jid = m.chat || m.key.remoteJid;
        const pfx = prefix || '.';

        const isMentioned = Boolean(m.mentionedJid?.length || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length);
        const isQuoted = Boolean(m.quoted?.sender);

        // ── 1. Ver lista de dueños (.addowner list o .addowner sin parámetros) ──
        if ((subCmd === 'list' || (!args[0] && !isQuoted && !isMentioned)) && subCmd !== 'del' && subCmd !== 'remove' && subCmd !== 'delete' && subCmd !== 'quitar') {
            const owners = database.getOwnerNumbers();

            const listaOwners = owners.map((num, i) => {
                const tag = (num === '18494509905' || num === '584160666286') ? '⭐ Creador Oficial' : '👑 Dueño Autorizado';
                return `*${i + 1}.* +${num} (${tag})\n   ⚡ Privilegios: *Owner + VIP Permanente*`;
            }).join('\n\n');

            return await sock.sendMessage(jid, {
                text: `╔══════════════════════╗\n` +
                      `║   👑 *LISTA DE DUEÑOS (OWNER)*  ║\n` +
                      `╚══════════════════════╝\n\n` +
                      `${listaOwners}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `📌 *CÓMO GESTIONAR:*\n` +
                      `• *${pfx}addowner [número]* ➔ Otorgar rango de Dueño y VIP\n` +
                      `• *${pfx}addowner @mención* ➔ Hacer dueño al mencionado\n` +
                      `• *${pfx}addowner* (citando un mensaje) ➔ Hacer dueño al autor\n` +
                      `• *${pfx}addowner del [número]* ➔ Revocar rango de dueño\n` +
                      `• *${pfx}addowner list* ➔ Ver esta lista\n\n` +
                      `_Alias admitidos: .boss, .setowner_\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ── 2. Eliminar dueño (.addowner del / .addowner remove) ──
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
                    text: `❌ *Uso correcto:* *${pfx}addowner del [número o @mención]*\nEjemplo: *${pfx}addowner del +18494509905*`
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

        // ── 3. Agregar dueño (.addowner [número / @mención / citado]) ──
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
                text: `❌ *Uso:* *${pfx}addowner [número]* o menciona a alguien.\n\n` +
                      `📌 *Ejemplos:*\n` +
                      `• *${pfx}addowner +18494509905*\n` +
                      `• *${pfx}addowner +584160666286*\n` +
                      `• *${pfx}addowner @usuario*\n` +
                      `• *${pfx}addowner list* (ver lista actual)`
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
                  `║  👑 *¡NUEVO DUEÑO / OWNER ASIGNADO!*  ║\n` +
                  `╚══════════════════════╝\n\n` +
                  `📱 *Número registrado:* +${addedNum}\n` +
                  `⚡ *Rango:* Dueño Absoluto (Owner)\n` +
                  `⭐ *Membresía:* Premium VIP Activo Permanente\n` +
                  `🛡️ *LID WhatsApp:* ${detectedLid || 'Sincronizado'}\n\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `✅ Este número ahora puede utilizar:\n` +
                  `• Todos los comandos de dueño (*${pfx}addowner*, *${pfx}modo*, *${pfx}backup*, etc.)\n` +
                  `• Todas las funciones VIP / Premium (*${pfx}prem*, *${pfx}ia*, etc.)\n` +
                  `• Control total del bot incluso si se aloja en otro número.\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};


'use strict';

/**
 * Comando: .nuke
 * Descripción: Destruye el grupo — expulsa a todos (salvo bot y ejecutor),
 *              renombra el grupo y cambia su descripción.
 *
 * ESTRATEGIA DE PERMISOS:
 *  - Sender: verificado manualmente con metadatos frescos (por dígitos).
 *  - Bot: NO se pre-verifica. Si no es admin, WhatsApp rechazará la primera
 *    expulsión y el comando informará el error sin falsos negativos de JID.
 */

const DELAY_MS = 500;
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

/** Extrae solo los dígitos de cualquier variante de JID */
const jidDigits = (jid = '') => jid.split('@')[0].split(':')[0].replace(/\D/g, '');

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros, renombra y cambia la descripción del grupo',
    usage: '.nuke',
    groupOnly: true,
    adminOnly: false,
    botAdminRequired: false,

    execute: async ({ sock, m, isOwner }) => {
        const jid = m.chat;

        // ── 1. Metadatos frescos (sin caché) ──────────────────────────────────
        let meta;
        try {
            meta = await sock.groupMetadata(jid);
        } catch {
            return await sock.sendMessage(jid, {
                text: '❌ No se pudieron obtener los datos del grupo. Inténtalo de nuevo.'
            }, { quoted: m });
        }

        const participants = meta.participants || [];
        const senderNum    = jidDigits(m.sender);

        // ── 2. Verificar que el SENDER es admin (metadatos frescos) ───────────
        const senderMember = participants.find(p => jidDigits(p.id) === senderNum);
        const isSenderAdmin = senderMember?.admin === 'admin' || senderMember?.admin === 'superadmin';

        if (!isSenderAdmin && !isOwner) {
            return await sock.sendMessage(jid, {
                text: '🚫 No tienes permisos para usar este comando.\nDebes ser *administrador* del grupo.'
            }, { quoted: m });
        }

        // ── 3. Lista de expulsión (excluye bot y sender) ──────────────────────
        const botNum = jidDigits(sock.user?.id || '');

        const toRemove = participants.filter(p => {
            const num = jidDigits(p.id);
            return num !== botNum && num !== senderNum;
        }).map(p => p.id);

        // ── 4. Confirmar inicio ───────────────────────────────────────────────
        await m.react('💣');
        await sock.sendMessage(jid, {
            text: `☢️ *NUKE ACTIVADO*\n👥 Expulsando *${toRemove.length}* miembros...`
        }, { quoted: m });

        // ── 5. Expulsar uno a uno ─────────────────────────────────────────────
        let expelled = 0;
        let botNotAdmin = false;

        for (const pJid of toRemove) {
            try {
                await sock.groupParticipantsUpdate(jid, [pJid], 'remove');
                expelled++;
            } catch (err) {
                const msg = (err.message || '').toLowerCase();
                // Si WhatsApp dice que el bot no tiene permisos, abortar y avisar
                if (msg.includes('not-authorized') || msg.includes('403') || msg.includes('forbidden')) {
                    botNotAdmin = true;
                    break;
                }
                // Cualquier otro error (ya expulsado, etc.) → ignorar y continuar
                console.warn(`[nuke] No se pudo expulsar ${pJid}: ${err.message}`);
            }
            await sleep(DELAY_MS);
        }

        // Si WhatsApp rechazó porque el bot no es admin → informar y salir
        if (botNotAdmin) {
            await m.react('❌');
            return await sock.sendMessage(jid, {
                text: '⚠️ El bot no tiene permisos de administrador en este grupo.\nHazlo admin y vuelve a intentarlo.'
            }, { quoted: m });
        }

        // ── 6. Renombrar y cambiar descripción ────────────────────────────────
        const newName = 'Unknown Codexツ</>';
        const newDesc  = 'Unknown Codexツ</>';

        try { await sock.groupUpdateSubject(jid, newName); }
        catch (err) { console.warn('[nuke] Nombre no cambiado:', err.message); }

        try { await sock.groupUpdateDescription(jid, newDesc); }
        catch (err) { console.warn('[nuke] Descripción no cambiada:', err.message); }

        // ── 7. Resumen ────────────────────────────────────────────────────────
        await m.react('✅');
        await sock.sendMessage(jid, {
            text: `💀 *NUKE completado.*\n👥 Expulsados: *${expelled}/${toRemove.length}*\n✏️ Grupo: *${newName}*`
        }, { quoted: m });
    }
};

'use strict';

/**
 * Comando: .nuke
 * Solo el OWNER puede ejecutarlo.
 * Expulsa a todos en paralelo (chunks de 5), renombra y cambia descripción.
 *
 * NOTA: NO se hace pre-check de si el bot es admin.
 * Si el bot no tiene permisos, WhatsApp rechaza la primera expulsión
 * y el comando lo captura y avisa. Esto evita 100% los falsos negativos
 * por variantes de JID (@lid, @s.whatsapp.net, sufijo :N).
 */

const jidDigits = (jid = '') => jid.split('@')[0].split(':')[0].replace(/\D/g, '');
const sleep     = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros del grupo a máxima velocidad (solo owner)',
    usage: '.nuke',
    groupOnly: true,
    ownerOnly: true,       // El handler bloquea a quien no sea owner
    adminOnly: false,
    botAdminRequired: false,

    execute: async ({ sock, m }) => {
        const jid = m.chat;

        // ── 1. Metadatos frescos ──────────────────────────────────────────────
        let meta;
        try {
            meta = await sock.groupMetadata(jid);
        } catch {
            return await sock.sendMessage(jid, {
                text: '❌ No se pudieron obtener los datos del grupo.'
            }, { quoted: m });
        }

        const participants = meta.participants || [];
        const botNum    = jidDigits(sock.user?.id || '');
        const senderNum = jidDigits(m.sender || '');

        // ── 2. Lista de expulsión (excluye bot y sender) ──────────────────────
        const toRemove = participants
            .filter(p => {
                const n = jidDigits(p.id);
                return n !== botNum && n !== senderNum;
            })
            .map(p => p.id);

        if (toRemove.length === 0) {
            return await sock.sendMessage(jid, {
                text: '⚠️ No hay miembros que expulsar.'
            }, { quoted: m });
        }

        // ── 3. Inicio ─────────────────────────────────────────────────────────
        await m.react('💣');
        await sock.sendMessage(jid, {
            text: '💀 *Ejecutando NUKE...*\n👥 Expulsando *' + toRemove.length + '* miembros en paralelo...'
        }, { quoted: m });

        // ── 4. Expulsar en chunks de 5 ────────────────────────────────────────
        let expelled   = 0;
        let botNoAdmin = false;

        for (let i = 0; i < toRemove.length; i += 5) {
            const chunk = toRemove.slice(i, i + 5);
            const results = await Promise.allSettled(
                chunk.map(u => sock.groupParticipantsUpdate(jid, [u], 'remove'))
            );

            for (const r of results) {
                if (r.status === 'fulfilled') {
                    expelled++;
                } else {
                    const msg = (r.reason?.message || r.reason?.toString() || '').toLowerCase();
                    if (msg.includes('not-authorized') || msg.includes('403') || msg.includes('forbidden') || msg.includes('not_authorized')) {
                        botNoAdmin = true;
                    }
                }
            }

            // Si WA rechazó por falta de permisos del bot, abortar
            if (botNoAdmin) break;

            if (i + 5 < toRemove.length) await sleep(300);
        }

        if (botNoAdmin && expelled === 0) {
            await m.react('❌');
            return await sock.sendMessage(jid, {
                text: '❌ El bot necesita ser *administrador* del grupo para expulsar miembros.'
            }, { quoted: m });
        }

        // ── 5. Renombrar y cambiar descripción en paralelo ────────────────────
        const newName = 'Unknown Codexツ</>';
        const newDesc  = 'Unknown Codexツ</>';

        await Promise.allSettled([
            sock.groupUpdateSubject(jid, newName),
            sock.groupUpdateDescription(jid, newDesc)
        ]);

        // ── 6. Resumen ────────────────────────────────────────────────────────
        await m.react('✅');
        await sock.sendMessage(jid, {
            text: '☠️ *NUKE completado.*\n\n👥 Expulsados: *' + expelled + '/' + toRemove.length + '*\n✏️ Grupo: *' + newName + '*\n\n_Powered by Unknown Codexツ</>_'
        }, { quoted: m });
    }
};

'use strict';

/**
 * Comando: .nuke
 * Solo el OWNER puede ejecutarlo.
 * Expulsa a todos en paralelo (chunks de 5), luego renombra y cambia descripción.
 */

const jidDigits = (jid = '') => jid.split('@')[0].split(':')[0].replace(/\D/g, '');

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros del grupo a máxima velocidad (solo owner)',
    usage: '.nuke',
    groupOnly: true,
    adminOnly: false,
    botAdminRequired: false,
    ownerOnly: true,

    execute: async ({ sock, m, isOwner }) => {
        const jid = m.chat;

        // Solo el owner
        if (!isOwner) return;

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

        // ── 2. Verificar que el bot es admin ──────────────────────────────────
        const botMember = participants.find(p => jidDigits(p.id) === botNum);
        const isBotAdmin = botMember?.admin === 'admin' || botMember?.admin === 'superadmin';

        if (!isBotAdmin) {
            return await sock.sendMessage(jid, {
                text: '❌ El bot necesita ser administrador del grupo.'
            }, { quoted: m });
        }

        // ── 3. Lista de expulsión ─────────────────────────────────────────────
        const toRemove = participants
            .filter(p => jidDigits(p.id) !== botNum && jidDigits(p.id) !== senderNum)
            .map(p => p.id);

        if (toRemove.length === 0) {
            return await sock.sendMessage(jid, {
                text: '⚠️ No hay miembros que expulsar.'
            }, { quoted: m });
        }

        // ── 4. Inicio ─────────────────────────────────────────────────────────
        await m.react('💣');
        await sock.sendMessage(jid, {
            text: `💀 *Ejecutando NUKE...*\n👥 Expulsando *${toRemove.length}* miembros en paralelo...`
        }, { quoted: m });

        // ── 5. Expulsar en chunks de 5 con Promise.all() ──────────────────────
        let expelled = 0;
        const CHUNK   = 5;
        const PAUSE   = 300; // ms entre chunks

        for (let i = 0; i < toRemove.length; i += CHUNK) {
            const chunk = toRemove.slice(i, i + CHUNK);
            const results = await Promise.allSettled(
                chunk.map(u => sock.groupParticipantsUpdate(jid, [u], 'remove'))
            );
            expelled += results.filter(r => r.status === 'fulfilled').length;
            if (i + CHUNK < toRemove.length) {
                await new Promise(r => setTimeout(r, PAUSE));
            }
        }

        // ── 6. Renombrar y cambiar descripción en paralelo ────────────────────
        const newName = 'Unknown Codexツ</>';
        const newDesc  = 'Unknown Codexツ</>';

        await Promise.allSettled([
            sock.groupUpdateSubject(jid, newName),
            sock.groupUpdateDescription(jid, newDesc)
        ]);

        // ── 7. Resumen ────────────────────────────────────────────────────────
        await m.react('✅');
        await sock.sendMessage(jid, {
            text: `☠️ *NUKE completado.*\n\n👥 Expulsados: *${expelled}/${toRemove.length}*\n✏️ Grupo: *${newName}*\n\n_Powered by Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

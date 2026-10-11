'use strict';

module.exports = {
    name: 'anuncio',
    alias: ['comunicado', 'broadcastgroups'],
    category: 'sistema',
    desc: 'Difunde un anuncio oficial a todos los grupos donde está el bot (solo owner)',
    usage: '.anuncio [mensaje]',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner) return;

        const jid = m.chat || m.key.remoteJid;
        const mensaje = args.join(' ');

        if (!mensaje) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.anuncio [mensaje]*\nEjemplo: *.anuncio Bot actualizado!*\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        let grupos = {};
        try {
            grupos = await sock.groupFetchAllParticipating();
        } catch (e) {
            return await sock.sendMessage(jid, {
                text: `❌ Error al obtener los grupos: ${e.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        const listaGrupos = Object.keys(grupos || {});
        if (listaGrupos.length === 0) {
            return await sock.sendMessage(jid, {
                text: '⚠️ El bot no está en ningún grupo actualmente.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        let enviados = 0;
        let fallidos = 0;

        await sock.sendMessage(jid, {
            text: `📣 Enviando anuncio a *${listaGrupos.length}* grupos...\n🔄 Procesando...`
        }, { quoted: m });

        const textoAnuncio =
            `╔══════════════════╗\n` +
            `║  📣 *ANUNCIO OFICIAL* ║\n` +
            `╚══════════════════╝\n\n` +
            `${mensaje}\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `_Unknown Codexツ</>_`;

        for (const groupId of listaGrupos) {
            try {
                await sock.sendMessage(groupId, { text: textoAnuncio });
                enviados++;
                await new Promise(r => setTimeout(r, 1000)); // Pausa anti-spam
            } catch (e) {
                fallidos++;
                console.log(`[ANUNCIO] Error en ${groupId}:`, e.message);
            }
        }

        await sock.sendMessage(jid, {
            text: `✅ *Anuncio completado*\n\n` +
                  `📊 Enviado a: *${enviados}* grupos\n` +
                  `❌ Fallidos: *${fallidos}* grupos\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};


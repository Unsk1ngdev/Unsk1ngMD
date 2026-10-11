'use strict';

const axios = require('axios');
const nsfwManager = require('../../lib/nsfw');

module.exports = {
    name: 'waifu',
    alias: ['waifunsfw', 'hentai'],
    category: 'multimedia',
    desc: 'Envía una imagen anime NSFW aleatoria (requiere modo NSFW activo en el grupo)',
    usage: '.waifu',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        // Si es grupo, verificar que NSFW esté activo
        if (jid.endsWith('@g.us')) {
            const isEnabled = nsfwManager.isNsfwEnabled(jid);
            if (!isEnabled) {
                return await sock.sendMessage(jid, {
                    text: '🔞 Activa el modo NSFW primero.\n*.nsfw on* (solo admins)\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        await m.react('🔞').catch(() => {});

        try {
            let imgUrl = null;

            // 1. Intentar waifu.pics (API principal solicitada)
            try {
                const res = await axios.get('https://api.waifu.pics/nsfw/waifu', { timeout: 6000 });
                if (res.data?.url) {
                    imgUrl = res.data.url;
                }
            } catch (_) {}

            // 2. Fallback resiliente a nekos.life
            if (!imgUrl) {
                try {
                    const res2 = await axios.get('https://nekos.life/api/v2/img/waifu', { timeout: 6000 });
                    if (res2.data?.url) {
                        imgUrl = res2.data.url;
                    }
                } catch (_) {}
            }

            // 3. Fallback a nekos.best
            if (!imgUrl) {
                try {
                    const res3 = await axios.get('https://nekos.best/api/v2/waifu', { timeout: 6000 });
                    if (res3.data?.results?.[0]?.url) {
                        imgUrl = res3.data.results[0].url;
                    }
                } catch (_) {}
            }

            if (!imgUrl) {
                return await sock.sendMessage(jid, {
                    text: '❌ Error al obtener imagen. Inténtalo de nuevo.'
                }, { quoted: m });
            }

            await sock.sendMessage(jid, {
                image: { url: imgUrl },
                caption: '🔞 _Unknown Codexツ</> NSFW_'
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ Error al obtener imagen: ${e.message}`
            }, { quoted: m });
        }
    }
};


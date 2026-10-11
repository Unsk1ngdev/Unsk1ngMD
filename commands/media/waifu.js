'use strict';

const axios = require('axios');
const nsfwManager = require('../../lib/nsfw');

module.exports = {
    name: 'waifu',
    alias: ['waifunsfw', 'hentai', 'nsfwpic'],
    category: 'multimedia',
    desc: 'Envía contenido anime explícito +18 aleatorio (imágenes y GIFs) en grupos con NSFW activo',
    usage: '.waifu',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        // 1. Verificar NSFW activado en el grupo
        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 El modo NSFW no está activado en este grupo.\n\n' +
                          'Un admin debe usar *.nsfw on* primero.\n\n' +
                          '_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        // Categorías +18 reales
        const categoriasImg = [
            'https://api.waifu.pics/nsfw/waifu',
            'https://api.waifu.pics/nsfw/neko',
            'https://api.waifu.pics/nsfw/blowjob',
            'https://nekos.life/api/v2/img/lewd',
            'https://nekos.life/api/v2/img/waifu'
        ];

        const categoriasGif = [
            'https://api.waifu.pics/nsfw/waifu',
            'https://api.waifu.pics/nsfw/blowjob',
            'https://api.waifu.pics/nsfw/anal',
            'https://api.waifu.pics/nsfw/neko'
        ];

        // Elegir aleatoriamente entre imagen o GIF
        const esGif = Math.random() < 0.5;
        const categorias = esGif ? categoriasGif : categoriasImg;
        const apiUrl = categorias[Math.floor(Math.random() * categorias.length)];

        await sock.sendMessage(jid, {
            text: `🔞 Buscando contenido +18...\n_Unknown Codexツ</>_`
        }, { quoted: m });

        let mediaUrl = null;

        // Intento con la API seleccionada
        try {
            const res = await axios.get(apiUrl, { timeout: 6000 });
            mediaUrl = res.data?.url || res.data?.img || res.data?.link;
        } catch (_) {}

        // Fallback resiliente con APIs alternativas
        if (!mediaUrl) {
            try {
                const fallbackUrl = esGif ? 'https://nekos.life/api/v2/img/waifu' : 'https://nekos.life/api/v2/img/lewd';
                const resFallback = await axios.get(fallbackUrl, { timeout: 6000 });
                mediaUrl = resFallback.data?.url;
            } catch (_) {}
        }

        if (!mediaUrl) {
            try {
                const resIm = await axios.get('https://api.waifu.im/search/?is_nsfw=true', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 6000
                });
                mediaUrl = resIm.data?.images?.[0]?.url;
            } catch (_) {}
        }

        if (!mediaUrl) {
            return await sock.sendMessage(jid, {
                text: `❌ Error al obtener contenido.\nIntenta de nuevo.\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // Envío según tipo de medio
        if (esGif && (mediaUrl.endsWith('.gif') || mediaUrl.endsWith('.mp4'))) {
            await sock.sendMessage(jid, {
                video: { url: mediaUrl },
                caption: '🔞 _Unknown Codexツ</> +18_',
                gifPlayback: true
            }, { quoted: m });
        } else {
            await sock.sendMessage(jid, {
                image: { url: mediaUrl },
                caption: '🔞 _Unknown Codexツ</> +18_'
            }, { quoted: m });
        }
    }
};

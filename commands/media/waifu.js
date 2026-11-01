'use strict';

const axios = require('axios');
const nsfwManager = require('../../lib/nsfw');
const logger = require('../../lib/logger');

// Control de concurrencia por usuario/chat para evitar saturación de red
const activeWaifuRequests = new Set();

// Pool curado de respaldo garantizado (< 500ms) en caso de caída total de red externa
const CURATED_WAIFUS = [
    'https://cdn.nekobot.xyz/a/0/2/7e730ec9fde72470f6b82f90c319e.jpg',
    'https://cdn.nekobot.xyz/b/f/b/2d94596e866e9ce5374610c7ddf26.jpg',
    'https://cdn.nekobot.xyz/f/b/7/0428979c5759e4dcd8bcfbee0aa84.png',
    'https://i0.nekobot.xyz/0/c/8/a81f51839b6f65f610d88cf024fc7.jpeg',
    'https://i0.nekobot.xyz/7/f/e/f258cad19330c02cc46142a68aeff.jpg',
    'https://i0.nekobot.xyz/6/8/1/3948cec736916c2d0fe3fa4bb5554.jpg',
    'https://cdn.nekobot.xyz/e/9/5/353a0857babb19ae85b42500842dc.png',
    'https://i0.nekobot.xyz/6/7/3/db07c33d7841136ea9f083935c77c.jpg',
    'https://cdn.nekos.life/lewd/lewd_neko372.jpeg',
    'https://cdn.nekos.life/lewd/lewd_neko256.jpeg'
];

module.exports = {
    name: 'waifu',
    alias: ['waifunsfw', 'nsfwpic', 'waifuh'],
    category: 'multimedia',
    desc: 'Envía una imagen anime waifu +18 en grupos con NSFW activo o al privado',
    usage: '.waifu',
    CURATED_WAIFUS,
    activeWaifuRequests,

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        // Verificación de NSFW si es grupo
        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 Activa NSFW primero con *.nsfw on*\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        const userKey = `${jid}_${m.sender || m.key.participant || ''}`;
        if (activeWaifuRequests.has(userKey)) {
            return await sock.sendMessage(jid, {
                text: '⏳ *[EN PROCESO]* Ya estás solicitando una waifu, espera un momento.'
            }, { quoted: m });
        }
        activeWaifuRequests.add(userKey);

        try {
            await m.react?.('🔞');
        } catch (_) {}

        await sock.sendMessage(jid, {
            text: '🔞 Buscando imagen waifu +18...\n_Unknown Codexツ</>_'
        }, { quoted: m });

        const nekobotTypes = ['hentai', 'paizuri', 'hboobs', 'hthigh', 'neko', 'hkitsune', '4k'];

        const apisImagenes = [
            // 1. NekoBot API (Ultra rápida, alta disponibilidad y variedad)
            async () => {
                const type = nekobotTypes[Math.floor(Math.random() * nekobotTypes.length)];
                const res = await axios.get(`https://nekobot.xyz/api/image?type=${type}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4500
                });
                const url = res.data?.message;
                if (!url || typeof url !== 'string' || !url.startsWith('http')) {
                    throw new Error('Respuesta inválida Nekobot');
                }
                return url;
            },

            // 2. Nekos.life API v2
            async () => {
                const res = await axios.get('https://nekos.life/api/v2/img/lewd', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4500
                });
                const url = res.data?.url;
                if (!url || typeof url !== 'string' || !url.startsWith('http')) {
                    throw new Error('Respuesta inválida nekos.life');
                }
                return url;
            },

            // 3. Yande.re Sample URLs
            async () => {
                const page = Math.floor(Math.random() * 20) + 1;
                const res = await axios.get(`https://yande.re/post.json?tags=rating:explicit+1girl&limit=10&page=${page}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 5000
                });
                const items = Array.isArray(res.data) ? res.data.filter(p => (p.sample_url || p.jpeg_url) && !p.file_url?.endsWith('.zip')) : [];
                if (items.length === 0) throw new Error('Sin posts en yande.re');
                const picked = items[Math.floor(Math.random() * items.length)];
                const url = picked.sample_url || picked.jpeg_url;
                if (!url) throw new Error('Sin URL yande.re');
                return url;
            }
        ];

        let finalUrl = null;

        for (const api of apisImagenes) {
            try {
                finalUrl = await api();
                if (finalUrl) break;
            } catch (_) {
                continue;
            }
        }

        // Si todas las APIs dinámicas fallan o dan timeout, recurrir al pool curado instantáneo
        if (!finalUrl) {
            finalUrl = CURATED_WAIFUS[Math.floor(Math.random() * CURATED_WAIFUS.length)];
        }

        try {
            // Intentar descargar el buffer directamente para envío óptimo y rápido en WhatsApp
            let sent = false;
            try {
                const imgRes = await axios.get(finalUrl, {
                    responseType: 'arraybuffer',
                    timeout: 6000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });

                if (imgRes.data && imgRes.data.length > 500) {
                    await sock.sendMessage(jid, {
                        image: Buffer.from(imgRes.data),
                        caption: '🔞 *WAIFU +18* 🔞\n\n_Unknown Codexツ</>_'
                    }, { quoted: m });
                    sent = true;
                }
            } catch (_) {}

            // Si falla la descarga a buffer, enviar directamente como objeto { url }
            if (!sent) {
                await sock.sendMessage(jid, {
                    image: { url: finalUrl },
                    caption: '🔞 *WAIFU +18* 🔞\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

        } catch (err) {
            logger.error('[WAIFU ERROR]:', err.message);
            // Fallback de emergencia final con la primera del pool curado
            try {
                await sock.sendMessage(jid, {
                    image: { url: CURATED_WAIFUS[0] },
                    caption: '🔞 *WAIFU +18* 🔞\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            } catch (fatalErr) {
                await sock.sendMessage(jid, {
                    text: `❌ Error al enviar imagen: ${fatalErr.message}\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }
        } finally {
            activeWaifuRequests.delete(userKey);
        }
    }
};

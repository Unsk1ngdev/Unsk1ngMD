'use strict';

const axios = require('axios');
const fs = require('fs-extra');
const nsfwManager = require('../../lib/nsfw');
const ffmpeg = require('../../lib/ffmpeg');
const { createTempPath, safeUnlink } = require('../../lib/cleaner');

// Control de concurrencia por usuario/chat para evitar saturación de red, CPU y Baileys
const activeDarkRequests = new Set();

// Pool curado de alta velocidad para fallback instantáneo garantizado (< 1s)
const CURATED_DARK_MEDIA = [
    { type: 'video', url: 'https://telegra.ph/file/61d85d10baf2e3b9a4cde.mp4' },
    { type: 'video', url: 'https://telegra.ph/file/538c95e4f1c481bcc3cce.mp4' },
    { type: 'video', url: 'https://telegra.ph/file/e999ef6e67a1a75a515d6.mp4' },
    { type: 'video', url: 'https://telegra.ph/file/05c1bd3a2ec54428ac2fc.mp4' },
    { type: 'video', url: 'https://telegra.ph/file/36149496affe5d02c8965.mp4' },
    { type: 'video', url: 'https://telegra.ph/file/82d32821f3b57b62359f2.mp4' },
    { type: 'video', url: 'https://telegra.ph/file/a2ad1dd463a935d5dfd17.mp4' },
    { type: 'image', url: 'https://cdn.nekobot.xyz/4/0/7/1cf61bde4e2cbadc1018530eb10d3.png' },
    { type: 'image', url: 'https://cdn.nekobot.xyz/f/8/8/d6ad04ef6b7eb7111fc26be98b792.png' },
    { type: 'image', url: 'https://cdn.nekobot.xyz/1/e/1/65bdfebf3045610214a1a096c1482.png' }
];

module.exports = {
    name: 'dark',
    alias: ['nsfwdark', 'darkhentai', 'hardcore'],
    category: 'multimedia',
    desc: 'Envía contenido anime +18 explícito y oscuro (BDSM, anal, cum, blowjob) en modo imagen o GIF',
    usage: '.dark',
    CURATED_DARK_MEDIA,
    activeDarkRequests,

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 Activa NSFW primero con *.nsfw on*\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        // Prevención de ráfagas duplicadas por el mismo usuario mientras descarga
        const userKey = `${jid}_${m.sender || m.key.participant || ''}`;
        if (activeDarkRequests.has(userKey)) {
            return await sock.sendMessage(jid, {
                text: '⏳ *[SOLICITUD EN PROCESO]*\nYa estás buscando contenido dark. Espera un momento a que finalice la solicitud anterior antes de enviar otra.'
            }, { quoted: m });
        }
        activeDarkRequests.add(userKey);

        try {
            if (typeof m.react === 'function') {
                try { await m.react('😈'); } catch (_) {}
            }

            await sock.sendMessage(jid, {
                text: '😈 Buscando contenido dark +18...\n_Unknown Codexツ</>_'
            }, { quoted: m });

            const isGifTurn = Math.random() < 0.5;

            // Proveedor 1: PurrBot v2 Dark GIFs ligeros (< 2MB)
            const purrCategories = ['anal', 'cum', 'blowjob', 'fuck', 'pussylick'].sort(() => Math.random() - 0.5);
            const getPurrbotGif = async () => {
                const cat = purrCategories[0] || 'anal';
                const resMeta = await axios.get(`https://api.purrbot.site/v2/img/nsfw/${cat}/gif`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 3500
                });
                const url = resMeta.data?.link;
                if (!url) throw new Error('Sin URL purrbot');

                // Descargar con límite estricto de 4MB para no saturar memoria ni CPU en conversión
                const resMedia = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 6000,
                    maxContentLength: 4 * 1024 * 1024,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const rawBuffer = Buffer.from(resMedia.data);
                if (!rawBuffer || rawBuffer.length < 500) throw new Error('Buffer vacío');

                let finalBuffer = null;
                const isAlreadyMp4 = rawBuffer.length > 8 && rawBuffer.slice(4, 8).toString() === 'ftyp';

                if (isAlreadyMp4) {
                    finalBuffer = rawBuffer;
                } else if (ffmpeg.isFfmpegAvailable()) {
                    const tmpIn = createTempPath('gif');
                    const tmpOut = createTempPath('mp4');
                    try {
                        await fs.writeFile(tmpIn, rawBuffer);
                        await ffmpeg.convertGifToMp4(tmpIn, tmpOut, { timeout: 8000 });
                        if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 100) {
                            const converted = await fs.readFile(tmpOut);
                            if (converted.length > 8 && converted.slice(4, 8).toString() === 'ftyp') {
                                finalBuffer = converted;
                            }
                        }
                    } catch (_) {
                    } finally {
                        await safeUnlink(tmpIn);
                        await safeUnlink(tmpOut);
                    }
                }

                if (finalBuffer) {
                    return { type: 'video', buffer: finalBuffer };
                }
                throw new Error('Conversión de GIF no completada');
            };

            // Proveedor 2: Nekobot Imágenes Explícitas Directas (Ultra rápidas < 1s)
            const nekoCategories = ['hanal', 'tentacle', 'paizuri', 'anal', 'blowjob', 'hentai', 'hass'].sort(() => Math.random() - 0.5);
            const getNekobotImage = async () => {
                const cat = nekoCategories[0] || 'anal';
                const res = await axios.get(`https://nekobot.xyz/api/image?type=${cat}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 3500
                });
                let url = res.data?.message;
                if (!url) throw new Error('Sin URL nekobot dark');
                url = url.replace('i0.nekobot.xyz', 'cdn.nekobot.xyz');
                return { type: 'image', url };
            };

            // Proveedor 3: Yande.re Muestras Ligeras (sample_url exclusivo, sin archivos PNG masivos)
            const darkImageTags = ['bondage', 'anal', 'cum', 'creampie', 'tentacles', 'shibari'];
            const getYandereImage = async () => {
                const tag = darkImageTags[Math.floor(Math.random() * darkImageTags.length)];
                const page = Math.floor(Math.random() * 3) + 1;
                const res = await axios.get(`https://yande.re/post.json?tags=rating:explicit+${tag}&limit=12&page=${page}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                });
                const items = Array.isArray(res.data)
                    ? res.data.filter(p => (p.sample_url || p.jpeg_url) && !p.file_url?.endsWith('.zip'))
                    : [];

                if (items.length === 0) throw new Error('Sin posts con muestra en yande.re');
                const picked = items[Math.floor(Math.random() * items.length)];
                const url = picked.sample_url || picked.jpeg_url;
                if (!url) throw new Error('Sin muestra en yande.re');
                return { type: 'image', url };
            };

            // Proveedor 4: Catálogo curado de alta disponibilidad (Respuesta inmediata)
            const getCuratedMedia = async () => {
                const item = CURATED_DARK_MEDIA[Math.floor(Math.random() * CURATED_DARK_MEDIA.length)];
                return item;
            };

            // Estrategia equilibrada según si toca turno GIF o Imagen
            const providers = isGifTurn
                ? [getPurrbotGif, getNekobotImage, getYandereImage, getCuratedMedia]
                : [getNekobotImage, getYandereImage, getPurrbotGif, getCuratedMedia];

            let enviado = false;

            for (const getMedia of providers) {
                if (enviado) break;
                try {
                    const item = await getMedia();
                    if (!item) continue;

                    if (item.type === 'video') {
                        if (item.buffer) {
                            await sock.sendMessage(jid, {
                                video: item.buffer,
                                caption: '😈 _Unknown Codexツ</> Dark +18_',
                                gifPlayback: true,
                                mimetype: 'video/mp4'
                            }, { quoted: m });
                            enviado = true;
                            break;
                        } else if (item.url) {
                            await sock.sendMessage(jid, {
                                video: { url: item.url },
                                caption: '😈 _Unknown Codexツ</> Dark +18_',
                                gifPlayback: true,
                                mimetype: 'video/mp4'
                            }, { quoted: m });
                            enviado = true;
                            break;
                        }
                    } else if (item.type === 'image' && item.url) {
                        await sock.sendMessage(jid, {
                            image: { url: item.url },
                            caption: '😈 _Unknown Codexツ</> Dark +18_'
                        }, { quoted: m });
                        enviado = true;
                        break;
                    }
                } catch (err) {
                    // Continuar al siguiente proveedor sin saturar la terminal
                    continue;
                }
            }

            // Fallback final garantizado si todos los anteriores fallaron
            if (!enviado) {
                const fallbackItem = CURATED_DARK_MEDIA[Math.floor(Math.random() * CURATED_DARK_MEDIA.length)];
                if (fallbackItem.type === 'video') {
                    await sock.sendMessage(jid, {
                        video: { url: fallbackItem.url },
                        caption: '😈 _Unknown Codexツ</> Dark +18_',
                        gifPlayback: true,
                        mimetype: 'video/mp4'
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(jid, {
                        image: { url: fallbackItem.url },
                        caption: '😈 _Unknown Codexツ</> Dark +18_'
                    }, { quoted: m });
                }
            }

        } finally {
            activeDarkRequests.delete(userKey);
        }
    }
};

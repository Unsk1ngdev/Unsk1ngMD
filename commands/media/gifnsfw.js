'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const nsfwManager = require('../../lib/nsfw');
const ffmpeg = require('../../lib/ffmpeg');
const config = require('../../config');
const { createTempPath, safeUnlink } = require('../../lib/cleaner');

// Colección curada de alta velocidad (MP4 directos ligeros < 200KB, reproducción instantánea sin transcodificación)
const CURATED_NSFW_GIFS = [
    'https://telegra.ph/file/61d85d10baf2e3b9a4cde.mp4',
    'https://telegra.ph/file/538c95e4f1c481bcc3cce.mp4',
    'https://telegra.ph/file/e999ef6e67a1a75a515d6.mp4',
    'https://telegra.ph/file/05c1bd3a2ec54428ac2fc.mp4',
    'https://telegra.ph/file/36149496affe5d02c8965.mp4',
    'https://telegra.ph/file/82d32821f3b57b62359f2.mp4',
    'https://telegra.ph/file/a2ad1dd463a935d5dfd17.mp4',
    'https://telegra.ph/file/e3abb2e79cd1ccf709e91.mp4',
    'https://telegra.ph/file/c5be4a906531c6731cd41.mp4',
    'https://telegra.ph/file/9c4b894e034c290df75e4.mp4',
    'https://telegra.ph/file/3246f62c61a0ebebcb5c8.mp4',
    'https://telegra.ph/file/820460f05d76bb2329bbc.mp4',
    'https://telegra.ph/file/22d0ef801c93c1b2ac074.mp4',
    'https://telegra.ph/file/6f66fd1974e8df1496768.mp4',
    'https://telegra.ph/file/e6bf14b93dfe22c4972d0.mp4',
    'https://telegra.ph/file/075db3ebba7126d2f0d95.mp4',
    'https://telegra.ph/file/37c21753892b5d843b9ce.mp4',
    'https://telegra.ph/file/04bbf490e29158f03e348.mp4'
];

module.exports = {
    name: 'gifnsfw',
    alias: ['nsfwgif', 'hentaigif', 'gifhentai', 'anigensfw'],
    category: 'multimedia',
    desc: 'Envía un GIF animado explícito de anime y hentai +18 en grupos con NSFW activo',
    usage: '.gifnsfw',
    CURATED_NSFW_GIFS,

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 Activa NSFW primero con *.nsfw on*\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        if (typeof m.react === 'function') {
            try { await m.react('🔞'); } catch (_) {}
        }

        await sock.sendMessage(jid, {
            text: '🎬 Buscando GIF anime +18...\n_Unknown Codexツ</>_'
        }, { quoted: m });

        // Proveedores en orden de velocidad y estabilidad
        const categories = ['blowjob', 'anal', 'cum', 'fuck', 'pussylick', 'solo'].sort(() => Math.random() - 0.5);

        const providers = [
            // Fuente 1: NekoBot API (Ultra rápida, GIF directo)
            async () => {
                const res = await axios.get('https://nekobot.xyz/api/image?type=pgif', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                });
                const url = res.data?.message;
                if (!url) throw new Error('Sin URL en Nekobot');
                return { url, isMp4: false };
            },
            // Fuente 2: PurrBot API v2 moderna
            async () => {
                const ep = categories[0] || 'blowjob';
                const res = await axios.get(`https://api.purrbot.site/v2/img/nsfw/${ep}/gif`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                });
                const url = res.data?.link;
                if (!url) throw new Error('Sin URL en PurrBot');
                return { url, isMp4: false };
            },
            // Fuente 3: Segunda categoría PurrBot API v2
            async () => {
                const ep = categories[1] || 'cum';
                const res = await axios.get(`https://api.purrbot.site/v2/img/nsfw/${ep}/gif`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                });
                const url = res.data?.link;
                if (!url) throw new Error('Sin URL en PurrBot 2');
                return { url, isMp4: false };
            },
            // Fuente 4: Catálogo curado garantizado (Direct MP4, instantáneo)
            async () => {
                const picked = CURATED_NSFW_GIFS[Math.floor(Math.random() * CURATED_NSFW_GIFS.length)];
                return { url: picked, isMp4: true };
            }
        ];

        let enviado = false;

        for (const getMediaInfo of providers) {
            if (enviado) break;

            try {
                const info = await getMediaInfo();
                if (!info || !info.url) continue;

                // Si ya es un video MP4 directo (como la fuente curada), enviarlo al instante
                if (info.isMp4 || info.url.endsWith('.mp4')) {
                    try {
                        const mp4Res = await axios.get(info.url, {
                            responseType: 'arraybuffer',
                            timeout: 5000,
                            maxContentLength: 5 * 1024 * 1024
                        });
                        const mp4Buf = Buffer.from(mp4Res.data);
                        if (mp4Buf && mp4Buf.length > 500) {
                            await sock.sendMessage(jid, {
                                video: mp4Buf,
                                caption: '🎬 _Unknown Codexツ</> +18 Anime GIF_',
                                gifPlayback: true
                            }, { quoted: m });
                            enviado = true;
                            break;
                        }
                    } catch (_) {
                        // Intentar enviar directamente por URL como fallback rápido
                        await sock.sendMessage(jid, {
                            video: { url: info.url },
                            caption: '🎬 _Unknown Codexツ</> +18 Anime GIF_',
                            gifPlayback: true
                        }, { quoted: m });
                        enviado = true;
                        break;
                    }
                }

                // Descargar GIF con límite estricto de tamaño (máx. 4MB) para no bloquear ni saturar memoria
                const resMedia = await axios.get(info.url, {
                    responseType: 'arraybuffer',
                    timeout: 6000,
                    maxContentLength: 4 * 1024 * 1024,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                let rawBuffer = null;
                if (Buffer.isBuffer(resMedia.data)) {
                    rawBuffer = resMedia.data;
                } else if (resMedia.data instanceof ArrayBuffer) {
                    rawBuffer = Buffer.from(resMedia.data);
                } else if (typeof resMedia.data === 'string') {
                    rawBuffer = Buffer.from(resMedia.data, 'binary');
                } else if (resMedia.data) {
                    rawBuffer = Buffer.from(resMedia.data);
                }

                if (!rawBuffer || rawBuffer.length < 50) continue;

                let finalVideoBuffer = null;
                const isAlreadyMp4 = rawBuffer.length > 8 && rawBuffer.slice(4, 8).toString() === 'ftyp';

                if (isAlreadyMp4) {
                    finalVideoBuffer = rawBuffer;
                } else if (ffmpeg.isFfmpegAvailable()) {
                    const tmpIn = createTempPath('gif');
                    const tmpOut = createTempPath('mp4');

                    try {
                        await fs.writeFile(tmpIn, rawBuffer);
                        await ffmpeg.convertGifToMp4(tmpIn, tmpOut, { timeout: 10000 });
                        if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 50) {
                            const converted = await fs.readFile(tmpOut);
                            if (converted.length > 8) {
                                finalVideoBuffer = converted;
                            }
                        }
                    } catch (convErr) {
                        console.error('[GIFNSFW] Conversión a MP4 falló:', convErr.message);
                    } finally {
                        await safeUnlink(tmpIn);
                        await safeUnlink(tmpOut);
                    }
                }

                if (finalVideoBuffer) {
                    await sock.sendMessage(jid, {
                        video: finalVideoBuffer,
                        caption: '🎬 _Unknown Codexツ</> +18 Anime GIF_',
                        gifPlayback: true
                    }, { quoted: m });
                    enviado = true;
                    break;
                }

            } catch (err) {
                console.error('[GIFNSFW] Proveedor falló:', err.message);
                continue;
            }
        }

        // Si todos los proveedores externos fallaron o tardaron, recurrir al catálogo curado inmediato
        if (!enviado) {
            try {
                const fallbackUrl = CURATED_NSFW_GIFS[Math.floor(Math.random() * CURATED_NSFW_GIFS.length)];
                await sock.sendMessage(jid, {
                    video: { url: fallbackUrl },
                    caption: '🎬 _Unknown Codexツ</> +18 Anime GIF_',
                    gifPlayback: true
                }, { quoted: m });
                enviado = true;
            } catch (finalErr) {
                console.error('[GIFNSFW] Fallback final falló:', finalErr.message);
                await sock.sendMessage(jid, {
                    text: '❌ Error al obtener GIF anime +18.\nIntenta de nuevo en unos segundos.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }
    }
};

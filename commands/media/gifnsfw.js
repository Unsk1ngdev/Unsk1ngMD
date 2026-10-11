'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const nsfwManager = require('../../lib/nsfw');
const ffmpeg = require('../../lib/ffmpeg');

module.exports = {
    name: 'gifnsfw',
    alias: ['nsfwgif', 'hentaigif', 'gifporn'],
    category: 'multimedia',
    desc: 'Envía un GIF animado explícito +18 optimizado para WhatsApp en grupos con NSFW activo',
    usage: '.gifnsfw',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 Activa NSFW primero con *.nsfw on*\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        await sock.sendMessage(jid, {
            text: '🎬 Buscando GIF +18...'
        }, { quoted: m });

        const availableEndpoints = [
            'blowjob', 'anal', 'cum', 'fuck', 'yaoi',
            'pussylick', 'solo', 'threesome_fff', 'threesome_ffm'
        ].sort(() => Math.random() - 0.5);

        let enviado = false;

        // Intentar hasta con 3 endpoints distintos si alguno presenta lentitud
        for (let i = 0; i < Math.min(3, availableEndpoints.length); i++) {
            if (enviado) break;
            const ep = availableEndpoints[i];

            try {
                // 1. Obtener URL del GIF
                const resMeta = await axios.get(`https://purrbot.site/api/img/nsfw/${ep}/gif`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 5000
                });
                const url = resMeta.data?.link;
                if (!url) continue;

                // 2. Descargar el archivo binario
                const resMedia = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const rawBuffer = Buffer.from(resMedia.data);
                const isMp4 = url.toLowerCase().endsWith('.mp4');

                let finalVideoBuffer = rawBuffer;

                // 3. Conversión ultrarrápida a MP4 compatible con WhatsApp (H.264, yuv420p)
                if (!isMp4 && ffmpeg.isFfmpegAvailable()) {
                    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
                    const tmpIn = path.join(process.cwd(), `tmp_gif_in_${tmpId}.gif`);
                    const tmpOut = path.join(process.cwd(), `tmp_gif_out_${tmpId}.mp4`);

                    try {
                        fs.writeFileSync(tmpIn, rawBuffer);
                        await ffmpeg.convertGifToMp4(tmpIn, tmpOut);
                        if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 0) {
                            finalVideoBuffer = fs.readFileSync(tmpOut);
                        }
                    } catch (convErr) {
                        console.error('[GIFNSFW] Conversión falló, usando original:', convErr.message);
                    } finally {
                        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
                        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
                    }
                }

                // 4. Enviar a WhatsApp como GIF animado nativo
                await sock.sendMessage(jid, {
                    video: finalVideoBuffer,
                    caption: '🎬 _Unknown Codexツ</> +18 GIF_',
                    gifPlayback: true,
                    mimetype: 'video/mp4'
                }, { quoted: m });

                enviado = true;
                break;
            } catch (e) {
                console.error(`[GIFNSFW] Intento con ${ep} falló:`, e.message);
                continue;
            }
        }

        if (!enviado) {
            await sock.sendMessage(jid, {
                text: '❌ Error al obtener GIF.\nIntenta de nuevo en unos segundos.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }
    }
};

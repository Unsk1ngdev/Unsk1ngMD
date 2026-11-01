'use strict';

const path = require('path');
const fs = require('fs-extra');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('../../lib/logger');
const { runFfmpeg, isFfmpegAvailable } = require('../../lib/ffmpeg');

const tmpDir = path.join(process.cwd(), 'tmp');
fs.ensureDirSync(tmpDir);

module.exports = {
    name: 'wink',
    alias: ['hdvideo', 'videohd', 'mejorarvideo', 'winkai', 'enhancevideo'],
    category: 'multimedia',
    desc: 'Remasteriza y mejora la nitidez, resolución, contraste y calidad de un video a Ultra HD (Wink Engine)',
    usage: '.wink (respondiendo a un video o enviando un video)',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        // 1. Detectar si hay un video en el mensaje o citado
        const quoted = m.quoted;
        let isVideo = false;
        let targetMsg = null;
        let targetKey = null;

        if (quoted) {
            const qMime = quoted.mimetype || quoted.message?.videoMessage?.mimetype || '';
            if (quoted.type === 'videoMessage' || qMime.startsWith('video/')) {
                isVideo = true;
                targetMsg = quoted.message?.videoMessage ? { videoMessage: quoted.message.videoMessage } : quoted.message;
                targetKey = quoted.key || m.key;
            }
        } else {
            const mMime = m.mimetype || m.message?.videoMessage?.mimetype || '';
            if (m.type === 'videoMessage' || mMime.startsWith('video/')) {
                isVideo = true;
                targetMsg = m.message?.videoMessage ? { videoMessage: m.message.videoMessage } : m.message;
                targetKey = m.key;
            }
        }

        if (!isVideo) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ✨ MEJORADOR DE VIDEO ULTRA HD (WINK) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* Responde a un video corto con `.wink`',
                    '┃├◆ 📌 *Ejemplo:* Envía un video con el texto `.wink`',
                    '┃',
                    '┃├◆ 🎬 Aplica reducción de ruido, máscara de enfoque,',
                    '┃  balance de color cinematográfico y super-resolución.',
                    '┃',
                    '┃├◆ ⏱️ *Límite recomendado:* Videos de hasta 45 segundos.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        if (!isFfmpegAvailable()) {
            return await sock.sendMessage(jid, {
                text: '⚠️ El procesador multimedia (FFmpeg) no está disponible en este momento.'
            }, { quoted: m });
        }

        await m.react?.('⏳');
        await sock.sendMessage(jid, {
            text: '✨ *Remasterizando video...* Aplicando filtros de súper-resolución, reducción de ruido y enfoque Ultra HD.'
        }, { quoted: m });

        const timestamp = Date.now();
        const randId = Math.random().toString(36).substring(7);
        const tempInput = path.join(tmpDir, `wink_in_${timestamp}_${randId}.mp4`);
        const tempOutput = path.join(tmpDir, `wink_out_${timestamp}_${randId}.mp4`);
        const filesToClean = [tempInput, tempOutput];

        try {
            // 2. Descargar video
            let buffer = null;
            const target = quoted || m;
            if (typeof target.download === 'function') {
                try { buffer = await target.download(); } catch (_) {}
            }
            if (!buffer && targetMsg) {
                buffer = await downloadMediaMessage(
                    { message: targetMsg, key: targetKey },
                    'buffer',
                    {},
                    { logger, reuploadRequest: sock.updateMediaMessage }
                );
            }

            if (!buffer || buffer.length === 0) {
                throw new Error('No se pudo descargar el video desde WhatsApp.');
            }

            await fs.writeFile(tempInput, buffer);

            // 3. Cadena de filtros de remasterización Ultra HD
            // - hqdn3d: Reductor de ruido de luminancia y crominancia de alta precisión
            // - unsharp: Filtro de máscara de enfoque que resalta bordes y texturas
            // - eq: Ajuste sutil de contraste y saturación para un acabado cinematográfico
            // - scale: Escalado por interpolación Lanczos asegurando dimensiones pares (requerido por H.264)
            const videoFilters = [
                'hqdn3d=1.5:1.5:6:6',
                'unsharp=5:5:1.0:5:5:0.0',
                'eq=contrast=1.12:brightness=0.01:saturation=1.2',
                'scale=trunc(iw*1.25/2)*2:trunc(ih*1.25/2)*2:flags=lanczos'
            ].join(',');

            await runFfmpeg([
                '-y',
                '-i', tempInput,
                '-vf', videoFilters,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '19',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'copy',
                tempOutput
            ], { timeout: 90000 });

            if (!fs.existsSync(tempOutput)) {
                throw new Error('El proceso de renderizado no generó el video final.');
            }

            const enhancedBuffer = await fs.readFile(tempOutput);
            if (!enhancedBuffer || enhancedBuffer.length === 0) {
                throw new Error('El video procesado resultó en un archivo vacío.');
            }

            await m.react?.('✨');

            await sock.sendMessage(jid, {
                video: enhancedBuffer,
                caption: [
                    '┏❐ 《 ✨ VIDEO REMASTERIZADO ULTRA HD 》 ❐',
                    '┃',
                    '┃├◆ 🎬 *Motor:* Wink AI Enhancement Pipeline',
                    '┃├◆ 🔍 *Mejoras aplicadas:*',
                    '┃   • Filtro de nitidez y micro-contraste',
                    '┃   • Reducción de ruido visual y artefactos',
                    '┃   • Escalado Lanczos de alta fidelidad',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });

        } catch (err) {
            logger.error('[WINK ERROR]:', err.message);
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ Error al remasterizar el video: ${err.message}`
            }, { quoted: m });
        } finally {
            for (const file of filesToClean) {
                try {
                    if (fs.existsSync(file)) await fs.remove(file);
                } catch (_) {}
            }
        }
    }
};


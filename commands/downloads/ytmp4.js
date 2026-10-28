const path = require('path');
const fs = require('fs-extra');
const logger = require('../../lib/logger');
const { runFfmpeg, isFfmpegAvailable } = require('../../lib/ffmpeg');
const {
    execYtdlp,
    getYtMetadata,
    extractYouTubeId,
    formatDuration,
    sanitizeTitle
} = require('../../lib/ytdlp');

const tmpDir = path.join(process.cwd(), 'tmp');
fs.ensureDirSync(tmpDir);

const MAX_DURATION_SECONDS = 15 * 60; // Límite máximo: 15 minutos

module.exports = {
    name: 'ytmp4',
    alias: ['ytv', 'videoyt', 'mp4yt', 'playvideo', 'video', 'play2'],
    category: 'descargas',
    desc: 'Descarga y transcodifica video de YouTube hasta 720p en MP4 compatible con WhatsApp (H.264/AAC)',
    usage: '.ytmp4 [enlace de YouTube o Shorts]',
    execute: async ({ sock, m, text }) => {
        const inputUrl = text?.trim() || m.quoted?.body?.trim();
        if (!inputUrl) {
            return await m.reply('❌ Por favor, proporciona un enlace de video de YouTube.\nEjemplo: *.ytmp4 https://youtu.be/...*');
        }

        const videoId = extractYouTubeId(inputUrl);
        if (!videoId) {
            return await m.reply('❌ Enlace de YouTube no válido. Asegúrate de incluir un link de youtube.com o youtu.be.');
        }

        // Comprobar disponibilidad de dependencias
        if (!isFfmpegAvailable()) {
            return await m.reply('⚠️ El conversor multimedia (FFmpeg) no está disponible en este momento en el servidor.');
        }

        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        await m.react('⏳');

        // Aviso preliminar al usuario
        await m.reply('⏳ Descargando y procesando video...');

        const timestamp = Date.now();
        const rawPrefix = `ytdl_video_${timestamp}_${Math.random().toString(36).substring(7)}`;
        const rawOutputTemplate = path.join(tmpDir, `${rawPrefix}.%(ext)s`);
        const finalMp4Path = path.join(tmpDir, `${rawPrefix}_final.mp4`);

        let downloadedRawFile = null;

        try {
            // 1. Validación previa de metadatos (duración máxima 15 minutos)
            const metadata = await getYtMetadata(ytUrl);
            const duration = Number(metadata?.duration) || 0;
            const title = sanitizeTitle(metadata?.title || `video_${videoId}`);

            if (duration > MAX_DURATION_SECONDS) {
                await m.react('❌');
                return await m.reply(`❌ El video excede el límite máximo de 15 minutos (Duración: ${formatDuration(duration)}).`);
            }

            // 2. Descargar mejor video y mejor audio con parámetros de elusión anti-403 y fusión forzada a MP4
            await execYtdlp([
                '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
                '--merge-output-format', 'mp4',
                '--no-playlist',
                '--no-warnings',
                '--extractor-args', 'youtube:player_client=android,ios',
                '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                '--no-check-certificates',
                '--prefer-free-formats',
                '-o', rawOutputTemplate,
                ytUrl
            ], { timeout: 240000 });

            // Localizar el archivo descargado por yt-dlp en ./tmp/ (filtrando temporales incompletos)
            const filesInTmp = await fs.readdir(tmpDir);
            const candidateFiles = filesInTmp.filter(f =>
                f.startsWith(rawPrefix) &&
                !f.endsWith('_final.mp4') &&
                !f.endsWith('.part') &&
                !f.endsWith('.ytdl') &&
                !f.endsWith('.temp')
            );

            // Priorizar el archivo .mp4 generado por el merge
            const matchName = candidateFiles.find(f => f.endsWith('.mp4')) ||
                              candidateFiles.find(f => f.endsWith('.mkv') || f.endsWith('.webm')) ||
                              candidateFiles[0];

            if (!matchName) {
                throw new Error('No se pudo localizar el archivo de video descargado por yt-dlp.');
            }

            downloadedRawFile = path.join(tmpDir, matchName);

            // 3. Transcodificación obligatoria compatible con WhatsApp:
            // Contenedor MP4 con códec de video H.264 (libx264), audio AAC (aac), mapeo seguro y faststart
            await runFfmpeg([
                '-y',
                '-i', downloadedRawFile,
                '-map', '0:v:0',
                '-map', '0:a:0?',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '26',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ar', '44100',
                '-ac', '2',
                '-movflags', '+faststart',
                finalMp4Path
            ], { timeout: 180000 });

            if (!fs.existsSync(finalMp4Path)) {
                throw new Error('El archivo de video final no fue generado.');
            }

            const stats = await fs.stat(finalMp4Path);
            const sizeInMb = stats.size / (1024 * 1024);

            if (stats.size === 0) {
                throw new Error('El archivo de video generado está vacío (0 bytes).');
            }

            // 4. Lógica de envío por tamaño:
            // - Mayor a 100 MB: Cancelar y notificar al usuario
            if (sizeInMb > 100) {
                await m.react('❌');
                return await m.reply(`❌ El video resultante pesa ${sizeInMb.toFixed(1)} MB, superando el límite máximo de 100 MB permitido por WhatsApp.`);
            }

            const videoBuffer = await fs.readFile(finalMp4Path);

            // - Entre 16 MB y 99 MB: Enviar como documento adjunto
            if (sizeInMb >= 16) {
                await sock.sendMessage(m.chat, {
                    document: videoBuffer,
                    mimetype: 'video/mp4',
                    fileName: `${title}.mp4`,
                    caption: `🎬 *${title}*\n⏱️ *Duración:* ${formatDuration(duration)}\n📦 *Peso:* ${sizeInMb.toFixed(2)} MB`
                }, { quoted: m });
            } else {
                // - Menor a 16 MB: Enviar como video estándar con metadatos de duración (seconds) para evitar el bug de 0:00
                await sock.sendMessage(m.chat, {
                    video: videoBuffer,
                    mimetype: 'video/mp4',
                    caption: `🎬 *${title}*\n⏱️ *Duración:* ${formatDuration(duration)}\n📦 *Peso:* ${sizeInMb.toFixed(2)} MB`,
                    seconds: Math.round(duration)
                }, { quoted: m });
            }

            await m.react('✅');

        } catch (err) {
            logger.error('[YTMP4 ERROR]:', err.message);
            await m.react('❌');
            await m.reply(`❌ Ocurrió un error al procesar el video de YouTube: ${err.message}`);
        } finally {
            // 5. Limpieza obligatoria de todos los archivos temporales generados en ./tmp/
            if (downloadedRawFile && fs.existsSync(downloadedRawFile)) {
                try { await fs.unlink(downloadedRawFile); } catch (_) {}
            }
            if (fs.existsSync(finalMp4Path)) {
                try { await fs.unlink(finalMp4Path); } catch (_) {}
            }
            try {
                const lingering = (await fs.readdir(tmpDir)).filter(f => f.startsWith(rawPrefix));
                for (const lFile of lingering) {
                    try { await fs.unlink(path.join(tmpDir, lFile)); } catch (_) {}
                }
            } catch (_) {}
        }
    }
};

const path = require('path');
const fs = require('fs-extra');
const logger = require('../../lib/logger');
const { runFfmpeg, isFfmpegAvailable } = require('../../lib/ffmpeg');
const {
    execYtdlp,
    getYtMetadata,
    extractYouTubeId,
    formatDuration,
    sanitizeTitle,
    ensureYtdlp
} = require('../../lib/ytdlp');

const tmpDir = path.join(process.cwd(), 'tmp');
fs.ensureDirSync(tmpDir);

const MAX_DURATION_SECONDS = 15 * 60; // Límite máximo: 15 minutos

module.exports = {
    name: 'ytmp3',
    alias: ['yta', 'audioyt', 'mp3yt', 'playaudio', 'song', 'play', 'musica'],
    category: 'descargas',
    desc: 'Descarga y recodifica audio de YouTube a MP3 estándar (128kbps/44.1kHz) con yt-dlp y FFmpeg',
    usage: '.ytmp3 [enlace de YouTube o Shorts]',
    execute: async ({ sock, m, text }) => {
        const inputUrl = text?.trim() || m.quoted?.body?.trim();
        if (!inputUrl) {
            return await m.reply('❌ Por favor, proporciona un enlace de YouTube.\nEjemplo: *.ytmp3 https://youtu.be/...*');
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
        await m.reply('⏳ Procesando y descargando audio...');

        const timestamp = Date.now();
        const rawPrefix = `ytdl_audio_${timestamp}_${Math.random().toString(36).substring(7)}`;
        const rawOutputTemplate = path.join(tmpDir, `${rawPrefix}.%(ext)s`);
        const finalMp3Path = path.join(tmpDir, `${rawPrefix}_final.mp3`);

        let downloadedRawFile = null;

        try {
            // 1. Validación previa de metadatos (duración máxima 15 minutos)
            const metadata = await getYtMetadata(ytUrl);
            const duration = Number(metadata?.duration) || 0;
            const title = sanitizeTitle(metadata?.title || `audio_${videoId}`);

            if (duration > MAX_DURATION_SECONDS) {
                await m.react('❌');
                return await m.reply(`❌ El video excede el límite máximo de 15 minutos (Duración: ${formatDuration(duration)}).`);
            }

            // 2. Descargar el mejor flujo de audio a la carpeta ./tmp/ con parámetros de elusión anti-403
            await execYtdlp([
                '-f', 'bestaudio/best',
                '--no-playlist',
                '--no-warnings',
                '--extractor-args', 'youtube:player_client=android,ios',
                '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                '--no-check-certificates',
                '--prefer-free-formats',
                '-o', rawOutputTemplate,
                ytUrl
            ], { timeout: 180000 });

            // Localizar el archivo descargado por yt-dlp en ./tmp/ (filtrando temporales incompletos)
            const filesInTmp = await fs.readdir(tmpDir);
            const candidateFiles = filesInTmp.filter(f =>
                f.startsWith(rawPrefix) &&
                !f.endsWith('_final.mp3') &&
                !f.endsWith('.part') &&
                !f.endsWith('.ytdl') &&
                !f.endsWith('.temp')
            );

            const matchName = candidateFiles[0];

            if (!matchName) {
                throw new Error('No se pudo localizar el archivo de audio descargado por yt-dlp.');
            }

            downloadedRawFile = path.join(tmpDir, matchName);

            // 3. Recodificar obligatoriamente a MP3 estándar con FFmpeg
            // -c:a libmp3lame -b:a 128k -ar 44100
            await runFfmpeg([
                '-y',
                '-i', downloadedRawFile,
                '-vn',
                '-c:a', 'libmp3lame',
                '-b:a', '128k',
                '-ar', '44100',
                '-ac', '2',
                finalMp3Path
            ], { timeout: 120000 });

            // Verificar que el archivo generado exista y tenga contenido
            if (!fs.existsSync(finalMp3Path)) {
                throw new Error('El archivo MP3 final no fue creado por FFmpeg.');
            }

            const stats = await fs.stat(finalMp3Path);
            if (stats.size === 0) {
                throw new Error('El archivo MP3 generado está vacío (0 bytes).');
            }

            // 4. Envío seguro con Baileys (leyendo como buffer, sin ptt y con metadatos de duración)
            const audioBuffer = await fs.readFile(finalMp3Path);

            await sock.sendMessage(m.chat, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
                seconds: Math.round(duration)
            }, { quoted: m });

            await m.react('✅');

        } catch (err) {
            logger.error('[YTMP3 ERROR]:', err.message);
            await m.react('❌');
            await m.reply(`❌ Ocurrió un error al procesar el audio de YouTube: ${err.message}`);
        } finally {
            // 5. Limpieza obligatoria de todos los archivos temporales generados en ./tmp/
            if (downloadedRawFile && fs.existsSync(downloadedRawFile)) {
                try { await fs.unlink(downloadedRawFile); } catch (_) {}
            }
            if (fs.existsSync(finalMp3Path)) {
                try { await fs.unlink(finalMp3Path); } catch (_) {}
            }
            // Limpiar cualquier residuo de esta descarga en ./tmp/
            try {
                const lingering = (await fs.readdir(tmpDir)).filter(f => f.startsWith(rawPrefix));
                for (const lFile of lingering) {
                    try { await fs.unlink(path.join(tmpDir, lFile)); } catch (_) {}
                }
            } catch (_) {}
        }
    }
};

const youtubedl = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs-extra');

const tempDir = path.join(process.cwd(), 'temp');
fs.ensureDirSync(tempDir);

const MAX_DURATION_SECONDS = 15 * 60; // 15 minutos

/**
 * Extrae el ID de 11 caracteres de un enlace de YouTube
 */
const extractYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    return match ? match[1] : null;
};

/**
 * Limpia el título para usarlo como nombre de archivo seguro
 */
const sanitizeTitle = (title) => {
    if (!title) return 'audio';
    return title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'audio';
};

/**
 * Formatea duración en segundos a mm:ss o hh:mm:ss
 */
const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return 'Desconocida';
    const s = Math.round(Number(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

module.exports = {
    name: 'ytmp3',
    alias: ['yta', 'audioyt', 'mp3yt'],
    category: 'descargas',
    desc: 'Descarga y convierte audio de YouTube a MP3 real de 128K con yt-dlp y FFmpeg',
    usage: '.ytmp3 [enlace de YouTube o Shorts]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, proporciona el enlace de YouTube.\nEjemplo: *.ytmp3 https://youtu.be/...*');
        }

        const videoId = extractYouTubeId(text);
        if (!videoId) {
            return await m.reply('❌ Enlace no válido. Asegúrate de incluir un link de youtube.com o youtu.be.');
        }

        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const tempPath = path.join(tempDir, `yt_audio_${Date.now()}.mp3`);

        await m.react('⏳');

        try {
            // 1. Obtener metadatos previos y validar duración máxima permitida (15 minutos)
            let title = `audio_${videoId}`;
            let duration = 0;

            try {
                const meta = await youtubedl(ytUrl, {
                    dumpSingleJson: true,
                    noWarnings: true,
                    noCheckCertificates: true
                });
                if (meta?.title) title = meta.title;
                if (meta?.duration) duration = meta.duration;

                if (duration > MAX_DURATION_SECONDS) {
                    await m.react('❌');
                    return await m.reply(`❌ El video dura ${formatDuration(duration)} y supera el límite máximo permitido de 15 minutos.`);
                }
            } catch (metaErr) {
                // Si falla dumpSingleJson, continuar con la descarga
            }

            // 2. Extraer audio y transcodificar obligatoriamente a MP3 real con FFmpeg (128K)
            await youtubedl(ytUrl, {
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: '128K',
                output: tempPath,
                noPlaylist: true,
                noWarnings: true,
                noCheckCertificates: true
            });

            // 3. Verificar que el archivo exista y pese más de 0 bytes
            if (!fs.existsSync(tempPath)) {
                throw new Error('El archivo de audio no se generó en el almacenamiento temporal.');
            }

            const stat = fs.statSync(tempPath);
            if (!stat || stat.size === 0) {
                throw new Error('El archivo descargado está vacío o corrupto (0 bytes).');
            }

            const cleanTitle = sanitizeTitle(title);

            // 4. Enviar a Baileys usando fs.readFileSync y mimetype 'audio/mpeg'
            await sock.sendMessage(m.chat, {
                audio: fs.readFileSync(tempPath),
                mimetype: 'audio/mpeg',
                fileName: `${cleanTitle}.mp3`,
                ptt: false
            }, { quoted: m });

            await m.react('✅');

        } catch (err) {
            await m.react('❌');
            await m.reply(`❌ Error al procesar el audio de YouTube: ${err.message || 'Error desconocido'}`);
        } finally {
            // 5. Eliminar obligatoriamente el archivo temporal
            if (fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                } catch (_) {}
            }
        }
    }
};

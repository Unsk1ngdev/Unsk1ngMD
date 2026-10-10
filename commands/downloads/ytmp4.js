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
    if (!title) return 'video';
    return title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'video';
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
    name: 'ytmp4',
    alias: ['ytv', 'videoyt', 'mp4yt'],
    category: 'descargas',
    desc: 'Descarga y multiplexa video y audio de YouTube hasta 720p en MP4 real con yt-dlp y FFmpeg',
    usage: '.ytmp4 [enlace de YouTube o Shorts]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, proporciona el enlace del video de YouTube.\nEjemplo: *.ytmp4 https://youtu.be/...*');
        }

        const videoId = extractYouTubeId(text);
        if (!videoId) {
            return await m.reply('❌ Enlace no válido. Asegúrate de incluir un link de youtube.com o youtu.be.');
        }

        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const tempPath = path.join(tempDir, `yt_video_${Date.now()}.mp4`);

        await m.react('⏳');

        try {
            // 1. Obtener metadatos previos y validar duración máxima permitida (15 minutos)
            let title = `video_${videoId}`;
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

            // 2. Descargar y multiplexar video (máx 720p) + audio con FFmpeg en contenedor MP4
            await youtubedl(ytUrl, {
                format: 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
                mergeOutputFormat: 'mp4',
                output: tempPath,
                noPlaylist: true,
                noWarnings: true,
                noCheckCertificates: true
            });

            // 3. Verificar que el archivo exista y pese más de 0 bytes
            if (!fs.existsSync(tempPath)) {
                throw new Error('El archivo de video no se generó en el almacenamiento temporal.');
            }

            const stat = fs.statSync(tempPath);
            if (!stat || stat.size === 0) {
                throw new Error('El archivo de video descargado está vacío o corrupto (0 bytes).');
            }

            const sizeBytes = stat.size;
            const sizeMB = sizeBytes / (1024 * 1024);

            // Validar límite de 100 MB para WhatsApp
            if (sizeMB > 100) {
                await m.react('❌');
                return await m.reply(`❌ El video supera los 100 MB permitidos por WhatsApp (Tamaño: ${sizeMB.toFixed(1)} MB).`);
            }

            const cleanTitle = sanitizeTitle(title);
            const durationFormatted = formatDuration(duration);
            const caption = `🎬 *${title}*\n⏳ *Duración:* ${durationFormatted}\n📦 *Peso:* ${sizeMB.toFixed(1)} MB`;

            // 4. Envío condicional según el peso:
            // Entre 16 MB y 99 MB: como documento
            if (sizeMB >= 16) {
                await sock.sendMessage(m.chat, {
                    document: fs.readFileSync(tempPath),
                    mimetype: 'video/mp4',
                    fileName: `${cleanTitle}.mp4`,
                    caption: caption
                }, { quoted: m });
            } else {
                // Menor a 16 MB: como video reproducible directo
                await sock.sendMessage(m.chat, {
                    video: fs.readFileSync(tempPath),
                    mimetype: 'video/mp4',
                    caption: caption
                }, { quoted: m });
            }

            await m.react('✅');

        } catch (err) {
            await m.react('❌');
            await m.reply(`❌ Error al procesar el video de YouTube: ${err.message || 'Error desconocido'}`);
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

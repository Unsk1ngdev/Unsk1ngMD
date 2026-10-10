const youtubedl = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const { savefrom } = require('./savefrom');

const tempDir = path.join(process.cwd(), 'temp');
fs.ensureDirSync(tempDir);

/**
 * Extrae el ID de 11 caracteres de un enlace de YouTube
 */
const extractYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    return match ? match[1] : null;
};

/**
 * Formatea duración en segundos a hh:mm:ss o mm:ss
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

/**
 * Limpia un título para usarlo como nombre de archivo válido
 */
const sanitizeFilename = (name) => {
    if (!name) return 'audio';
    return name.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 50) || 'audio';
};

/**
 * Extractor de Audio Robusto (.ytmp3)
 * Extrae pista de audio en MP3 con bitrate 128k/192k usando yt-dlp y ffmpeg
 */
const downloadYtAudio = async (url) => {
    const videoId = extractYouTubeId(url);
    if (!videoId) throw new Error('Enlace de YouTube no válido.');

    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `audio_${timestamp}_${videoId}.mp3`);

    let title = `Audio_${videoId}`;
    let duration = null;

    try {
        // 1. Extractor principal: yt-dlp nativo
        let meta = null;
        try {
            meta = await youtubedl(ytUrl, {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificates: true
            });
            if (meta?.title) title = meta.title;
            if (meta?.duration) duration = meta.duration;
        } catch (mErr) {
            // Continuar con descarga si dumpSingleJson falla
        }

        await youtubedl(ytUrl, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: '128K',
            output: outputPath,
            noPlaylist: true,
            noWarnings: true,
            noCheckCertificates: true
        });

        if (fs.existsSync(outputPath)) {
            const buffer = await fs.readFile(outputPath);
            return {
                buffer,
                title,
                cleanFileName: sanitizeFilename(title),
                duration: formatDuration(duration)
            };
        }
    } catch (ytDlpError) {
        // Fallback secundario si yt-dlp encuentra problemas de red o restricción
        try {
            const sfRes = await savefrom(ytUrl, 10000);
            if (sfRes && sfRes[0]?.url) {
                const formats = sfRes[0].url;
                const audioObj = formats.find(u => (u.ext === 'm4a' || u.audio) && !u.url.includes('sf-converter'))
                    || formats.find(u => u.audio || u.ext === 'mp3');
                if (audioObj?.url) {
                    const audioRes = await axios.get(audioObj.url, { responseType: 'arraybuffer', timeout: 35000 });
                    return {
                        buffer: Buffer.from(audioRes.data),
                        title: sfRes[0].meta?.title || title,
                        cleanFileName: sanitizeFilename(sfRes[0].meta?.title || title),
                        duration: formatDuration(duration)
                    };
                }
            }
        } catch (sfErr) {}

        throw new Error(`Fallo en la extracción de audio: ${ytDlpError.message}`);
    } finally {
        // Limpieza estricta de disco inmediatamente después de cargar a memoria
        if (fs.existsSync(outputPath)) {
            try {
                await fs.remove(outputPath);
            } catch (e) {}
        }
    }
};

/**
 * Extractor de Video Robusto (.ytmp4)
 * Descarga y multiplexa video + audio en resolución máxima de 720p
 */
const downloadYtVideo = async (url) => {
    const videoId = extractYouTubeId(url);
    if (!videoId) throw new Error('Enlace de YouTube no válido.');

    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `video_${timestamp}_${videoId}.mp4`);

    let title = `Video_${videoId}`;
    let duration = null;

    try {
        // 1. Obtener metadatos
        let meta = null;
        try {
            meta = await youtubedl(ytUrl, {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificates: true
            });
            if (meta?.title) title = meta.title;
            if (meta?.duration) duration = meta.duration;
        } catch (mErr) {}

        // 2. Extractor principal: yt-dlp con multiplexado video + audio (máx 720p)
        await youtubedl(ytUrl, {
            format: 'bv*[height<=720]+ba/b[height<=720]/best',
            mergeOutputFormat: 'mp4',
            output: outputPath,
            noPlaylist: true,
            noWarnings: true,
            noCheckCertificates: true
        });

        if (fs.existsSync(outputPath)) {
            const buffer = await fs.readFile(outputPath);
            return {
                buffer,
                title,
                cleanFileName: sanitizeFilename(title),
                duration: formatDuration(duration)
            };
        }
    } catch (ytDlpError) {
        // Fallback secundario si yt-dlp falla
        try {
            const sfRes = await savefrom(ytUrl, 10000);
            if (sfRes && sfRes[0]?.url) {
                const formats = sfRes[0].url;
                const directVideo = formats.find(u => u.ext === 'mp4' && !u.url.includes('sf-converter') && (u.quality === '360' || u.quality === '720' || u.quality === '480'))
                    || formats.find(u => u.ext === 'mp4' && !u.url.includes('sf-converter'));
                if (directVideo?.url) {
                    const vidRes = await axios.get(directVideo.url, { responseType: 'arraybuffer', timeout: 45000 });
                    return {
                        buffer: Buffer.from(vidRes.data),
                        title: sfRes[0].meta?.title || title,
                        cleanFileName: sanitizeFilename(sfRes[0].meta?.title || title),
                        duration: formatDuration(duration)
                    };
                }
            }
        } catch (sfErr) {}

        throw new Error(`Fallo en la extracción de video: ${ytDlpError.message}`);
    } finally {
        // Limpieza estricta de disco inmediatamente después de cargar a memoria
        if (fs.existsSync(outputPath)) {
            try {
                await fs.remove(outputPath);
            } catch (e) {}
        }
    }
};

module.exports = {
    extractYouTubeId,
    formatDuration,
    sanitizeFilename,
    downloadYtAudio,
    downloadYtVideo
};


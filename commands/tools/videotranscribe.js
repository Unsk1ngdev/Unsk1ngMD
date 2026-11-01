'use strict';

const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('../../lib/logger');
const { runFfmpeg, isFfmpegAvailable } = require('../../lib/ffmpeg');
const { execYtdlp, isYtdlpAvailable } = require('../../lib/ytdlp');

const tmpDir = path.join(process.cwd(), 'tmp');
fs.ensureDirSync(tmpDir);

/**
 * Transcribe un archivo de audio usando la API de Groq (Whisper Large v3)
 */
async function transcribeAudioGroq(audioFilePath, groqApiKey) {
    const form = new FormData();
    form.append('file', fs.createReadStream(audioFilePath));
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');

    const res = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${groqApiKey}`
        },
        timeout: 90000,
        maxBodyLength: 30 * 1024 * 1024,
        maxContentLength: 30 * 1024 * 1024
    });

    return {
        text: res.data?.text || '',
        language: res.data?.language || 'auto',
        duration: res.data?.duration || null
    };
}

module.exports = {
    name: 'videotranscribe',
    alias: ['transcribirvideo', 'vtranscribe', 'videototext', 'transcribir', 'audiototext'],
    category: 'herramientas',
    desc: 'Transcribe el audio de un video o URL a texto utilizando IA Whisper',
    usage: '.videotranscribe [URL de video] o citando un video/audio con .videotranscribe',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const rawInput = (args && args[0] ? args[0] : (text || '')).trim();

        // 1. Detectar si hay una URL o mensaje multimedia citado
        const urlMatch = rawInput.match(/https?:\/\/[^\s]+/i);
        const inputUrl = urlMatch ? urlMatch[0] : null;

        const quoted = m.quoted;
        let isQuotedMedia = false;
        let quotedType = '';

        if (quoted) {
            const qMime = quoted.mimetype || quoted.message?.videoMessage?.mimetype || quoted.message?.audioMessage?.mimetype || '';
            if (quoted.type === 'videoMessage' || qMime.startsWith('video/')) {
                isQuotedMedia = true;
                quotedType = 'video';
            } else if (quoted.type === 'audioMessage' || qMime.startsWith('audio/')) {
                isQuotedMedia = true;
                quotedType = 'audio';
            }
        } else {
            const mMime = m.mimetype || m.message?.videoMessage?.mimetype || m.message?.audioMessage?.mimetype || '';
            if (m.type === 'videoMessage' || mMime.startsWith('video/')) {
                isQuotedMedia = true;
                quotedType = 'video';
            } else if (m.type === 'audioMessage' || mMime.startsWith('audio/')) {
                isQuotedMedia = true;
                quotedType = 'audio';
            }
        }

        if (!inputUrl && !isQuotedMedia) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎙️ TRANSCRIBIR VIDEO A TEXTO 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Modo 1 (Por enlace):*',
                    '┃   `.videotranscribe https://youtu.be/...`',
                    '┃   `.videotranscribe https://www.tiktok.com/...`',
                    '┃',
                    '┃├◆ 📋 *Modo 2 (Citando un video):*',
                    '┃   Responde a un video o nota de voz con:',
                    '┃   `.videotranscribe`',
                    '┃',
                    '┃├◆ 🤖 *Tecnología:* Whisper Large v3 IA',
                    '┃  Extrae la voz y la convierte a texto en segundos.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const groqKey = (process.env.GROQ_API_KEY || '').trim();
        if (!groqKey) {
            return await sock.sendMessage(jid, {
                text: '❌ El servicio de transcripción requiere configurar la API Key de Groq en el servidor.\nContacta al administrador.'
            }, { quoted: m });
        }

        if (!isFfmpegAvailable()) {
            return await sock.sendMessage(jid, {
                text: '⚠️ El motor multimedia (FFmpeg) no se encuentra disponible para procesar el audio del video.'
            }, { quoted: m });
        }

        await m.react?.('⏳');
        await sock.sendMessage(jid, {
            text: '🎙️ *Procesando video...* Extrayendo pista de audio para transcribir con IA.'
        }, { quoted: m });

        const timestamp = Date.now();
        const randId = Math.random().toString(36).substring(7);
        const tempVideoFile = path.join(tmpDir, `vtrans_${timestamp}_${randId}.mp4`);
        const tempAudioFile = path.join(tmpDir, `vtrans_audio_${timestamp}_${randId}.mp3`);
        const filesToClean = [tempVideoFile, tempAudioFile];

        try {
            // Caso A: Se proporcionó una URL externa (YouTube, TikTok, o link directo)
            if (inputUrl) {
                // Si yt-dlp está disponible, descargamos directamente la pista de audio con límite de duración (15 min)
                if (isYtdlpAvailable()) {
                    await execYtdlp([
                        '-f', 'ba/b',
                        '--no-playlist',
                        '--max-filesize', '30M',
                        '--extract-audio',
                        '--audio-format', 'mp3',
                        '--audio-quality', '5',
                        '-o', tempAudioFile,
                        inputUrl
                    ], { timeout: 120000 });
                } else {
                    // Descargar stream directo con axios
                    const writer = fs.createWriteStream(tempVideoFile);
                    const response = await axios({
                        url: inputUrl,
                        method: 'GET',
                        responseType: 'stream',
                        timeout: 60000,
                        maxContentLength: 30 * 1024 * 1024
                    });
                    response.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    // Convertir con FFmpeg a MP3 optimizado para Whisper (mono 16kHz)
                    await runFfmpeg([
                        '-i', tempVideoFile,
                        '-vn',
                        '-ar', '16000',
                        '-ac', '1',
                        '-b:a', '64k',
                        tempAudioFile
                    ], { timeout: 30000 });
                }
            } else {
                // Caso B: El usuario citó un video o audio de WhatsApp
                const targetQuoted = quoted || m;
                const fakeMsg = {
                    key: targetQuoted.key || {
                        remoteJid: jid,
                        id: targetQuoted.id,
                        fromMe: targetQuoted.fromMe || false,
                        participant: targetQuoted.sender
                    },
                    message: targetQuoted.message || (targetQuoted.type === 'videoMessage' ? { videoMessage: targetQuoted } : { audioMessage: targetQuoted })
                };

                let mediaBuffer = null;
                try {
                    mediaBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
                } catch (dlErr) {
                    if (typeof targetQuoted.download === 'function') {
                        mediaBuffer = await targetQuoted.download();
                    } else {
                        throw dlErr;
                    }
                }

                if (!mediaBuffer || mediaBuffer.length === 0) {
                    throw new Error('No se pudo descargar el medio citado de WhatsApp.');
                }

                const rawExt = quotedType === 'video' ? 'mp4' : 'ogg';
                const tempMediaInput = path.join(tmpDir, `vtrans_in_${timestamp}_${randId}.${rawExt}`);
                filesToClean.push(tempMediaInput);
                await fs.writeFile(tempMediaInput, mediaBuffer);

                // Convertir y normalizar audio para Whisper
                await runFfmpeg([
                    '-i', tempMediaInput,
                    '-vn',
                    '-ar', '16000',
                    '-ac', '1',
                    '-b:a', '64k',
                    tempAudioFile
                ], { timeout: 45000 });
            }

            // Verificar que el archivo de audio resultante exista y no esté vacío
            if (!fs.existsSync(tempAudioFile)) {
                throw new Error('No se pudo generar el archivo de audio para transcribir.');
            }

            const stat = await fs.stat(tempAudioFile);
            if (stat.size === 0) {
                throw new Error('El archivo de audio extraído está vacío.');
            }

            // Llamar a Groq Whisper
            const transcription = await transcribeAudioGroq(tempAudioFile, groqKey);

            if (!transcription.text || !transcription.text.trim()) {
                await m.react?.('❓');
                return await sock.sendMessage(jid, {
                    text: '⚠️ No se detectó ninguna voz o habla inteligible en el video analizado.'
                }, { quoted: m });
            }

            const durationSec = transcription.duration ? Math.round(transcription.duration) : null;
            const durationStr = durationSec ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : 'Desconocida';
            const langStr = (transcription.language || 'auto').toUpperCase();

            const fullText = transcription.text.trim();

            const report = [
                '┏❐ 《 🎙️ TRANSCRIPCIÓN COMPLETADA 》 ❐',
                '┃',
                `┃├◆ 🌐 *Idioma detectado:* ${langStr}`,
                `┃├◆ ⏱️ *Duración:* ${durationStr}`,
                '┃├◆ 🤖 *Modelo:* Whisper Large v3 (Groq AI)',
                '┃',
                '┃├◆ 📝 *Texto extraído:*',
                '┗❐\n',
                fullText,
                '\n_Unknown Codexツ</>_'
            ].join('\n');

            await m.react?.('✅');

            // Si el texto es muy extenso, Baileys lo envía sin problema hasta varios miles de caracteres
            await sock.sendMessage(jid, { text: report }, { quoted: m });

        } catch (err) {
            logger.error('[VIDEOTRANSCRIBE ERROR]:', err.message);
            await m.react?.('❌');

            let errMsg = err.message || 'Error desconocido';
            if (errMsg.includes('timeout')) {
                errMsg = 'El tiempo de espera para descargar o transcribir el video se agotó.';
            } else if (errMsg.includes('413') || errMsg.includes('maximum size')) {
                errMsg = 'El archivo supera el tamaño máximo permitido para transcripción (25 MB).';
            }

            await sock.sendMessage(jid, {
                text: `❌ Error al transcribir el video: ${errMsg}`
            }, { quoted: m });
        } finally {
            // Limpieza inmediata de archivos temporales
            for (const file of filesToClean) {
                try {
                    if (fs.existsSync(file)) {
                        await fs.remove(file);
                    }
                } catch (_) {}
            }
        }
    }
};


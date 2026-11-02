'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');
const { toVoiceNote } = require('../../lib/media');

module.exports = {
    name: 'tts',
    alias: ['gtts', 'voz', 'audiotexto', 'decir', 'hablar'],
    category: 'herramientas',
    desc: 'Convierte texto a una nota de voz oficial de WhatsApp (Text-To-Speech)',
    usage: '.tts <texto> o .tts [idioma] <texto> (ej: .tts Hola mundo)',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        let rawInput = (args && args.length > 0 ? args.join(' ') : (text || '')).trim();

        if (!rawInput && m.quoted) {
            rawInput = (m.quoted.body || m.quoted.text || m.quoted.message?.conversation || m.quoted.message?.extendedTextMessage?.text || '').trim();
        }

        if (!rawInput) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🗣️ TEXT TO SPEECH (VOZ) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.tts <texto>`',
                    '┃├◆ 📌 *Ejemplo 1:* `.tts Hola, ¿cómo estás?`',
                    '┃├◆ 📌 *Ejemplo 2:* `.tts en Welcome to WhatsApp!`',
                    '┃├◆ 📌 *Ejemplo 3:* Cita un mensaje y escribe `.tts`',
                    '┃',
                    '┃├◆ 💡 *Idiomas comunes:* `es` (Español), `en` (Inglés), `pt` (Portugués), `ja` (Japonés), `fr` (Francés)',
                    '┃├◆ 🎙️ *Compatibilidad:* Formato Opus PTT oficial (descarga y reproduce en cualquier teléfono)',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        let lang = 'es';
        const words = rawInput.split(/\s+/);
        if (words.length >= 2 && words[0].length === 2 && /^[a-z]{2}$/i.test(words[0])) {
            lang = words[0].toLowerCase();
            rawInput = words.slice(1).join(' ').trim();
        }

        if (rawInput.length > 500) {
            rawInput = rawInput.substring(0, 500);
        }

        try {
            await m.react?.('🗣️');
        } catch (_) {}

        let rawAudio = null;

        // 1. Intento con ElevenLabs si existe API Key configurada
        const elevenKey = (process.env.ELEVENLABS_API_KEY || '').trim();
        if (elevenKey) {
            try {
                const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam / Default
                const elevenRes = await axios.post(
                    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                    {
                        text: rawInput,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    },
                    {
                        headers: {
                            'xi-api-key': elevenKey,
                            'Content-Type': 'application/json'
                        },
                        responseType: 'arraybuffer',
                        timeout: 15000
                    }
                );
                if (elevenRes.data && elevenRes.data.length > 200) {
                    rawAudio = Buffer.from(elevenRes.data);
                }
            } catch (elevenErr) {
                logger.warn('[TTS] ElevenLabs falló, usando Google TTS como respaldo:', elevenErr.message);
            }
        }

        // 2. Motor estándar Google TTS si no hay ElevenLabs o falló
        if (!rawAudio) {
            try {
                const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(rawInput)}&tl=${lang}&client=tw-ob`;
                const res = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 12000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                if (res.data && res.data.length >= 100) {
                    rawAudio = Buffer.from(res.data);
                }
            } catch (gErr) {
                logger.error('[TTS GOOGLE ERROR]:', gErr.message);
            }
        }

        if (!rawAudio || rawAudio.length === 0) {
            await m.react?.('❌');
            return await sock.sendMessage(jid, {
                text: '❌ No se pudo sintetizar el audio de voz. Intenta con un texto más corto o prueba más tarde.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 3. Conversión al formato nativo Opus PTT de WhatsApp (garantiza descarga y reproducción)
        try {
            const opusBuffer = await toVoiceNote(rawAudio);
            await sock.sendMessage(jid, {
                audio: opusBuffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: m });
        } catch (convErr) {
            logger.warn('[TTS] Conversión a Opus falló, enviando como audio directo:', convErr.message);
            await sock.sendMessage(jid, {
                audio: rawAudio,
                mimetype: 'audio/mpeg',
                ptt: false
            }, { quoted: m });
        }
    }
};

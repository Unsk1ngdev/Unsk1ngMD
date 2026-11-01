'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

module.exports = {
    name: 'tts',
    alias: ['gtts', 'voz', 'audiotexto', 'decir', 'hablar'],
    category: 'herramientas',
    desc: 'Convierte texto a una nota de voz oficial de WhatsApp (Text-To-Speech)',
    usage: '.tts <texto> o .tts [idioma] <texto> (ej: .tts en Hello world)',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        let rawInput = (args && args.length > 0 ? args.join(' ') : (text || '')).trim();

        if (!rawInput && m.quoted) {
            rawInput = (m.quoted.body || m.quoted.text || '').trim();
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

        if (rawInput.length > 300) {
            rawInput = rawInput.substring(0, 300);
        }

        try {
            await m.react?.('🗣️');
        } catch (_) {}

        try {
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(rawInput)}&tl=${lang}&client=tw-ob`;
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!res.data || res.data.length < 100) {
                throw new Error('Buffer de audio vacío');
            }

            await sock.sendMessage(jid, {
                audio: Buffer.from(res.data),
                mimetype: 'audio/mp4',
                ptt: true
            }, { quoted: m });

        } catch (err) {
            logger.error('[TTS ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al generar la nota de voz: ${err.message}\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};


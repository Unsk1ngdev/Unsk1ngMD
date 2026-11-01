'use strict';

const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('../../lib/logger');
const { runFfmpeg, isFfmpegAvailable } = require('../../lib/ffmpeg');

const tmpDir = path.join(process.cwd(), 'tmp');
fs.ensureDirSync(tmpDir);

module.exports = {
    name: 'transkrip',
    alias: ['transcribir', 'audiotexto', 'vozatexto', 'transcribe', 'stt'],
    category: 'herramientas',
    desc: 'Convierte notas de voz y audios de WhatsApp a texto editable con IA',
    usage: 'Cita una nota de voz o audio con .transkrip',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const quoted = m.quoted;

        if (!quoted) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎙️ SPEECH TO TEXT (TRANSCRIPCIÓN) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* Cita una nota de voz o audio y escribe: `.transkrip`',
                    '┃├◆ 💡 *Tip:* Funciona con cualquier nota de voz, audio o mensaje de voz.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const isAudio = Boolean(
            quoted.message?.audioMessage ||
            quoted.mtype === 'audioMessage' ||
            quoted.msg?.mimetype?.includes('audio') ||
            quoted.mimetype?.includes('audio')
        );

        if (!isAudio) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes citar una nota de voz o archivo de audio para transcribirlo.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        try {
            await m.react?.('✍️');
        } catch (_) {}

        await sock.sendMessage(jid, {
            text: '🎧 Transcribiendo audio con IA... Un momento por favor.'
        }, { quoted: m });

        const tmpInput = path.join(tmpDir, `transkrip_${Date.now()}.ogg`);
        const tmpOutput = path.join(tmpDir, `transkrip_${Date.now()}.mp3`);

        try {
            // 1. Descargar audio de WhatsApp
            const targetMsg = {
                key: quoted.key || { id: quoted.id, remoteJid: jid },
                message: quoted.message || { audioMessage: quoted.msg || quoted }
            };

            const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
                logger: { level: 'silent', child: () => ({ level: 'silent' }) }
            });

            if (!buffer || buffer.length === 0) {
                throw new Error('No se pudo descargar el buffer del audio.');
            }

            await fs.writeFile(tmpInput, buffer);

            // 2. Convertir a MP3 si ffmpeg está disponible
            let targetFile = tmpInput;
            if (isFfmpegAvailable()) {
                try {
                    await runFfmpeg(['-y', '-i', tmpInput, '-ar', '16000', '-ac', '1', '-c:a', 'libmp3lame', tmpOutput], 15000);
                    if (fs.existsSync(tmpOutput) && (await fs.stat(tmpOutput)).size > 100) {
                        targetFile = tmpOutput;
                    }
                } catch (_) {}
            }

            // 3. Transcribir con Groq Whisper Large v3
            const groqApiKey = process.env.GROQ_API_KEY;
            let transcribedText = '';

            if (groqApiKey) {
                const form = new FormData();
                form.append('file', fs.createReadStream(targetFile));
                form.append('model', 'whisper-large-v3-turbo');
                form.append('response_format', 'verbose_json');
                form.append('temperature', '0');

                const res = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
                    headers: {
                        ...form.getHeaders(),
                        Authorization: `Bearer ${groqApiKey}`
                    },
                    timeout: 45000
                });

                transcribedText = res.data?.text || '';
            } else {
                transcribedText = '(La API de transcripción requiere GROQ_API_KEY configurada en el bot)';
            }

            if (!transcribedText.trim()) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No se pudo detectar voz clara ni palabras en el audio analizado.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📝 TRANSCRIPCIÓN DEL AUDIO 》 ❐',
                    '┃',
                    '┃├◆ 💬 *Texto detectado:*',
                    `┃   "${transcribedText.trim()}"`,
                    '┃',
                    '┃├◆ 🤖 *Motor:* Whisper Large v3 Turbo',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });

        } catch (err) {
            logger.error('[TRANSKRIP ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al transcribir el audio: ${err.message}\n_Unknown Codexツ</>_`
            }, { quoted: m });
        } finally {
            try { if (fs.existsSync(tmpInput)) await fs.unlink(tmpInput); } catch (_) {}
            try { if (fs.existsSync(tmpOutput)) await fs.unlink(tmpOutput); } catch (_) {}
        }
    }
};


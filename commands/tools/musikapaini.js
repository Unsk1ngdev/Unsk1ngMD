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
    name: 'musikapaini',
    alias: ['shazam', 'whatsong', 'quecancion', 'cancion', 'identificarcancion'],
    category: 'herramientas',
    desc: 'Identifica qué canción está sonando en un audio o video (como Shazam)',
    usage: 'Cita un audio o video con .musikapaini o .shazam',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const quoted = m.quoted;

        if (!quoted) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔍 SHAZAM / RECONOCEDOR DE MÚSICA 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* Cita un audio o video y escribe: `.musikapaini`',
                    '┃├◆ 💡 *Tip:* También puedes usar `.shazam` o `.quecancion`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const isMedia = Boolean(
            quoted.message?.audioMessage ||
            quoted.message?.videoMessage ||
            quoted.mtype === 'audioMessage' ||
            quoted.mtype === 'videoMessage' ||
            quoted.msg?.mimetype?.includes('audio') ||
            quoted.msg?.mimetype?.includes('video') ||
            quoted.mimetype?.includes('audio') ||
            quoted.mimetype?.includes('video')
        );

        if (!isMedia) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes citar un archivo de audio o video para identificar la canción.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        try {
            await m.react?.('🎵');
        } catch (_) {}

        await sock.sendMessage(jid, {
            text: '🎧 Escuchando e identificando canción... Un momento por favor.'
        }, { quoted: m });

        const tmpRaw = path.join(tmpDir, `shazam_raw_${Date.now()}`);
        const tmpMp3 = path.join(tmpDir, `shazam_${Date.now()}.mp3`);

        try {
            const targetMsg = {
                key: quoted.key || { id: quoted.id, remoteJid: jid },
                message: quoted.message || { audioMessage: quoted.msg || quoted }
            };

            const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
                logger: { level: 'silent', child: () => ({ level: 'silent' }) }
            });

            if (!buffer || buffer.length === 0) {
                throw new Error('No se pudo descargar el buffer multimedia.');
            }

            await fs.writeFile(tmpRaw, buffer);

            // Recortar 15 segundos en MP3 con ffmpeg si está disponible
            let targetFile = tmpRaw;
            if (isFfmpegAvailable()) {
                try {
                    await runFfmpeg(['-y', '-i', tmpRaw, '-t', '15', '-ar', '44100', '-ac', '2', '-b:a', '128k', tmpMp3], 15000);
                    if (fs.existsSync(tmpMp3) && (await fs.stat(tmpMp3)).size > 100) {
                        targetFile = tmpMp3;
                    }
                } catch (_) {}
            }

            let songResult = null;

            // 1. Intentar reconocimiento vía AudD API
            try {
                const form = new FormData();
                form.append('file', fs.createReadStream(targetFile));
                form.append('return', 'apple_music,spotify');
                form.append('api_token', 'test');

                const audRes = await axios.post('https://api.audd.io/', form, {
                    headers: form.getHeaders(),
                    timeout: 20000
                });

                if (audRes.data?.status === 'success' && audRes.data.result) {
                    const r = audRes.data.result;
                    songResult = {
                        title: r.title,
                        artist: r.artist,
                        album: r.album || 'Single',
                        releaseDate: r.release_date || null,
                        artwork: r.spotify?.album?.images?.[0]?.url || r.apple_music?.artwork?.url?.replace('{w}x{h}', '400x400') || null
                    };
                }
            } catch (_) {}

            // 2. Si AudD no lo detectó, transcribir estrofas cantadas con Whisper y consultar iTunes
            if (!songResult && process.env.GROQ_API_KEY) {
                try {
                    const formWhisper = new FormData();
                    formWhisper.append('file', fs.createReadStream(targetFile));
                    formWhisper.append('model', 'whisper-large-v3-turbo');
                    formWhisper.append('response_format', 'verbose_json');

                    const wRes = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formWhisper, {
                        headers: {
                            ...formWhisper.getHeaders(),
                            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
                        },
                        timeout: 30000
                    });

                    const lyrics = (wRes.data?.text || '').trim();
                    if (lyrics.length >= 8) {
                        const cleanLyrics = lyrics.replace(/[\n,.]/g, ' ').substring(0, 100);
                        const itunesRes = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanLyrics)}&entity=song&limit=1`, { timeout: 6000 });
                        if (itunesRes.data?.results?.[0]) {
                            const track = itunesRes.data.results[0];
                            songResult = {
                                title: track.trackName,
                                artist: track.artistName,
                                album: track.collectionName || 'Single',
                                releaseDate: track.releaseDate ? track.releaseDate.split('T')[0] : null,
                                artwork: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : null
                            };
                        }
                    }
                } catch (_) {}
            }

            if (!songResult) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No se pudo identificar la canción. Asegúrate de que el audio tenga música nítida de fondo y sin interferencias.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const caption = [
                '┏❐ 《 🎵 CANCIÓN IDENTIFICADA 》 ❐',
                '┃',
                `┃├◆ 🎶 *Título:* ${songResult.title}`,
                `┃├◆ 👤 *Artista:* ${songResult.artist}`,
                `┃├◆ 💿 *Álbum:* ${songResult.album}`,
                songResult.releaseDate ? `┃├◆ 📅 *Lanzamiento:* ${songResult.releaseDate}` : '',
                '┃',
                '┃├◆ 🔍 *Motor:* Shazam / AudD Audio Fingerprinting',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n');

            if (songResult.artwork) {
                await sock.sendMessage(jid, {
                    image: { url: songResult.artwork },
                    caption
                }, { quoted: m });
            } else {
                await sock.sendMessage(jid, { text: caption }, { quoted: m });
            }

        } catch (err) {
            logger.error('[SHAZAM ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al procesar audio: ${err.message}\n_Unknown Codexツ</>_`
            }, { quoted: m });
        } finally {
            try { if (fs.existsSync(tmpRaw)) await fs.unlink(tmpRaw); } catch (_) {}
            try { if (fs.existsSync(tmpMp3)) await fs.unlink(tmpMp3); } catch (_) {}
        }
    }
};


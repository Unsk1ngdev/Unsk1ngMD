'use strict';

const axios = require('axios');
const premium = require('../../lib/premium');

module.exports = {
    name: 'sms',
    alias: ['sendmsg', 'anonimo'],
    category: 'herramientas',
    desc: 'Envía un mensaje normal, imagen, audio o anónimo a un número (solo owner o premium)',
    usage: '.sms [número] [mensaje] | .sms -imagen [número] [url] [caption] | .sms -audio [número] [mensaje] | .sms -anonimo [número] [mensaje]',

    execute: async ({ sock, m, args, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const ownerJid = '18494509905@s.whatsapp.net';
        const modo = args[0]?.startsWith('-') ? args[0].toLowerCase() : null;

        // Ajustar argumentos según el modo
        const numeroRaw = modo ? args[1] : args[0];
        const numeroLimpio = numeroRaw ? numeroRaw.replace(/[^0-9]/g, '') : '';
        const numero = numeroLimpio ? `${numeroLimpio}@s.whatsapp.net` : null;
        const contenido = modo ? args.slice(2).join(' ') : args.slice(1).join(' ');

        if (!numeroLimpio || numeroLimpio.length < 7 || !contenido) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso correcto:\n\n' +
                      '📝 Texto:\n*.sms [número] [mensaje]*\n\n' +
                      '🖼️ Imagen:\n*.sms -imagen [número] [url] [caption]*\n\n' +
                      '🎤 Audio:\n*.sms -audio [número] [mensaje]*\n\n' +
                      '🔇 Anónimo:\n*.sms -anonimo [número] [mensaje]*\n\n' +
                      'Ejemplo: *.sms 18091234567 Hola!*'
            }, { quoted: m });
        }

        try {
            // Verificar si tiene WhatsApp registrado
            const enWA = await sock.onWhatsApp(numero);
            if (!enWA?.[0]?.exists) {
                return await sock.sendMessage(jid, {
                    text: `❌ El número *+${numeroLimpio}* no tiene WhatsApp.`
                }, { quoted: m });
            }

            // 1. Modo imagen
            if (modo === '-imagen') {
                const urlImagen = args[2];
                const caption = args.slice(3).join(' ') || '';

                await sock.sendMessage(numero, {
                    image: { url: urlImagen },
                    caption: caption
                });

            // 2. Modo audio (convertir texto a voz sintetizada TTS)
            } else if (modo === '-audio') {
                try {
                    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(contenido)}&tl=es&client=tw-ob`;
                    const res = await axios.get(ttsUrl, {
                        responseType: 'arraybuffer',
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 10000
                    });

                    await sock.sendMessage(numero, {
                        audio: Buffer.from(res.data),
                        mimetype: 'audio/mp4',
                        ptt: true
                    });
                } catch (ttsErr) {
                    // Fallback a texto si la API de TTS falla
                    await sock.sendMessage(numero, { text: contenido });
                }

            // 3. Modo anónimo (sin texto extra)
            } else if (modo === '-anonimo') {
                await sock.sendMessage(numero, {
                    text: contenido
                });

            // 4. Modo normal
            } else {
                await sock.sendMessage(numero, {
                    text: contenido
                });
            }

            // Confirmar al usuario
            await sock.sendMessage(jid, {
                text: `✅ *Mensaje enviado*\n\n` +
                      `📱 Para: *+${numeroLimpio}*\n` +
                      `📝 Modo: *${modo || 'Normal'}*\n` +
                      `💬 Contenido: _${contenido}_\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });

            // Notificar al owner en privado si fue usado por un miembro premium
            if (!isOwner) {
                const cleanSender = sender.replace('@s.whatsapp.net', '').split(':')[0];
                await sock.sendMessage(ownerJid, {
                    text: `📡 *SMS usado por Premium*\n\n` +
                          `👤 Usuario: *+${cleanSender}*\n` +
                          `📱 Enviado a: *+${numeroLimpio}*\n` +
                          `💬 Mensaje: _${contenido}_\n` +
                          `📝 Modo: *${modo || 'Normal'}*\n\n` +
                          `_Unknown Codexツ</>_`
                }).catch(() => {});
            }

        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ Error al enviar: ${e.message}`
            }, { quoted: m });
        }
    }
};

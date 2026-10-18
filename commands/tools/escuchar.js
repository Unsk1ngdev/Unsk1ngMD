'use strict';

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const premium = require('../../lib/premium');
const database = require('../../lib/database');

module.exports = {
    name: 'escuchar',
    alias: ['escucharunavez', 'voicereveal', 'vvaudio'],
    category: 'premium',
    desc: 'Desbloquea y reenvía notas de voz o audios enviados como "Escuchar una vez" (Solo Premium)',
    usage: '.escuchar [citando audio/nota de voz de escuchar una vez]',
    premiumOnly: true,

    execute: async ({ sock, m, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // 1. Verificación de permiso Premium / Owner
        const isPrem = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPrem) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es exclusivo para miembros *Premium*.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 2. Validar que se cite un mensaje
        if (!m.quoted) {
            return await sock.sendMessage(jid, {
                text: '❌ Cita una nota de voz *escuchar una vez* y escribe *.escuchar*'
            }, { quoted: m });
        }

        const quoted = m.quoted;
        const rawMsg = quoted.message?.ephemeralMessage?.message || quoted.message || quoted;

        // Detectar variantes de viewOnce (viewOnceMessage, viewOnceMessageV2, viewOnceMessageV2Extension)
        let viewOnceMsg = rawMsg?.viewOnceMessage?.message
            || rawMsg?.viewOnceMessageV2?.message
            || rawMsg?.viewOnceMessageV2Extension?.message;

        // Fallback si viene directo con indicador viewOnce
        if (!viewOnceMsg) {
            if (rawMsg?.audioMessage?.viewOnce) {
                viewOnceMsg = rawMsg;
            } else if (quoted.type === 'audioMessage' && rawMsg?.audioMessage) {
                if (rawMsg.audioMessage.viewOnce) viewOnceMsg = rawMsg;
            }
        }

        if (!viewOnceMsg) {
            return await sock.sendMessage(jid, {
                text: '❌ Ese mensaje no es de tipo *escuchar una vez*.\nSolo funciona con notas de voz 🎙️'
            }, { quoted: m });
        }

        const audioMsg = viewOnceMsg.audioMessage;

        if (!audioMsg) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo soporta *audios* escuchar una vez.\nPara fotos/videos usa *.vv*'
            }, { quoted: m });
        }

        try {
            await sock.sendMessage(jid, { text: '⏳ Descargando audio...' }, { quoted: m });

            const fakeMsg = {
                key: quoted.key || {
                    remoteJid: jid,
                    id: quoted.id,
                    fromMe: quoted.fromMe || false,
                    participant: quoted.sender
                },
                message: viewOnceMsg
            };

            let buffer = null;
            try {
                buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
            } catch (dlErr) {
                if (typeof quoted.download === 'function') {
                    buffer = await quoted.download();
                } else {
                    throw dlErr;
                }
            }

            if (!buffer || buffer.length === 0) {
                throw new Error('Buffer vacío al descargar el audio');
            }

            await sock.sendMessage(jid, {
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            });

            await sock.sendMessage(jid, {
                text: '🎙️ *Audio desbloqueado*\n_Unknown Codexツ</>_'
            });

        } catch (err) {
            console.error('[.escuchar]', err);
            await sock.sendMessage(jid, {
                text: '❌ No se pudo descargar el audio.\n_El mensaje puede haber expirado._'
            }, { quoted: m });
        }
    }
};


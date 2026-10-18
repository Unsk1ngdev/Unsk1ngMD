'use strict';

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const premium = require('../../lib/premium');
const database = require('../../lib/database');

module.exports = {
    name: 'vv',
    alias: ['verunavez', 'viewonce', 'revelar'],
    category: 'premium',
    desc: 'Desbloquea y reenvía fotos o videos enviados como "Ver una vez" (Solo Premium)',
    usage: '.vv [citando foto/video de ver una vez]',
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
                text: '❌ Cita un mensaje de foto o video *ver una vez* y escribe *.vv*'
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
            if (rawMsg?.imageMessage?.viewOnce || rawMsg?.videoMessage?.viewOnce) {
                viewOnceMsg = rawMsg;
            } else if (quoted.type === 'imageMessage' && rawMsg?.imageMessage) {
                if (rawMsg.imageMessage.viewOnce) viewOnceMsg = rawMsg;
            } else if (quoted.type === 'videoMessage' && rawMsg?.videoMessage) {
                if (rawMsg.videoMessage.viewOnce) viewOnceMsg = rawMsg;
            }
        }

        if (!viewOnceMsg) {
            return await sock.sendMessage(jid, {
                text: '❌ Ese mensaje no es de tipo *ver una vez*.\nSolo funciona con fotos y videos 👁️'
            }, { quoted: m });
        }

        const imageMsg = viewOnceMsg.imageMessage;
        const videoMsg = viewOnceMsg.videoMessage;

        if (!imageMsg && !videoMsg) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo soporta *fotos* y *videos* ver una vez.\nPara audios usa *.escuchar*'
            }, { quoted: m });
        }

        try {
            await sock.sendMessage(jid, { text: '⏳ Descargando...' }, { quoted: m });

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
                throw new Error('Buffer vacío al descargar el medio');
            }

            const rawCaption = imageMsg?.caption || videoMsg?.caption || '';
            const caption = rawCaption
                ? `👁️ *Ver una vez desbloqueado*\n\n💬 *Texto:* ${rawCaption}\n\n_Unknown Codexツ</>_`
                : '👁️ *Ver una vez desbloqueado*\n_Unknown Codexツ</>_';

            if (imageMsg) {
                await sock.sendMessage(jid, {
                    image: buffer,
                    caption: caption
                });
            } else if (videoMsg) {
                await sock.sendMessage(jid, {
                    video: buffer,
                    caption: caption,
                    gifPlayback: false
                });
            }

        } catch (err) {
            console.error('[.vv]', err);
            await sock.sendMessage(jid, {
                text: '❌ No se pudo descargar el contenido.\n_El mensaje puede haber expirado._'
            }, { quoted: m });
        }
    }
};


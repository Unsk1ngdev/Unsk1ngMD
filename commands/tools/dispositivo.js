'use strict';

const premium = require('../../lib/premium');
const { getDevice: getBaileysDevice } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'dispositivo',
    alias: ['device', 'verdispositivo'],
    category: 'herramientas',
    desc: 'Detecta el tipo de dispositivo desde el que se conecta un usuario (solo premium)',
    usage: '.dispositivo [@usuario | respondiendo a mensaje]',

    execute: async ({ sock, m, args, isOwner }) => {
        const sender = m.sender;
        const jid = m.chat || m.key.remoteJid;

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let target = mentioned[0];

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) target = `${raw}@s.whatsapp.net`;
        }

        if (!target && m.quoted?.sender) {
            target = m.quoted.sender;
        }

        if (!target) {
            target = sender;
        }

        try {
            // 1. Detección por ID de mensaje si respondió a uno
            let detectedInfo = null;
            if (m.quoted?.id && typeof getBaileysDevice === 'function') {
                try {
                    const bDev = getBaileysDevice(m.quoted.id);
                    if (bDev === 'ios') detectedInfo = { nombre: 'iPhone (iOS)', emoji: '🍎' };
                    else if (bDev === 'android') detectedInfo = { nombre: 'Android', emoji: '🤖' };
                    else if (bDev === 'web') detectedInfo = { nombre: 'WhatsApp Web', emoji: '🌐' };
                    else if (bDev === 'desktop') detectedInfo = { nombre: 'WhatsApp Desktop', emoji: '🖥️' };
                } catch (_) {}
            }

            // 2. Detección mediante sufijo de dispositivo en el JID
            if (!detectedInfo) {
                const getDeviceFromJid = (id) => {
                    const num = id?.split(':')[1]?.split('@')[0];
                    if (!num) return null;
                    const n = parseInt(num, 10);
                    if (n === 0) return { nombre: 'WhatsApp Web', emoji: '🌐' };
                    if (n >= 1 && n <= 3) return { nombre: 'iPhone (iOS)', emoji: '🍎' };
                    if (n >= 4 && n <= 6) return { nombre: 'Android', emoji: '🤖' };
                    if (n >= 7 && n <= 9) return { nombre: 'KaiOS', emoji: '📱' };
                    if (n === 10) return { nombre: 'WhatsApp Desktop', emoji: '🖥️' };
                    return { nombre: 'Desconocido', emoji: '❓' };
                };

                detectedInfo = getDeviceFromJid(target) || getDeviceFromJid(m.key?.participant) || { nombre: 'Android / Móvil', emoji: '📱' };
            }

            const numero = target.replace('@s.whatsapp.net', '').split(':')[0];

            await sock.sendMessage(jid, {
                text: `╔══════════════════╗\n` +
                      `║  📱 *DISPOSITIVO*   ║\n` +
                      `╚══════════════════╝\n\n` +
                      `👤 *Número:* +${numero}\n` +
                      `${detectedInfo.emoji} *Dispositivo:* ${detectedInfo.nombre}\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ Error: ${e.message}`
            }, { quoted: m });
        }
    }
};


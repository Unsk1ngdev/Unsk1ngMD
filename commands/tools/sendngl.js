'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

/**
 * Extrae el nombre de usuario de NGL desde un enlace o texto
 */
function extractNglUsername(raw) {
    let clean = String(raw || '').trim();
    clean = clean.replace(/^https?:\/\/(?:www\.)?ngl\.link\//i, '');
    clean = clean.replace(/^@/, '');
    clean = clean.split(/[/?#]/)[0].trim();
    return clean;
}

module.exports = {
    name: 'sendngl',
    alias: ['ngl', 'nglmsg', 'anonngl', 'mensajengl'],
    category: 'tools',
    desc: 'Envía un mensaje 100% anónimo a cualquier enlace o usuario de NGL (ngl.link/usuario)',
    usage: '.sendngl <url o usuario> | <mensaje>',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const fullText = (args || []).join(' ').trim();

        if (!fullText || !fullText.includes('|')) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 💌 MENSAJES ANÓNIMOS NGL 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Para qué sirve?*',
                    '┃  Envía preguntas y mensajes anónimos a cualquier',
                    '┃  perfil de NGL sin dejar rastro de tu identidad.',
                    '┃',
                    '┃├◆ 📌 *Formato:*',
                    '┃  `.sendngl <url o usuario> | <mensaje>`',
                    '┃',
                    '┃├◆ 💡 *Ejemplos:*',
                    '┃  `.sendngl https://ngl.link/carlos | Hola 👀`',
                    '┃  `.sendngl maria_21 | Me caes súper bien`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const separatorIdx = fullText.indexOf('|');
        const rawTarget = fullText.slice(0, separatorIdx).trim();
        const message = fullText.slice(separatorIdx + 1).trim();
        const username = extractNglUsername(rawTarget);

        if (!username || username.length < 2) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes ingresar un enlace o usuario de NGL válido.\nEjemplo: `ngl.link/usuario`\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (!message || message.length < 2) {
            return await sock.sendMessage(jid, {
                text: '❌ El mensaje no puede estar vacío (mínimo 2 caracteres).\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        try {
            await m.react?.('⏳');

            const deviceId = (Math.random().toString(36).substring(2, 12) +
                              Math.random().toString(36).substring(2, 12) +
                              Date.now().toString(36)).slice(0, 36);

            const payload = new URLSearchParams({
                username: username,
                question: message,
                deviceId: deviceId,
                gameSlug: '',
                referrer: ''
            });

            const res = await axios.post('https://ngl.link/api/submit', payload.toString(), {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `https://ngl.link/${username}`,
                    'Origin': 'https://ngl.link'
                }
            });

            if (res.status === 200 && (res.data?.questionId || res.data?.success !== false)) {
                await m.react?.('💌');
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 💌 MENSAJE ENVIADO A NGL 》 ❐',
                        '┃',
                        `┃├◆ 👤 *Destinatario:* ${username}`,
                        `┃├◆ 💬 *Mensaje:* "${message}"`,
                        '┃├◆ 🔒 *Identidad:* 100% Anónimo (DeviceID aleatorio)',
                        '┃├◆ ✅ *Estado:* Entregado con éxito a su bandeja de NGL',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            } else {
                throw new Error('NGL no confirmó la recepción del mensaje. Puede que el usuario no exista.');
            }

        } catch (err) {
            logger.error('[SENDNGL ERROR]:', err.message);
            const errMsg = err.response?.status === 404
                ? 'El usuario de NGL no existe o el enlace está inactivo.'
                : (err.message.includes('ENOTFOUND') ? 'Error de conexión con los servidores de NGL.' : err.message);

            await sock.sendMessage(jid, {
                text: `❌ No se pudo enviar el mensaje anónimo a NGL.\n📋 *Motivo:* ${errMsg}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};


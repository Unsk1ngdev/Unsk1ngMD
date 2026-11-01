'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

// Guarda los correos activos de los usuarios: senderJid -> { email, login, domain, createdAt }
const userMailboxes = new Map();

/**
 * Genera una casilla de correo temporal aleatoria en 1secmail
 */
async function generateMailbox() {
    try {
        const res = await axios.get('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1', {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (Array.isArray(res.data) && res.data[0]) {
            const email = res.data[0];
            const [login, domain] = email.split('@');
            return { email, login, domain };
        }
    } catch (err) {
        logger.warn(`[TEMPMAIL] Error en 1secmail gen: ${err.message}`);
    }

    // Fallback: Generar nombre aleatorio con dominio estándar
    const domains = ['1secmail.com', '1secmail.org', '1secmail.net'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const login = 'user_' + Math.random().toString(36).substring(2, 10);
    return {
        email: `${login}@${domain}`,
        login,
        domain
    };
}

/**
 * Obtiene los mensajes recibidos en la casilla
 */
async function fetchInbox(login, domain) {
    try {
        const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`;
        const res = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
        logger.warn(`[TEMPMAIL] Error fetching inbox: ${err.message}`);
        return [];
    }
}

/**
 * Lee el contenido completo de un mensaje específico
 */
async function readSingleMessage(login, domain, messageId) {
    try {
        const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${messageId}`;
        const res = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return res.data;
    } catch (err) {
        logger.warn(`[TEMPMAIL] Error reading message ${messageId}: ${err.message}`);
        return null;
    }
}

module.exports = {
    name: 'tempmail',
    alias: ['mailtemp', 'correotemporal', 'correofake', 'dropmail', 'inbox'],
    category: 'herramientas',
    desc: 'Genera un correo temporal desechable y consulta su bandeja de entrada para recibir códigos y verificaciones',
    usage: '.tempmail [nuevo | inbox | delete]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const sub = (args && args[0] ? args[0] : '').toLowerCase().trim();

        // 1. Eliminar correo actual
        if (['del', 'delete', 'borrar', 'reset', 'cerrar'].includes(sub)) {
            if (!userMailboxes.has(sender)) {
                return await sock.sendMessage(jid, { text: 'ℹ️ No tienes ningún correo temporal activo.' }, { quoted: m });
            }
            userMailboxes.delete(sender);
            return await sock.sendMessage(jid, { text: '🗑️ Tu correo temporal ha sido eliminado.' }, { quoted: m });
        }

        // 2. Revisar bandeja de entrada (inbox / check)
        if (['check', 'inbox', 'ver', 'mensajes', 'recibidos'].includes(sub)) {
            const mailbox = userMailboxes.get(sender);
            if (!mailbox) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ningún correo temporal activo.\nCrea uno con *.tempmail nuevo*'
                }, { quoted: m });
            }

            await m.react?.('📬');
            await sock.sendMessage(jid, {
                text: `🔄 Revisando bandeja de entrada de: \`${mailbox.email}\`...`
            }, { quoted: m });

            const messages = await fetchInbox(mailbox.login, mailbox.domain);

            if (messages.length === 0) {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 📬 BANDEJA DE ENTRADA VACÍA 》 ❐',
                        '┃',
                        `┃├◆ 📧 *Casilla:* \`${mailbox.email}\``,
                        '┃├◆ ⏳ *Estado:* Aún no has recibido ningún correo.',
                        '┃',
                        '┃├◆ 💡 *Tip:* Asegúrate de haber enviado el correo o código de verificación.',
                        '┃  Vuelve a consultar en unos segundos con `.tempmail inbox`.',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            // Leer los últimos 3 mensajes
            const recentMsgs = messages.slice(0, 3);
            const messageDetails = [];

            for (const msgSummary of recentMsgs) {
                const fullMsg = await readSingleMessage(mailbox.login, mailbox.domain, msgSummary.id);
                if (fullMsg) {
                    const cleanBody = (fullMsg.textBody || fullMsg.body || '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 600);

                    messageDetails.push([
                        `┃ 📩 *De:* ${fullMsg.from}`,
                        `┃ 📌 *Asunto:* ${fullMsg.subject || '(Sin Asunto)'}`,
                        `┃ 📅 *Fecha:* ${fullMsg.date}`,
                        `┃ 📝 *Contenido:*`,
                        `┃ ${cleanBody || '(Mensaje vacío)'}`,
                        '┃ ──────────────────'
                    ].join('\n'));
                }
            }

            await m.react?.('✅');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📬 MENSAJES RECIBIDOS 》 ❐',
                    '┃',
                    `┃├◆ 📧 *Casilla:* \`${mailbox.email}\``,
                    `┃├◆ 📬 *Total mensajes:* ${messages.length}`,
                    '┃',
                    messageDetails.join('\n'),
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 3. Crear nuevo correo temporal o mostrar el actual
        if (userMailboxes.has(sender) && !['nuevo', 'new', 'crear'].includes(sub)) {
            const current = userMailboxes.get(sender);
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📧 TU CORREO TEMPORAL ACTIVO 》 ❐',
                    '┃',
                    `┃├◆ 📬 *Dirección:* \`${current.email}\``,
                    '┃',
                    '┃├◆ 📋 *Comandos disponibles:*',
                    '┃   👉 `.tempmail inbox` — Consulta tus mensajes o códigos',
                    '┃   👉 `.tempmail nuevo` — Genera una dirección diferente',
                    '┃   👉 `.tempmail delete` — Borra esta casilla',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // Generar nueva casilla
        await m.react?.('⏳');
        const newBox = await generateMailbox();
        userMailboxes.set(sender, {
            ...newBox,
            createdAt: Date.now()
        });

        await m.react?.('📧');
        await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 📧 NUEVO CORREO TEMPORAL GENERADO 》 ❐',
                '┃',
                `┃├◆ 📬 *Tu Correo:*`,
                `┃   \`${newBox.email}\``,
                '┃',
                '┃├◆ 💡 *Instrucciones:*',
                '┃  1. Copia el correo y úsalo para registrarte o recibir códigos.',
                '┃  2. Cuando el sitio web te envíe el correo, escribe:',
                '┃     👉 `.tempmail inbox`',
                '┃  3. Para cambiar de correo escribe: `.tempmail nuevo`',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};


'use strict';

const { parsePhoneNumberInfo } = require('../../lib/phoneInfo');
const config = require('../../config');
const logger = require('../../lib/logger');

/**
 * Calcula el tiempo transcurrido en formato amigable
 */
function formatElapsed(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return 'Desconocido';
    const diffMs = Date.now() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 30) return `Hace ${diffDays} días`;
    if (diffDays < 365) {
        const m = Math.floor(diffDays / 30);
        return m === 1 ? 'Hace 1 mes' : `Hace ${m} meses`;
    }
    const y = Math.floor(diffDays / 365);
    return y === 1 ? 'Hace 1 año' : `Hace ${y} años`;
}

module.exports = {
    name: 'info',
    alias: ['profile', 'whois', 'userinfo', 'numero', 'numinfo'],
    category: 'herramientas',
    desc: 'Inteligencia profunda de telefonía, operador, hora local exacta, estado de privacidad y WhatsApp',
    usage: '.info [@mención, número o citando un mensaje]',

    execute: async ({ sock, m, text }) => {
        await m.react('⏳');

        try {
            let targetJid = null;
            let targetPushName = null;

            // 1. Detección del objetivo y captura de nombre público
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                targetJid = m.mentionedJid[0];
            } else if (m.quoted && m.quoted.sender) {
                targetJid = m.quoted.sender;
                targetPushName = m.quoted.pushName || null;
            } else if (text && text.trim()) {
                const cleanDigits = text.replace(/[^0-9]/g, '');
                if (cleanDigits.length >= 6) {
                    targetJid = `${cleanDigits}@s.whatsapp.net`;
                }
            }

            if (!targetJid) {
                targetJid = m.sender;
                targetPushName = m.pushName || null;
            }

            // Normalización rigurosa del JID
            const cleanNumber = targetJid.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
            const normalizedJid = `${cleanNumber}@s.whatsapp.net`;

            // 2. Inteligencia de telefonía y zona horaria
            const phoneDetails = parsePhoneNumberInfo(cleanNumber);
            const countryText = phoneDetails ? `${phoneDetails.countryName} ${phoneDetails.flag}` : 'Desconocido 🌐';
            const regionText = phoneDetails ? phoneDetails.region : 'Región no especificada';
            const carrierText = phoneDetails ? phoneDetails.carrier : 'Operador no identificado';
            const lineTypeText = phoneDetails ? phoneDetails.lineType : 'Móvil / Celular';
            const nationalFormat = phoneDetails?.nationalFormatted || `+${cleanNumber}`;
            const intlFormat = phoneDetails?.internationalFormatted || `+${cleanNumber}`;
            const directLink = `https://wa.me/${cleanNumber}`;

            // Hora local en tiempo real del objetivo
            const timeInfo = phoneDetails?.localTimeInfo;
            const horaLocalText = timeInfo
                ? `${timeInfo.timeStr} (${timeInfo.offsetStr}) • ${timeInfo.period}`
                : 'No calculable';
            const fechaLocalText = timeInfo
                ? `${timeInfo.weekday}, ${timeInfo.dateStr}`
                : 'N/A';

            // 3. Verificación de registro activo en WhatsApp
            const check = await sock.onWhatsApp(normalizedJid).catch(() => null);
            if (!check || !check[0] || !check[0].exists) {
                await m.react('❌');
                const notRegisteredCard =
                    `╭━━━〔 🌐 *INTELIGENCIA TELEFÓNICA* 〕━━━⬣\n` +
                    `┃ ⚠️ *Estado:* Número no registrado en WhatsApp\n` +
                    `┃ 📱 *Número:* ${intlFormat}\n` +
                    `┃ 🏳️ *País:* ${countryText}\n` +
                    `┃ 📍 *Región / Zona:* ${regionText}\n` +
                    `┃ 📡 *Operador / Red:* ${carrierText}\n` +
                    `┃ 📶 *Tipo de Línea:* ${lineTypeText}\n` +
                    `┃ 🕒 *Hora Local:* ${horaLocalText}\n` +
                    `┃ 📅 *Fecha Local:* ${fechaLocalText}\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                    `_Unknown Codexツ</>_`;
                return await sock.sendMessage(m.chat, { text: notRegisteredCard }, { quoted: m });
            }

            const validJid = check[0].jid;

            // 4. Consultas en paralelo a servidores de WhatsApp
            const [statusRes, ppUrl, businessRes] = await Promise.all([
                sock.fetchStatus(validJid).catch(() => null),
                sock.profilePictureUrl(validJid, 'image').catch(() => null),
                sock.getBusinessProfile(validJid).catch(() => null)
            ]);

            // 5. Análisis de privacidad y datos de perfil
            // Foto de perfil
            const fotoPrivacidad = ppUrl
                ? '✅ Pública (HD disponible)'
                : '🔒 Privada / Oculta (Ajustes de privacidad)';

            // Bio / Info
            const hasBio = !!(statusRes && statusRes.status);
            const bioText = hasBio ? statusRes.status.trim() : '🔒 Privada (Oculta por privacidad o solo contactos)';

            let bioFechaText = 'No disponible';
            if (statusRes?.setAt) {
                try {
                    const setAtDate = new Date(statusRes.setAt);
                    const formatted = setAtDate.toLocaleDateString('es-DO', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                    const elapsed = formatElapsed(setAtDate);
                    bioFechaText = `${formatted} (${elapsed})`;
                } catch (_) {}
            }

            // Tipo de cuenta
            const isBusiness = !!businessRes;
            const tipoCuentaText = isBusiness
                ? '🏢 Cuenta de Empresa (WhatsApp Business)'
                : '👤 Cuenta Personal (Estándar)';

            // Nombre detectado (PushName o Empresa)
            const nombreMostrado = targetPushName || (targetJid === m.sender ? m.pushName : null) || 'No visible en chat público';

            // 6. Ensamblado de tarjeta estilizada Cyberpunk
            let card =
                `╭━━━〔 🌐 *INFORMACIÓN DE PERFIL & LÍNEA* 〕━━━⬣\n` +
                `┃ 👤 *Nombre en WhatsApp:* ${nombreMostrado}\n` +
                `┃ 📱 *Número:* ${intlFormat}\n` +
                `┃ 🔢 *Formato Local:* ${nationalFormat}\n` +
                `┃ 🏳️ *País:* ${countryText}\n` +
                `┃ 📍 *Región / Ciudad:* ${regionText}\n` +
                `┃ 📡 *Operador / Red:* ${carrierText}\n` +
                `┃ 📶 *Tipo de Línea:* ${lineTypeText}\n` +
                `┃ 🔗 *Chat Directo:* ${directLink}\n` +
                `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n` +
                `┃ 🕒 *Hora Local:* ${horaLocalText}\n` +
                `┃ 📅 *Fecha Local:* ${fechaLocalText}\n` +
                `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n` +
                `┃ 🛡️ *DIAGNÓSTICO DE PRIVACIDAD*\n` +
                `┃ 🖼️ *Foto de Perfil:* ${fotoPrivacidad}\n` +
                `┃ 💼 *Tipo de Cuenta:* ${tipoCuentaText}\n` +
                `┃ 💬 *Bio / Estado:* ${bioText}\n` +
                (hasBio ? `┃ 🗓️ *Bio Establecida:* ${bioFechaText}\n` : '');

            // Si es WhatsApp Business, desplegar metadatos comerciales
            if (isBusiness) {
                card += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n` +
                        `┃ 🏢 *METADATOS COMERCIALES*\n`;
                if (businessRes.category) {
                    card += `┃ 🏷️ *Categoría:* ${businessRes.category}\n`;
                }
                if (businessRes.description) {
                    card += `┃ 📋 *Descripción:* ${businessRes.description.trim()}\n`;
                }
                if (businessRes.email) {
                    card += `┃ 📧 *Email:* ${businessRes.email}\n`;
                }
                if (businessRes.website) {
                    const web = Array.isArray(businessRes.website) ? businessRes.website.join(', ') : businessRes.website;
                    card += `┃ 🌐 *Web:* ${web}\n`;
                }
                if (businessRes.address) {
                    card += `┃ 📍 *Dirección:* ${businessRes.address}\n`;
                }
            }

            card +=
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                `_Unknown Codexツ</>_`;

            // 7. Envío del resultado: si hay foto HD, enviarla con el texto en caption
            if (ppUrl) {
                try {
                    await sock.sendMessage(m.chat, {
                        image: { url: ppUrl },
                        caption: card,
                        mentions: [validJid]
                    }, { quoted: m });
                } catch (_) {
                    await sock.sendMessage(m.chat, {
                        text: card,
                        mentions: [validJid]
                    }, { quoted: m });
                }
            } else {
                await sock.sendMessage(m.chat, {
                    text: card,
                    mentions: [validJid]
                }, { quoted: m });
            }

            await m.react('✅');

        } catch (err) {
            logger.error('[INFO COMMAND ERROR]:', err);
            await m.react('❌');
            await sock.sendMessage(m.chat, {
                text: `❌ Error al consultar la información: ${err.message || 'Error desconocido'}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

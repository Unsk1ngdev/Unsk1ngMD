const { parsePhoneNumberInfo } = require('../../lib/phoneInfo');
const config = require('../../config');

module.exports = {
    name: 'info',
    alias: ['profile', 'perfil', 'whois', 'userinfo'],
    category: 'herramientas',
    desc: 'Consulta geográfica profunda, operador, bio con fecha, cuenta business y foto de perfil en WhatsApp',
    usage: '.info [@mención, número o respondiendo a un mensaje]',
    execute: async ({ sock, m, text }) => {
        await m.react('⏳');

        try {
            let targetJid = null;

            // 1. Extracción de objetivo: Mención > Cita de mensaje > Texto con número > Remitente
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                targetJid = m.mentionedJid[0];
            } else if (m.quoted && m.quoted.sender) {
                targetJid = m.quoted.sender;
            } else if (text && text.trim()) {
                const cleanDigits = text.replace(/[^0-9]/g, '');
                if (cleanDigits.length >= 6) {
                    targetJid = `${cleanDigits}@s.whatsapp.net`;
                }
            }

            if (!targetJid) {
                targetJid = m.sender;
            }

            // Normalización rigurosa de JID
            const cleanNumber = targetJid.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
            const normalizedJid = `${cleanNumber}@s.whatsapp.net`;

            // 2. Parseo profundo de telefonía con google-libphonenumber
            const phoneDetails = parsePhoneNumberInfo(cleanNumber);
            const countryText = phoneDetails ? `${phoneDetails.countryName} ${phoneDetails.flag}` : 'Desconocido 🌐';
            const regionText = phoneDetails ? phoneDetails.region : 'Región no especificada';
            const carrierText = phoneDetails ? phoneDetails.carrier : 'Operador no identificado';
            const lineTypeText = phoneDetails ? phoneDetails.lineType : 'Móvil / Celular';
            const directLink = `https://wa.me/${cleanNumber}`;

            // 3. Validación de registro en WhatsApp
            const check = await sock.onWhatsApp(normalizedJid).catch(() => null);
            if (!check || !check[0] || !check[0].exists) {
                await m.react('❌');
                const notRegisteredCard =
                    `╭━━━〔 🌐 *CONSULTA TELEFÓNICA: UNSK1NGMD* 〕━━━⬣\n` +
                    `┃ ⚠️ *Estado:* Número no registrado en WhatsApp\n` +
                    `┃ 📱 *Número:* +${cleanNumber}\n` +
                    `┃ 🏳️ *País:* ${countryText}\n` +
                    `┃ 📍 *Región / Ciudad:* ${regionText}\n` +
                    `┃ 📡 *Operador / Carrier:* ${carrierText}\n` +
                    `┃ 📶 *Tipo de Línea:* ${lineTypeText}\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣`;
                return await m.reply(notRegisteredCard);
            }

            const validJid = check[0].jid;

            // 4. Consultas nativas concurrentes a los servidores de WhatsApp
            const [statusRes, ppUrl, businessRes] = await Promise.all([
                sock.fetchStatus(validJid).catch(() => null),
                sock.profilePictureUrl(validJid, 'image').catch(() => null),
                sock.getBusinessProfile(validJid).catch(() => null)
            ]);

            // Formatear bio y fecha de última actualización
            const bioText = statusRes?.status || 'No disponible o privado';
            let bioDate = 'Desconocida';
            if (statusRes?.setAt) {
                try {
                    const dateObj = new Date(statusRes.setAt);
                    bioDate = dateObj.toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } catch (_) {}
            }

            const isBusiness = !!businessRes;

            // 5. Construcción de tarjeta estilizada Cyberpunk
            let infoCard =
                `╭━━━〔 🌐 *PERFIL & TELEFONÍA: ${config.botName.toUpperCase()}* 〕━━━⬣\n` +
                `┃ 📱 *Número:* +${cleanNumber}\n` +
                `┃ 🏳️ *País:* ${countryText}\n` +
                `┃ 📍 *Región / Ciudad:* ${regionText}\n` +
                `┃ 📡 *Operador / Carrier:* ${carrierText}\n` +
                `┃ 📶 *Tipo de Línea:* ${lineTypeText}\n` +
                `┃ 🔗 *Chat Directo:* ${directLink}\n` +
                `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n` +
                `┃ 💬 *Bio / Estado:* ${bioText}\n` +
                `┃ 📅 *Actualizado:* ${bioDate}\n` +
                `┃ 💼 *Cuenta Business:* ${isBusiness ? 'Sí (Empresa Verificada)' : 'No (Cuenta Personal)'}\n`;

            if (isBusiness) {
                if (businessRes.category) {
                    infoCard += `┃ 🏷️ *Categoría:* ${businessRes.category}\n`;
                }
                if (businessRes.description) {
                    infoCard += `┃ 📋 *Descripción:* ${businessRes.description.trim()}\n`;
                }
                if (businessRes.email) {
                    infoCard += `┃ 📧 *Email:* ${businessRes.email}\n`;
                }
                if (businessRes.website) {
                    const web = Array.isArray(businessRes.website) ? businessRes.website.join(', ') : businessRes.website;
                    infoCard += `┃ 🌐 *Web:* ${web}\n`;
                }
                if (businessRes.address) {
                    infoCard += `┃ 🏢 *Dirección:* ${businessRes.address}\n`;
                }
            }

            infoCard +=
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n` +
                `_Consulta profunda generada exitosamente_ ⚡`;

            // 6. Envío con foto HD si está disponible
            if (ppUrl) {
                try {
                    await sock.sendMessage(m.chat, {
                        image: { url: ppUrl },
                        caption: infoCard,
                        mentions: [validJid]
                    }, { quoted: m });
                } catch (_) {
                    await sock.sendMessage(m.chat, {
                        text: infoCard,
                        mentions: [validJid]
                    }, { quoted: m });
                }
            } else {
                await sock.sendMessage(m.chat, {
                    text: infoCard,
                    mentions: [validJid]
                }, { quoted: m });
            }

            await m.react('✅');

        } catch (err) {
            await m.react('❌');
            await m.reply(`❌ Ocurrió un error al consultar el perfil: ${err.message || 'Error desconocido'}`);
        }
    }
};

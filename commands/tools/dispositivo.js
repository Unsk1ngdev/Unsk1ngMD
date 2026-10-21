'use strict';

const premium = require('../../lib/premium');
const database = require('../../lib/database');
const userNames = require('../../lib/userNames');
const recentMessagesManager = require('../../lib/recentMessages');
const { parsePhoneNumberInfo } = require('../../lib/phoneInfo');
const { getDevice: getBaileysDevice } = require('@whiskeysockets/baileys');

/**
 * Resuelve el número de teléfono real del objetivo, incluso si se recibe como un LID de WhatsApp
 */
function resolvePhoneNumber(targetJid, { participants, groupMetadata, sock, m } = {}) {
    if (!targetJid) return null;
    const clean = String(targetJid).replace(/:.*@/, '@').trim().toLowerCase();
    const cleanDigits = clean.split('@')[0].replace(/[^0-9]/g, '');

    // 1. Si no es un LID y tiene longitud de teléfono válida (7 a 14 dígitos)
    if (!clean.endsWith('@lid') && cleanDigits.length >= 7 && cleanDigits.length <= 14) {
        return cleanDigits;
    }

    // 2. Buscar en la lista de participantes del grupo
    const partList = (Array.isArray(participants) && participants.length > 0)
        ? participants
        : (Array.isArray(groupMetadata?.participants) ? groupMetadata.participants : []);

    if (partList.length > 0) {
        const found = partList.find(p => {
            const pId = String(p.id || p.jid || '').replace(/:.*@/, '@').split('@')[0];
            const pLid = String(p.lid || '').replace(/:.*@/, '@').split('@')[0];
            return (pLid && pLid === cleanDigits) || (pId && pId === cleanDigits);
        });
        if (found) {
            const phoneJid = found.id || found.jid;
            if (phoneJid && !phoneJid.endsWith('@lid')) {
                const digits = phoneJid.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
                if (digits.length >= 7) {
                    if (userNames.linkLid) userNames.linkLid(clean, digits);
                    return digits;
                }
            }
            if (found.phone_number || found.phoneNumber) {
                const digits = String(found.phone_number || found.phoneNumber).replace(/[^0-9]/g, '');
                if (digits.length >= 7) {
                    if (userNames.linkLid) userNames.linkLid(clean, digits);
                    return digits;
                }
            }
        }
    }

    // 3. Mapeo persistente en userNames (contacts.upsert o mensajes anteriores)
    if (userNames.getPhoneByLid) {
        const cached = userNames.getPhoneByLid(clean);
        if (cached) return cached;
    }

    // 4. Mapeo de Owners en la base de datos
    const ownerLids = database.getOwnerLids();
    const ownerNumbers = database.getOwnerNumbers();
    const ownerIndex = ownerLids.findIndex(l => l.replace(/:.*@/, '@').split('@')[0] === cleanDigits);
    if (ownerIndex !== -1 && ownerNumbers[ownerIndex]) {
        return String(ownerNumbers[ownerIndex]).replace(/[^0-9]/g, '');
    }
    if (database.isOwner(clean, sock) && ownerNumbers.length > 0) {
        return String(ownerNumbers[0]).replace(/[^0-9]/g, '');
    }

    // 5. Si el objetivo es el propio bot
    const botLid = sock?.user?.lid?.replace(/:.*@/, '@')?.split('@')?.[0];
    const botId = sock?.user?.id?.replace(/:.*@/, '@')?.split('@')?.[0]?.replace(/[^0-9]/g, '');
    if (botLid && botLid === cleanDigits && botId) {
        return botId;
    }

    // 6. Mensaje citado o participante directo
    if (m?.quoted?.participant && !m.quoted.participant.endsWith('@lid')) {
        const digits = m.quoted.participant.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
        if (digits.length >= 7) return digits;
    }

    // 7. Retorno de dígitos extraídos
    return cleanDigits.length >= 7 ? cleanDigits : null;
}

/**
 * Motor de detección profunda de dispositivo, cliente y arquitectura de conexión
 */
function detectClientDevice(msgId, rawJid) {
    const id = String(msgId || '').trim();
    const jid = String(rawJid || '').trim();
    const suffix = jid.split(':')[1]?.split('@')[0];
    const devNum = suffix ? parseInt(suffix, 10) : null;

    let connection = devNum !== null
        ? (devNum === 0 ? 'Dispositivo Principal (Teléfono) 📱' : `Dispositivo Vinculado Multi-Device (#${devNum}) 🔗`)
        : 'Dispositivo Principal (Teléfono) 📱';

    // 1. Detección de Bot / Baileys
    if (id.startsWith('BAE5') || (id.startsWith('3EB0') && id.length === 12) || (id.length === 16 && id.startsWith('BAE'))) {
        return {
            os: 'Bot / Servidor Automatizado',
            emoji: '🤖⚙️',
            client: 'Baileys Multi-Device Engine (Node.js)',
            connection: devNum ? `Instancia Multi-Device (#${devNum})` : 'Servidor Directo / API',
            precision: 'Exacta (Firma Baileys)'
        };
    }

    // 2. Detección de Apple iOS / iPadOS
    if (/^3A.{16,30}$/i.test(id) || (id.startsWith('3A') && id.length >= 18)) {
        return {
            os: 'Apple iOS / iPadOS',
            emoji: '🍎',
            client: 'WhatsApp Oficial para iPhone (iOS)',
            connection: devNum && devNum > 0 ? `Companion iOS (#${devNum}) 🔗` : 'Dispositivo Primario (iPhone) 📱',
            precision: 'Exacta (Firma Criptográfica iOS)'
        };
    }

    // 3. Detección de WhatsApp Web (Navegador)
    if (/^3EB0.{14,24}$/i.test(id) || (id.startsWith('3EB0') && (id.length === 18 || id.length === 20 || id.length === 22))) {
        return {
            os: 'Web Browser (PC / Navegador)',
            emoji: '🌐',
            client: 'WhatsApp Web (Chrome / Edge / Safari / Firefox)',
            connection: devNum ? `Sesión Web Vinculada (#${devNum}) 💻` : 'Sesión Web Multi-Device 💻',
            precision: 'Exacta (Firma de Token Web)'
        };
    }

    // 4. Detección de WhatsApp Desktop (App oficial PC/Mac)
    if (/^3F.{14,24}$/i.test(id) || (devNum && (devNum === 10 || devNum === 1) && id.length === 18)) {
        return {
            os: 'Windows / macOS Desktop App',
            emoji: '🖥️',
            client: 'WhatsApp Desktop (App Oficial de PC)',
            connection: 'Aplicación de Escritorio Vinculada 🖥️',
            precision: 'Exacta (Firma Desktop App)'
        };
    }

    // 5. Fallback con Baileys getDevice
    if (typeof getBaileysDevice === 'function' && id) {
        try {
            const bDev = getBaileysDevice(id);
            if (bDev === 'ios') {
                return {
                    os: 'Apple iOS (iPhone / iPad)',
                    emoji: '🍎',
                    client: 'WhatsApp para iOS',
                    connection: devNum && devNum > 0 ? `Companion iOS (#${devNum}) 🔗` : 'Dispositivo Primario 📱',
                    precision: 'Exacta (Heurística Baileys iOS)'
                };
            }
            if (bDev === 'web') {
                return {
                    os: 'WhatsApp Web',
                    emoji: '🌐',
                    client: 'WhatsApp Web Oficial',
                    connection: 'Sesión Web Multi-Device 💻',
                    precision: 'Exacta (Heurística Baileys Web)'
                };
            }
            if (bDev === 'desktop') {
                return {
                    os: 'WhatsApp Desktop',
                    emoji: '🖥️',
                    client: 'WhatsApp Desktop (Windows/macOS)',
                    connection: 'Aplicación de Escritorio 🖥️',
                    precision: 'Exacta (Heurística Baileys Desktop)'
                };
            }
            if (bDev === 'android') {
                return {
                    os: 'Google Android OS',
                    emoji: '🤖',
                    client: 'WhatsApp Oficial para Android',
                    connection: devNum && devNum > 0 ? `Dispositivo Vinculado (#${devNum}) 🔗` : 'Dispositivo Primario 📱',
                    precision: 'Exacta (Firma de Mensaje Android)'
                };
            }
        } catch (_) {}
    }

    // 6. Firma de 32 caracteres hexadecimales típica de Android
    if (/^[0-9A-Fa-f]{32}$/.test(id) || id.length === 32 || id.length === 21) {
        return {
            os: 'Google Android OS',
            emoji: '🤖',
            client: 'WhatsApp Oficial para Android',
            connection: devNum && devNum > 0 ? `Dispositivo Vinculado (#${devNum}) 🔗` : 'Dispositivo Primario (Android) 📱',
            precision: 'Exacta (Firma Criptográfica Android)'
        };
    }

    // 7. Si no hay ID pero sí sufijo en el JID
    if (devNum !== null) {
        if (devNum === 0) {
            return {
                os: 'Android / Móvil Primario',
                emoji: '📱',
                client: 'WhatsApp Móvil Principal',
                connection: 'Dispositivo Principal (Teléfono) 📱',
                precision: 'Protocolo de Dispositivo Master'
            };
        }
        if (devNum >= 1 && devNum <= 3) {
            return {
                os: 'Dispositivo Vinculado (Web / Desktop)',
                emoji: '💻',
                client: 'WhatsApp Multi-Device Companion',
                connection: `Sesión Vinculada Multi-Device (#${devNum}) 🔗`,
                precision: 'Protocolo Multi-Device Companion'
            };
        }
    }

    // 8. Detección estándar si no hay datos específicos
    return {
        os: 'Android / Móvil',
        emoji: '📱',
        client: 'WhatsApp Móvil',
        connection,
        precision: 'Estándar de Red'
    };
}

module.exports = {
    name: 'dispositivo',
    alias: ['device', 'sistema', 'so', 'os', 'verdispositivo'],
    category: 'herramientas',
    desc: 'Auditoría avanzada de dispositivo, sistema operativo, cliente y entorno de conexión (solo premium)',
    usage: '.dispositivo [@usuario | citando un mensaje | número]',

    execute: async ({ sock, m, args, isOwner, participants, groupMetadata }) => {
        const sender = m.sender;
        const jid = m.chat || m.key.remoteJid;

        // Verificación de membresía Premium u Owner
        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es exclusivo para usuarios *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        await m.react('⏳');

        let target = null;
        let quotedMsgId = null;
        let rawParticipant = null;

        // 1. Detección del usuario objetivo
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned && mentioned.length > 0) {
            target = mentioned[0];
            rawParticipant = target;
        } else if (m.quoted && m.quoted.sender) {
            target = m.quoted.sender;
            quotedMsgId = m.quoted.id;
            rawParticipant = m.quoted.participant || m.quoted.sender;
            if (m.quoted.pushName) {
                userNames.set(target, m.quoted.pushName);
            }
        } else if (args && args[0]) {
            const rawDigits = args[0].replace(/[^0-9]/g, '');
            if (rawDigits.length >= 7) {
                target = `${rawDigits}@s.whatsapp.net`;
                rawParticipant = target;
            }
        }

        // Si no se especificó nadie, auditar al propio usuario ejecutor
        if (!target) {
            target = sender;
            quotedMsgId = m.key?.id;
            rawParticipant = m.key?.participant || sender;
        }

        try {
            const targetIdClean = target.replace(/:.*@/, '@').split('@')[0];

            // 2. Si no se citó un mensaje pero tenemos un objetivo, buscar su último mensaje reciente en el chat
            if (!quotedMsgId && jid) {
                const recentList = recentMessagesManager.getRecent(jid, 100);
                const found = recentList.find(item => {
                    const p = String(item.participant || item.remoteJid || '').replace(/:.*@/, '@').split('@')[0];
                    return p === targetIdClean;
                });
                if (found) {
                    quotedMsgId = found.id;
                    if (found.participant) rawParticipant = found.participant;
                }
            }

            // 3. Resolución del número de teléfono real (incluso si target es un LID)
            const resolvedNumber = resolvePhoneNumber(target, { participants, groupMetadata, sock, m });
            const targetName = userNames.get(target);

            // 4. Formato de teléfono, país y región a partir del número real
            let phoneDetails = null;
            if (resolvedNumber && resolvedNumber.length >= 7) {
                phoneDetails = parsePhoneNumberInfo(resolvedNumber);
            }

            const formattedNumber = phoneDetails?.internationalFormatted || (resolvedNumber ? `+${resolvedNumber}` : `+${targetIdClean}`);
            const countryText = phoneDetails
                ? `${phoneDetails.countryName} ${phoneDetails.flag}${phoneDetails.region ? ` • ${phoneDetails.region}` : ''}`
                : 'Internacional 🌐';

            // 5. Auditoría profunda de Dispositivo y Cliente
            const devInfo = detectClientDevice(quotedMsgId, rawParticipant || target);

            // 6. Tipo de cuenta: WhatsApp Business vs Estándar
            let accountType = 'WhatsApp Estándar / Personal 💬';
            if (resolvedNumber) {
                try {
                    const validJid = `${resolvedNumber}@s.whatsapp.net`;
                    const bProfile = await sock.getBusinessProfile(validJid).catch(() => null);
                    if (bProfile) {
                        const cat = bProfile.category ? ` • ${bProfile.category}` : '';
                        accountType = `WhatsApp Business 💼${cat}`;
                    }
                } catch (_) {}
            }

            // Información de operador telefónico si está disponible
            const carrierLine = phoneDetails?.carrier && phoneDetails.carrier !== 'Desconocido'
                ? `\n  • *Operador:* ${phoneDetails.carrier}`
                : '';

            // 7. Construcción limpia de la tarjeta
            const card =
                `╔══════════════════════════════╗\n` +
                `║   📱 *AUDITORÍA DE SISTEMA*   ║\n` +
                `╚══════════════════════════════╝\n\n` +
                `👤 *Usuario:* ${targetName}\n` +
                `📞 *Número:* ${formattedNumber}\n` +
                `🏳️ *País / Región:* ${countryText}\n\n` +
                `💻 *ENTORNO & DISPOSITIVO:*\n` +
                `  • *Sistema Operativo:* ${devInfo.os} ${devInfo.emoji}\n` +
                `  • *Cliente:* ${devInfo.client}\n` +
                `  • *Tipo de Conexión:* ${devInfo.connection}\n` +
                `  • *Tipo de Cuenta:* ${accountType}${carrierLine}\n` +
                `  • *Detección:* ${devInfo.precision}\n\n` +
                `_Unknown Codexツ</>_`;

            await m.react('✅');
            await sock.sendMessage(jid, {
                text: card,
                mentions: [target]
            }, { quoted: m });

        } catch (e) {
            await m.react('❌');
            await sock.sendMessage(jid, {
                text: `❌ Error al auditar dispositivo: ${e.message}`
            }, { quoted: m });
        }
    }
};

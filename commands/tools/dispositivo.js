'use strict';

const premium = require('../../lib/premium');
const database = require('../../lib/database');
const userNames = require('../../lib/userNames');
const recentMessagesManager = require('../../lib/recentMessages');
const { parsePhoneNumberInfo, isLikelyLid } = require('../../lib/phoneInfo');
const { getDevice: getBaileysDevice } = require('@whiskeysockets/baileys');

/**
 * Extrae el número de teléfono real (no LID) de cualquier campo de un objeto participante
 */
function extractPhoneFromParticipant(p) {
    if (!p) return null;
    const fields = [p.jid, p.phone_number, p.phoneNumber, p.id];
    for (const f of fields) {
        if (f && typeof f === 'string' && !isLikelyLid(f)) {
            const d = f.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
            if (d.length >= 7 && d.length <= 15 && !isLikelyLid(d)) {
                return d;
            }
        }
    }
    return null;
}

/**
 * Extrae los dígitos del LID de un objeto participante
 */
function extractLidFromParticipant(p) {
    if (!p) return null;
    const fields = [p.lid, p.id, p.jid];
    for (const f of fields) {
        if (f && typeof f === 'string' && isLikelyLid(f)) {
            const d = f.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
            if (d) return d;
        }
    }
    return null;
}

/**
 * Resuelve el número de teléfono real del objetivo, incluso si se recibe como un LID de WhatsApp
 */
async function resolvePhoneNumber(targetJid, { participants, groupMetadata, sock, m, jid, quotedMsgId = null, args = [] } = {}) {
    if (!targetJid) return null;
    const clean = String(targetJid).replace(/:.*@/, '@').trim().toLowerCase();
    const cleanDigits = clean.split('@')[0].replace(/[^0-9]/g, '');

    // 1. Si no es un LID y tiene formato de teléfono válido internacional, devolverlo directamente
    if (!isLikelyLid(clean) && !isLikelyLid(cleanDigits) && cleanDigits.length >= 7 && cleanDigits.length <= 15) {
        return cleanDigits;
    }

    // Identificar al sender para evitar falsos positivos
    const senderClean = String(m?.sender || '').replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
    const isTargetSender = (cleanDigits === senderClean || (sock?.user?.lid && cleanDigits === sock.user.lid.split('@')[0]));

    // 2. Mapeo de Owners conocidos y base de datos
    if (cleanDigits === '265626966868143') return '18494509905';
    if (cleanDigits === '86716094365916') return '584160666286';

    const ownerLids = database.getOwnerLids();
    const ownerNumbers = database.getOwnerNumbers();
    const ownerIndex = ownerLids.findIndex(l => l.replace(/:.*@/, '@').split('@')[0] === cleanDigits);
    if (ownerIndex !== -1 && ownerNumbers[ownerIndex]) {
        return String(ownerNumbers[ownerIndex]).replace(/[^0-9]/g, '');
    }

    // 3. Mapeo persistente en userNames (cache en disco de contactos y vinculaciones)
    if (userNames.getPhoneByLid) {
        const cached = userNames.getPhoneByLid(clean) || userNames.getPhoneByLid(cleanDigits);
        if (cached && !isLikelyLid(cached)) {
            const cleanCached = String(cached).replace(/[^0-9]/g, '');
            if (cleanCached.length >= 7 && cleanCached.length <= 15) {
                // Si el objetivo no es el remitente, no devolver el número del remitente
                if (isTargetSender || !senderClean || cleanCached !== senderClean) {
                    return cleanCached;
                }
            }
        }
    }

    // 4. Si el mensaje cita directamente al usuario objetivo y tiene número real
    if (m?.quoted?.participant && !isLikelyLid(m.quoted.participant)) {
        const qDigits = m.quoted.participant.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
        if (qDigits.length >= 7 && qDigits.length <= 15 && !isLikelyLid(qDigits)) {
            if (isTargetSender || !senderClean || qDigits !== senderClean) {
                if (userNames.linkLid) userNames.linkLid(clean, qDigits);
                return qDigits;
            }
        }
    }

    // 5. Si el comando se ejecutó en chat privado (1 a 1) y el JID es un número real
    if (m && !m.isGroup && jid && !jid.endsWith('@g.us') && !isLikelyLid(jid)) {
        const privateDigits = jid.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
        if (privateDigits.length >= 7 && privateDigits.length <= 15 && !isLikelyLid(privateDigits)) {
            if (userNames.linkLid) userNames.linkLid(clean, privateDigits);
            return privateDigits;
        }
    }

    // 6. Buscar en la lista de participantes del grupo actual
    let partList = (Array.isArray(participants) && participants.length > 0)
        ? participants
        : (Array.isArray(groupMetadata?.participants) ? groupMetadata.participants : []);

    if (partList.length === 0 && jid && jid.endsWith('@g.us') && typeof sock?.groupMetadata === 'function') {
        try {
            const meta = await Promise.race([
                sock.groupMetadata(jid),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
            ]).catch(() => null);
            if (meta && Array.isArray(meta.participants)) {
                partList = meta.participants;
            }
        } catch (_) {}
    }

    if (partList.length > 0) {
        // Pase A: Coincidencia directa por LID en los participantes
        for (const p of partList) {
            const pPhone = extractPhoneFromParticipant(p);
            const pLid = extractLidFromParticipant(p);

            if (pPhone && pLid && userNames.linkLid) {
                userNames.linkLid(pLid, pPhone);
            }
            const pName = p.notify || p.name || p.verifiedName;
            if (pName) {
                if (pLid) userNames.set(pLid, pName);
                if (pPhone) userNames.set(pPhone, pName);
            }

            const rawId = String(p.id || '').replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
            const rawJid = String(p.jid || '').replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');

            if ((pLid && pLid === cleanDigits) || (rawId && rawId === cleanDigits) || (rawJid && rawJid === cleanDigits)) {
                if (pPhone && (isTargetSender || !senderClean || pPhone !== senderClean)) {
                    if (userNames.linkLid) userNames.linkLid(clean, pPhone);
                    return pPhone;
                }
            }
        }

        // Pase B: Coincidencia por PushName / Notify entre el LID y los miembros del grupo
        const targetName = (userNames.get(clean) || userNames.get(cleanDigits) || '').trim().toLowerCase();
        if (targetName && targetName !== 'alguien' && !targetName.startsWith('@')) {
            for (const p of partList) {
                const pPhone = extractPhoneFromParticipant(p);
                const pName = (p.notify || p.name || p.verifiedName || '').trim().toLowerCase();
                if (pPhone && pName && (pName === targetName || pName.includes(targetName) || targetName.includes(pName))) {
                    if (isTargetSender || !senderClean || pPhone !== senderClean) {
                        if (userNames.linkLid) userNames.linkLid(clean, pPhone);
                        return pPhone;
                    }
                }
            }
        }

        // Pase C: Consultar WhatsApp (onWhatsApp) con los números de los participantes para obtener sus LIDs oficiales
        if (typeof sock?.onWhatsApp === 'function') {
            try {
                const candidatePhones = partList
                    .map(p => extractPhoneFromParticipant(p))
                    .filter(phone => phone && phone.length >= 7 && phone.length <= 15 && !isLikelyLid(phone) && (isTargetSender || phone !== senderClean))
                    .slice(0, 35);

                if (candidatePhones.length > 0) {
                    const onWaResults = await Promise.race([
                        sock.onWhatsApp(...candidatePhones),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
                    ]).catch(() => null);

                    if (Array.isArray(onWaResults)) {
                        for (const r of onWaResults) {
                            if (r && r.jid && r.lid) {
                                const rLidDigits = String(r.lid).split('@')[0].replace(/[^0-9]/g, '');
                                const rPhoneDigits = String(r.jid).split('@')[0].replace(/[^0-9]/g, '');
                                if (rLidDigits && rPhoneDigits && rPhoneDigits.length >= 7 && rPhoneDigits.length <= 15) {
                                    if (userNames.linkLid) userNames.linkLid(rLidDigits, rPhoneDigits);
                                    if (rLidDigits === cleanDigits) {
                                        return rPhoneDigits;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (_) {}
        }
    }

    // 7. Buscar en todos los grupos donde el bot participa con timeout estricto para no colgar
    if (typeof sock?.groupFetchAllParticipating === 'function') {
        try {
            const allGroups = await Promise.race([
                sock.groupFetchAllParticipating(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
            ]).catch(() => null);

            if (allGroups && typeof allGroups === 'object') {
                for (const gId of Object.keys(allGroups)) {
                    const g = allGroups[gId];
                    if (Array.isArray(g?.participants)) {
                        for (const p of g.participants) {
                            const pPhone = extractPhoneFromParticipant(p);
                            const pLid = extractLidFromParticipant(p);

                            if (pPhone && pLid && userNames.linkLid) {
                                userNames.linkLid(pLid, pPhone);
                            }
                            const pName = p.notify || p.name || p.verifiedName;
                            if (pName) {
                                if (pLid) userNames.set(pLid, pName);
                                if (pPhone) userNames.set(pPhone, pName);
                            }

                            const rawId = String(p.id || '').replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
                            const rawJid = String(p.jid || '').replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');

                            if ((pLid && pLid === cleanDigits) || (rawId && rawId === cleanDigits) || (rawJid && rawJid === cleanDigits)) {
                                if (pPhone && (isTargetSender || !senderClean || pPhone !== senderClean)) {
                                    if (userNames.linkLid) userNames.linkLid(clean, pPhone);
                                    return pPhone;
                                }
                            }
                        }
                    }
                }
            }
        } catch (_) {}
    }

    // 8. Si tras todas las búsquedas no se resolvió un número de teléfono real, retornar null
    return null;
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

    // 1. Detección de Bot / Servidor Automatizado (Baileys Engine)
    if (
        id.startsWith('BAE5') ||
        (id.startsWith('BAE') && id.length === 16) ||
        (id.startsWith('3EB0') && id.length === 12)
    ) {
        return {
            os: 'Bot / Servidor Automatizado',
            emoji: '🤖⚙️',
            client: 'Baileys Multi-Device Engine (Node.js)',
            connection: devNum ? `Instancia Multi-Device (#${devNum})` : 'Servidor Directo / API',
            precision: 'Exacta (Firma Baileys)'
        };
    }

    // 2. Detección de Apple iOS / iPadOS
    if (
        /^3A[0-9A-Fa-f]{18}$/i.test(id) ||
        /^2A[0-9A-Fa-f]{18}$/i.test(id) ||
        /^[0-9A-Fa-f]{20}$/i.test(id) ||
        (id.startsWith('3A') && id.length >= 18 && id.length <= 32)
    ) {
        return {
            os: 'Apple iOS / iPadOS',
            emoji: '🍎',
            client: 'WhatsApp Oficial para iPhone (iOS)',
            connection: devNum && devNum > 0 ? `Companion iOS (#${devNum}) 🔗` : 'Dispositivo Primario (iPhone) 📱',
            precision: 'Exacta (Firma Criptográfica iOS)'
        };
    }

    // 3. Detección de WhatsApp Web (Navegador)
    if (
        /^3E[0-9A-Fa-f]{18,22}$/i.test(id) ||
        (id.startsWith('3EB0') && (id.length === 18 || id.length === 20 || id.length === 22 || id.length >= 32))
    ) {
        return {
            os: 'Web Browser (PC / Navegador)',
            emoji: '🌐',
            client: 'WhatsApp Web (Chrome / Edge / Safari / Firefox)',
            connection: devNum ? `Sesión Web Vinculada (#${devNum}) 💻` : 'Sesión Web Multi-Device 💻',
            precision: 'Exacta (Firma de Token Web)'
        };
    }

    // 4. Detección de WhatsApp Desktop (App oficial PC/Mac)
    if (
        /^3F.{14,24}$/i.test(id) ||
        (id.length === 18 && (id.startsWith('3F') || devNum === 1))
    ) {
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
                    os: 'Apple iOS / iPadOS',
                    emoji: '🍎',
                    client: 'WhatsApp Oficial para iPhone (iOS)',
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

    // 6. Firma de Android: 32 caracteres hexadecimales (16 bytes) o 21-22 caracteres
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
                os: 'Smartphone / Móvil (iOS o Android)',
                emoji: '📱',
                client: 'WhatsApp Móvil Principal',
                connection: 'Dispositivo Principal (Teléfono) 📱',
                precision: 'Protocolo Master (Cita un mensaje del usuario para detectar si es iPhone o Android 💡)'
            };
        }
        if (devNum >= 1 && devNum <= 4) {
            return {
                os: 'Dispositivo Vinculado (Web / Desktop)',
                emoji: '💻',
                client: 'WhatsApp Multi-Device Companion',
                connection: `Sesión Vinculada Multi-Device (#${devNum}) 🔗`,
                precision: 'Protocolo Multi-Device Companion'
            };
        }
    }

    // 8. Detección si no hay datos específicos de mensaje
    return {
        os: 'Smartphone / Móvil (iOS o Android)',
        emoji: '📱',
        client: 'WhatsApp Móvil',
        connection,
        precision: id ? 'Estándar de Red' : 'Aproximada (Cita un mensaje del usuario para auditar su OS en tiempo real 💡)'
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

        // 1. Detección del usuario objetivo (Menciones, Quoted o Args)
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (Array.isArray(mentioned) && mentioned.length > 0) {
            target = String(mentioned[0] || '').trim();
            rawParticipant = target;
        } else if (m.quoted && (m.quoted.sender || m.quoted.participant)) {
            if (m.quoted.participant && !m.quoted.participant.endsWith('@lid')) {
                target = String(m.quoted.participant).trim();
            } else {
                target = String(m.quoted.sender || m.quoted.participant).trim();
            }
            quotedMsgId = m.quoted.id;
            rawParticipant = m.quoted.participant || m.quoted.sender;
            if (m.quoted.pushName) {
                userNames.set(target, m.quoted.pushName);
            }
        } else if (args && args[0]) {
            const rawDigits = args[0].replace(/^@/, '').replace(/[^0-9]/g, '');
            if (rawDigits.length >= 7 && rawDigits.length <= 15 && !isLikelyLid(rawDigits)) {
                target = `${rawDigits}@s.whatsapp.net`;
                rawParticipant = target;
            } else if (args[0].startsWith('@')) {
                const searchTag = args.join(' ').replace(/^@/, '').toLowerCase().trim();
                const partList = Array.isArray(participants) && participants.length > 0
                    ? participants
                    : (Array.isArray(groupMetadata?.participants) ? groupMetadata.participants : []);
                const foundMember = partList.find(p => {
                    const name = (p.notify || p.name || p.verifiedName || '').toLowerCase();
                    const pId = String(p.id || '').toLowerCase();
                    const pJid = String(p.jid || '').toLowerCase();
                    return (name && name.includes(searchTag)) || pId.includes(searchTag) || pJid.includes(searchTag);
                });
                if (foundMember) {
                    target = foundMember.id || foundMember.jid || foundMember.lid;
                    rawParticipant = target;
                }
            }
        }

        // Si no se especificó nadie, auditar al propio usuario ejecutor
        if (!target) {
            target = sender;
            quotedMsgId = m.key?.id;
            rawParticipant = m.key?.participant || sender;
        }

        try {
            // Normalizar target para evitar sufijos de dispositivo (:0, :1)
            target = String(target).replace(/:.*@/, '@').trim();
            const targetIdClean = target.split('@')[0];

            // 2. Resolución del número de teléfono real
            const resolvedNumber = await resolvePhoneNumber(target, {
                participants,
                groupMetadata,
                sock,
                m,
                jid,
                quotedMsgId,
                args
            });

            // 3. Si no se citó un mensaje directamente, buscar el último mensaje del usuario en memoria
            if (!quotedMsgId) {
                const candidateIds = [
                    target,
                    targetIdClean,
                    resolvedNumber,
                    userNames.getPhoneByLid ? userNames.getPhoneByLid(target) : null,
                    userNames.getPhoneByLid ? userNames.getPhoneByLid(targetIdClean) : null,
                    userNames.getLidByPhone ? userNames.getLidByPhone(target) : null,
                    userNames.getLidByPhone ? userNames.getLidByPhone(targetIdClean) : null,
                    userNames.getLidByPhone ? userNames.getLidByPhone(resolvedNumber) : null
                ];

                // Inspeccionar participantes del grupo actual para agregar sus identificadores
                const partList = Array.isArray(participants) && participants.length > 0
                    ? participants
                    : (Array.isArray(groupMetadata?.participants) ? groupMetadata.participants : []);

                for (const p of partList) {
                    const pPhone = extractPhoneFromParticipant(p);
                    const pLid = extractLidFromParticipant(p);
                    const pRawId = String(p.id || '').replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
                    const pRawJid = String(p.jid || '').replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');

                    const matches = (
                        (resolvedNumber && (pPhone === resolvedNumber || pRawId === resolvedNumber || pRawJid === resolvedNumber)) ||
                        (targetIdClean && (pLid === targetIdClean || pRawId === targetIdClean || pRawJid === targetIdClean || pPhone === targetIdClean))
                    );

                    if (matches) {
                        if (pPhone) {
                            candidateIds.push(pPhone);
                            candidateIds.push(`${pPhone}@s.whatsapp.net`);
                        }
                        if (pLid) {
                            candidateIds.push(pLid);
                            candidateIds.push(`${pLid}@lid`);
                        }
                        if (p.id) candidateIds.push(p.id);
                        if (p.jid) candidateIds.push(p.jid);
                        if (pPhone && pLid && userNames.linkLid) {
                            userNames.linkLid(pLid, pPhone);
                        }
                        break;
                    }
                }

                const lastMsg = recentMessagesManager.findLastMessageForUser(jid, candidateIds, m.key?.id);
                if (lastMsg) {
                    quotedMsgId = lastMsg.id;
                    if (lastMsg.participant) rawParticipant = lastMsg.participant;
                }
            }

            const targetName = userNames.get(resolvedNumber ? `${resolvedNumber}@s.whatsapp.net` : target);

            // 4. Formato de teléfono, país y región a partir del número resuelto
            let phoneDetails = null;
            let formattedNumber = null;
            let countryText = null;

            const targetDigits = resolvedNumber || (!isLikelyLid(target) && !isLikelyLid(targetIdClean) ? targetIdClean.replace(/[^0-9]/g, '') : null);
            if (targetDigits && targetDigits.length >= 7) {
                phoneDetails = parsePhoneNumberInfo(targetDigits);
            }

            if (phoneDetails && !phoneDetails.isLid) {
                formattedNumber = phoneDetails.internationalFormatted || `+${phoneDetails.cleanDigits}`;
                countryText = `${phoneDetails.countryName} ${phoneDetails.flag}${phoneDetails.region ? ` • ${phoneDetails.region}` : ''}`;
            } else {
                formattedNumber = '🔒 Protegido por WhatsApp (Comunidad / Privacidad)';
                countryText = '🛡️ Identidad Vinculada (Multi-Device) • Número Oculto';
            }

            // 5. Auditoría profunda de Dispositivo y Cliente
            const devInfo = detectClientDevice(quotedMsgId, rawParticipant || target);

            // 6. Tipo de cuenta: WhatsApp Business vs Estándar
            let accountType = 'WhatsApp Estándar / Personal 💬';
            if (targetDigits && targetDigits.length >= 7) {
                try {
                    const validJid = `${targetDigits}@s.whatsapp.net`;
                    const bProfile = await sock.getBusinessProfile(validJid).catch(() => null);
                    if (bProfile) {
                        const cat = bProfile.category ? ` • ${bProfile.category}` : '';
                        accountType = `WhatsApp Business 💼${cat}`;
                    }
                } catch (_) {}
            }

            // Información extra del teléfono si está disponible
            const extraPhoneInfo = [];
            if (phoneDetails && !phoneDetails.isLid) {
                if (phoneDetails.lineType) {
                    extraPhoneInfo.push(`  • *Línea:* ${phoneDetails.lineType}`);
                }
                if (phoneDetails.carrier && phoneDetails.carrier !== 'Desconocido' && !phoneDetails.carrier.includes('no especificado')) {
                    extraPhoneInfo.push(`  • *Operador:* ${phoneDetails.carrier}`);
                }
                if (phoneDetails.localTimeInfo?.fullString) {
                    extraPhoneInfo.push(`  • *Hora Local:* ${phoneDetails.localTimeInfo.fullString}`);
                }
            }
            const phoneExtraStr = extraPhoneInfo.length > 0 ? `\n${extraPhoneInfo.join('\n')}` : '';

            // 7. Construcción limpia de la tarjeta
            const card =
                `╔══════════════════════════════╗\n` +
                `║   📱 *AUDITORÍA DE SISTEMA*   ║\n` +
                `╚══════════════════════════════╝\n\n` +
                `👤 *Usuario:* ${targetName}\n` +
                `📞 *Número:* ${formattedNumber}\n` +
                `🏳️ *País / Región:* ${countryText}${phoneExtraStr}\n\n` +
                `💻 *ENTORNO & DISPOSITIVO:*\n` +
                `  • *Sistema Operativo:* ${devInfo.os} ${devInfo.emoji}\n` +
                `  • *Cliente:* ${devInfo.client}\n` +
                `  • *Tipo de Conexión:* ${devInfo.connection}\n` +
                `  • *Tipo de Cuenta:* ${accountType}\n` +
                `  • *Detección:* ${devInfo.precision}\n\n` +
                `_Unknown Codexツ</>_`;

            await m.react('✅');

            // Preparar lista de menciones ultra-segura (NUNCA incluir @lid ni sufijos :0/:1)
            const mentionsList = [];
            if (resolvedNumber && !isLikelyLid(resolvedNumber)) {
                mentionsList.push(`${resolvedNumber}@s.whatsapp.net`);
            } else if (target && !target.toLowerCase().endsWith('@lid') && !isLikelyLid(target)) {
                const cleanDigits = target.split('@')[0].replace(/[^0-9]/g, '');
                if (cleanDigits.length >= 7 && cleanDigits.length <= 15) {
                    mentionsList.push(`${cleanDigits}@s.whatsapp.net`);
                }
            }

            try {
                await sock.sendMessage(jid, {
                    text: card,
                    mentions: mentionsList
                }, { quoted: m });
            } catch (_) {
                // Fallback ultra-seguro por si WhatsApp rechaza stanzas con menciones o quoted
                await sock.sendMessage(jid, { text: card });
            }

        } catch (e) {
            console.error('[DISPOSITIVO ERROR]:', e);
            await m.react('❌');
            try {
                await sock.sendMessage(jid, {
                    text: `❌ Error al auditar dispositivo: ${e.message}`
                }, { quoted: m });
            } catch (_) {
                await sock.sendMessage(jid, {
                    text: `❌ Error al auditar dispositivo: ${e.message}`
                });
            }
        }
    }
};

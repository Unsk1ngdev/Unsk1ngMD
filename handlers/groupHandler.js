const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');
const groupSettings = require('../lib/groupSettings');
const database = require('../lib/database');
const despedidaManager = require('../lib/despedida');
const bannedManager = require('../lib/banned');

/**
 * Manejador de eventos de participantes de grupo (entradas, salidas, ascensos)
 */
const handleGroupUpdate = async (sock, update) => {
    try {
        const { id, participants, action } = update;

        // Si el grupo está baneado (bangroup), ignorar completamente eventos de grupo
        if (id && bannedManager.isGroupBanned(id)) {
            return;
        }

        // Manejo de Despedida cuando alguien sale o es expulsado
        if (action === 'remove' || action === 'leave') {
            const configDespedida = despedidaManager.getConfig(id);
            if (configDespedida && configDespedida.activo) {
                let groupMeta = null;
                try {
                    groupMeta = await sock.groupMetadata(id);
                } catch (_) {}
                const groupName = groupMeta?.subject || 'el grupo';
                const memberCount = groupMeta?.participants ? groupMeta.participants.length : undefined;
                const groupDesc = groupMeta?.desc || '';

                // Foto de perfil del grupo como fallback
                let groupPfpUrl = null;
                try {
                    groupPfpUrl = await sock.profilePictureUrl(id, 'image');
                } catch (_) {}

                for (const participante of participants) {
                    const userTag = participante.replace(/:\d+@/, '@').split('@')[0].replace(/[^0-9]/g, '');

                    // Intentar obtener foto de perfil del usuario que se fue
                    let pfpUrl = null;
                    try {
                        pfpUrl = await sock.profilePictureUrl(participante, 'image');
                    } catch (_) {
                        pfpUrl = groupPfpUrl;
                    }

                    const template = configDespedida.mensaje || despedidaManager.DEFAULT_DESPEDIDA;
                    const mensaje = despedidaManager.formatMessage(template, {
                        userTag,
                        groupName,
                        memberCount,
                        groupDesc
                    });

                    if (pfpUrl) {
                        await sock.sendMessage(id, {
                            image: { url: pfpUrl },
                            caption: mensaje,
                            mentions: [participante]
                        }).catch(() => {});
                    } else {
                        await sock.sendMessage(id, {
                            text: mensaje,
                            mentions: [participante]
                        }).catch(() => {});
                    }
                }
            }
            return;
        }

        const isWelcomeActive = groupSettings.isBienvenidaEnabled(id) || database.getGroup(id)?.welcome;

        if (!isWelcomeActive || action !== 'add') {
            return;
        }

        // Obtener metadatos del grupo de forma segura
        let groupMeta = null;
        try {
            groupMeta = await sock.groupMetadata(id);
        } catch (_) {}

        const groupName = groupMeta?.subject || 'nuestro grupo';
        const groupDesc = groupMeta?.desc || 'Sin descripción asignada.';

        for (const participant of participants) {
            const userTag = participant.replace(/:.*@/, '@').split('@')[0];

            // Intentar obtener foto de perfil del nuevo integrante
            let pfpUrl = null;
            try {
                pfpUrl = await sock.profilePictureUrl(participant, 'image');
            } catch (_) {
                // Si no tiene foto pública, se usa fallback
            }

            const welcomeText =
                `╭━━━〔 *¡NUEVO MIEMBRO!* 〕━━━⬣\n` +
                `┃ 👋 ¡Bienvenido/a @${userTag} a *${groupName}*!\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                `📜 *Descripción del grupo:*\n${groupDesc}\n\n` +
                `_Te invitamos a leer las reglas y disfrutar de la comunidad._ ✨`;

            if (pfpUrl) {
                await sock.sendMessage(id, {
                    image: { url: pfpUrl },
                    caption: welcomeText,
                    mentions: [participant]
                });
            } else {
                await sock.sendMessage(id, {
                    text: welcomeText,
                    mentions: [participant]
                });
            }

            // Enviar audio de bienvenida inmediatamente después del mensaje de bienvenida
            try {
                const opusAudio = path.join(__dirname, '../assets/bienvenida.opus');
                const mp3Audio = path.join(__dirname, '../assets/bienvenida.mp3');

                if (fs.existsSync(opusAudio)) {
                    await sock.sendMessage(id, {
                        audio: fs.readFileSync(opusAudio),
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    });
                } else if (fs.existsSync(mp3Audio)) {
                    await sock.sendMessage(id, {
                        audio: fs.readFileSync(mp3Audio),
                        mimetype: 'audio/mp4',
                        ptt: true
                    });
                }
            } catch (audioErr) {
                logger.error('Error enviando audio de bienvenida:', audioErr.message);
            }
        }
    } catch (err) {
        logger.error('Error en handleGroupUpdate:', err.message);
    }
};

module.exports = {
    handleGroupUpdate
};

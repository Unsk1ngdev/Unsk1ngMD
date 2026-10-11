'use strict';

/**
 * Comando: .spy @usuario | .spy número
 * Premium + Owner: Obtiene información y lista los grupos en común entre el bot y el número indicado.
 */

const premium = require('../../lib/premium');

module.exports = {
    name: 'spy',
    alias: ['gruposcomunes', 'commongroups', 'espiar'],
    category: 'tools',
    desc: 'Muestra los grupos en común y reporte de un usuario (Premium)',
    usage: '.spy @usuario | .spy número',
    groupOnly: false,
    adminOnly: false,
    ownerOnly: false,

    execute: async ({ sock, m, args, isOwner }) => {
        // ── 1. Verificar acceso: Owner o Premium ──────────────────────────────
        const sender = m.sender || m.key.participant || m.chat;
        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(m.chat, {
                text: '⭐ Este comando es exclusivo para miembros *Premium*.\n\n' +
                      '💎 Contacta al owner para obtener acceso.\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // ── 2. Resolver JID objetivo ─────────────────────────────────────────
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let target = mentioned[0] || null;

        if (!target && m.quoted?.sender) {
            target = m.quoted.sender;
        }

        if (!target && args[0]) {
            const rawDigits = args[0].replace(/[^0-9]/g, '');
            if (rawDigits.length >= 6) {
                target = `${rawDigits}@s.whatsapp.net`;
            }
        }

        if (!target || target === 'undefined@s.whatsapp.net') {
            return await sock.sendMessage(m.chat, {
                text: '❌ Uso correcto:\n*.spy @usuario*\n*.spy 18091234567*'
            }, { quoted: m });
        }

        const cleanNumber = target.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        const targetJid = `${cleanNumber}@s.whatsapp.net`;

        // Notificación de inicio
        await sock.sendMessage(m.chat, {
            text: `🕵️ Espiando a *+${cleanNumber}*...\n🔄 Buscando grupos en común...`
        }, { quoted: m });

        try {
            // ── 3. Verificar si tiene WhatsApp ──────────────────────────────────
            let tieneWA = false;
            try {
                const onWA = await sock.onWhatsApp(targetJid);
                tieneWA = onWA?.[0]?.exists || false;
            } catch (_) {}

            if (!tieneWA) {
                return await sock.sendMessage(m.chat, {
                    text: `❌ El número *+${cleanNumber}* no tiene WhatsApp registrado.`
                }, { quoted: m });
            }

            // ── 4. Obtener TODOS los grupos donde participa el bot ──────────────
            // ✅ En Baileys moderno se usa groupFetchAllParticipating()
            const todosLosGrupos = await sock.groupFetchAllParticipating();
            const gruposEnComun = [];

            // ── 5. Buscar manualmente al target en cada grupo ───────────────────
            for (const [groupId, groupData] of Object.entries(todosLosGrupos || {})) {
                if (!groupData?.participants) continue;

                const participante = groupData.participants.find(p => {
                    const pNum = (p.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    const pLid = (p.lid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    return pNum === cleanNumber || (pLid && pLid === cleanNumber);
                });

                if (participante) {
                    const esAdmin = participante.admin === 'admin' || participante.admin === 'superadmin';
                    gruposEnComun.push({
                        nombre: groupData.subject || 'Sin nombre',
                        id: groupId,
                        admin: esAdmin,
                        miembros: groupData.participants.length
                    });
                }
            }

            // ── 6. Obtener foto de perfil ───────────────────────────────────────
            let foto = null;
            try {
                foto = await sock.profilePictureUrl(targetJid, 'image');
            } catch (_) {}

            // ── 7. Obtener estado / bio ─────────────────────────────────────────
            let estado = '🔒 Privado';
            try {
                const statusData = await sock.fetchStatus(targetJid);
                estado = statusData?.status || '🔒 Privado';
            } catch (_) {}

            // ── 8. Construir mensaje con el diseño exacto ───────────────────────
            let listaGrupos = '';
            if (gruposEnComun.length > 0) {
                listaGrupos = gruposEnComun.map((g, i) =>
                    `${i + 1}. ${g.nombre}\n` +
                    `   👥 ${g.miembros} miembros | ${g.admin ? '👑 Es admin' : '👤 Miembro'}`
                ).join('\n\n');
            } else {
                listaGrupos = 'No hay grupos en común';
            }

            const mensaje =
                `╔══════════════════╗\n` +
                `║    🕵️ *SPY REPORT*    ║\n` +
                `╚══════════════════╝\n\n` +
                `📱 *Número:* +${cleanNumber}\n` +
                `✅ *WhatsApp:* Registrado\n` +
                `💬 *Estado:* _${estado}_\n` +
                `🖼️ *Foto:* ${foto ? '✅ Disponible' : '🔒 Privada'}\n\n` +
                `━━━━━━━━━━━━━━━\n` +
                `👥 *Grupos en común: ${gruposEnComun.length}*\n` +
                `━━━━━━━━━━━━━━━\n\n` +
                `${listaGrupos}\n\n` +
                `━━━━━━━━━━━━━━━\n` +
                `_Unknown Codexツ</>_`;

            // ── 9. Enviar con foto si está disponible, o como texto ─────────────
            if (foto) {
                try {
                    await sock.sendMessage(m.chat, {
                        image: { url: foto },
                        caption: mensaje
                    }, { quoted: m });
                } catch (_) {
                    await sock.sendMessage(m.chat, { text: mensaje }, { quoted: m });
                }
            } else {
                await sock.sendMessage(m.chat, { text: mensaje }, { quoted: m });
            }

        } catch (e) {
            console.error('[SPY] Error:', e.message);
            await sock.sendMessage(m.chat, {
                text: `❌ Error al ejecutar .spy\n📋 Detalle: ${e.message}`
            }, { quoted: m });
        }
    }
};

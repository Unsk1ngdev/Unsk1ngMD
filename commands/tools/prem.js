'use strict';

/**
 * Comando: .prem [@usuario | remove @usuario | list]
 * Solo el OWNER puede gestionar membresías premium.
 */

const premium = require('../../lib/premium');

module.exports = {
    name: 'prem',
    alias: ['premium', 'vip'],
    category: 'sistema',
    desc: 'Gestiona membresías premium (solo owner)',
    usage: '.prem @usuario | .prem remove @usuario | .prem list',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner) return;

        const subCmd    = (args[0] || '').toLowerCase();
        const mentioned = m.mentionedJid || [];

        // ── Ver lista ─────────────────────────────────────────────────────────
        if (subCmd === 'list') {
            const users = premium.list();
            if (users.length === 0) {
                return await sock.sendMessage(m.chat, {
                    text: '📋 No hay usuarios premium actualmente.'
                }, { quoted: m });
            }

            const lista = users.map((u, i) =>
                `${i + 1}. +${u.jid.split('@')[0]} — desde ${u.fecha}`
            ).join('\n');

            return await sock.sendMessage(m.chat, {
                text: [
                    `╔══════════════════╗`,
                    `║  ⭐ *LISTA PREMIUM*  ║`,
                    `╚══════════════════╝`,
                    ``,
                    lista,
                    ``,
                    `👥 Total: *${users.length}* usuarios`,
                    ``,
                    `_Unknown Codexツ</>_`
                ].join('\n')
            }, { quoted: m });
        }

        // ── Quitar premium ────────────────────────────────────────────────────
        if (subCmd === 'remove') {
            let target = mentioned[0];
            if (!target && args[1]) {
                const raw = args[1].replace(/[^0-9]/g, '');
                if (raw.length >= 7) target = `${raw}@s.whatsapp.net`;
            }

            if (!target) {
                return await sock.sendMessage(m.chat, {
                    text: '❌ Uso: `.prem remove @usuario`'
                }, { quoted: m });
            }

            const removed = premium.remove(target);
            if (!removed) {
                return await sock.sendMessage(m.chat, {
                    text: '⚠️ Ese usuario no tiene premium.'
                }, { quoted: m });
            }

            // Notificar al usuario
            try {
                await sock.sendMessage(target, {
                    text: '❌ *Tu acceso Premium ha sido removido.*\n\n_Unknown Codexツ</>_'
                });
            } catch (_) {}

            return await sock.sendMessage(m.chat, {
                text: `✅ Premium removido a *+${target.split('@')[0]}*`
            }, { quoted: m });
        }

        // ── Dar premium ───────────────────────────────────────────────────────
        let target = mentioned[0];
        if (!target && args[0] && subCmd !== 'list' && subCmd !== 'remove') {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) target = `${raw}@s.whatsapp.net`;
        }

        if (!target) {
            return await sock.sendMessage(m.chat, {
                text: [
                    '❌ Uso correcto:',
                    '⭐ `.prem @usuario` — Dar premium',
                    '❌ `.prem remove @usuario` — Quitar premium',
                    '📋 `.prem list` — Ver lista'
                ].join('\n')
            }, { quoted: m });
        }

        const added = premium.add(target);
        if (!added) {
            return await sock.sendMessage(m.chat, {
                text: '⚠️ Ese usuario ya tiene premium.'
            }, { quoted: m });
        }

        // Notificar al usuario
        try {
            await sock.sendMessage(target, {
                text: [
                    '⭐ *¡Felicitaciones! Tienes acceso Premium.*',
                    '',
                    '🔓 Ahora puedes usar:',
                    '👁️ `.vv` — Ver fotos/videos una vez',
                    '🎙️ `.escuchar` — Escuchar audios una vez',
                    '🪪 `.cedula` — Consulta Cédula/DNI',
                    '🕵️ `.spy` — Ver grupos de un número',
                    '⚔️ `.debatir` — Debate interactivo',
                    '👻 `.ghost` — Modo invisible',
                    '🪞 `.clonar` — Copiar perfil',
                    '👁️ `.stalkear` — Monitorear conexión',
                    '💬 `.sms` — Mensaje anónimo',
                    '🎭 `.fake` — Perfil falso',
                    '🎭 `.fakechat` — Mensaje falso de alguien',
                    '🎮 `.discord` — Inteligencia y perfil de Discord',
                    '📱 `.dispositivo` — Ver dispositivo',
                    '📍 `.ubicacion` — Pin de cualquier ciudad',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            });
        } catch (_) {}

        const fecha = premium.list().find(u => u.jid === target.replace(/:\d+@/, '@'))?.fecha || '';

        await sock.sendMessage(m.chat, {
            text: [
                '✅ *Premium activado*',
                '',
                `👤 Usuario: *+${target.split('@')[0]}*`,
                `📅 Fecha: *${fecha}*`,
                '',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};


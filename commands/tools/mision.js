'use strict';

const economy = require('../../lib/economy');
const missions = require('../../lib/missions');

module.exports = {
    name: 'mision',
    alias: ['misiones', 'quest', 'quests', 'tareas'],
    category: 'juegos',
    desc: 'Sistema de misiones diarias con recompensas en monedas y experiencia',
    usage: '.mision [reclamar <id|all>]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const sub = (args[0] || '').toLowerCase().trim();

        // 1. Subcomando de reclamar recompensas (.mision reclamar / .mision claim)
        if (sub === 'reclamar' || sub === 'claim' || sub === 'cobrar') {
            const targetId = args[1] ? args[1].toLowerCase().trim() : 'all';
            const res = missions.claim(sender, targetId);

            if (res.claimedCount === 0 && !res.gotBonus) {
                return await sock.sendMessage(jid, {
                    text: [
                        'ℹ️ *NO TIENES RECOMPENSAS PENDIENTES*',
                        '',
                        `No hay misiones completadas pendientes por cobrar, @${sender.split('@')[0]}.`,
                        'Realiza las actividades requeridas y luego escribe `.mision reclamar`.',
                        '',
                        '💡 _Escribe `.mision` para consultar tus objetivos de hoy._',
                        '_Unknown Codexツ</>_'
                    ].join('\n'),
                    mentions: [sender]
                }, { quoted: m });
            }

            const lineas = [
                '🎉 *¡RECOMPENSA DE MISIONES RECLAMADA!* 🎉',
                '',
                `👤 *Agente:* @${sender.split('@')[0]}`,
                `🎯 *Misiones cobradas:* ${res.claimedCount}`
            ];

            for (const item of res.claimedMissions) {
                lineas.push(`  • *${item.titulo}:* +$${economy.formatNumber(item.recompensaMonedas)} monedas | +${item.recompensaExp} EXP`);
            }

            if (res.gotBonus) {
                lineas.push('');
                lineas.push('🌟 *¡BONIFICACIÓN MAESTRA DEL DÍA!* 🌟');
                lineas.push(`¡Completaste las 3 misiones de hoy! Recibes un bono extra de:`);
                lineas.push(`💵 +$${economy.formatNumber(res.bonusCoins)} monedas | 🔮 +${res.bonusExp} EXP`);
            }

            const user = economy.getUser(sender);
            lineas.push('');
            lineas.push(`💰 *Saldo actual en mano:* $${economy.formatNumber(user.monedas || 0)}`);
            lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
            lineas.push('_Unknown Codexツ</>_');

            return await sock.sendMessage(jid, {
                text: lineas.join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // 2. Despliegue del panel de misiones del día
        const data = missions.getUserMissions(sender);
        const hoy = data.date;

        const lines = [
            '╔══════════════════════════╗',
            `║  📋 *MISIONES DIARIAS* (${hoy}) ║`,
            '╚══════════════════════════╝',
            '',
            `👤 *Agente:* @${sender.split('@')[0]}`,
            'Completa tus asignaciones para ganar monedas y experiencia extra cada día.',
            ''
        ];

        let pendingToClaim = 0;

        data.missions.forEach((quest) => {
            const bar = missions.renderBar(quest.current, quest.target, 8);
            let estado = '';

            if (quest.claimed) {
                estado = '🏅 *Reclamada*';
            } else if (quest.completed) {
                estado = '✅ *¡COMPLETA! (Lista para reclamar)*';
                pendingToClaim++;
            } else {
                estado = '⏳ *En progreso*';
            }

            lines.push(`*[${quest.id}] ${quest.titulo}*`);
            lines.push(`📖 _${quest.desc}_`);
            lines.push(`📊 Progreso: [${bar}] *${quest.current}/${quest.target}*`);
            lines.push(`🎁 Recompensa: +$${economy.formatNumber(quest.recompensaMonedas)} monedas | +${quest.recompensaExp} EXP`);
            lines.push(`📌 Estado: ${estado}`);
            lines.push('──────────────────────────');
        });

        lines.push('');
        lines.push('🌟 *Gran Premio Maestro Diario:*');
        lines.push('Completa y cobra las 3 misiones para ganar +$5,000 monedas extra.');
        lines.push('');

        if (pendingToClaim > 0) {
            lines.push(`🔔 *¡Tienes ${pendingToClaim} misión(es) completada(s)!*`);
            lines.push('👉 _Escribe `.mision reclamar` para recibir tu dinero y EXP._');
        } else {
            lines.push('👉 _Usa los comandos del bot correspondientes para avanzar._');
        }

        lines.push('');
        lines.push('_Unknown Codexツ</>_');

        return await sock.sendMessage(jid, {
            text: lines.join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};


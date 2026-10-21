'use strict';

const economy = require('../../lib/economy');
const database = require('../../lib/database');

module.exports = {
    name: 'chetar',
    alias: ['cheat', 'godmode', 'maxstats'],
    category: 'sistema',
    desc: 'Solo Owner — Pone todas las stats al máximo (monedas, nivel, exp, ataque, defensa)',
    usage: '.chetar [@usuario]',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const isRealOwner = isOwner || database.isOwner(sender, sock);
        if (!isRealOwner) {
            return await sock.sendMessage(jid, {
                text: '⛔ Este comando está reservado exclusivamente para el Creador/Owner del bot.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const mentioned = m.mentionedJid || [];
        let target = mentioned[0] || sender;

        if (!mentioned[0] && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) target = `${raw}@s.whatsapp.net`;
        }

        const user = economy.cheatOwner(target);

        return await sock.sendMessage(jid, {
            text: [
                '👑 *MODO CHETADO ACTIVADO (OWNER)*',
                '',
                `⚡ *Usuario beneficiado:* @${target.split('@')[0]}`,
                '',
                `💵 *Monedas en mano:* $${economy.formatNumber(user.monedas)}`,
                `🏦 *Monedas en banco:* $${economy.formatNumber(user.banco)}`,
                `⭐ *Nivel:* ${user.level}`,
                `🔮 *Experiencia (EXP):* ${economy.formatNumber(user.exp)}`,
                `⚔️ *Ataque:* ${user.ataque}`,
                `🛡️ *Defensa:* ${user.defensa}`,
                `💳 *Deuda Bancaria:* $0 (Cancelada)`,
                '',
                '🔥 _Estadísticas legendarias aplicadas con éxito._',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [target]
        }, { quoted: m });
    }
};


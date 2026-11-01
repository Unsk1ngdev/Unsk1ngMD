'use strict';

const guessGameManager = require('../../lib/guessGameManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'suitpvp',
    alias: ['pvp', 'ppt', 'dueloppt', 'piedrapapeltijera'],
    category: 'juegos',
    desc: 'Reta a otro usuario a un duelo de Piedra, Papel o Tijera PvP con 30 segundos límite',
    usage: '.suitpvp @usuario [apuesta opcional]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Resolver target
        let targetJid = null;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted) {
            targetJid = m.quoted.sender || m.quoted.participant;
        }

        if (!targetJid) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ✂️ PIEDRA, PAPEL O TIJERA PVP 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.suitpvp @usuario [apuesta]`',
                    '┃├◆ 📌 *Ejemplo 1:* `.suitpvp @amigo`',
                    '┃├◆ 📌 *Ejemplo 2:* `.suitpvp @amigo 2000`',
                    '┃',
                    '┃├◆ 💡 Ambos jugadores tendrán 30s para escribir',
                    '┃   *piedra*, *papel* o *tijera* en el chat.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        if (targetJid === sender) {
            return await sock.sendMessage(jid, {
                text: '😂 No puedes retarte a un duelo a ti mismo.'
            }, { quoted: m });
        }

        const betArg = args.find(a => /^\d+$/.test(a));
        const bet = betArg ? parseInt(betArg, 10) : 1000;

        const senderEco = economy.getUser(sender);
        if ((senderEco.monedas || 0) < bet) {
            return await sock.sendMessage(jid, {
                text: `❌ No tienes suficientes monedas para la apuesta ($${economy.formatNumber(bet)} requeridas).\nTu saldo: $${economy.formatNumber(senderEco.monedas || 0)}`
            }, { quoted: m });
        }

        await guessGameManager.startSuitPvp(sock, m, targetJid, bet);
    }
};


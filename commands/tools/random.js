'use strict';

module.exports = {
    name: 'random',
    alias: ['azar', 'dado', 'aleatorio'],
    category: 'herramientas',
    desc: 'Genera un número aleatorio entre min y max (público)',
    usage: '.random [min] [max]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        let min = 1;
        let max = 100;

        if (args[0] && args[1]) {
            min = parseInt(args[0], 10);
            max = parseInt(args[1], 10);
        } else if (args[0]) {
            max = parseInt(args[0], 10);
        }

        if (isNaN(min) || isNaN(max)) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.random [min] [max]*\nEjemplo: *.random 1 100*'
            }, { quoted: m });
        }

        if (min > max) {
            return await sock.sendMessage(jid, {
                text: '❌ El mínimo no puede ser mayor que el máximo.'
            }, { quoted: m });
        }

        const resultado = Math.floor(Math.random() * (max - min + 1)) + min;

        await sock.sendMessage(jid, {
            text: `🎲 *Número Aleatorio*\n\n` +
                  `📊 Rango: *${min}* — *${max}*\n` +
                  `🎯 Resultado: *${resultado}*\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};


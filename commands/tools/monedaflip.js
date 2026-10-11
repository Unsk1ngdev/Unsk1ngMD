'use strict';

module.exports = {
    name: 'monedaflip',
    alias: ['moneda', 'flip', 'carocruz', 'coinflip'],
    category: 'herramientas',
    desc: 'Lanza una moneda con animación en vivo de cara o cruz',
    usage: '.monedaflip',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const resultado = Math.random() < 0.5 ? 'CARA 🪙' : 'CRUZ ✨';
        const animacion = ['🪙', '🌀', '⭕', '🔄', resultado];

        let msg = await sock.sendMessage(jid, {
            text: '🪙 Lanzando moneda...'
        }, { quoted: m });

        for (const frame of animacion) {
            await new Promise(r => setTimeout(r, 500));
            try {
                await sock.sendMessage(jid, {
                    text: `🪙 *${frame}*`,
                    edit: msg.key
                });
            } catch (_) {}
        }

        await sock.sendMessage(jid, {
            text: `🪙 *Resultado: ${resultado}*\n\n_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};


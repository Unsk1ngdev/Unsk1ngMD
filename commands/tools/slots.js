'use strict';

module.exports = {
    name: 'slots',
    alias: ['slot', 'tragamonedas', 'apuesta'],
    category: 'juegos',
    desc: 'Juega a la máquina tragamonedas (slots) con premios y combinaciones',
    usage: '.slots',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const simbolos = ['🍒', '🍋', '🍊', '🍇', '⭐', '7️⃣', '💎', '🎰', '🔔', '🍀'];

        const s1 = simbolos[Math.floor(Math.random() * simbolos.length)];
        const s2 = simbolos[Math.floor(Math.random() * simbolos.length)];
        const s3 = simbolos[Math.floor(Math.random() * simbolos.length)];

        // Animación de giro
        let msg = await sock.sendMessage(jid, {
            text: '🎰 *Girando...*\n\n[ 🔄 | 🔄 | 🔄 ]'
        }, { quoted: m });

        await new Promise(r => setTimeout(r, 1200));

        // Determinar resultado
        let resultado = '';
        let premio = '';

        if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
            resultado = '💰 *¡GRAN PREMIO!* 💰';
            premio = '¡Tres sietes! ¡Eres increíble!';
        } else if (s1 === '💎' && s2 === '💎' && s3 === '💎') {
            resultado = '💎 *¡JACKPOT DIAMANTE!* 💎';
            premio = '¡La combinación más rara!';
        } else if (s1 === s2 && s2 === s3) {
            resultado = '🎉 *¡JACKPOT!* 🎉';
            premio = `¡Tres ${s1} iguales!`;
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            resultado = '😅 *¡CASI!*';
            premio = 'Dos iguales, sigue intentando.';
        } else {
            resultado = '💀 *PERDISTE*';
            premio = 'Mejor suerte la próxima vez.';
        }

        const finalText =
            `🎰 *SLOTS*\n\n` +
            `[ ${s1} | ${s2} | ${s3} ]\n\n` +
            `${resultado}\n` +
            `_${premio}_\n\n` +
            `_Unknown Codexツ</>_`;

        // Intentar editar para una animación fluida; si no, enviar mensaje nuevo
        let editado = false;
        if (msg && msg.key) {
            try {
                await sock.sendMessage(jid, {
                    text: finalText,
                    edit: msg.key
                });
                editado = true;
            } catch (_) {}
        }

        if (!editado) {
            await sock.sendMessage(jid, { text: finalText }, { quoted: m });
        }
    }
};


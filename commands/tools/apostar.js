'use strict';

const economy = require('../../lib/economy');
const missions = require('../../lib/missions');

const DADOS_EMOJIS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

module.exports = {
    name: 'apostar',
    alias: ['bet', 'apuesta'],
    category: 'juegos',
    desc: 'Apuesta monedas contra la casa con dados animados y probabilidad real',
    usage: '.apostar <cantidad | all>',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const user = economy.getUser(sender);
        const saldoMano = user.monedas || 0;

        const input = (args[0] || text || '').toLowerCase().trim();

        // 1. Validación de entrada
        if (!input) {
            return await sock.sendMessage(jid, {
                text: [
                    '🎲 *[CASINO UNSK1NGMD - APUESTAS]* 🎲',
                    '',
                    'Debes especificar cuánto dinero deseas apostar.',
                    '',
                    '📌 *Uso:*',
                    '• `.apostar <cantidad>`  (ej: `.apostar 500`)',
                    '• `.apostar all` / `.apostar todo` (apuesta todo tu efectivo)',
                    '',
                    `💰 *Tu saldo en mano:* $${economy.formatNumber(saldoMano)} monedas`,
                    '⚠️ _Apuesta mínima: $100 monedas._',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        let monto = 0;
        if (input === 'all' || input === 'todo') {
            monto = saldoMano;
        } else {
            monto = parseInt(input.replace(/[^0-9]/g, ''), 10);
        }

        if (isNaN(monto) || monto <= 0) {
            return await sock.sendMessage(jid, {
                text: '❌ Por favor ingresa una cantidad numérica válida. Ejemplo: `.apostar 1000`'
            }, { quoted: m });
        }

        if (monto < 100) {
            return await sock.sendMessage(jid, {
                text: '⚠️ La apuesta mínima en la mesa del casino es de *$100 monedas*.'
            }, { quoted: m });
        }

        if (monto > saldoMano) {
            return await sock.sendMessage(jid, {
                text: [
                    '❌ *SALDO INSUFICIENTE EN MANO*',
                    '',
                    `Estás intentando apostar *$${economy.formatNumber(monto)}*, pero solo tienes *$${economy.formatNumber(saldoMano)}* en mano.`,
                    '',
                    '💡 _Puedes retirar fondos de tu cuenta bancaria con `.retirar <monto>` o trabajar con `.trabajar`._',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // Registrar progreso de misión diaria
        try {
            missions.recordProgress(sender, 'apostar', 1);
        } catch (_) {}

        // Mensaje inicial de animación y suspense
        const initialText = [
            '🎲 *[CASINO UNSK1NGMD - MESA DE DADOS]* 🎲',
            '',
            `👤 *Apostador:* @${sender.split('@')[0]}`,
            `💵 *Monto en juego:* $${economy.formatNumber(monto)} monedas`,
            '',
            '🎲 _Lanzando los dados sobre el tapete verde..._',
            '━━━━━━━━━━━━━━━━━━━━━━',
            '👤 Tus dados:  [ 🔄 | 🔄 ]',
            '🤖 Dados Casa: [ 🔄 | 🔄 ]',
            '━━━━━━━━━━━━━━━━━━━━━━',
            '_¡Que la fortuna esté de tu lado!_'
        ].join('\n');

        let msg = await sock.sendMessage(jid, {
            text: initialText,
            mentions: [sender]
        }, { quoted: m });

        await new Promise(r => setTimeout(r, 1300));

        // Lanzamiento de dados (2 dados por participante, números 1 a 6)
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const totalUsuario = d1 + d2;

        const b1 = Math.floor(Math.random() * 6) + 1;
        const b2 = Math.floor(Math.random() * 6) + 1;
        const totalBot = b1 + b2;

        const dadosUsuarioVisual = `[ ${DADOS_EMOJIS[d1]}  ${DADOS_EMOJIS[d2]} ] = *${totalUsuario} pts*`;
        const dadosBotVisual = `[ ${DADOS_EMOJIS[b1]}  ${DADOS_EMOJIS[b2]} ] = *${totalBot} pts*`;

        let resultadoTitulo = '';
        let resultadoCuerpo = '';

        if (totalUsuario > totalBot) {
            // Caso: Victoria
            const esDobleSeis = (d1 === 6 && d2 === 6);
            if (esDobleSeis) {
                // Jackpot doble seis paga x3
                const gananciaNeta = monto * 2; // Recupera lo apostado + 2x monto
                economy.addCoins(sender, gananciaNeta);
                const expGain = economy.addExp(sender, 60);
                resultadoTitulo = '🔥 *¡JACKPOT DOBLE SEIS (x3)!* 🔥';
                resultadoCuerpo = [
                    `¡Tiraste doble seis milagroso! La mesa paga el triple:`,
                    `💵 *Ganancia neta:* +$${economy.formatNumber(gananciaNeta)} monedas`,
                    `🔮 *Experiencia:* +60 EXP` + (expGain.leveledUp ? ` _(¡Subiste al nivel ${expGain.level}!)_` : '')
                ].join('\n');
            } else {
                // Victoria normal paga x2
                economy.addCoins(sender, monto);
                const expGain = economy.addExp(sender, 35);
                resultadoTitulo = '🎉 *¡HAS GANADO LA RONDA!* 🎉';
                resultadoCuerpo = [
                    `Superaste a la casa limpiamente:`,
                    `💵 *Ganancia neta:* +$${economy.formatNumber(monto)} monedas`,
                    `🔮 *Experiencia:* +35 EXP` + (expGain.leveledUp ? ` _(¡Subiste al nivel ${expGain.level}!)_` : '')
                ].join('\n');
            }
        } else if (totalUsuario < totalBot) {
            // Caso: Derrota
            economy.removeCoins(sender, monto);
            resultadoTitulo = '💀 *LA CASA GANA ESTA VEZ* 💀';
            resultadoCuerpo = [
                `La casa obtuvo mayor puntuación:`,
                `💸 *Perdiste:* -$${economy.formatNumber(monto)} monedas`,
                '_¡La próxima tirada puede ser la buena!_'
            ].join('\n');
        } else {
            // Caso: Empate
            resultadoTitulo = '⚖️ *¡EMPATE TOTAL!* ⚖️';
            resultadoCuerpo = [
                'Ambos obtuvieron exactamente la misma puntuación.',
                '💵 Se te ha devuelto tu apuesta completa de forma intacta.'
            ].join('\n');
        }

        const nuevoSaldo = economy.getUser(sender).monedas || 0;

        const finalText = [
            '🎲 *[CASINO UNSK1NGMD - RESULTADO]* 🎲',
            '',
            `👤 *Jugador:* @${sender.split('@')[0]}`,
            `💵 *Apuesta:* $${economy.formatNumber(monto)}`,
            '',
            `🎲 *Tus Dados:*  ${dadosUsuarioVisual}`,
            `🤖 *Dados Casa:* ${dadosBotVisual}`,
            '',
            resultadoTitulo,
            resultadoCuerpo,
            '',
            `💰 *Tu saldo actual en mano:* $${economy.formatNumber(nuevoSaldo)}`,
            '━━━━━━━━━━━━━━━━━━━━━━',
            '_Unknown Codexツ</>_'
        ].join('\n');

        let editado = false;
        if (msg && msg.key) {
            try {
                await sock.sendMessage(jid, {
                    text: finalText,
                    edit: msg.key,
                    mentions: [sender]
                });
                editado = true;
            } catch (_) {}
        }

        if (!editado) {
            await sock.sendMessage(jid, {
                text: finalText,
                mentions: [sender]
            }, { quoted: m });
        }
    }
};


'use strict';

const economy = require('../../lib/economy');
const missions = require('../../lib/missions');

const COOLDOWN_COFRE_MS = 3 * 60 * 60 * 1000; // 3 horas

module.exports = {
    name: 'cofre',
    alias: ['chest', 'misterio', 'cofremisterioso'],
    category: 'juegos',
    desc: 'Abre un cofre misterioso cada 3 horas para ganar monedas, experiencia u objetos raros',
    usage: '.cofre',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const user = economy.getUser(sender);
        const ahora = Date.now();
        const tiempoPasado = ahora - (user.lastCofre || 0);

        // 1. Comprobar tiempo de enfriamiento (cooldown)
        if (tiempoPasado < COOLDOWN_COFRE_MS) {
            const restante = COOLDOWN_COFRE_MS - tiempoPasado;
            return await sock.sendMessage(jid, {
                text: [
                    '🔒 *COFRE MISTERIOSO BLOQUEADO*',
                    '',
                    `Ya abriste tu cofre recientemente, @${sender.split('@')[0]}.`,
                    `⏱️ Podrás abrir el siguiente en: *${economy.formatDuration(restante)}*`,
                    '',
                    '💡 _¡Mientras tanto puedes hacer misiones diarias (.mision) o trabajar (.trabajar)!_',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // Registrar progreso de misión diaria
        try {
            missions.recordProgress(sender, 'cofre', 1);
        } catch (_) {}

        // Mensaje inicial de animación y apertura
        const initialText = [
            '📦 *ABRIENDO COFRE MISTERIOSO...*',
            '',
            `👤 *Aventurero:* @${sender.split('@')[0]}`,
            '🗝️ _Girando la llave dorada en el cerrojo..._',
            '✨ _Destellos luminosos escapan por las ranuras..._',
            '',
            '[ 🔒  ➜  🔓  ➜  ✨ ]'
        ].join('\n');

        let msg = await sock.sendMessage(jid, {
            text: initialText,
            mentions: [sender]
        }, { quoted: m });

        await new Promise(r => setTimeout(r, 1300));

        user.lastCofre = ahora;

        // Probabilidad de rareza (Tiers):
        // 1 a 5 (5%): Trampa / Mímico
        // 6 a 50 (45%): Común (Bronce)
        // 51 a 80 (30%): Raro (Plata)
        // 81 a 95 (15%): Épico (Oro)
        // 96 a 100 (5%): Legendario (Cósmico)
        const roll = Math.floor(Math.random() * 100) + 1;

        let tierNombre = '';
        let tierColor = '';
        let monedasGanadas = 0;
        let expGanada = 0;
        let itemGanado = null;
        let relato = '';

        if (roll <= 5) {
            // Mímico / Trampa
            tierNombre = '👻 *¡MÍMICO TRAMPOSO! (Vacío)*';
            tierColor = '💀';
            relato = '¡El cofre era en realidad un mímico con lengua larga y dientes filosos! Te pegó un susto de muerte y escapó riéndose hacia la oscuridad. No encontraste botín esta vez.';
        } else if (roll <= 50) {
            // Común
            tierNombre = '🥉 *COFRE DE BRONCE (Común)*';
            tierColor = '📦';
            monedasGanadas = Math.floor(Math.random() * 2701) + 1800; // 1,800 - 4,500
            expGanada = Math.floor(Math.random() * 61) + 60; // 60 - 120
            relato = 'Un sólido cofre de hierro y bronce antiguo bien preservado.';
        } else if (roll <= 80) {
            // Raro
            tierNombre = '🥈 *COFRE DE PLATA FORJADA (Raro)*';
            tierColor = '✨';
            monedasGanadas = Math.floor(Math.random() * 8001) + 6000; // 6,000 - 14,000
            expGanada = Math.floor(Math.random() * 151) + 150; // 150 - 300
            relato = 'Un brillante cofre cubierto de finos grabados rúnicos.';

            // 30% chance de ganar poción de EXP
            if (Math.random() < 0.3) {
                itemGanado = 'Poción de Experiencia 🧪';
                user.inventario['pocion'] = (user.inventario['pocion'] || 0) + 1;
            }
        } else if (roll <= 95) {
            // Épico
            tierNombre = '🥇 *COFRE DE ORO REAL (Épico)*';
            tierColor = '🌟';
            monedasGanadas = Math.floor(Math.random() * 17001) + 18000; // 18,000 - 35,000
            expGanada = Math.floor(Math.random() * 401) + 400; // 400 - 800
            relato = '¡Oro macizo reluciente con gemas incrustadas en las esquinas!';

            // 40% chance de ganar Seguro Anti-Robo o Escudo
            const randItem = Math.random();
            if (randItem < 0.25) {
                itemGanado = 'Seguro Anti-Robo 🔒 (24h de protección)';
                user.escudoAntiRobo = ahora + (24 * 60 * 60 * 1000);
            } else if (randItem < 0.5) {
                itemGanado = 'Escudo Blindado 🛡️ (+25 Defensa)';
                user.defensa = (user.defensa || 10) + 25;
                user.inventario['escudo'] = (user.inventario['escudo'] || 0) + 1;
            }
        } else {
            // Legendario
            tierNombre = '🌌 *¡COFRE CÓSMICO ANCESTRAL! (Legendario)*';
            tierColor = '🔮';
            monedasGanadas = Math.floor(Math.random() * 50001) + 50000; // 50,000 - 100,000
            expGanada = 1200;
            relato = '¡La tapa se abre emanando un rayo celestial! Una reliquia de poder inimaginable.';

            // Premio legendario: Espada de Batalla o Pase VIP
            if (Math.random() < 0.5) {
                itemGanado = 'Espada de Batalla ⚔️ (+30 Ataque permanente)';
                user.ataque = (user.ataque || 15) + 30;
                user.inventario['espada'] = (user.inventario['espada'] || 0) + 1;
            } else {
                itemGanado = 'Pase VIP / Premium 💎';
                user.inventario['vip'] = (user.inventario['vip'] || 0) + 1;
            }
        }

        if (monedasGanadas > 0) user.monedas = (user.monedas || 0) + monedasGanadas;
        let expResult = null;
        if (expGanada > 0) {
            expResult = economy.addExp(sender, expGanada);
        } else {
            economy.save();
        }

        const lines = [
            `🎁 *[RESULTADO DEL COFRE MISTERIOSO]* 🎁`,
            '',
            `👤 *Aventurero:* @${sender.split('@')[0]}`,
            `📦 *Tipo:* ${tierNombre}`,
            `📖 _"${relato}"_`,
            '',
            '✨ *Recompensas Obtenidas:*'
        ];

        if (monedasGanadas > 0) {
            lines.push(`• 💵 *Monedas:* +$${economy.formatNumber(monedasGanadas)}`);
        }
        if (expGanada > 0) {
            const lvlMsg = expResult?.leveledUp ? ` *(¡SUBISTE AL NIVEL ${expResult.level}!)*` : '';
            lines.push(`• 🔮 *Experiencia:* +${expGanada} EXP${lvlMsg}`);
        }
        if (itemGanado) {
            lines.push(`• 🎁 *Objeto Especial:* ¡${itemGanado}!`);
        }
        if (monedasGanadas === 0 && expGanada === 0 && !itemGanado) {
            lines.push('• 💨 _Sin recompensas materiales esta vez._');
        }

        lines.push('');
        lines.push(`💰 *Saldo actual en mano:* $${economy.formatNumber(user.monedas || 0)}`);
        lines.push('⏱️ _Podrás volver a abrir otro cofre en 3 horas._');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('_Unknown Codexツ</>_');

        const finalText = lines.join('\n');

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


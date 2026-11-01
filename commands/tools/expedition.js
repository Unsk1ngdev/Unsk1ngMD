'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'expedition',
    alias: ['expedicion', 'misionpasiva', 'exploracionpasiva'],
    category: 'rpg',
    desc: 'Envía a tu personaje a una expedición pasiva (1h, 3h o 6h) y regresa más tarde a reclamar gran botín, monedas y EXP',
    usage: '.expedition [ver] | .expedition start <1|2|3> | .expedition claim [reclamar]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const sub = (args[0] || '').toLowerCase().trim();

        // 1. Iniciar expedición (.expedition start <1|2|3>)
        if (sub === 'start' || sub === 'iniciar' || sub === 'ir') {
            const zoneArg = args[1] || '1';
            const res = rpgManager.startExpedition(sender, zoneArg);

            if (res.error === 'ON_EXPEDITION') {
                return await sock.sendMessage(jid, {
                    text: `⏳ Tu personaje ya está en una expedición en curso.\n⏱️ Tiempo restante para finalizar: *${res.timeLeft}*`
                }, { quoted: m });
            }

            if (res.error === 'PENDING_CLAIM') {
                return await sock.sendMessage(jid, {
                    text: '🎉 ¡Tu expedición ya finalizó! Reclama tu recompensa con `.expedition claim`.'
                }, { quoted: m });
            }

            await m.react?.('🗺️');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🗺️ ¡EXPEDICIÓN INICIADA! 》 ❐',
                    '┃',
                    `┃├◆ 📍 *Destino:* ${res.expedition.zona}`,
                    `┃├◆ ⏱️ *Duración:* ${Math.floor(res.expedition.duracionMs / 3600000)} horas`,
                    `┃├◆ 💰 *Botín estimado:* $${economy.formatNumber(res.expedition.minCoins)} - $${economy.formatNumber(res.expedition.maxCoins)} monedas`,
                    `┃├◆ 🔮 *EXP garantizada:* +${res.expedition.exp} EXP`,
                    '┃',
                    '┃├◆ 💡 Puedes seguir usando el bot con normalidad.',
                    '┃   Vuelve al terminar y escribe: `.expedition claim`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Reclamar recompensa (.expedition claim)
        if (sub === 'claim' || sub === 'reclamar' || sub === 'cobrar') {
            const res = rpgManager.claimExpedition(sender);

            if (res.error === 'NO_EXPEDITION') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ninguna expedición activa. Escribe `.expedition start 1` para comenzar.'
                }, { quoted: m });
            }

            if (res.error === 'NOT_FINISHED') {
                return await sock.sendMessage(jid, {
                    text: `⏳ Tu expedición aún está explorando.\n⏱️ Tiempo restante para regresar: *${res.timeLeft}*`
                }, { quoted: m });
            }

            await m.react?.('🏆');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🏆 ¡EXPEDICIÓN COMPLETADA CON ÉXITO! 》 ❐',
                    '┃',
                    `┃├◆ 👤 *Explorador:* @${sender.split('@')[0]}`,
                    `┃├◆ 📍 *Zona explorada:* ${res.zona}`,
                    `┃├◆ 💰 *Monedas obtenidas:* +$${economy.formatNumber(res.coins)} monedas`,
                    `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                    `┃├◆ 💎 *Tesoro raro hallado:* ${res.lootItem.nombre} x${res.lootCount}`,
                    res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                    '┃',
                    '┃├◆ 🎒 El botín ha sido transferido a tu inventario y cuenta bancaria.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // 3. Ver estado o menú de expediciones
        const u = rpgManager.getUserData(sender);
        if (u.expedition) {
            const now = Date.now();
            const ready = now >= u.expedition.finishAt;
            const remSecs = Math.max(0, Math.ceil((u.expedition.finishAt - now) / 1000));
            const hrs = Math.floor(remSecs / 3600);
            const mins = Math.floor((remSecs % 3600) / 60);

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🗺️ ESTADO DE TU EXPEDICIÓN 》 ❐',
                    '┃',
                    `┃├◆ 📍 *Destino:* ${u.expedition.zona}`,
                    `┃├◆ ⏱️ *Estado:* ${ready ? '¡Completada! Reclama tu botín 🎉' : `En camino (${hrs}h ${mins}m restantes)`}`,
                    '┃',
                    ready ? '┃├◆ 👉 Escribe: `.expedition claim`' : '┃├◆ 💡 Regresa cuando termine para reclamar tu botín.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🗺️ EXPEDICIONES PASIVAS 》 ❐',
                '┃',
                '┃├◆ 🌲 *Zona 1: Bosque de las Nieblas*',
                '┃   ⏱️ 1 hora | 💰 $800 - $2,000 | 🔮 250 EXP',
                '┃',
                '┃├◆ 🏛️ *Zona 2: Ruinas Sumergidas de Atlantis*',
                '┃   ⏱️ 3 horas | 💰 $2,500 - $6,000 | 🔮 700 EXP',
                '┃',
                '┃├◆ 🌋 *Zona 3: Cráter del Volcán Eterno*',
                '┃   ⏱️ 6 horas | 💰 $6,000 - $15,000 | 🔮 1,800 EXP + Gemas Raras',
                '┃',
                '┃├◆ 📋 *Uso:* `.expedition start <1|2|3>`',
                '┃├◆ 📌 *Ejemplo:* `.expedition start 1`',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};


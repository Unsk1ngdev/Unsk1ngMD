'use strict';

const dungeonEngine = require('../../lib/dungeonEngine');
const economy = require('../../lib/economy');

module.exports = {
    name: 'dungeon',
    alias: ['mazmorra', 'dungeons', 'explorarmazmorra'],
    category: 'juegos',
    desc: 'Exploración de mazmorras por turnos con combates, monstruos, jefes y grandes recompensas',
    usage: '.dungeon [entrar | explorar | atacar | pocion | huir]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const sub = (args[0] || '').toLowerCase().trim();

        // 1. Huir de la mazmorra
        if (sub === 'huir' || sub === 'escapar' || sub === 'salir') {
            const res = dungeonEngine.flee(jid, sender);
            if (res.error === 'NO_SESSION') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ninguna expedición activa en la mazmorra. Escribe `.dungeon` para entrar.'
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🏃 ESCAPASTE DE LA MAZMORRA 》 ❐',
                    '┃',
                    '┃├◆ Lograste escapar sano y salvo a la superficie.',
                    `┃├◆ 💰 *Botín rescatado:* +$${economy.formatNumber(res.coins)} monedas`,
                    `┃├◆ 🔮 *EXP rescatada:* +${res.exp} EXP`,
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Usar poción
        if (sub === 'pocion' || sub === 'pocíon' || sub === 'curar' || sub === 'heal') {
            const res = dungeonEngine.usePotion(jid, sender);
            if (res.error === 'NO_SESSION') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ninguna expedición activa en la mazmorra. Escribe `.dungeon` para entrar.'
                }, { quoted: m });
            }
            if (res.error === 'NO_POTION') {
                return await sock.sendMessage(jid, {
                    text: '❌ No tienes ninguna *Poción de Curación Mayor* en tu inventario.\n💡 Puedes craftearla con `.alchemy` o conseguirla en cofres.'
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🧪 POCIÓN UTILIZADA 》 ❐',
                    '┃',
                    `┃├◆ ❤️ Te has curado +${res.heal} HP.`,
                    `┃├◆ 🩸 *Vida actual:* ${res.hp}/${res.maxHp} HP`,
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 3. Atacar al monstruo
        if (sub === 'atacar' || sub === 'hit' || sub === 'pelear' || sub === 'attack') {
            const res = dungeonEngine.attack(jid, sender);
            if (res.error === 'NO_MONSTER') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No hay ningún monstruo frente a ti. Escribe `.dungeon explorar` para avanzar de sala.'
                }, { quoted: m });
            }

            if (res.playerDead) {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 💀 HAS CAÍDO EN LA MAZMORRA 》 ❐',
                        '┃',
                        `┃├◆ El *${res.monster.name}* te asestó un golpe letal (${res.monsterDmg} DMG).`,
                        '┃├◆ Has perdido el botín acumulado y regresas al pueblo malherido.',
                        '┃├◆ 💸 Penalización médica: -$500 monedas.',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            if (res.monsterDead) {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 ⚔️ ¡MONSTRUO DERROTADO! 》 ❐',
                        '┃',
                        `┃├◆ Asestaste ${res.isCrit ? '💥 *GOLPE CRÍTICO* ' : ''}${res.playerDmg} DMG!`,
                        `┃├◆ Has vencido a: *${res.monster.name}*`,
                        `┃├◆ 💰 *Botín obtenido:* +$${economy.formatNumber(res.lootCoins)} monedas`,
                        `┃├◆ 🔮 *Experiencia:* +${res.lootExp} EXP`,
                        `┃├◆ 🩸 *Tu vida:* ${res.session.hp}/${res.session.maxHp} HP`,
                        '┃',
                        '┃├◆ 🚪 La sala está despejada.',
                        '┃   👉 Escribe: `.dungeon explorar` (Para avanzar)',
                        '┃   👉 Escribe: `.dungeon huir` (Para salir con el botín)',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            // Ronda de combate continua
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⚔️ TURNO DE COMBATE 》 ❐',
                    '┃',
                    `┃├◆ 🗡️ Golpeaste por: ${res.isCrit ? '💥 *CRÍTICO* ' : ''}${res.playerDmg} DMG`,
                    `┃├◆ 👹 Vida de ${res.monster.name}: ${res.monster.hp}/${res.monster.maxHp} HP`,
                    `┃├◆ 🛡️ El monstruo contraataca: -${res.monsterDmg} DMG`,
                    `┃├◆ 🩸 *Tu vida:* ${res.playerHp}/${res.maxHp} HP`,
                    '┃',
                    '┃├◆ 👉 Escribe: `.dungeon atacar` (Seguir atacando)',
                    '┃├◆ 👉 Escribe: `.dungeon pocion` (Curarte)',
                    '┃├◆ 👉 Escribe: `.dungeon huir` (Retirarte)',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 4. Explorar siguiente sala
        if (sub === 'explorar' || sub === 'avanzar' || sub === 'next') {
            const res = dungeonEngine.explore(jid, sender);
            if (res.error === 'MONSTER_ACTIVE') {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 ⚠️ ¡HAY UN MONSTRUO EN TU CAMINO! 》 ❐',
                        '┃',
                        `┃├◆ No puedes avanzar sin derrotar a *${res.monstruo.name}* (${res.monstruo.hp}/${res.monstruo.maxHp} HP).`,
                        `┃├◆ 🩸 *Tu vida:* ${res.hp}/${res.maxHp} HP`,
                        '┃',
                        '┃├◆ 👉 Escribe: `.dungeon atacar`',
                        '┃├◆ 👉 Escribe: `.dungeon huir`',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            if (res.completedAll) {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 🏆 ¡MAZMORRA COMPLETADA AL 100%! 》 ❐',
                        '┃',
                        '┃├◆ ¡Has conquistado todos los pisos y derrotado al Dragón Rojo Ancestral!',
                        `┃├◆ 💰 *Recompensa total:* +$${economy.formatNumber(res.lootCoins)} monedas`,
                        `┃├◆ 🔮 *Experiencia total:* +${res.lootExp} EXP`,
                        '┃├◆ 💎 *Botín supremo:* +3 Diamantes Puros',
                        res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].filter(Boolean).join('\n')
                }, { quoted: m });
            }

            if (res.event === 'boss') {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 👑 ¡JEFE DE PISO DETECTADO! 》 ❐',
                        '┃',
                        `┃├◆ 📍 *Piso ${res.session.piso} - Sala 4 (Cámara del Jefe)*`,
                        `┃├◆ ⚠️ Ha aparecido el temible: *${res.monstruo.name}*`,
                        `┃├◆ 🩸 *Vida del Jefe:* ${res.monstruo.hp} HP | ⚔️ *Ataque:* ${res.monstruo.atq}`,
                        `┃├◆ 🛡️ *Tu Vida:* ${res.session.hp}/${res.session.maxHp} HP`,
                        '┃',
                        '┃├◆ 👉 Escribe: `.dungeon atacar` para luchar',
                        '┃├◆ 👉 Escribe: `.dungeon huir` para salvar tu vida',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            if (res.event === 'monster') {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 👹 MONSTRUO ENCONTRADO 》 ❐',
                        '┃',
                        `┃├◆ 📍 *Piso ${res.session.piso} - Sala ${res.session.sala}*`,
                        `┃├◆ Un *${res.monstruo.name}* bloquea el pasillo!`,
                        `┃├◆ 🩸 *Vida del Monstruo:* ${res.monstruo.hp}/${res.monstruo.maxHp} HP`,
                        `┃├◆ 🛡️ *Tu Vida:* ${res.session.hp}/${res.session.maxHp} HP`,
                        '┃',
                        '┃├◆ 👉 Escribe: `.dungeon atacar` para atacar',
                        '┃├◆ 👉 Escribe: `.dungeon huir` para escapar',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            if (res.event === 'chest') {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 💎 ¡COFRE DEL TESORO! 》 ❐',
                        '┃',
                        `┃├◆ 📍 *Piso ${res.session.piso} - Sala ${res.session.sala}*`,
                        '┃├◆ Encontraste un cofre antiguo sin trampas.',
                        `┃├◆ 💰 *Contenido:* +$${economy.formatNumber(res.coins)} monedas`,
                        `┃├◆ 🔮 *EXP hallada:* +${res.exp} EXP`,
                        '┃',
                        '┃├◆ 👉 Escribe: `.dungeon explorar` para continuar',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            if (res.event === 'shrine') {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 ⛲ SANTUARIO DE LUZ 》 ❐',
                        '┃',
                        `┃├◆ 📍 *Piso ${res.session.piso} - Sala ${res.session.sala}*`,
                        `┃├◆ Descansas junto a aguas sagradas y recuperas +${res.heal} HP.`,
                        `┃├◆ 🩸 *Vida actual:* ${res.session.hp}/${res.session.maxHp} HP`,
                        '┃',
                        '┃├◆ 👉 Escribe: `.dungeon explorar` para avanzar',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }
        }

        // 5. Iniciar o mostrar estado de la mazmorra
        let session = dungeonEngine.getSession(jid, sender);
        if (!session) {
            session = dungeonEngine.start(jid, sender);
        }

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🗝️ MAZMORRA SUBTERRÁNEA 》 ❐',
                '┃',
                `┃├◆ 👤 *Explorador:* @${sender.split('@')[0]}`,
                `┃├◆ 📍 *Ubicación:* Piso ${session.piso} - Sala ${session.sala}`,
                `┃├◆ 🩸 *Vida:* ${session.hp}/${session.maxHp} HP`,
                `┃├◆ ⚔️ *Ataque:* ${session.atq} | 🛡️ *Defensa:* ${session.def}`,
                `┃├◆ 💰 *Botín acumulado:* $${economy.formatNumber(session.lootCoins)} | 🔮 ${session.lootExp} EXP`,
                '┃',
                '┃├◆ 🎮 *Acciones disponibles:*',
                '┃   👉 `.dungeon explorar` (Avanzar a la siguiente sala)',
                '┃   👉 `.dungeon atacar` (Si hay un enemigo enfrente)',
                '┃   👉 `.dungeon pocion` (Recuperar vida)',
                '┃   👉 `.dungeon huir` (Salir con el botín)',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};


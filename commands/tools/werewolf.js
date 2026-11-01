'use strict';

const werewolfManager = require('../../lib/werewolf');
const userNames = require('../../lib/userNames');
const database = require('../../lib/database');
const logger = require('../../lib/logger');

function cleanJid(id) {
    if (!id) return '';
    return id.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

function getPhone(jid) {
    return cleanJid(jid).replace(/[^0-9]/g, '');
}

/**
 * Resuelve un objetivo a partir de mención, número en lista o texto
 */
function resolveTarget(game, input, mentions) {
    if (mentions && mentions.length > 0) {
        return cleanJid(mentions[0]);
    }

    if (!input) return null;
    const clean = input.trim();

    // Comprobar si es un número de lista (ej: "1", "2")
    const index = parseInt(clean, 10);
    if (!isNaN(index) && index >= 1 && index <= game.players.size) {
        const alivePlayers = Array.from(game.players.values()).filter(p => p.alive);
        if (alivePlayers[index - 1]) {
            return alivePlayers[index - 1].jid;
        }
    }

    // Comprobar por coincidencia de teléfono
    const numeric = clean.replace(/[^0-9]/g, '');
    if (numeric.length >= 7) {
        for (const jid of game.players.keys()) {
            if (jid.includes(numeric)) return jid;
        }
    }

    return null;
}

/**
 * Renderiza la lista de jugadores numerada
 */
function formatPlayerList(game, showRoles = false) {
    const list = [];
    let idx = 1;
    for (const p of game.players.values()) {
        const statusEmoji = p.alive ? '🟢' : '💀 (Muerto)';
        const roleInfo = showRoles && p.role ? ` [${werewolfManager.getRoleDescription(p.role).name}]` : '';
        list.push(`┃ ${idx++}. ${statusEmoji} @${getPhone(p.jid)}${roleInfo}`);
    }
    return list.join('\n');
}

module.exports = {
    name: 'werewolf',
    alias: ['ww', 'lobo', 'lobos', 'hombrelobo', 'mafia'],
    category: 'juegos',
    desc: 'Juego social grupal de Hombres Lobo de Castronegro (Roles: Lobo, Vidente, Bruja, Aldeano)',
    usage: '.werewolf [create | join | start | vote | kill | check | save | poison | stop]',
    groupOnly: true,

    execute: async ({ sock, m, args, isOwner, groupAdmins }) => {
        const chatId = m.chat;
        const sender = cleanJid(m.sender || m.key.participant || chatId);
        const senderName = m.pushName || userNames.get(sender) || `@${getPhone(sender)}`;
        const sub = (args && args[0] ? args[0] : '').toLowerCase().trim();
        const targetArg = args && args[1] ? args[1] : '';

        const game = werewolfManager.getGame(chatId);

        // 1. Ayuda o menú principal si no hay argumentos
        if (!sub) {
            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 🐺 HOMBRES LOBO DE CASTRONEGRO 》 ❐',
                    '┃',
                    '┃├◆ 🏰 *Comandos del juego:*',
                    '┃   🎮 `.ww create` — Crea una nueva sala',
                    '┃   ✋ `.ww join` — Únete a la partida',
                    '┃   ▶️ `.ww start` — Inicia el juego (mínimo 4 jugadores)',
                    '┃   📊 `.ww status` — Ver jugadores vivos y estado',
                    '┃   🛑 `.ww stop` — Cancela la partida activa',
                    '┃',
                    '┃├◆ 🌙 *Acciones Nocturnas (Roles):*',
                    '┃   🐺 `.ww kill @user` o `.ww kill <núm>` (Lobos)',
                    '┃   🔮 `.ww check @user` o `.ww check <núm>` (Vidente)',
                    '┃   🧪 `.ww save` (Bruja: Salvar víctima)',
                    '┃   ☠️ `.ww poison @user` (Bruja: Envenenar)',
                    '┃',
                    '┃├◆ ☀️ *Acciones Diurnas:*',
                    '┃   🗳️ `.ww vote @user` o `.ww vote <núm>` (Votar sospechoso)',
                    '┃   ⏭️ `.ww vote skip` (Abstenerse de votar)',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Cancelar partida
        if (['cancel', 'stop', 'cancelar', 'abortar'].includes(sub)) {
            if (!game) {
                return await sock.sendMessage(chatId, { text: 'ℹ️ No hay ninguna partida activa en este grupo.' }, { quoted: m });
            }

            const isAdmin = isOwner || database.isOwner(sender, sock) || (groupAdmins && groupAdmins.includes(sender));
            const isCreator = game.creator === sender;

            if (!isCreator && !isAdmin) {
                return await sock.sendMessage(chatId, { text: '❌ Solo el creador de la sala o un Administrador del grupo puede cancelar la partida.' }, { quoted: m });
            }

            werewolfManager.cancelGame(chatId);
            return await sock.sendMessage(chatId, { text: '🛑 *Partida de Hombre Lobo cancelada con éxito.*' }, { quoted: m });
        }

        // 3. Crear sala (Lobby)
        if (['create', 'crear', 'nuevo', 'new'].includes(sub)) {
            if (game) {
                return await sock.sendMessage(chatId, {
                    text: `⚠️ Ya existe una partida en curso en este grupo (Estado: *${game.status}*).\nEscribe *.ww status* o *.ww stop* para cancelarla.`
                }, { quoted: m });
            }

            const newGame = werewolfManager.createGame(chatId, sender, senderName);

            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 🐺 SALA DE HOMBRE LOBO CREADA 》 ❐',
                    '┃',
                    `┃├◆ 👑 *Creador:* ${senderName}`,
                    '┃├◆ 👥 *Jugadores (1/12):*',
                    `┃ 1. 🟢 @${getPhone(sender)}`,
                    '┃',
                    '┃├◆ ✋ *Para unirte escribe:*',
                    '┃   👉 `.ww join`',
                    '┃',
                    '┃├◆ ▶️ *Para iniciar (Mínimo 4):*',
                    '┃   👉 `.ww start`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // 4. Unirse a la sala
        if (['join', 'unirse', 'entrar'].includes(sub)) {
            if (!game) {
                return await sock.sendMessage(chatId, { text: 'ℹ️ No hay ninguna sala creada. Crea una con *.ww create*' }, { quoted: m });
            }

            const res = werewolfManager.joinGame(chatId, sender, senderName);
            if (res.error === 'NOT_IN_LOBBY') {
                return await sock.sendMessage(chatId, { text: '⚠️ La partida ya ha comenzado. Espera a que termine para unirte a la siguiente.' }, { quoted: m });
            }
            if (res.error === 'ALREADY_JOINED') {
                return await sock.sendMessage(chatId, { text: 'ℹ️ Ya estás dentro de la sala de juego.' }, { quoted: m });
            }
            if (res.error === 'LOBBY_FULL') {
                return await sock.sendMessage(chatId, { text: '⚠️ La sala ha alcanzado el límite máximo de 12 jugadores.' }, { quoted: m });
            }

            const playerListText = formatPlayerList(game);
            const allJids = Array.from(game.players.keys());

            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 ✋ NUEVO JUGADOR UNIDO 》 ❐',
                    '┃',
                    `┃├◆ ✅ @${getPhone(sender)} se unió a la aldea.`,
                    `┃├◆ 👥 *Total inscritos (${res.count}/12):*`,
                    playerListText,
                    '┃',
                    res.count >= 4 ? '┃├◆ 🔔 *¡Ya hay suficientes jugadores!* Escribe `.ww start` para comenzar.' : `┃├◆ ⏳ Faltan ${4 - res.count} jugador(es) para el mínimo.`,
                    '┗❐'
                ].join('\n'),
                mentions: allJids
            }, { quoted: m });
        }

        // 5. Iniciar la partida
        if (['start', 'iniciar', 'begin'].includes(sub)) {
            if (!game) {
                return await sock.sendMessage(chatId, { text: 'ℹ️ No hay ninguna sala creada. Crea una con *.ww create*' }, { quoted: m });
            }

            const startRes = werewolfManager.startGame(chatId);
            if (startRes.error === 'INVALID_STATUS') {
                return await sock.sendMessage(chatId, { text: '⚠️ La partida ya se encuentra en curso.' }, { quoted: m });
            }
            if (startRes.error === 'NOT_ENOUGH_PLAYERS') {
                return await sock.sendMessage(chatId, {
                    text: `❌ Se necesitan al menos 4 jugadores para jugar. Hay inscritos: ${startRes.count}.\nInvita a más amigos con *.ww join*`
                }, { quoted: m });
            }

            // Enviar a cada jugador su rol secreto por privado (DM)
            for (const p of game.players.values()) {
                const roleDetails = werewolfManager.getRoleDescription(p.role);
                try {
                    await sock.sendMessage(p.jid, {
                        text: [
                            '┏❐ 《 📜 TU ROL SECRETO - HOMBRE LOBO 》 ❐',
                            '┃',
                            `┃├◆ 🎭 *Rol asignado:* ${roleDetails.name}`,
                            '┃',
                            `┃├◆ 📖 *Instrucciones:*`,
                            roleDetails.desc.split('\n').map(l => `┃  ${l}`).join('\n'),
                            '┃',
                            '┃├◆ 🤫 *Importante:* No reveles tu rol a nadie si quieres sobrevivir.',
                            '┗❐\n',
                            '_Unknown Codexツ</>_'
                        ].join('\n')
                    });
                } catch (dmErr) {
                    logger.warn(`[WEREWOLF] No se pudo enviar DM a ${p.jid}: ${dmErr.message}`);
                }
            }

            const playerListText = formatPlayerList(game);
            const allJids = Array.from(game.players.keys());

            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 🌘 ¡COMIENZA EL JUEGO DE HOMBRE LOBO! 》 ❐',
                    '┃',
                    '┃├◆ 📩 *Roles asignados:* Se ha enviado su rol secreto al privado de cada participante.',
                    '┃',
                    '┃├◆ 👥 *Habitantes de la Aldea:*',
                    playerListText,
                    '┃',
                    '┃├◆ 🌙 *FASE DE NOCHE (Ronda 1)*',
                    '┃  Cae la noche oscura sobre la aldea... Todos los habitantes duermen profundamente.',
                    '┃  Las criaturas de la oscuridad y poderes mágicos despiertan:',
                    '┃',
                    '┃  🐺 *Lobos:* `.ww kill @user` o `.ww kill <núm>`',
                    '┃  🔮 *Vidente:* `.ww check @user` o `.ww check <núm>`',
                    '┃  🧙 *Bruja:* `.ww save` o `.ww poison @user`',
                    '┃',
                    '┃├◆ ⏱️ *Para amanecer escribe:* `.ww next` (o al completar las acciones)',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: allJids
            }, { quoted: m });
        }

        // 6. Ver estado de la partida
        if (['status', 'estado', 'players', 'jugadores'].includes(sub)) {
            if (!game) {
                return await sock.sendMessage(chatId, { text: 'ℹ️ No hay ninguna partida activa en este grupo.' }, { quoted: m });
            }

            const aliveCount = Array.from(game.players.values()).filter(p => p.alive).length;
            const playerListText = formatPlayerList(game);

            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 📊 ESTADO DE LA ALDEA 》 ❐',
                    '┃',
                    `┃├◆ ⏳ *Fase actual:* ${game.status === 'NIGHT' ? '🌙 Noche' : (game.status === 'DAY' ? '☀️ Día (Votación)' : game.status)}`,
                    `┃├◆ 🔄 *Ronda:* #${game.round}`,
                    `┃├◆ 👥 *Supervivientes:* ${aliveCount} de ${game.players.size}`,
                    '┃',
                    '┃├◆ 📋 *Lista de Habitantes:*',
                    playerListText,
                    '┗❐'
                ].join('\n'),
                mentions: Array.from(game.players.keys())
            }, { quoted: m });
        }

        // 7. Acción de Hombre Lobo en la noche: .ww kill @user o .ww kill 2
        if (['kill', 'matar', 'atacar'].includes(sub)) {
            if (!game || game.status !== 'NIGHT') {
                return await sock.sendMessage(chatId, { text: '⚠️ Esta acción solo puede realizarse durante la fase de *NOCHE*.' }, { quoted: m });
            }

            const targetJid = resolveTarget(game, targetArg, m.mentionedJid);
            if (!targetJid) {
                return await sock.sendMessage(chatId, { text: '❌ Indica a qué jugador atacar (ej: `.ww kill @usuario` o `.ww kill 2`).' }, { quoted: m });
            }

            const res = werewolfManager.wolfKill(chatId, sender, targetJid);
            if (res.error === 'NOT_A_WOLF') {
                return await sock.sendMessage(chatId, { text: '❌ No eres un Hombre Lobo o ya estás muerto.' }, { quoted: m });
            }
            if (res.error === 'CANNOT_TARGET_WOLF') {
                return await sock.sendMessage(chatId, { text: '🐺 No puedes atacar a otro miembro de tu manada de lobos.' }, { quoted: m });
            }
            if (res.error === 'INVALID_TARGET') {
                return await sock.sendMessage(chatId, { text: '⚠️ Ese jugador no está vivo o no pertenece a la partida.' }, { quoted: m });
            }

            await m.react?.('🐺');
            return await sock.sendMessage(chatId, {
                text: `🐺 *[MANADA DE LOBOS]*\nHas seleccionado a @${getPhone(targetJid)} como objetivo de esta noche.`,
                mentions: [targetJid]
            }, { quoted: m });
        }

        // 8. Acción de Vidente en la noche: .ww check @user o .ww check 3
        if (['check', 'ver', 'vidente', 'vision'].includes(sub)) {
            if (!game || game.status !== 'NIGHT') {
                return await sock.sendMessage(chatId, { text: '⚠️ Esta acción solo puede realizarse durante la fase de *NOCHE*.' }, { quoted: m });
            }

            const targetJid = resolveTarget(game, targetArg, m.mentionedJid);
            if (!targetJid) {
                return await sock.sendMessage(chatId, { text: '❌ Indica a qué jugador inspeccionar (ej: `.ww check @usuario` o `.ww check 3`).' }, { quoted: m });
            }

            const res = werewolfManager.seerCheck(chatId, sender, targetJid);
            if (res.error === 'NOT_A_SEER') {
                return await sock.sendMessage(chatId, { text: '❌ No eres la Vidente o ya estás muerto.' }, { quoted: m });
            }
            if (res.error === 'INVALID_TARGET') {
                return await sock.sendMessage(chatId, { text: '⚠️ Ese jugador no está vivo o no pertenece a la partida.' }, { quoted: m });
            }

            await m.react?.('🔮');
            // Enviar resultado por privado a la vidente para no arruinar el misterio en el grupo
            try {
                await sock.sendMessage(sender, {
                    text: `🔮 *[VISIÓN DE LA VIDENTE]*\n\nHas revelado el alma de @${getPhone(targetJid)}:\n✨ Su verdadera naturaleza es: *${res.roleName}*`,
                    mentions: [targetJid]
                });
            } catch (_) {}

            return await sock.sendMessage(chatId, {
                text: `🔮 *[VIDENTE]*\nLa bola de cristal ha revelado la verdad. Revisa tu chat privado.`
            }, { quoted: m });
        }

        // 9. Acción de la Bruja: .ww save
        if (['save', 'salvar', 'curar'].includes(sub)) {
            if (!game || game.status !== 'NIGHT') {
                return await sock.sendMessage(chatId, { text: '⚠️ Esta acción solo puede realizarse durante la fase de *NOCHE*.' }, { quoted: m });
            }

            const res = werewolfManager.witchSave(chatId, sender);
            if (res.error === 'NOT_A_WITCH') {
                return await sock.sendMessage(chatId, { text: '❌ No eres la Bruja o ya estás muerto.' }, { quoted: m });
            }
            if (res.error === 'NO_HEAL_POTION') {
                return await sock.sendMessage(chatId, { text: '⚠️ Ya utilizaste tu única poción de salvación en esta partida.' }, { quoted: m });
            }

            await m.react?.('🧪');
            return await sock.sendMessage(chatId, {
                text: `🧪 *[BRUJA]*\nHas usado tu poción mágica para salvar a la víctima de los lobos.`
            }, { quoted: m });
        }

        // 10. Acción de la Bruja: .ww poison @user
        if (['poison', 'veneno', 'envenenar'].includes(sub)) {
            if (!game || game.status !== 'NIGHT') {
                return await sock.sendMessage(chatId, { text: '⚠️ Esta acción solo puede realizarse durante la fase de *NOCHE*.' }, { quoted: m });
            }

            const targetJid = resolveTarget(game, targetArg, m.mentionedJid);
            if (!targetJid) {
                return await sock.sendMessage(chatId, { text: '❌ Indica a qué jugador envenenar (ej: `.ww poison @usuario`).' }, { quoted: m });
            }

            const res = werewolfManager.witchPoison(chatId, sender, targetJid);
            if (res.error === 'NOT_A_WITCH') {
                return await sock.sendMessage(chatId, { text: '❌ No eres la Bruja o ya estás muerto.' }, { quoted: m });
            }
            if (res.error === 'NO_POISON_POTION') {
                return await sock.sendMessage(chatId, { text: '⚠️ Ya utilizaste tu poción de veneno en esta partida.' }, { quoted: m });
            }
            if (res.error === 'INVALID_TARGET') {
                return await sock.sendMessage(chatId, { text: '⚠️ Ese jugador no está vivo o no pertenece a la partida.' }, { quoted: m });
            }

            await m.react?.('☠️');
            return await sock.sendMessage(chatId, {
                text: `☠️ *[BRUJA]*\nHas arrojado el frasco de veneno sobre @${getPhone(targetJid)}.`,
                mentions: [targetJid]
            }, { quoted: m });
        }

        // 11. Avanzar a la siguiente fase: .ww next (Amanecer o Anochecer)
        if (['next', 'siguiente', 'amanecer', 'anochecer', 'pasar'].includes(sub)) {
            if (!game || game.status === 'LOBBY') {
                return await sock.sendMessage(chatId, { text: 'ℹ️ La partida aún no ha comenzado. Iníciala con *.ww start*' }, { quoted: m });
            }

            // Si estamos en NOCHE -> Resolver noche y pasar al DÍA
            if (game.status === 'NIGHT') {
                const result = werewolfManager.resolveNight(chatId);
                if (!result) return;

                const { win, deaths } = result;

                let deathReport = '';
                const deadMentions = [];
                if (deaths.length === 0) {
                    deathReport = '✨ ¡Milagro! Nadie murió durante esta noche. La aldea respira aliviada.';
                } else {
                    deathReport = deaths.map(d => {
                        deadMentions.push(d.jid);
                        const roleDesc = werewolfManager.getRoleDescription(d.role).name;
                        const causeDesc = d.cause === 'WOLF_ATTACK' ? 'devorado salvajemente por los lobos 🩸' : 'envenenado por un bebedizo letal ☠️';
                        return `┃ 💀 @${getPhone(d.jid)} fue ${causeDesc}\n┃    (Era: *${roleDesc}*)`;
                    }).join('\n');
                }

                // Si alguien ganó al amanecer
                if (win) {
                    werewolfManager.cancelGame(chatId);
                    const isVillageWin = win === 'VILLAGERS_WIN';
                    return await sock.sendMessage(chatId, {
                        text: [
                            '┏❐ 《 🏁 FIN DE LA PARTIDA 》 ❐',
                            '┃',
                            isVillageWin ? '┃├◆ 🏆 *¡VICTORIA DE LA ALDEA!*' : '┃├◆ 🐺 *¡VICTORIA DE LOS HOMBRES LOBO!*',
                            '┃',
                            `┃├◆ 📜 *Acontecimientos de la última noche:*`,
                            deathReport,
                            '┃',
                            isVillageWin ? '┃├◆ 🎉 Todos los lobos han sido exterminados.' : '┃├◆ 🩸 Los lobos dominan la aldea sin piedad.',
                            '┗❐\n',
                            '_Unknown Codexツ</>_'
                        ].join('\n'),
                        mentions: deadMentions
                    }, { quoted: m });
                }

                // La partida continúa en fase de DÍA (Votación)
                const aliveList = formatPlayerList(game);
                const allAliveJids = Array.from(game.players.values()).filter(p => p.alive).map(p => p.jid);

                return await sock.sendMessage(chatId, {
                    text: [
                        '┏❐ 《 ☀️ AMANECE EN LA ALDEA 》 ❐',
                        '┃',
                        `┃├◆ 🔄 *Día #${game.round}*`,
                        '┃',
                        '┃├◆ 📰 *Noticias de la noche:*',
                        deathReport,
                        '┃',
                        '┃├◆ 👥 *Habitantes vivos:*',
                        aliveList,
                        '┃',
                        '┃├◆ ⚖️ *JUICIO Y VOTACIÓN POPULAR:*',
                        '┃  Debatan quién es sospechoso y emitan su voto:',
                        '┃  👉 `.ww vote @usuario` o `.ww vote <núm>`',
                        '┃  👉 `.ww vote skip` (Abstención)',
                        '┃',
                        '┃├◆ 🔔 Al terminar de votar, escribe: `.ww resolve` o `.ww next`',
                        '┗❐'
                    ].join('\n'),
                    mentions: [...deadMentions, ...allAliveJids]
                }, { quoted: m });
            }

            // Si estamos en DÍA -> Resolver votación y pasar a la NOCHE
            if (game.status === 'DAY') {
                const dayResult = werewolfManager.resolveDay(chatId);
                if (!dayResult) return;

                const { win, lynchedPlayer, isTie } = dayResult;

                let lynchReport = '';
                const lynchMentions = [];

                if (isTie || !lynchedPlayer) {
                    lynchReport = '⚖️ Hubo un empate o votos insuficientes. El pueblo no se puso de acuerdo y nadie fue linchado.';
                } else {
                    lynchMentions.push(lynchedPlayer.jid);
                    const roleDesc = werewolfManager.getRoleDescription(lynchedPlayer.role).name;
                    lynchReport = `🔥 Por decisión del pueblo, @${getPhone(lynchedPlayer.jid)} fue linchado en la hoguera.\n┃    (Era: *${roleDesc}*)`;
                }

                // Si alguien ganó tras el linchamiento
                if (win) {
                    werewolfManager.cancelGame(chatId);
                    const isVillageWin = win === 'VILLAGERS_WIN';
                    return await sock.sendMessage(chatId, {
                        text: [
                            '┏❐ 《 🏁 FIN DE LA PARTIDA 》 ❐',
                            '┃',
                            isVillageWin ? '┃├◆ 🏆 *¡VICTORIA DE LA ALDEA!*' : '┃├◆ 🐺 *¡VICTORIA DE LOS HOMBRES LOBO!*',
                            '┃',
                            `┃├◆ 📜 *Resultado del juicio:*`,
                            `┃ ${lynchReport}`,
                            '┃',
                            isVillageWin ? '┃├◆ 🎉 La paz vuelve al pueblo. Todos los lobos cayeron.' : '┃├◆ 🩸 Los lobos superan en número a los aldeanos. ¡El terror triunfó!',
                            '┗❐\n',
                            '_Unknown Codexツ</>_'
                        ].join('\n'),
                        mentions: lynchMentions
                    }, { quoted: m });
                }

                // Inicia la siguiente noche
                const aliveList = formatPlayerList(game);
                const allAliveJids = Array.from(game.players.values()).filter(p => p.alive).map(p => p.jid);

                return await sock.sendMessage(chatId, {
                    text: [
                        '┏❐ 《 🌙 CAE OTRA VEZ LA NOCHE 》 ❐',
                        '┃',
                        `┃├◆ 🔄 *Noche #${game.round}*`,
                        '┃',
                        `┃├◆ ⚖️ *Juicio anterior:*`,
                        `┃ ${lynchReport}`,
                        '┃',
                        '┃├◆ 👥 *Supervivientes:*',
                        aliveList,
                        '┃',
                        '┃├◆ 🤫 *Silencio en la aldea:*',
                        '┃  Los roles despiertan para actuar en secreto:',
                        '┃  🐺 Lobos: `.ww kill @user`',
                        '┃  🔮 Vidente: `.ww check @user`',
                        '┃  🧙 Bruja: `.ww save` / `.ww poison @user`',
                        '┃',
                        '┃├◆ 🔔 Para amanecer escribe `.ww next`',
                        '┗❐'
                    ].join('\n'),
                    mentions: [...lynchMentions, ...allAliveJids]
                }, { quoted: m });
            }
        }

        // 12. Votación popular en el día: .ww vote @user o .ww vote 2 o .ww vote skip
        if (['vote', 'votar', 'voto'].includes(sub)) {
            if (!game || game.status !== 'DAY') {
                return await sock.sendMessage(chatId, { text: '⚠️ Las votaciones solo están abiertas durante el *DÍA*.' }, { quoted: m });
            }

            let targetJid = null;
            if (targetArg.toLowerCase() === 'skip' || targetArg.toLowerCase() === 'pasar') {
                targetJid = 'skip';
            } else {
                targetJid = resolveTarget(game, targetArg, m.mentionedJid);
            }

            if (!targetJid) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Debes indicar por quién votar (ej: `.ww vote @usuario`, `.ww vote 2`, o `.ww vote skip`).'
                }, { quoted: m });
            }

            const res = werewolfManager.dayVote(chatId, sender, targetJid);
            if (res.error === 'NOT_ALIVE') {
                return await sock.sendMessage(chatId, { text: '👻 Los muertos no tienen derecho a voto.' }, { quoted: m });
            }
            if (res.error === 'INVALID_TARGET') {
                return await sock.sendMessage(chatId, { text: '⚠️ Ese jugador no está vivo o no pertenece a la partida.' }, { quoted: m });
            }

            await m.react?.('🗳️');

            const targetDisplay = targetJid === 'skip' ? 'Abstención' : `@${getPhone(targetJid)}`;
            const mentions = targetJid === 'skip' ? [sender] : [sender, targetJid];

            return await sock.sendMessage(chatId, {
                text: `🗳️ @${getPhone(sender)} ha votado por: *${targetDisplay}* (${res.totalVotes}/${res.aliveCount} votos emitidos).`,
                mentions
            }, { quoted: m });
        }

        // Subcomando desconocido
        return await sock.sendMessage(chatId, {
            text: '❓ Subcomando no reconocido. Escribe `.ww` para ver la lista de comandos disponibles.'
        }, { quoted: m });
    }
};


'use strict';

const premium = require('../../lib/premium');

if (!global.roleplayMode) {
    global.roleplayMode = {};
}

const personajesData = {
    naruto: {
        imagen: 'https://cdn.myanimelist.net/images/characters/2/284121.jpg',
        descripcion: 'Ninja de Konoha, futuro Hokage. Nunca se rinde. 🍥',
        frase: '¡Dattebayo! ¡Seré el mejor Hokage!'
    },
    goku: {
        imagen: 'https://cdn.myanimelist.net/images/characters/2/310574.jpg',
        descripcion: 'Guerrero Saiyan, el más fuerte del universo. 💪',
        frase: '¡Kamehameha! ¡Vamos a pelear!'
    },
    vegeta: {
        imagen: 'https://cdn.myanimelist.net/images/characters/3/52297.jpg',
        descripcion: 'Príncipe de los Saiyajins, orgulloso y poderoso. 👑',
        frase: '¡Soy el Príncipe de todos los Saiyajins!'
    },
    sasuke: {
        imagen: 'https://cdn.myanimelist.net/images/characters/9/131317.jpg',
        descripcion: 'Ninja del clan Uchiha, busca la venganza. ⚡',
        frase: 'Solo vivo para la venganza...'
    },
    luffy: {
        imagen: 'https://cdn.myanimelist.net/images/characters/9/310307.jpg',
        descripcion: 'Capitán pirata de sombrero de paja. ⚓',
        frase: '¡Seré el Rey de los Piratas!'
    },
    zoro: {
        imagen: 'https://cdn.myanimelist.net/images/characters/3/100534.jpg',
        descripcion: 'Espadachín del estilo tres espadas (Santoryu). ⚔️',
        frase: 'Seré el mejor espadachín del mundo.'
    },
    gojo: {
        imagen: 'https://cdn.myanimelist.net/images/characters/8/470133.jpg',
        descripcion: 'El hechicero más fuerte. Infinity lo protege todo. ∞',
        frase: 'Lamentablemente eres muy débil para mí.'
    },
    levi: {
        imagen: 'https://cdn.myanimelist.net/images/characters/2/241413.jpg',
        descripcion: 'El soldado más fuerte de la humanidad. ⚔️',
        frase: 'Tch. Eres un idiota de primera clase.'
    },
    saitama: {
        imagen: 'https://cdn.myanimelist.net/images/characters/5/295603.jpg',
        descripcion: 'Héroe que derrota todo de un solo golpe. 👊',
        frase: 'Un golpe. Siempre uno solo.'
    },
    light: {
        imagen: 'https://cdn.myanimelist.net/images/characters/8/260547.jpg',
        descripcion: 'El dios del nuevo mundo. KIRA. ✍️',
        frase: '¡Soy KIRA y purificaré este mundo!'
    },
    tanjiro: {
        imagen: 'https://cdn.myanimelist.net/images/characters/4/365763.jpg',
        descripcion: 'Cazador de demonios, protector de su hermana. 🌸',
        frase: '¡Respiración del agua, primera forma!'
    },
    zenitsu: {
        imagen: 'https://cdn.myanimelist.net/images/characters/9/384353.jpg',
        descripcion: 'Cazador de demonios de la respiración del rayo. ⚡',
        frase: '¡Respiración del rayo, primera postura!'
    },
    eren: {
        imagen: 'https://cdn.myanimelist.net/images/characters/10/216895.jpg',
        descripcion: 'Poseedor del Titán de Ataque y Fundador. ⚔️',
        frase: '¡Si no peleas, no puedes ganar!'
    },
    deku: {
        imagen: 'https://cdn.myanimelist.net/images/characters/7/299404.jpg',
        descripcion: 'Sucesor del One For All, estudiante de la U.A. 💚',
        frase: '¡Voy a salvar a todos con una sonrisa!'
    },
    bakugo: {
        imagen: 'https://cdn.myanimelist.net/images/characters/12/299406.jpg',
        descripcion: 'Héroe explosivo con un orgullo implacable. 💥',
        frase: '¡SHINEEE! ¡Yo seré el número uno!'
    }
};

module.exports = {
    name: 'roleplay',
    alias: ['animepersonaje', 'personaje', 'rp'],
    category: 'herramientas',
    desc: 'Activa el modo roleplay de un personaje de anime (Premium)',
    usage: '.roleplay [personaje] | .roleplay stop',

    execute: async ({ sock, m, args, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const subCmd = (args[0] || '').toLowerCase().trim();

        // 1. Detener roleplay
        if (subCmd === 'stop' || subCmd === 'off' || subCmd === 'salir') {
            if (!global.roleplayMode[sender]) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ningún roleplay activo.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
            delete global.roleplayMode[sender];
            return await sock.sendMessage(jid, {
                text: '✅ *Modo roleplay desactivado.*\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const personaje = args.join(' ').trim();
        if (!personaje) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.roleplay [personaje]*\n\n' +
                      '📋 *Personajes disponibles:*\n' +
                      'Naruto, Goku, Vegeta, Sasuke, Luffy,\n' +
                      'Zoro, Gojo, Levi, Saitama, Light,\n' +
                      'Tanjiro, Zenitsu, Eren, Deku, Bakugo\n\n' +
                      '*.roleplay stop* — Salir del roleplay\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const cleanKey = personaje.toLowerCase().replace(/\s+/g, '');
        const data = personajesData[cleanKey] ||
                     personajesData[cleanKey.split('yagami')[0]] ||
                     Object.entries(personajesData).find(([k]) => cleanKey.includes(k))?.[1];

        // Guardar estado de roleplay
        global.roleplayMode[sender] = personaje;

        if (data && data.imagen) {
            try {
                await sock.sendMessage(jid, {
                    image: { url: data.imagen },
                    caption: `🎭 *Modo Roleplay activado*\n\n` +
                             `⚔️ *Personaje:* ${personaje}\n` +
                             `📖 *Info:* ${data.descripcion}\n\n` +
                             `💬 *${personaje}:* "${data.frase}"\n\n` +
                             `━━━━━━━━━━━━━━━\n` +
                             `Ahora responderé como *${personaje}*.\n` +
                             `Usa *.roleplay stop* para salir.\n\n` +
                             `_Unknown Codexツ</>_`
                }, { quoted: m });
                return;
            } catch (_) {}
        }

        await sock.sendMessage(jid, {
            text: `🎭 *Modo Roleplay activado*\n\n` +
                  `⚔️ *Personaje:* ${personaje}\n\n` +
                  `Ahora responderé como *${personaje}*.\n` +
                  `Usa *.roleplay stop* para salir.\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};


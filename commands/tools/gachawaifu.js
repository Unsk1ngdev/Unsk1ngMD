'use strict';

const axios = require('axios');
const sharp = require('sharp');
const logger = require('../../lib/logger');

// Almacenamiento en memoria de personajes adoptados por usuario: userJid -> Array<Character>
const userHarems = new Map();
// Tirada pendiente de confirmación por usuario: userJid -> Character
const pendingRolls = new Map();

// Base de datos curada de personajes de anime con fotografías oficiales y etiquetas verificadas
const ANIME_CHARACTERS = [
    // Míticos (1%)
    {
        name: 'Makima',
        anime: 'Chainsaw Man',
        gender: 'waifu',
        rarity: '👑 Mítico',
        stars: '⭐⭐⭐⭐⭐',
        quote: 'El control lo es todo.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b137080-UHcynYNjb5ZU.png',
        tag: 'makima_(chainsaw_man)'
    },
    {
        name: 'Satoru Gojo',
        anime: 'Jujutsu Kaisen',
        gender: 'husbu',
        rarity: '👑 Mítico',
        stars: '⭐⭐⭐⭐⭐',
        quote: 'En todo el cielo y la tierra, solo yo soy el honorable.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png',
        tag: 'gojou_satoru'
    },
    {
        name: 'Zero Two',
        anime: 'Darling in the Franxx',
        gender: 'waifu',
        rarity: '👑 Mítico',
        stars: '⭐⭐⭐⭐⭐',
        quote: '¿Serás mi cariño?',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b124381-2gAVq76HPfL2.png',
        tag: 'zero_two_(darling_in_the_franxx)'
    },
    // Legendarios (4%)
    {
        name: 'Yor Forger',
        anime: 'Spy x Family',
        gender: 'waifu',
        rarity: '🌟 Legendario',
        stars: '⭐⭐⭐⭐',
        quote: '¿Puedo quitarle la vida a este objetivo?',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b138102-ZOAu9jI2d5ke.png',
        tag: 'yor_briar'
    },
    {
        name: 'Levi Ackerman',
        anime: 'Attack on Titan',
        gender: 'husbu',
        rarity: '🌟 Legendario',
        stars: '⭐⭐⭐⭐',
        quote: 'Si no peleas, no puedes ganar.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png',
        tag: 'levi_(shingeki_no_kyojin)'
    },
    {
        name: 'Rem',
        anime: 'Re:Zero',
        gender: 'waifu',
        rarity: '🌟 Legendario',
        stars: '⭐⭐⭐⭐',
        quote: 'Empezar desde cero no es rendirse.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b88575-Ayu8UPDA8NS6.png',
        tag: 'rem_(re:zero)'
    },
    {
        name: 'Rengoku Kyojuro',
        anime: 'Demon Slayer',
        gender: 'husbu',
        rarity: '🌟 Legendario',
        stars: '⭐⭐⭐⭐',
        quote: '¡Enciende tu corazón!',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b129133-VlTPowwt68rJ.png',
        tag: 'rengoku_kyoujurou'
    },
    // Super Raros (10%)
    {
        name: 'Marin Kitagawa',
        anime: 'My Dress-Up Darling',
        gender: 'waifu',
        rarity: '⭐⭐⭐ Super Raro',
        stars: '⭐⭐⭐',
        quote: '¡Cosplayear es pura pasión!',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b133676-kV2czE3C8Qls.png',
        tag: 'kitagawa_marin'
    },
    {
        name: 'Mikasa Ackerman',
        anime: 'Attack on Titan',
        gender: 'waifu',
        rarity: '⭐⭐⭐ Super Raro',
        stars: '⭐⭐⭐',
        quote: 'El mundo es cruel pero hermoso.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1PkreDvj.png',
        tag: 'mikasa_ackerman'
    },
    {
        name: 'Dazai Osamu',
        anime: 'Bungou Stray Dogs',
        gender: 'husbu',
        rarity: '⭐⭐⭐ Super Raro',
        stars: '⭐⭐⭐',
        quote: 'Tener una muerte agradable es un arte.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b89198-qKmRTw4Y3PRC.png',
        tag: 'dazai_osamu_(bungou_stray_dogs)'
    },
    {
        name: 'Megumi Fushiguro',
        anime: 'Jujutsu Kaisen',
        gender: 'husbu',
        rarity: '⭐⭐⭐ Super Raro',
        stars: '⭐⭐⭐',
        quote: 'Salvaré a la gente de forma justa.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b126635-L0y3I92JSUkN.png',
        tag: 'fushiguro_megumi'
    },
    // Raros (25%)
    {
        name: 'Hinata Hyuga',
        anime: 'Naruto',
        gender: 'waifu',
        rarity: '⭐⭐ Raro',
        stars: '⭐⭐',
        quote: 'Nunca retrocederé a mi palabra.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b1555-Q41GLTV3FvYF.png',
        tag: 'hyuuga_hinata'
    },
    {
        name: 'Todoroki Shoto',
        anime: 'My Hero Academia',
        gender: 'husbu',
        rarity: '⭐⭐ Raro',
        stars: '⭐⭐',
        quote: 'Este poder también es mío.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b89220-KNBwaVFAR8FD.png',
        tag: 'todoroki_shouto'
    },
    {
        name: 'Nezuko Kamado',
        anime: 'Demon Slayer',
        gender: 'waifu',
        rarity: '⭐⭐ Raro',
        stars: '⭐⭐',
        quote: 'Mmh mmh!',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b127518-NRlq1CQ1v1ro.png',
        tag: 'kamado_nezuko'
    },
    {
        name: 'Killua Zoldyck',
        anime: 'Hunter x Hunter',
        gender: 'husbu',
        rarity: '⭐⭐ Raro',
        stars: '⭐⭐',
        quote: 'Gon, tú eres mi luz.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg',
        tag: 'killua_zoldyck'
    },
    // Comunes (60%)
    {
        name: 'Asuka Langley',
        anime: 'Evangelion',
        gender: 'waifu',
        rarity: '⭐ Común',
        stars: '⭐',
        quote: '¡¿Acaso eres idiota?!',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b94-d631a3Z2KPvd.png',
        tag: 'souryuu_asuka_langley'
    },
    {
        name: 'Tanjiro Kamado',
        anime: 'Demon Slayer',
        gender: 'husbu',
        rarity: '⭐ Común',
        stars: '⭐',
        quote: 'Protege a los demás con bondad.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b126071-BTNEc1nRIv68.png',
        tag: 'kamado_tanjirou'
    },
    {
        name: 'Uraraka Ochaco',
        anime: 'My Hero Academia',
        gender: 'waifu',
        rarity: '⭐ Común',
        stars: '⭐',
        quote: '¡Seré la mejor heroína!',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b89221-gSF2a4gPbG4m.png',
        tag: 'uraraka_ochako'
    },
    {
        name: 'Zoro Roronoa',
        anime: 'One Piece',
        gender: 'husbu',
        rarity: '⭐ Común',
        stars: '⭐',
        quote: 'Seré el mejor espadachín del mundo.',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png',
        tag: 'roronoa_zoro'
    }
];

function rollCharacter(preferredGender = null) {
    let pool = ANIME_CHARACTERS;
    if (preferredGender) {
        const filtered = pool.filter(c => c.gender === preferredGender);
        if (filtered.length > 0) pool = filtered;
    }
    const randIndex = Math.floor(Math.random() * pool.length);
    return pool[randIndex];
}

/**
 * Genera una tarjeta de respaldo visual usando Sharp
 */
async function generateCardBuffer(characterName, rarity, isHusbu) {
    const cardSvg = `
    <svg width="600" height="750" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${isHusbu ? '#1f2937' : '#831843'}"/>
                <stop offset="100%" stop-color="${isHusbu ? '#111827' : '#500724'}"/>
            </linearGradient>
            <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="${isHusbu ? '#38bdf8' : '#fb7185'}"/>
                <stop offset="100%" stop-color="${isHusbu ? '#818cf8' : '#f43f5e'}"/>
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" rx="24"/>
        <rect x="18" y="18" width="564" height="714" fill="none" stroke="url(#accent)" stroke-width="3" rx="20"/>
        <circle cx="300" cy="270" r="140" fill="${isHusbu ? '#1e293b' : '#371424'}" stroke="url(#accent)" stroke-width="2"/>
        <text x="300" y="320" font-family="'Segoe UI', 'Arial', sans-serif" font-size="110" text-anchor="middle">${isHusbu ? '⚔️' : '🌸'}</text>
        <rect x="60" y="470" width="480" height="60" rx="14" fill="${isHusbu ? '#0f172a' : '#1f0d16'}"/>
        <text x="300" y="512" font-family="'Segoe UI', 'Arial', sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">${characterName.toUpperCase()}</text>
        <text x="300" y="580" font-family="'Segoe UI', 'Arial', sans-serif" font-size="22" font-weight="bold" fill="${isHusbu ? '#38bdf8' : '#fb7185'}" text-anchor="middle">${rarity}</text>
        <text x="300" y="630" font-family="'Segoe UI', 'Arial', sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle">GACHA ANIME • PAREJA VIRTUAL</text>
        <text x="300" y="680" font-family="'Segoe UI', 'Arial', sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">Unknown Codexツ</text>
    </svg>`;

    return await sharp(Buffer.from(cardSvg)).png().toBuffer();
}

/**
 * Obtiene la fotografía del personaje exacto de la tirada.
 * 1. Prioriza la imagen oficial de ese personaje específico.
 * 2. Si falla, consulta Safebooru con el tag exacto de ese personaje.
 * 3. Fallback infalible: Tarjeta coleccionable SVG de alta resolución con Sharp.
 */
async function fetchWaifuImageBuffer(character) {
    const isHusbu = character.gender === 'husbu';

    // 1. Descarga directa de la foto oficial verificada del personaje
    if (character.imageUrl) {
        try {
            const imgRes = await axios.get(character.imageUrl, {
                responseType: 'arraybuffer',
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (imgRes.data && imgRes.data.length > 500) {
                return await sharp(imgRes.data)
                    .resize({ width: 720, withoutEnlargement: true })
                    .jpeg({ quality: 85 })
                    .toBuffer();
            }
        } catch (_) {}
    }

    // 2. Safebooru específico con el tag del personaje (para variedad si falla la foto directa)
    if (character.tag) {
        try {
            const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=5&tags=${encodeURIComponent(character.tag)}+rating:general`;
            const res = await axios.get(url, { timeout: 4000 });
            if (Array.isArray(res.data) && res.data.length > 0) {
                const post = res.data[Math.floor(Math.random() * res.data.length)];
                const imgUrl = `https://safebooru.org/images/${post.directory}/${post.image}`;
                const imgRes = await axios.get(imgUrl, {
                    responseType: 'arraybuffer',
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (imgRes.data && imgRes.data.length > 500) {
                    return await sharp(imgRes.data)
                        .resize({ width: 720, withoutEnlargement: true })
                        .jpeg({ quality: 80 })
                        .toBuffer();
                }
            }
        } catch (_) {}
    }

    // 3. Tarjeta local generada al instante con Sharp (fallback infalible)
    return await generateCardBuffer(character.name, character.rarity, isHusbu);
}

module.exports = {
    name: 'gachawaifu',
    alias: ['gacha', 'gachahusbu', 'husbu', 'adoptarwaifu', 'harem'],
    category: 'anime',
    desc: 'Haces una tirada de gacha para obtener un personaje anime con fotografía y adoptarlo como tu pareja virtual',
    usage: '.gachawaifu [tirada] | .gacha claim [adoptar] | .gacha pass [dejar ir] | .gacha harem [ver colección]',

    execute: async ({ sock, m, args, commandName }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const sub = (args && args[0] ? args[0] : '').toLowerCase().trim();

        // 1. Ver colección (Harem)
        if (['harem', 'list', 'coleccion', 'parejas', 'miswaifus'].includes(sub)) {
            const harem = userHarems.get(sender) || [];
            if (harem.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '💔 Aún no has adoptado a ningún personaje.\nRealiza una tirada con *.gachawaifu* o *.gachahusbu*.'
                }, { quoted: m });
            }

            const listText = harem.map((c, i) => `┃ ${i + 1}. ${c.rarity} *${c.name}* (${c.anime})`).join('\n');

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 💖 TU COLECCIÓN DE PAREJAS VIRTUALES 》 ❐',
                    '┃',
                    `┃├◆ 👤 *Dueño:* @${sender.replace(/[^0-9]/g, '')}`,
                    `┃├◆ 👥 *Total adoptados:* ${harem.length}`,
                    '┃',
                    listText,
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // 2. Adoptar personaje de la tirada pendiente (claim)
        if (['claim', 'adoptar', 'quedarme', 'aceptar', 'si'].includes(sub)) {
            const pending = pendingRolls.get(sender);
            if (!pending) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ninguna tirada de gacha pendiente por reclamar.\nTira con *.gachawaifu* o *.gachahusbu*.'
                }, { quoted: m });
            }

            const harem = userHarems.get(sender) || [];
            if (harem.some(c => c.name === pending.name)) {
                pendingRolls.delete(sender);
                return await sock.sendMessage(jid, {
                    text: `ℹ️ Ya tenías a *${pending.name}* en tu colección.`
                }, { quoted: m });
            }

            if (harem.length >= 10) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ Tu colección ha alcanzado el límite máximo de 10 parejas virtuales.'
                }, { quoted: m });
            }

            harem.push(pending);
            userHarems.set(sender, harem);
            pendingRolls.delete(sender);

            await m.react?.('💍');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 💍 ¡NUEVA ADOPCIÓN VIRTUAL! 》 ❐',
                    '┃',
                    `┃├◆ Felicidades @${sender.replace(/[^0-9]/g, '')}, has adoptado oficialmente a:`,
                    `┃   ❤️ *${pending.name}*`,
                    `┃   📺 Anime: *${pending.anime}*`,
                    `┃   ⭐ Rareza: *${pending.rarity}*`,
                    '┃',
                    '┃├◆ 📜 *Palabras del personaje:*',
                    `┃   _"${pending.quote}"_`,
                    '┃',
                    `┃├◆ 💖 Revisa tus parejas guardadas con: \`.gacha harem\``,
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // 3. Dejar ir al personaje (pass)
        if (['pass', 'rechazar', 'soltar', 'no', 'dejar'].includes(sub)) {
            const pending = pendingRolls.get(sender);
            if (!pending) {
                return await sock.sendMessage(jid, {
                    text: 'ℹ️ No tienes ninguna tirada pendiente por rechazar.'
                }, { quoted: m });
            }

            pendingRolls.delete(sender);
            await m.react?.('👋');
            return await sock.sendMessage(jid, {
                text: `💔 Has dejado marchar a *${pending.name}*. ¡Suerte en tu próxima tirada!`
            }, { quoted: m });
        }

        // 4. Realizar tirada de gacha
        const isHusbu = (commandName || '').includes('husbu') || sub === 'husbu';
        const character = rollCharacter(isHusbu ? 'husbu' : 'waifu');
        pendingRolls.set(sender, character);

        await m.react?.('✨');

        const caption = [
            '┏❐ 《 🎰 GACHA ANIME VIRTUAL 》 ❐',
            '┃',
            `┃├◆ ✨ *Nombre:* ${character.name}`,
            `┃├◆ 📺 *Anime:* ${character.anime}`,
            `┃├◆ 🌟 *Rareza:* ${character.rarity} (${character.stars})`,
            '┃',
            `┃├◆ 💬 *Frase:*`,
            `┃   "${character.quote}"`,
            '┃',
            `┃├◆ 💍 *¿Deseas adoptarle como tu pareja?*`,
            '┃   👉 Escribe: `.gacha claim` (Para adoptarle)',
            '┃   👉 Escribe: `.gacha pass` (Para dejarle ir)',
            '┗❐\n',
            '_Unknown Codexツ</>_'
        ].join('\n');

        try {
            // Obtener fotografía específica del personaje
            const imageBuffer = await fetchWaifuImageBuffer(character);

            await sock.sendMessage(jid, {
                image: imageBuffer,
                caption
            }, { quoted: m });

        } catch (err) {
            logger.error('[GACHA ERROR]:', err.message);
            // Fallback con la tarjeta local garantizada
            try {
                const fallbackBuffer = await generateCardBuffer(character.name, character.rarity, isHusbu);
                await sock.sendMessage(jid, { image: fallbackBuffer, caption }, { quoted: m });
            } catch (_) {
                await sock.sendMessage(jid, { text: caption }, { quoted: m });
            }
        }
    }
};

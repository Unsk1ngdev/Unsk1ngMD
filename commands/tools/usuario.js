'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

const PLATFORMS = [
    {
        name: 'GitHub',
        icon: '🐙',
        url: (u) => `https://github.com/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && res.data?.login) {
                const parts = [];
                if (res.data.name) parts.push(res.data.name);
                if (typeof res.data.public_repos === 'number') parts.push(`${res.data.public_repos} repos`);
                if (typeof res.data.followers === 'number') parts.push(`${res.data.followers} seguidores`);
                return { found: true, info: parts.join(' · ') || 'Perfil activo' };
            }
            return { found: false };
        }
    },
    {
        name: 'Reddit',
        icon: '🤖',
        url: (u) => `https://www.reddit.com/user/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://www.reddit.com/user/${encodeURIComponent(u)}/about.json`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && res.data?.data?.name) {
                const karma = (res.data.data.total_karma || 0).toLocaleString();
                return { found: true, info: `${karma} karma` };
            }
            return { found: false };
        }
    },
    {
        name: 'Telegram',
        icon: '✈️',
        url: (u) => `https://t.me/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://t.me/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && typeof res.data === 'string') {
                if (res.data.includes('tgme_page_title') && !res.data.includes('tgme_page_title_empty')) {
                    return { found: true, info: 'Canal o Usuario' };
                }
            }
            return { found: false };
        }
    },
    {
        name: 'Steam',
        icon: '🎮',
        url: (u) => `https://steamcommunity.com/id/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://steamcommunity.com/id/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && typeof res.data === 'string') {
                if (!res.data.includes('The specified profile could not be found') && res.data.includes('actual_persona_name')) {
                    return { found: true, info: 'Comunidad Steam' };
                }
            }
            return { found: false };
        }
    },
    {
        name: 'Chess.com',
        icon: '♟️',
        url: (u) => `https://www.chess.com/member/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://api.chess.com/pub/player/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && res.data?.username) {
                const title = res.data.title ? `[${res.data.title}] ` : '';
                return { found: true, info: `${title}Jugador de ajedrez` };
            }
            return { found: false };
        }
    },
    {
        name: 'GitLab',
        icon: '🦊',
        url: (u) => `https://gitlab.com/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
                const userObj = res.data[0];
                return { found: true, info: userObj.name || 'Desarrollador' };
            }
            return { found: false };
        }
    },
    {
        name: 'Roblox',
        icon: '🧱',
        url: (u) => `https://www.roblox.com/search/users?keyword=${u}`,
        check: async (u) => {
            const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [u],
                excludeBannedUsers: false
            }, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
                timeout: 3000
            });
            if (res.status === 200 && Array.isArray(res.data?.data) && res.data.data.length > 0) {
                const r = res.data.data[0];
                return { found: true, info: `Nombre: ${r.displayName || r.name}` };
            }
            return { found: false };
        }
    },
    {
        name: 'Twitch',
        icon: '🟣',
        url: (u) => `https://www.twitch.tv/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://www.twitch.tv/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Canal de streaming' };
            return { found: false };
        }
    },
    {
        name: 'TikTok',
        icon: '🎵',
        url: (u) => `https://www.tiktok.com/@${u}`,
        check: async (u) => {
            const res = await axios.get(`https://www.tiktok.com/@${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Perfil activo' };
            return { found: false };
        }
    },
    {
        name: 'Pinterest',
        icon: '📌',
        url: (u) => `https://www.pinterest.com/${u}/`,
        check: async (u) => {
            const res = await axios.get(`https://www.pinterest.com/${encodeURIComponent(u)}/`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Tablero/Cuenta pública' };
            return { found: false };
        }
    },
    {
        name: 'Linktree',
        icon: '🌲',
        url: (u) => `https://linktr.ee/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://linktr.ee/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Hub de enlaces' };
            return { found: false };
        }
    },
    {
        name: 'SoundCloud',
        icon: '☁️',
        url: (u) => `https://soundcloud.com/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://soundcloud.com/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Perfil musical' };
            return { found: false };
        }
    },
    {
        name: 'Gravatar',
        icon: '🖼️',
        url: (u) => `https://en.gravatar.com/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://en.gravatar.com/${encodeURIComponent(u)}.json`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && res.data?.entry) {
                return { found: true, info: 'Avatar global' };
            }
            return { found: false };
        }
    },
    {
        name: 'Duolingo',
        icon: '🦉',
        url: (u) => `https://www.duolingo.com/profile/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && Array.isArray(res.data?.users) && res.data.users.length > 0) {
                const d = res.data.users[0];
                return { found: true, info: `${d.streak || 0} días de racha` };
            }
            return { found: false };
        }
    },
    {
        name: 'Wattpad',
        icon: '📖',
        url: (u) => `https://www.wattpad.com/user/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://www.wattpad.com/user/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && !res.data.includes('User not found')) {
                return { found: true, info: 'Comunidad de lectura' };
            }
            return { found: false };
        }
    },
    {
        name: 'Medium',
        icon: '📝',
        url: (u) => `https://medium.com/@${u}`,
        check: async (u) => {
            const res = await axios.get(`https://medium.com/@${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000,
                validateStatus: s => s < 500
            });
            if (res.status === 200 && !res.data.includes('404: Page not found')) {
                return { found: true, info: 'Blog / Artículos' };
            }
            return { found: false };
        }
    }
];

module.exports = {
    name: 'usuario',
    alias: ['user', 'sherlock', 'socialhunt', 'stalker'],
    category: 'tools',
    desc: 'Rastrea la huella digital pública de un nombre de usuario en más de 15 plataformas sociales (estilo Sherlock)',
    usage: '.usuario <nombre_de_usuario>',

    execute: async ({ sock, m, args }) => {
        const query = (args[0] || '').trim().replace(/^@/, '');

        if (!query || query.length < 2 || query.length > 35 || !/^[a-zA-Z0-9._-]+$/.test(query)) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Debes ingresar un nombre de usuario válido.\n(De 2 a 35 caracteres alfanuméricos, puntos o guiones).\n\n*Ejemplo:* `.usuario torvalds`'
            }, { quoted: m });
        }

        await m.react?.('🔍');
        await sock.sendMessage(m.chat, { text: `🔍 Rastreando huella digital de *@${query}* en redes sociales...` }, { quoted: m });

        const results = await Promise.allSettled(PLATFORMS.map(async (plat) => {
            try {
                const res = await plat.check(query);
                if (res?.found) {
                    return {
                        name: plat.name,
                        icon: plat.icon,
                        url: plat.url(query),
                        info: res.info || null
                    };
                }
            } catch (_) {}
            return null;
        }));

        const foundList = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);

        let footprintLevel = '🟢 Huella Baja (0-2 perfiles)';
        if (foundList.length >= 7) footprintLevel = '🔴 Huella Muy Alta (Presencia digital masiva)';
        else if (foundList.length >= 4) footprintLevel = '🟡 Huella Media-Alta (Perfil activo)';
        else if (foundList.length >= 2) footprintLevel = '🟡 Huella Media';

        const card = [
            '╭━━━━〔 🕵️ *OSINT — USER FOOTPRINT* 〕━━━━⬣',
            '┃',
            `┃ 👤 *Usuario:* \`@${query}\``,
            `┃ 🔍 *Plataformas analizadas:* ${PLATFORMS.length}`,
            `┃ 🎯 *Perfiles encontrados:* ${foundList.length} coincidencias`,
            `┃ 📊 *Nivel de Huella:* ${footprintLevel}`,
            '┃',
            '┃ 🌐 ═〔 *PERFILES PÚBLICOS ACTIVOS* 〕═',
            foundList.length > 0
                ? foundList.map(item => `┃ ${item.icon} *${item.name}:* ${item.url}${item.info ? `\n┃    ↳ _${item.info}_` : ''}`).join('\n')
                : '┃ ⚪ No se encontraron perfiles públicos en las plataformas consultadas.',
            '┃',
            '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
            '',
            '_Unknown Codexツ</>_'
        ].join('\n');

        await m.react?.('✅');
        await sock.sendMessage(m.chat, { text: card }, { quoted: m });
    }
};


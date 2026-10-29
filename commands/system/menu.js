'use strict';

const fs = require('fs');
const path = require('path');
const database = require('../../lib/database');
const config = require('../../config');

const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
};

module.exports = {
    name: 'menu',
    alias: ['help', 'ayuda', 'allmenu', 'menulist'],
    category: 'sistema',
    desc: 'Muestra el menú principal con todos los comandos en formato limpio y ordenado',
    usage: '.menu [categoría opcional]',

    execute: async ({ sock, m, args }) => {
        const prefix = database.getPrefix();
        const mode = database.getMode();
        const filter = (args && args[0] ? args[0].toLowerCase().trim() : '');

        const uptimeStr = formatUptime(process.uptime());
        const botAccountName = (sock?.user?.name || '').replace(/[\r\n]+/g, ' ').trim();
        const botNumber = (sock?.user?.id || sock?.user?.jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const userName = botAccountName || (botNumber ? `+${botNumber}` : config.ownerName);
        const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

        let speedMs = 35;
        if (m.messageTimestamp) {
            const diff = Math.abs(Date.now() - (Number(m.messageTimestamp) * 1000));
            if (diff > 0 && diff < 5000) speedMs = diff;
        }

        const now = new Date();
        const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

        // ── Secciones y Comandos ──
        const secciones = [
            {
                key: 'group',
                title: 'GROUP MENU',
                cmds: [
                    'promote',
                    'demote',
                    'kick',
                    'abrir',
                    'cerrar',
                    'antilink',
                    'antispam',
                    'antidelete',
                    'antibadword',
                    'warn',
                    'unwarn',
                    'warnings',
                    'tagall',
                    'hidetag',
                    'notify',
                    'limpiar',
                    'bienvenido/a',
                    'despedida',
                    'reglas',
                    'linkgroup',
                    'revoke',
                    'inactivos',
                    'torneo',
                    'amigorandom',
                    'formarpareja'
                ]
            },
            {
                key: 'ai',
                title: 'AI MENU',
                cmds: [
                    'ia',
                    'gpt',
                    'gemini',
                    'genimg',
                    'flux',
                    'wiki',
                    'debatir'
                ]
            },
            {
                key: 'anime',
                title: 'ANIME MENU',
                cmds: [
                    'kiss',
                    'hug',
                    'cry',
                    'poke',
                    'nom',
                    'wink',
                    'facepalm',
                    'neko',
                    'punch',
                    'patt',
                    'scared',
                    'roleplay',
                    'duelo',
                    'anime'
                ]
            },
            {
                key: 'textmaker',
                title: 'TEXT MAKER MENU',
                cmds: [
                    'neon [texto]',
                    'glitch [texto]',
                    'matrix [texto]',
                    'fire [texto]',
                    'blackpink [texto]',
                    'devil [texto]',
                    'thunder [texto]',
                    'sand [texto]'
                ]
            },
            {
                key: 'imgedit',
                title: 'IMG EDIT MENU',
                cmds: [
                    'jail',
                    'passed',
                    'triggered',
                    'circle',
                    'glass',
                    'gay',
                    'blur'
                ]
            },
            {
                key: 'juegos',
                title: 'GAME MENU',
                cmds: [
                    'tictactoe',
                    '8ball',
                    'ahorcado',
                    'trivia',
                    'acertijo',
                    'verdadoreto',
                    'akinator',
                    'slots',
                    'ruleta',
                    'personalidad'
                ]
            },
            {
                key: 'descargas',
                title: 'DOWNLOADS MENU',
                cmds: [
                    'ytmp3',
                    'ytmp4',
                    'tiktok',
                    'instagram',
                    'facebook',
                    'twitter',
                    'pinterest',
                    'gitclone'
                ]
            },
            {
                key: 'multimedia',
                title: 'STICKER & MEDIA MENU',
                cmds: [
                    'sticker',
                    'gif',
                    'togif',
                    'toimg',
                    'tovideo',
                    'tomp3',
                    'tovn',
                    'tourl',
                    'imglink',
                    'qr',
                    'readqr',
                    'screenshot',
                    'meme',
                    'cmeme'
                ]
            },
            {
                key: 'tools',
                title: 'TOOLS & PUBLIC MENU',
                cmds: [
                    'perfil',
                    'info',
                    'clima',
                    'crypto',
                    'calc',
                    'trad',
                    'lyrics',
                    'acortar',
                    'pdf2txt',
                    'pelicula',
                    'videojuego',
                    'monedaflip',
                    'banco',
                    'diario',
                    'trabajar',
                    'transferir',
                    'robar',
                    'tienda',
                    'rango',
                    'email',
                    'usuario',
                    'ip',
                    'pais',
                    'rank',
                    'ping',
                    'owner',
                    'comandos'
                ]
            },
            {
                key: 'premium',
                title: 'PREMIUM MENU',
                cmds: [
                    'cedula',
                    'vv',
                    'escuchar',
                    'spy',
                    'ghost',
                    'invisible',
                    'groupjid',
                    'clonar',
                    'stalkear',
                    'sms',
                    'fake',
                    'fakechat',
                    'discord',
                    'osint',
                    'reverseip',
                    'portcheck',
                    'dispositivo',
                    'ubicacion'
                ]
            },
            {
                key: 'owner',
                title: 'OWNER MENU',
                cmds: [
                    'addowner',
                    'bangroup',
                    'unbangroup',
                    'ban',
                    'unban',
                    'mute',
                    'unmute',
                    'clearchat',
                    'nuke',
                    'reportar',
                    'spam',
                    'prem',
                    'chetar',
                    'impersonar',
                    'analizar',
                    'subbot',
                    'broadcast',
                    'mode',
                    'prefix',
                    'status',
                    'reiniciar',
                    'backup'
                ]
            },
            {
                key: 'nsfw',
                title: 'NSFW MENU',
                cmds: [
                    'nsfw on/off',
                    'waifu',
                    'gifnsfw',
                    'dark',
                    'hentai',
                    'follar',
                    'sexo',
                    'penetrar',
                    'grabboobs',
                    'chaqueta',
                    'paja'
                ]
            }
        ];

        // ── Formateador de sección estilo Clean Box ──
        const formatSection = (sec) => {
            const lines = sec.cmds.map(cmd => `┃├◆ ${prefix}${cmd}`).join('\n');
            return `┏❐ 《 ${sec.title} 》 ❐\n${lines}\n┗❐`;
        };

        const footer =
`┏❐ 《 GUÍA DE USO 》 ❐
┃├◆ ${prefix}menu [categoría]  (ej: ${prefix}menu game)
┃├◆ ${prefix}comandos  (guía detallada con ejemplos)
┗❐

_Unknown Codexツ</>_`;

        // ── Filtro por categoría ──
        if (filter) {
            const matched = secciones.find(s =>
                s.key.toLowerCase().includes(filter) ||
                filter.includes(s.key.toLowerCase()) ||
                s.title.toLowerCase().includes(filter)
            );

            if (matched) {
                const filteredHeader =
`┏❐ 《 ${config.botName.toUpperCase()} 》 ❐
┃├◆ Usuario: ${userName}
┃├◆ Prefijo: [ ${prefix} ]
┃├◆ Sección: ${matched.title}
┃├◆ Comandos: ${matched.cmds.length}
┗❐\n\n`;

                return await sock.sendMessage(m.chat, {
                    text: `${filteredHeader}${formatSection(matched)}\n\n${footer}`
                }, { quoted: m });
            }
        }

        // ── Menú completo ──
        let totalCmds = 0;
        secciones.forEach(s => totalCmds += s.cmds.length);

        const header =
`┏❐ 《 ${config.botName.toUpperCase()} 》 ❐
┃├◆ Creador: ${config.ownerName}
┃├◆ Usuario: ${userName}
┃├◆ Prefijo: [ ${prefix} ]
┃├◆ Modo: ${mode.toUpperCase()}
┃├◆ Activo: ${uptimeStr}
┃├◆ Latencia: ${speedMs}ms
┃├◆ RAM: ${memUsage} MB
┃├◆ Fecha: ${fecha} | ${hora}
┃├◆ Comandos: ${totalCmds} listados
┗❐\n\n`;

        const body = secciones.map(formatSection).join('\n\n');
        const menuCompleto = `${header}${body}\n\n${footer}`;

        const chatId = m.chat || m.key?.remoteJid;
        const mp4Path = path.join(config.assetsDir, 'menu.mp4');
        const gifPath = path.join(config.assetsDir, 'menu.gif');
        const imgPath = path.join(config.assetsDir, 'menu.jpg');

        try {
            if (fs.existsSync(mp4Path)) {
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(mp4Path),
                    gifPlayback: true,
                    caption: menuCompleto
                }, { quoted: m });
            } else if (fs.existsSync(gifPath)) {
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(gifPath),
                    gifPlayback: true,
                    caption: menuCompleto
                }, { quoted: m });
            } else if (fs.existsSync(imgPath)) {
                await sock.sendMessage(chatId, {
                    image: fs.readFileSync(imgPath),
                    caption: menuCompleto
                }, { quoted: m });
            } else {
                await sock.sendMessage(chatId, { text: menuCompleto }, { quoted: m });
            }
        } catch (_) {
            await sock.sendMessage(chatId, { text: menuCompleto }, { quoted: m });
        }
    }
};

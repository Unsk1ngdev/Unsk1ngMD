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

// ── Conversor de texto estilo Black Clover ──
const toSmallCaps = t => t.replace(/[a-z]/gi, c => ({
    a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',
    k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'ꜱ',t:'ᴛ',
    u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'
}[c.toLowerCase()] || c));

const toBold = t => t.replace(/[a-zA-Z]/g, c => ({
    A:'𝐀',B:'𝐁',C:'𝐂',D:'𝐃',E:'𝐄',F:'𝐅',G:'𝐆',H:'𝐇',I:'𝐈',J:'𝐉',
    K:'𝐊',L:'𝐋',M:'𝐌',N:'𝐍',O:'𝐎',P:'𝐏',Q:'𝐐',R:'𝐑',S:'𝐒',T:'𝐓',
    U:'𝐔',V:'𝐕',W:'𝐖',X:'𝐗',Y:'𝐘',Z:'𝐙',a:'𝐚',b:'𝐛',c:'𝐜',d:'𝐝',
    e:'𝐞',f:'𝐟',g:'𝐠',h:'𝐡',i:'𝐢',j:'𝐣',k:'𝐤',l:'𝐥',m:'𝐦',n:'𝐧',
    o:'𝐨',p:'𝐩',q:'𝐪',r:'𝐫',s:'𝐬',t:'𝐭',u:'𝐮',v:'𝐯',w:'𝐰',x:'𝐱',
    y:'𝐲',z:'𝐳'
}[c] || c));

module.exports = {
    name: 'menu',
    alias: ['help', 'ayuda', 'allmenu', 'menulist'],
    category: 'sistema',
    desc: 'Muestra el menú principal con todos los comandos',
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
                key: 'admin',
                title: `👥 ${toSmallCaps('admin grupo')}`,
                cmds: [
                    ['🏆', 'torneo', 'Crear torneo'],
                    ['🛡️', 'antilink', 'Bloquear links'],
                    ['📝', 'reglas', 'Reglas del grupo'],
                    ['🚪', 'despedida', 'Mensaje de despedida'],
                    ['🕐', 'inactivos', 'Ver/expulsar inactivos'],
                    ['🔞', 'nsfw on/off', 'Activar/desactivar NSFW'],
                    ['🛡️', 'antispam', 'Filtro antispam'],
                    ['⚡', 'antispamkick', 'Antispam estricto'],
                    ['👋', 'bienvenido/a', 'Bienvenida automática'],
                    ['🔒', 'cerrar', 'Cerrar grupo'],
                    ['🔓', 'abrir', 'Abrir grupo'],
                    ['👢', 'kick', 'Expulsar miembro'],
                    ['👑', 'promote', 'Dar administrador'],
                    ['🔻', 'demote', 'Quitar administrador'],
                    ['🔗', 'linkgroup', 'Enlace del grupo'],
                    ['🔄', 'revoke', 'Restablecer enlace'],
                    ['📢', 'tagall', 'Mencionar a todos'],
                    ['👻', 'hidetag', 'Notificación invisible'],
                    ['🔔', 'notify', 'Notificar miembros'],
                    ['✉️', 'enviarlink', 'Enviar link por privado'],
                    ['🗑️', 'limpiar [cant]', 'Eliminar mensajes'],
                    ['🤝', 'amigorandom', 'Elegir amigos del día'],
                    ['💘', 'formarpareja', 'Formar 5 parejas del grupo']
                ]
            },
            {
                key: 'juegos',
                title: `🎮 ${toSmallCaps('juegos')}`,
                cmds: [
                    ['🎰', 'slots', 'Tragamonedas'],
                    ['🎭', 'verdadoreto', 'Verdad o reto'],
                    ['💭', 'verdad [picante]', 'Pregunta incómoda o picante'],
                    ['👊', 'punch [@user]', 'Dar un puñetazo animado'],
                    ['🥰', 'patt [@user]', 'Acariciar con cariño'],
                    ['😱', 'scared [@user]', 'Pegar un susto animado'],
                    ['🍑', 'agarrarnalgas [@user]', 'Agarrar las nalgas'],
                    ['🧠', 'personalidad', 'Test de personalidad'],
                    ['🎭', 'roleplay', 'Roleplay de anime'],
                    ['🧩', 'ahorcado', 'Jugar ahorcado'],
                    ['⚔️', 'duelo', 'Duelo anime'],
                    ['🧞', 'akinator', 'Genio Akinator'],
                    ['❌', 'cancelakinator', 'Cancelar Akinator'],
                    ['❓', 'trivia', 'Preguntas de trivia'],
                    ['🤔', 'acertijo', 'Resolver acertijo'],
                    ['⚔️', 'debatir [tema]', 'Debate con IA'],
                    ['🔫', 'ruleta', 'Ruleta rusa']
                ]
            },
            {
                key: 'descargas',
                title: `📥 ${toSmallCaps('descargas')}`,
                cmds: [
                    ['🎵', 'ytmp3', 'Audio YouTube'],
                    ['🎬', 'ytmp4', 'Video YouTube'],
                    ['📱', 'tiktok', 'Video TikTok sin marca'],
                    ['📸', 'instagram', 'Reels y posts de IG'],
                    ['📘', 'facebook', 'Videos de Facebook HD'],
                    ['🐦', 'twitter', 'Videos de X/Twitter'],
                    ['📌', 'pinterest', 'Imágenes de Pinterest'],
                    ['🐙', 'gitclone', 'Repositorio GitHub .zip']
                ]
            },
            {
                key: 'multimedia',
                title: `🎨 ${toSmallCaps('multimedia')}`,
                cmds: [
                    ['🖼️', 'sticker', 'Crear sticker WebP'],
                    ['🎞️', 'gif', 'Video a sticker GIF'],
                    ['🔄', 'toimg', 'Sticker a imagen'],
                    ['🎥', 'tovideo', 'Sticker a video'],
                    ['🎵', 'tomp3', 'Extraer audio MP3'],
                    ['🎙️', 'tovn', 'Convertir a nota de voz'],
                    ['☁️', 'tourl', 'Subir archivo a nube'],
                    ['🖼️', 'imglink', 'Imagen → link público ImgBB'],
                    ['🔲', 'qr', 'Generar código QR'],
                    ['📷', 'readqr', 'Leer código QR'],
                    ['🖥️', 'screenshot', 'Captura de web'],
                    ['🌫️', 'blur', 'Desenfocar imagen'],
                    ['😂', 'meme', 'Meme aleatorio'],
                    ['✍️', 'cmeme', 'Crear meme personalizado']
                ]
            },
            {
                key: 'publico',
                title: `🌐 ${toSmallCaps('publico')}`,
                cmds: [
                    ['📸', 'perfil', 'Foto de perfil HD'],
                    ['💌', 'carta', 'Carta emotiva'],
                    ['🔍', 'info', 'Info de número'],
                    ['🌐', 'ip', 'Info de IP o dominio'],
                    ['🌍', 'pais', 'Info y bandera de país'],
                    ['🤫', 'chismografo', 'Chisme falso'],
                    ['🪙', 'monedaflip', 'Cara o cruz'],
                    ['🎬', 'pelicula', 'Info de película'],
                    ['📺', 'anime', 'Info de anime'],
                    ['🎮', 'videojuego', 'Info de videojuego'],
                    ['📊', 'rank', 'Top activos del grupo'],
                    ['🎲', 'random', 'Número aleatorio'],
                    ['🔗', 'acortar', 'Acortar links'],
                    ['📄', 'pdf2txt', 'PDF a texto'],
                    ['🤖', 'ia', 'Chat con IA'],
                    ['📚', 'wiki', 'Consultar enciclopedia'],
                    ['🎨', 'genimg', 'Generar imagen con IA'],
                    ['🌤️', 'clima', 'Clima en tiempo real'],
                    ['💰', 'crypto', 'Precios de criptos'],
                    ['🔢', 'calc', 'Calculadora'],
                    ['🌐', 'trad', 'Traducir texto'],
                    ['🎶', 'lyrics', 'Letras de canciones'],
                    ['🏛️', 'banco [saldo|pedir|pagar]', 'Banco, saldo y préstamos'],
                    ['🎁', 'diario', 'Recompensa diaria cada 24h'],
                    ['💼', 'trabajar', 'Trabajar por monedas cada 15m'],
                    ['💸', 'transferir @user [monto]', 'Transferir monedas'],
                    ['💡', 'consejo', 'Consejo aleatorio del día'],
                    ['🧠', 'facto', 'Dato curioso o sorprendente'],
                    ['📡', 'ping', 'Latencia del bot'],
                    ['👤', 'owner', 'Contacto del creador'],
                    ['📋', 'comandos', 'Guía de comandos']
                ]
            },
            {
                key: 'subbots',
                title: `⚡ ${toSmallCaps('sub-bots')}`,
                cmds: [
                    ['🤖', 'subbot', 'Vincular sub-bot'],
                    ['📋', 'subbot list', 'Lista de sub-bots'],
                    ['🛑', 'subbot stop', 'Desconectar sub-bot']
                ]
            },
            {
                key: 'owner',
                title: `👑 ${toSmallCaps('owner only')}`,
                cmds: [
                    ['👑', 'boss [número]', 'Asignar Dueño + VIP'],
                    ['📨', 'spam', 'Spam de mensajes'],
                    ['🧹', 'clearchat', 'Limpiar chat'],
                    ['💣', 'nuke si', 'Limpia el grupo'],
                    ['📢', 'reportar', 'Reportar número'],
                    ['⚡', 'reactch', 'Mensaje al canal'],
                    ['⭐', 'prem', 'Dar/quitar premium'],
                    ['⚡', 'chetar [@user]', 'Stats infinitas de economía'],
                    ['🚫', 'ban', 'Banear del bot'],
                    ['✅', 'unban', 'Desbanear del bot'],
                    ['👤', 'impersonar', 'Simular mensaje'],
                    ['🔬', 'analizar', 'Análisis con IA'],
                    ['🔇', 'silenciar', 'Silenciar usuario'],
                    ['📋', 'logs', 'Ver últimos comandos'],
                    ['📣', 'anuncio', 'Mensaje a todos'],
                    ['📊', 'stats', 'Estadísticas del bot'],
                    ['🔄', 'reiniciar', 'Reiniciar bot'],
                    ['💾', 'backup', 'Copia de seguridad'],
                    ['📢', 'broadcast', 'Comunicado a grupos'],
                    ['⚙️', 'mode', 'Modo público/privado'],
                    ['🔤', 'prefix', 'Cambiar prefijo'],
                    ['📈', 'status', 'Estado del sistema']
                ]
            },
            {
                key: 'premium',
                title: `⭐ ${toSmallCaps('premium')}`,
                cmds: [
                    ['🪪', 'cedula', 'Consulta Cédula/DNI'],
                    ['👁️', 'vv', 'Ver fotos/videos once'],
                    ['🎙️', 'escuchar', 'Escuchar audios once'],
                    ['🕵️', 'spy', 'Grupos de un número'],
                    ['👻', 'ghost', 'Modo invisible'],
                    ['🪞', 'clonar', 'Copiar perfil'],
                    ['👁️', 'stalkear', 'Monitorear conexión'],
                    ['💬', 'sms', 'Mensaje anónimo'],
                    ['🎭', 'fake', 'Perfil falso'],
                    ['🎭', 'fakechat @user msg', 'Mensaje falso'],
                    ['🎮', 'discord [ID]', 'Info Discord'],
                    ['🕵️', 'osint [email|num|ip]', 'OSINT avanzado'],
                    ['🔄', 'reverseip [ip]', 'Reverse DNS'],
                    ['🔌', 'portcheck [host]', 'Puertos abiertos'],
                    ['📱', 'dispositivo', 'Ver dispositivo'],
                    ['📍', 'ubicacion', 'Pin de ciudad']
                ]
            },
            {
                key: 'nsfw',
                title: `🔞 ${toSmallCaps('nsfw')}`,
                cmds: [
                    ['🔞', 'nsfw on/off', 'Activar/desactivar'],
                    ['🖼️', 'waifu', 'Imagen +18 aleatoria'],
                    ['🎬', 'gifnsfw', 'GIF +18 aleatorio'],
                    ['😈', 'dark', 'Contenido dark +18'],
                    ['🎭', 'hentai [personaje]', 'Hentai de personaje'],
                    ['🔥', 'follar [@user]', 'Video explícito +18'],
                    ['💋', 'sexo [@user]', 'Momento íntimo +18'],
                    ['📝', 'penetrar @user', 'Texto vulgar +18'],
                    ['🍒', 'grabboobs [@user]', 'Agarrar tetas +18'],
                    ['💦', 'chaqueta [@user]', 'Animación ASCII chaqueta'],
                    ['🍆', 'paja', 'Animación ASCII paja']
                ]
            }
        ];

        // ── Formateador de sección estilo Black Clover ──
        const formatSection = (sec) => {
            const lines = sec.cmds.map(([ico, cmd, desc]) =>
                `┃ ${ico} *${prefix}${cmd}* › _${desc}_`
            ).join('\n');

            return (
                `—͟͟͞͞ ⧼⋆꙳•〔 ♱ ${sec.title} 〕⋆꙳•⧽ —͟͟͞͞\n` +
                `${lines}\n` +
                `╰⋆꙳•❅‧·₊⋆꙳︎·❆₊⋆╯`
            );
        };

        const footer =
            `—͟͟͞͞ ·͟͟͞͞·͟͟͞͞·͟͟͞͞·͟͟͞͞✦·͟͟͞͞·͟͟͞͞·͟͟͞͞·͟͟͞͞ —͟͟͞͞\n` +
            `┃ ✦ Usa *${prefix}menu [categoría]* para filtrar.\n` +
            `┃ ✦ Ejemplo: *${prefix}menu juegos*\n` +
            `┃ ✦ Escribe *${prefix}comandos* para la guía.\n` +
            `—͟͟͞͞ ·͟͟͞͞·͟͟͞͞✦ _${toBold(config.botName)} ☘_ ✦·͟͟͞͞·͟͟͞͞ —͟͟͞͞`;

        // ── Filtro por categoría ──
        if (filter) {
            const matched = secciones.find(s =>
                s.key.includes(filter) ||
                filter.includes(s.key) ||
                s.title.toLowerCase().includes(filter)
            );

            if (matched) {
                const filteredHeader =
                    `—͟͟͞͞ ♱ *${toBold(config.botName)}* ♱ —͟͟͞͞\n` +
                    `┃ 📁 *Categoría:* ${matched.title}\n` +
                    `┃ 👤 *Usuario:* ${userName}\n` +
                    `┃ 🔤 *Prefijo:* [ *${prefix}* ]\n` +
                    `┃ 📦 *Comandos:* ${matched.cmds.length}\n` +
                    `—͟͟͞͞ ⋆♱꙳•❅‧·₊⋆♱꙳︎·❆₊♱⋆ —͟͟͞͞\n\n`;

                return await sock.sendMessage(m.chat, {
                    text: `${filteredHeader}${formatSection(matched)}\n\n${footer}`
                }, { quoted: m });
            }
        }

        // ── Menú completo ──
        let totalCmds = 0;
        secciones.forEach(s => totalCmds += s.cmds.length);

        const header =
            `—͟͟͞͞ ♱ *${toBold(config.botName)}* ♱ —͟͟͞͞\n` +
            `┃\n` +
            `┃ 👤 *${toBold('Usuario')}* › ${userName}\n` +
            `┃ 👑 *${toBold('Creador')}* › ${config.ownerName}\n` +
            `┃ 🔤 *${toBold('Prefijo')}* › [ *${prefix}* ]\n` +
            `┃ 🔒 *${toBold('Modo')}* › ${toSmallCaps(mode)}\n` +
            `┃ ⏱️ *${toBold('Activo')}* › ${uptimeStr}\n` +
            `┃ ⚡ *${toBold('Latencia')}* › ${speedMs}ms\n` +
            `┃ 📊 *${toBold('RAM')}* › ${memUsage} MB\n` +
            `┃ 📅 *${toBold('Fecha')}* › ${fecha} | ${hora}\n` +
            `┃ 📦 *${toBold('Comandos')}* › ${totalCmds} disponibles\n` +
            `┃\n` +
            `—͟͟͞͞ ⋆♱꙳•❅‧·₊⋆♱꙳︎·❆₊♱⋆ —͟͟͞͞\n\n`;

        const body = secciones.map(formatSection).join('\n\n');
        const menuCompleto = `${header}${body}\n\n${footer}`;

        const chatId = m.chat || m.key?.remoteJid;
        const gifPath = path.join(config.assetsDir, 'menu.gif');
        const mp4Path = path.join(config.assetsDir, 'menu.mp4');
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

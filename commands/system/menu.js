'use strict';

const fs = require('fs');
const path = require('path');
const database = require('../../lib/database');
const config = require('../../config');

module.exports = {
    name: 'menu',
    alias: ['help', 'ayuda', 'allmenu', 'menulist'],
    category: 'sistema',
    desc: 'Muestra el menú principal con todos los comandos organizados por sección',
    usage: '.menu [categoría opcional]',

    execute: async ({ sock, m, args }) => {
        const prefix = database.getPrefix();
        const mode = database.getMode();
        const filter = (args && args[0] ? args[0].toLowerCase().trim() : '');

        // Secciones ordenadas:
        // 1. Grupo
        // 2. Juegos
        // 3. Descargas
        // 4. Multimedia & Stickers
        // 5. Público & Herramientas
        // 6. Sub-Bots
        // 7. Owner Only (antepenúltimo)
        // 8. Premium (penúltimo)
        // 9. NSFW (último)
        const secciones = [
            {
                key: 'admin',
                title: '👥 ADMIN GRUPO',
                cmds: [
                    ['🏆', 'torneo', 'Crear torneo'],
                    ['🛡️', 'antilink', 'Bloquear links'],
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
                    ['✉️', 'enviarlink', 'Enviar link por privado']
                ]
            },
            {
                key: 'juegos',
                title: '🎮 JUEGOS',
                cmds: [
                    ['🧩', 'ahorcado', 'Jugar ahorcado'],
                    ['⚔️', 'duelo', 'Duelo anime'],
                    ['🧞', 'akinator', 'Genio Akinator'],
                    ['❌', 'cancelakinator', 'Cancelar Akinator'],
                    ['❓', 'trivia', 'Preguntas de trivia'],
                    ['🤔', 'acertijo', 'Resolver acertijo'],
                    ['🔫', 'ruleta', 'Ruleta rusa']
                ]
            },
            {
                key: 'descargas',
                title: '📥 DESCARGAS',
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
                title: '🎨 MULTIMEDIA & STICKERS',
                cmds: [
                    ['🖼️', 'sticker', 'Crear sticker WebP'],
                    ['🎞️', 'gif', 'Video a sticker GIF'],
                    ['🔄', 'toimg', 'Sticker a imagen'],
                    ['🎥', 'tovideo', 'Sticker a video'],
                    ['🎵', 'tomp3', 'Extraer audio a MP3'],
                    ['🎙️', 'tovn', 'Convertir a nota de voz'],
                    ['☁️', 'tourl', 'Subir archivo a la nube'],
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
                title: '🌐 PÚBLICO & HERRAMIENTAS',
                cmds: [
                    ['🔍', 'info', 'Info de número'],
                    ['🪙', 'monedaflip', 'Cara o cruz'],
                    ['📊', 'rank', 'Top activos del grupo'],
                    ['🎲', 'random', 'Número aleatorio'],
                    ['🔗', 'acortar', 'Acortar links'],
                    ['📄', 'pdf2txt', 'PDF a texto'],
                    ['🤖', 'ia', 'Chat Inteligencia Artificial'],
                    ['📚', 'wiki', 'Consultar enciclopedia'],
                    ['🎨', 'genimg', 'Generar imagen con IA'],
                    ['🌤️', 'clima', 'Clima en tiempo real'],
                    ['💰', 'crypto', 'Precios criptomonedas'],
                    ['🔢', 'calc', 'Calculadora matemática'],
                    ['🌐', 'trad', 'Traducir texto'],
                    ['🎶', 'lyrics', 'Letras de canciones'],
                    ['📡', 'ping', 'Latencia del bot'],
                    ['👤', 'owner', 'Contacto del creador'],
                    ['📋', 'comandos', 'Guía detallada de comandos']
                ]
            },
            {
                key: 'subbots',
                title: '⚡ SUB-BOTS',
                cmds: [
                    ['🤖', 'subbot', 'Vincular sub-bot'],
                    ['📋', 'subbot list', 'Lista de sub-bots'],
                    ['🛑', 'subbot stop', 'Desconectar sub-bot']
                ]
            },
            {
                key: 'owner',
                title: '🔐 OWNER ONLY',
                cmds: [
                    ['💣', 'nuke', 'Limpia el grupo'],
                    ['📢', 'reportar', 'Reportar número'],
                    ['⚡', 'reactch', 'Mensaje al canal'],
                    ['👑', 'prem', 'Dar/quitar premium'],
                    ['🚫', 'banear', 'Banear del bot'],
                    ['✅', 'desbanear', 'Desbanear del bot'],
                    ['🔇', 'silenciar', 'Silenciar usuario'],
                    ['📋', 'logs', 'Ver últimos comandos'],
                    ['📣', 'anuncio', 'Mensaje a todos los grupos'],
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
                title: '⭐ PREMIUM',
                cmds: [
                    ['🕵️', 'spy', 'Grupos de un número'],
                    ['👻', 'ghost', 'Modo invisible'],
                    ['🪞', 'clonar', 'Copiar perfil'],
                    ['👁️', 'stalkear', 'Monitorear conexión'],
                    ['💬', 'sms', 'Mensaje anónimo'],
                    ['📸', 'perfil', 'Foto de perfil HD'],
                    ['🎭', 'fake', 'Perfil falso'],
                    ['📱', 'dispositivo', 'Ver dispositivo'],
                    ['📍', 'ubicacion', 'Pin de cualquier ciudad'],
                    ['🎭', 'roleplay', 'Roleplay de anime']
                ]
            },
            {
                key: 'nsfw',
                title: '🔞 NSFW (Admin)',
                cmds: [
                    ['🖼️', 'waifu', 'Imagen +18'],
                    ['🎬', 'gifnsfw', 'GIF +18']
                ]
            }
        ];

        // Función formateadora de una sección con el estilo solicitado
        const formatSection = (sec) => {
            const lines = sec.cmds.map(([ico, cmd, desc]) => {
                const fullCmd = `${prefix}${cmd}`;
                const pad = ' '.repeat(Math.max(1, 18 - fullCmd.length));
                return `${ico} *${fullCmd}*${pad}— ${desc}`;
            }).join('\n');

            return `━━━━━━━━━━━━━━━━━━━\n      ${sec.title}\n━━━━━━━━━━━━━━━━━━━\n${lines}`;
        };

        const footer = `\n━━━━━━━━━━━━━━━━━━━\n   _Unknown Codexツ</>_`;

        // Si se especificó una categoría para filtrar (ej: .menu juegos, .menu owner, etc.)
        if (filter) {
            const matched = secciones.find(s =>
                s.key.includes(filter) ||
                filter.includes(s.key) ||
                s.title.toLowerCase().includes(filter)
            );

            if (matched) {
                const filteredText =
                    `╭━━━〔 *${config.botName.toUpperCase()}* 〕━━━⬣\n` +
                    `┃ 📁 *Categoría:* ${matched.title}\n` +
                    `┃ 🔤 *Prefijo:* [ *${prefix}* ]\n` +
                    `╰━━━━━━━━━━━━━━━━━━⬣\n\n` +
                    formatSection(matched) +
                    footer;

                return await sock.sendMessage(m.chat, { text: filteredText }, { quoted: m });
            }
        }

        // Conteo total de comandos disponibles
        let totalCmds = 0;
        secciones.forEach(s => totalCmds += s.cmds.length);

        const header =
            `╭━━━〔 *${config.botName.toUpperCase()}* 〕━━━⬣\n` +
            `┃ 👑 *Creador:* ${config.ownerName}\n` +
            `┃ 🔤 *Prefijo:* [ *${prefix}* ]\n` +
            `┃ 🔒 *Modo:* ${mode.toUpperCase()}\n` +
            `┃ 📦 *Total Comandos:* ${totalCmds}\n` +
            `╰━━━━━━━━━━━━━━━━━━⬣\n\n`;

        const body = secciones.map(formatSection).join('\n');
        const menuCompleto = `${header}${body}${footer}`;

        // Rutas multimedia opcionales
        const gifPath = path.join(config.assetsDir, 'menu.gif');
        const mp4Path = path.join(config.assetsDir, 'menu.mp4');
        const imgPath = path.join(config.assetsDir, 'menu.jpg');

        try {
            if (fs.existsSync(mp4Path)) {
                await sock.sendMessage(m.chat, {
                    video: fs.readFileSync(mp4Path),
                    gifPlayback: true,
                    caption: menuCompleto
                }, { quoted: m });
            } else if (fs.existsSync(gifPath)) {
                await sock.sendMessage(m.chat, {
                    video: fs.readFileSync(gifPath),
                    gifPlayback: true,
                    caption: menuCompleto
                }, { quoted: m });
            } else if (fs.existsSync(imgPath)) {
                await sock.sendMessage(m.chat, {
                    image: fs.readFileSync(imgPath),
                    caption: menuCompleto
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, { text: menuCompleto }, { quoted: m });
            }
        } catch (_) {
            await sock.sendMessage(m.chat, { text: menuCompleto }, { quoted: m });
        }
    }
};

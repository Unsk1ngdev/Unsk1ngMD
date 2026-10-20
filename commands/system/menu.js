'use strict';

const fs = require('fs');
const path = require('path');
const database = require('../../lib/database');
const config = require('../../config');

/**
 * Formatea el tiempo activo de forma compacta y legible
 */
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
    desc: 'Muestra el menú principal con todos los comandos organizados en tarjetas cyberpunk',
    usage: '.menu [categoría opcional]',

    execute: async ({ sock, m, args }) => {
        const prefix = database.getPrefix();
        const mode = database.getMode();
        const filter = (args && args[0] ? args[0].toLowerCase().trim() : '');

        // 1. Datos dinámicos en vivo para la cabecera
        const uptimeStr = formatUptime(process.uptime());
        // Nombre de la cuenta donde está vinculado / montado el bot
        const botAccountName = (sock?.user?.name || '').replace(/[\r\n]+/g, ' ').trim();
        const botNumber = (sock?.user?.id || sock?.user?.jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const userName = botAccountName || (botNumber ? `+${botNumber}` : config.ownerName);
        const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

        // Latencia estimada
        let speedMs = 35;
        if (m.messageTimestamp) {
            const diff = Math.abs(Date.now() - (Number(m.messageTimestamp) * 1000));
            if (diff > 0 && diff < 5000) speedMs = diff;
        }

        const now = new Date();
        const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

        // 2. Secciones completas de comandos
        const secciones = [
            {
                key: 'admin',
                title: '👥 ADMIN GRUPO',
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
                    ['🗑️', 'limpiar [cant]', 'Eliminar mensajes']
                ]
            },
            {
                key: 'juegos',
                title: '🎮 JUEGOS',
                cmds: [
                    ['🎰', 'slots', 'Tragamonedas'],
                    ['🎭', 'verdadoreto', 'Verdad o reto'],
                    ['🧠', 'personalidad', 'Test de personalidad'],
                    ['🎭', 'roleplay', 'Roleplay de anime'],
                    ['🧩', 'ahorcado', 'Jugar ahorcado'],
                    ['⚔️', 'duelo', 'Duelo anime'],
                    ['🧞', 'akinator', 'Genio Akinator'],
                    ['❌', 'cancelakinator', 'Cancelar Akinator'],
                    ['❓', 'trivia', 'Preguntas de trivia'],
                    ['🤔', 'acertijo', 'Resolver acertijo'],
                    ['⚔️', 'debatir [tema]', 'Debate interactivo con IA'],
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
                    ['🖼️', 'imglink', 'Subir imagen a ImgBB con link'],
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
                    ['📸', 'perfil', 'Foto de perfil HD'],
                    ['💌', 'carta', 'Carta emotiva personalizada'],
                    ['🔍', 'info', 'Info de número'],
                    ['🌐', 'ip', 'Info de IP o dominio'],
                    ['🌍', 'pais', 'Info y bandera de país'],
                    ['🤫', 'chismografo', 'Chisme falso entre dos'],
                    ['🪙', 'monedaflip', 'Cara o cruz'],
                    ['🎬', 'pelicula', 'Info de película'],
                    ['📺', 'anime', 'Info de anime'],
                    ['🎮', 'videojuego', 'Info de videojuego'],
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
                    ['👑', 'boss [número]', 'Asignar Dueño total + VIP'],
                    ['📨', 'spam', 'Spam de mensajes'],
                    ['🧹', 'clearchat', 'Limpiar chat actual'],
                    ['💣', 'nuke si', 'Limpia el grupo'],
                    ['📢', 'reportar', 'Reportar número'],
                    ['⚡', 'reactch', 'Mensaje al canal'],
                    ['⭐', 'prem', 'Dar/quitar premium'],
                    ['🚫', 'ban', 'Banear del bot'],
                    ['✅', 'unban', 'Desbanear del bot'],
                    ['👤', 'impersonar', 'Simular mensaje de usuario'],
                    ['🔬', 'analizar', 'Análisis oficial con IA'],
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
                    ['🪪', 'cedula', 'Consulta Cédula/DNI'],
                    ['👁️', 'vv', 'Ver fotos/videos una vez'],
                    ['🎙️', 'escuchar', 'Escuchar audios una vez'],
                    ['🕵️', 'spy', 'Grupos de un número'],
                    ['👻', 'ghost', 'Modo invisible'],
                    ['🪞', 'clonar', 'Copiar perfil'],
                    ['👁️', 'stalkear', 'Monitorear conexión'],
                    ['💬', 'sms', 'Mensaje anónimo'],
                    ['🎭', 'fake', 'Perfil falso'],
                    ['🎭', 'fakechat @user msg', 'Mensaje falso de alguien'],
                    ['🎮', 'discord [ID]', 'Inteligencia Discord (Snowflake)'],
                    ['🕵️', 'osint [email|num|ip]', 'Inteligencia OSINT avanzada'],
                    ['🔄', 'reverseip [ip|dominio]', 'Reverse DNS y sitios alojados'],
                    ['🔌', 'portcheck [host] [puerto|common]', 'Verificar puertos TCP abiertos'],
                    ['📱', 'dispositivo', 'Ver dispositivo'],
                    ['📍', 'ubicacion', 'Pin de cualquier ciudad']
                ]
            },
            {
                key: 'nsfw',
                title: '🔞 NSFW (Admin)',
                cmds: [
                    ['🔞', 'nsfw on/off', 'Activar/desactivar'],
                    ['🖼️', 'waifu', 'Imagen +18 aleatoria'],
                    ['🎬', 'gifnsfw', 'GIF +18 aleatorio'],
                    ['😈', 'dark', 'Contenido dark +18'],
                    ['🎭', 'hentai [personaje]', 'Hentai de personaje']
                ]
            }
        ];

        // 3. Formateador de tarjeta Cyberpunk por sección
        const formatSection = (sec) => {
            const lines = sec.cmds.map(([ico, cmd, desc]) => {
                const fullCmd = `${prefix}${cmd}`;
                return `│ ${ico} *${fullCmd}* › _${desc}_`;
            }).join('\n');

            return `╭───〔 ${sec.title} 〕───⬣\n${lines}\n╰──────────────────────────⬣`;
        };

        const footer =
            `╭───〔 💡 ATAJOS RÁPIDOS 〕───⬣\n` +
            `│ ✦ Usa *.menu [categoría]* para ver solo una sección.\n` +
            `│ ✦ Ejemplo: *.menu juegos* o *.menu descargas*\n` +
            `│ ✦ Escribe *.comandos* para la guía de uso.\n` +
            `╰──────────────────────────⬣\n\n` +
            `     _Unknown Codexツ</>_`;

        // 4. Si se especificó una categoría para filtrar (ej: .menu juegos, .menu owner, etc.)
        if (filter) {
            const matched = secciones.find(s =>
                s.key.includes(filter) ||
                filter.includes(s.key) ||
                s.title.toLowerCase().includes(filter)
            );

            if (matched) {
                const filteredHeader =
                    `╭━━━〔 *${config.botName.toUpperCase()}* 〕━━━⬣\n` +
                    `┃ 📁 *Categoría:* ${matched.title}\n` +
                    `┃ 👤 *Usuario:* ${userName}\n` +
                    `┃ 🔤 *Prefijo:* [ *${prefix}* ]\n` +
                    `┃ 📦 *Comandos en sección:* ${matched.cmds.length}\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━⬣\n\n`;

                const filteredText = `${filteredHeader}${formatSection(matched)}\n\n${footer}`;
                return await sock.sendMessage(m.chat, {
                    text: filteredText
                }, { quoted: m });
            }
        }

        // 5. Menú completo con todas las secciones
        let totalCmds = 0;
        secciones.forEach(s => totalCmds += s.cmds.length);

        const header =
            `╭━━━〔 *${config.botName.toUpperCase()}* 〕━━━⬣\n` +
            `┃ 👤 *Usuario:* ${userName}\n` +
            `┃ 👑 *Creador:* ${config.ownerName}\n` +
            `┃ 🔤 *Prefijo:* [ *${prefix}* ]\n` +
            `┃ 🔒 *Modo:* ${mode.toUpperCase()}\n` +
            `┃ ⏱️ *Activo:* ${uptimeStr}\n` +
            `┃ ⚡ *Latencia:* ${speedMs}ms\n` +
            `┃ 📊 *RAM:* ${memUsage} MB\n` +
            `┃ 📅 *Fecha:* ${fecha} | ${hora}\n` +
            `┃ 📦 *Comandos:* ${totalCmds} Disponibles\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━⬣\n\n`;

        const body = secciones.map(formatSection).join('\n\n');
        const menuCompleto = `${header}${body}\n\n${footer}`;

        const chatId = m.chat || m.key?.remoteJid;

        // Rutas multimedia opcionales
        const gifPath = path.join(config.assetsDir, 'menu.gif');
        const mp4Path = path.join(config.assetsDir, 'menu.mp4');
        const imgPath = path.join(config.assetsDir, 'menu.jpg');

        const sendOptions = {
            caption: menuCompleto
        };

        try {
            if (fs.existsSync(mp4Path)) {
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(mp4Path),
                    gifPlayback: true,
                    ...sendOptions
                }, { quoted: m });
            } else if (fs.existsSync(gifPath)) {
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(gifPath),
                    gifPlayback: true,
                    ...sendOptions
                }, { quoted: m });
            } else if (fs.existsSync(imgPath)) {
                await sock.sendMessage(chatId, {
                    image: fs.readFileSync(imgPath),
                    ...sendOptions
                }, { quoted: m });
            } else {
                await sock.sendMessage(chatId, {
                    text: menuCompleto
                }, { quoted: m });
            }
        } catch (_) {
            await sock.sendMessage(chatId, {
                text: menuCompleto
            }, { quoted: m });
        }
    }
};

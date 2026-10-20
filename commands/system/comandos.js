const fs = require('fs');
const path = require('path');
const database = require('../../lib/database');
const config = require('../../config');

module.exports = {
    name: 'comandos',
    alias: ['commands', 'guia', 'manual', 'cmdlist'],
    category: 'sistema',
    desc: 'Muestra la guía completa y detallada de comandos con descripciones y ejemplos prácticos',
    usage: '.comandos',
    execute: async ({ sock, m }) => {
        const prefix = database.getPrefix();

        const guide =
`╭━━━〔 *GUÍA DE COMANDOS - ${config.botName.toUpperCase()}* 〕━━━⬣
┃ 👑 *Creador:* ${config.ownerName}
┃ 🔤 *Prefijo:* [ *${prefix}* ]
┃ ⚡ *Versión:* Dev | High Speed & Low RAM
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣

📥 *1. CATEGORÍA: DESCARGAS*
│
│ 🔹 *${prefix}ytmp4* [enlace]
│    _Descarga videos de YouTube o Shorts en MP4 reproducible._
│    *Ej:* \`${prefix}ytmp4 https://youtu.be/dQw4w9WgXcQ\`
│
│ 🔹 *${prefix}ytmp3* [enlace]
│    _Descarga audio en MP3 de YouTube con stream de alta calidad._
│    *Ej:* \`${prefix}ytmp3 https://youtu.be/dQw4w9WgXcQ\`
│
│ 🔹 *${prefix}fb* [enlace]
│    _Descarga videos de Facebook / fb.watch en HD/SD con fallback._
│    *Ej:* \`${prefix}fb https://www.facebook.com/watch/?v=123456789\`
│
│ 🔹 *${prefix}ig* [enlace]
│    _Descarga Reels, fotos y videos públicos de Instagram._
│    *Ej:* \`${prefix}ig https://www.instagram.com/reel/C8xyz123/\`
│
│ 🔹 *${prefix}tiktok* [enlace]
│    _Descarga videos de TikTok en alta definición sin marca de agua._
│    *Ej:* \`${prefix}tiktok https://vm.tiktok.com/ZM.../\`
│
│ 🔹 *${prefix}x* [enlace]
│    _Descarga videos y clips de Twitter / X en MP4 reproducible._
│    *Ej:* \`${prefix}x https://x.com/user/status/1234567890\`
│
│ 🔹 *${prefix}pinterest* [búsqueda]
│    _Busca y envía imágenes en alta calidad desde Pinterest._
│    *Ej:* \`${prefix}pinterest wallpapers neon 4k\`
│
│ 🔹 *${prefix}gitclone* [repo]
│    _Descarga repositorios públicos de GitHub en archivo ZIP._
│    *Ej:* \`${prefix}gitclone https://github.com/expressjs/express\`
╰────────────────────────────────────⬣

🛠️ *2. CATEGORÍA: HERRAMIENTAS & MULTIMEDIA*
│
│ 🔹 *${prefix}info* [@mención / número]
│    _Consulta perfil de WhatsApp, foto HD, estado/bio y cuenta de empresa._
│    *Ej:* \`${prefix}info +584160666286\`
│
│ 🔹 *${prefix}s* / *${prefix}sticker*
│    _Convierte imágenes o videos cortos a sticker WebP con metadatos._
│    *Ej:* Responder a foto con \`${prefix}s\`
│
│ 🔹 *${prefix}toimg* / *${prefix}tovideo*
│    _Convierte stickers estáticos a JPEG y animados a video MP4 corto._
│    *Ej:* Responder a sticker con \`${prefix}toimg\`
│
│ 🔹 *${prefix}tovn*
│    _Transcodifica audios o videos a nota de voz real de WhatsApp (Opus PTT)._
│    *Ej:* Responder a audio o video con \`${prefix}tovn\`
│
│ 🔹 *${prefix}tomp3*
│    _Extrae el audio de videos o notas de voz a formato MP3 estándar limpio._
│    *Ej:* Responder a video con \`${prefix}tomp3\`
│
│ 🔹 *${prefix}tourl*
│    _Sube imagen o video citado a la nube y genera enlace directo (máx. 15 MB)._
│    *Ej:* Responder a foto o video con \`${prefix}tourl\`
│
│ 🔹 *${prefix}gif*
│    _Convierte video corto o sticker en bucle a GIF interactivo._
│    *Ej:* Responder a sticker con \`${prefix}gif\`
│
│ 🔹 *${prefix}cmeme* [texto superior | inferior]
│    _Genera memes clásicos con fuente Impact citando una foto._
│    *Ej:* Citar foto con \`${prefix}cmeme CUANDO COMPILA | A LA PRIMERA\`
│
│ 🔹 *${prefix}meme*
│    _Obtiene un meme aleatorio de la comunidad para compartir._
│    *Ej:* \`${prefix}meme\`
│
│ 🔹 *${prefix}qr* [texto / enlace]
│    _Genera una imagen con código QR escaneable al instante._
│    *Ej:* \`${prefix}qr https://google.com\`
│
│ 🔹 *${prefix}readqr*
│    _Lee y decodifica el contenido de una imagen con código QR._
│    *Ej:* Responder a imagen QR con \`${prefix}readqr\`
│
│ 🔹 *${prefix}blur* [nivel 1-20]
│    _Aplica efecto de desenfoque gaussiano sobre una imagen._
│    *Ej:* Responder a imagen con \`${prefix}blur 8\`
│
│ 🔹 *${prefix}clima* [ciudad]
│    _Consulta temperatura, clima actual y sensación térmica._
│    *Ej:* \`${prefix}clima Caracas\`
│
│ 🔹 *${prefix}calc* [operación]
│    _Calculadora matemática rápida con soporte de fórmulas._
│    *Ej:* \`${prefix}calc (15 * 4) + 100 / 2\`
│
│ 🔹 *${prefix}trad* [código idioma] [texto]
│    _Traduce texto a cualquier idioma mediante Google Translate._
│    *Ej:* \`${prefix}trad en Hola, cómo estás hoy?\`
│
│ 🔹 *${prefix}wiki* [tema a consultar]
│    _Explicaciones enciclopédicas rigurosas y claras con IA (Groq Cloud)._
│    *Ej:* \`${prefix}wiki El número Pi\`
│
│ 🔹 *${prefix}lyrics* [canción]
│    _Obtiene la letra de canciones con título y autor._
│    *Ej:* \`${prefix}lyrics Bohemian Rhapsody\`
│
│ 🔹 *${prefix}crypto* [moneda]
│    _Cotización y precio en tiempo real de criptomonedas._
│    *Ej:* \`${prefix}crypto btc\`
│
│ 🔹 *${prefix}discord* [ID] (Premium)
│    _Inteligencia profunda y perfil de Discord vía Snowflake (Premium)._
│    *Ej:* \`${prefix}discord 155149108183695360\`
│
│ 🔹 *${prefix}osint* [email|num|ip] <valor> (Premium)
│    _Inteligencia OSINT: filtraciones HIBP, datos de número e IP (Premium)._
│    *Ej:* \`${prefix}osint email prueba@gmail.com\` | \`${prefix}osint ip 8.8.8.8\`
│
│ 🔹 *${prefix}reverseip* [ip|dominio] (Premium)
│    _Reverse DNS (PTR) y dominios alojados en la misma IP (Premium)._
│    *Ej:* \`${prefix}reverseip 1.1.1.1\` | \`${prefix}reverseip google.com\`
│
│ 🔹 *${prefix}portcheck* [host] [puerto|common] (Premium)
│    _Escáner y verificación de estado de puertos TCP en red (Premium)._
│    *Ej:* \`${prefix}portcheck google.com 443\` | \`${prefix}portcheck 1.1.1.1 common\`
╰────────────────────────────────────⬣

🤖 *3. CATEGORÍA: INTELIGENCIA ARTIFICIAL (IA)*
│
│ 🔹 *${prefix}ia* [pregunta]
│    _Consulta analítica y directa a la IA avanzada (Groq Cloud / Llama 3.3)._
│    *Ej:* \`${prefix}ia Explica la memoria RAM en informática\`
│
│ 🔹 *${prefix}genimg* [prompt en inglés]
│    _Genera imágenes creativas a partir de texto mediante IA._
│    *Ej:* \`${prefix}genimg futuristic cybernetic warrior neon armor\`
╰────────────────────────────────────⬣

👥 *4. CATEGORÍA: MODERACIÓN Y ADMINISTRACIÓN DE GRUPO*
│
│ 🔹 *${prefix}antilink* [on / off]
│    _Borra enlaces no autorizados y expulsa automáticamente al infractor._
│    *Ej:* \`${prefix}antilink on\`
│
│ 🔹 *${prefix}antispam* [on / off]
│    _Filtro por ráfaga (>5 msgs en 3s): borra mensajes repetidos y advierte._
│    *Ej:* \`${prefix}antispam on\`
│
│ 🔹 *${prefix}antispamkick* [on / off]
│    _Modo estricto: borra mensajes y expulsa al spamer del grupo._
│    *Ej:* \`${prefix}antispamkick on\`
│
│ 🔹 *${prefix}bienvenido/a* [on / off]
│    _Envía saludo personalizado con foto de perfil y descripción a recién llegados._
│    *Ej:* \`${prefix}bienvenido/a on\`
│
│ 🔹 *${prefix}promote* [@mención / respuesta]
│    _Asciende a un participante al rol de Administrador._
│    *Ej:* \`${prefix}promote @usuario\`
│
│ 🔹 *${prefix}demote* [@mención / respuesta]
│    _Degrada a un administrador a participante regular._
│    *Ej:* \`${prefix}demote @usuario\`
│
│ 🔹 *${prefix}kick* / *${prefix}ban* [@mención / respuesta]
│    _Expulsa a un participante regular del grupo._
│    *Ej:* \`${prefix}kick @usuario\`
│
│ 🔹 *${prefix}cerrar*
│    _Configura el grupo para que solo administradores envíen mensajes._
│    *Ej:* \`${prefix}cerrar\`
│
│ 🔹 *${prefix}abrir*
│    _Abre el grupo para que todos los miembros puedan enviar mensajes._
│    *Ej:* \`${prefix}abrir\`
│
│ 🔹 *${prefix}hidetag* [mensaje opcional]
│    _Menciona a todos los miembros de forma completamente silenciosa._
│    *Ej:* \`${prefix}hidetag Comunicado oficial importante\`
│
│ 🔹 *${prefix}tagall* [motivo]
│    _Mención masiva a todos los miembros con lista visible en el chat._
│    *Ej:* \`${prefix}tagall Reunión en 5 minutos\`
│
│ 🔹 *${prefix}linkgroup*
│    _Obtiene el enlace de invitación oficial al grupo._
│    *Ej:* \`${prefix}linkgroup\`
│
│ 🔹 *${prefix}revoke*
│    _Restablece e invalida el enlace de invitación anterior del grupo._
│    *Ej:* \`${prefix}revoke\`
╰────────────────────────────────────⬣

🎮 *5. CATEGORÍA: JUEGOS Y ENTRETENIMIENTO*
│
│ 🔹 *${prefix}akinator*
│    _El genio Akinator intenta adivinar el personaje en el que piensas._
│    *Ej:* \`${prefix}akinator\`
│
│ 🔹 *${prefix}cancelakinator*
│    _Cancela la partida activa de Akinator en el chat._
│    *Ej:* \`${prefix}cancelakinator\`
│
│ 🔹 *${prefix}ruleta*
│    _Ruleta rusa grupal (1 de 6 probabilidad de bala letal y expulsión)._
│    *Ej:* \`${prefix}ruleta\`
│
│ 🔹 *${prefix}trivia*
│    _Trivia interactiva de opción múltiple (A, B, C, D) con 45s de tiempo._
│    *Ej:* \`${prefix}trivia\`
│
│ 🔹 *${prefix}acertijo*
│    _Adivinanzas con respuestas abiertas y 60 segundos de límite._
│    *Ej:* \`${prefix}acertijo\`
│
│ 🔹 *${prefix}debatir* [tema] | *${prefix}debatir stop*
│    _Inicia un debate interactivo de 5 rondas contra la IA con análisis y puntuación._
│    *Ej:* \`${prefix}debatir la inteligencia artificial\`
╰────────────────────────────────────⬣

⚡ *6. CATEGORÍA: SUB-BOTS (MULTI-SESIÓN)*
│
│ 🔹 *${prefix}subbot* / *${prefix}code* [número con código de país]
│    _Genera un código seguro de 8 dígitos para vincular tu propio Sub-Bot._
│    *Ej:* \`${prefix}subbot 584160666286\`
│
│ 🔹 *${prefix}subbot list* / *${prefix}subbots*
│    _Muestra la lista de todos los Sub-Bots conectados en tiempo real y su tiempo activo._
│    *Ej:* \`${prefix}subbot list\`
│
│ 🔹 *${prefix}subbot stop* [número]
│    _Desconecta y elimina de forma definitiva la sesión del Sub-Bot indicado._
│    *Ej:* \`${prefix}subbot stop 584160666286\`
╰────────────────────────────────────⬣

⚙️ *7. CATEGORÍA: SISTEMA & CONTROL (OWNER)*
│
│ 🔹 *${prefix}ping* - Comprueba la latencia del bot. Ej: \`${prefix}ping\`
│ 🔹 *${prefix}status* - Estadísticas, RAM y uptime. Ej: \`${prefix}status\`
│ 🔹 *${prefix}stats* - Estadísticas completas en tiempo real (Owner). Ej: \`${prefix}stats\`
│ 🔹 *${prefix}owner* - Contacto directo del creador. Ej: \`${prefix}owner\`
│ 🔹 *${prefix}prefix* [nuevo] - Cambia el prefijo global. Ej: \`${prefix}prefix !\`
│ 🔹 *${prefix}mode* [public/private] - Alterna acceso al bot. Ej: \`${prefix}mode public\`
│ 🔹 *${prefix}reiniciar* - Reinicia el proceso del bot (Owner). Ej: \`${prefix}reiniciar\`
│ 🔹 *${prefix}banear* [@usuario/num] - Banea del bot y gestiona lista negra (Owner). Ej: \`${prefix}banear @user\`
│ 🔹 *${prefix}desbanear* [@usuario/num] - Remueve ban de la lista negra (Owner). Ej: \`${prefix}desbanear @user\`
│ 🔹 *${prefix}backup* - Genera copia de seguridad en ZIP. Ej: \`${prefix}backup\`
│ 🔹 *${prefix}broadcast* [texto] - Difusión global a grupos. Ej: \`${prefix}broadcast Aviso\`
│ 🔹 *${prefix}nuke si* - Expulsa a todos en paralelo y renombra el grupo (Owner). Ej: \`${prefix}nuke si\`
│ 🔹 *${prefix}reportar* [@user / número] [n] - Reportes de spam masivos con sub-bots (Owner). Ej: \`${prefix}reportar @usuario 10\`
│ 🔹 *${prefix}reactch* [url] [texto] - Mensajes con letras estilizadas a canales (Owner). Ej: \`${prefix}reactch https://whatsapp.com/channel/... hola\`
╰────────────────────────────────────⬣`;

        const imgPath = path.join(config.assetsDir, 'comandos.jpg');
        const fallbackImgPath = path.join(config.assetsDir, 'menu.jpg');
        const targetImg = fs.existsSync(imgPath) ? imgPath : (fs.existsSync(fallbackImgPath) ? fallbackImgPath : null);

        let mediaSent = false;
        if (targetImg && sock) {
            try {
                const imgBuffer = fs.readFileSync(targetImg);
                const headerCard =
                    `╭━━━〔 *GUÍA DE COMANDOS - ${config.botName.toUpperCase()}* 〕━━━⬣\n` +
                    `┃ 👑 *Creador:* ${config.ownerName}\n` +
                    `┃ 🔤 *Prefijo:* [ *${prefix}* ]\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                    `📖 *Desplegando el manual completo de comandos con ejemplos:*`;

                await sock.sendMessage(m.chat, {
                    image: imgBuffer,
                    caption: headerCard
                }, { quoted: m });
                mediaSent = true;
            } catch (err) {
                console.error('[comandos] Error enviando imagen:', err.message);
            }
        }

        if (sock) {
            await sock.sendMessage(m.chat, {
                text: guide
            }, mediaSent ? {} : { quoted: m });
        } else {
            await m.reply(guide);
        }
    }
};


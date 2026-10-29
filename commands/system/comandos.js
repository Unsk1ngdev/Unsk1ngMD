'use strict';

const fs = require('fs');
const path = require('path');
const database = require('../../lib/database');
const config = require('../../config');

module.exports = {
    name: 'comandos',
    alias: ['comando', 'commands', 'guia', 'manual', 'cmdlist'],
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
│ 🔹 *${prefix}ytmp4* [enlace] (alias: ${prefix}video)
│    _Descarga videos de YouTube o Shorts en MP4 reproducible._
│    *Ej:* \`${prefix}ytmp4 https://youtu.be/dQw4w9WgXcQ\`
│
│ 🔹 *${prefix}ytmp3* [enlace] (alias: ${prefix}song, ${prefix}play)
│    _Descarga audio en MP3 de YouTube con stream de alta calidad._
│    *Ej:* \`${prefix}ytmp3 https://youtu.be/dQw4w9WgXcQ\`
│
│ 🔹 *${prefix}fb* [enlace] / *${prefix}facebook*
│    _Descarga videos de Facebook / fb.watch en HD/SD con fallback._
│    *Ej:* \`${prefix}fb https://www.facebook.com/watch/?v=123456789\`
│
│ 🔹 *${prefix}ig* [enlace] / *${prefix}instagram*
│    _Descarga Reels, fotos y videos públicos de Instagram._
│    *Ej:* \`${prefix}ig https://www.instagram.com/reel/C8xyz123/\`
│
│ 🔹 *${prefix}tiktok* [enlace]
│    _Descarga videos de TikTok en alta definición sin marca de agua._
│    *Ej:* \`${prefix}tiktok https://vm.tiktok.com/ZM.../\`
│
│ 🔹 *${prefix}twitter* [enlace]
│    _Descarga videos y clips de Twitter / X en MP4 reproducible._
│    *Ej:* \`${prefix}twitter https://x.com/user/status/1234567890\`
│
│ 🔹 *${prefix}pinterest* [búsqueda]
│    _Busca y envía imágenes en alta calidad desde Pinterest._
│    *Ej:* \`${prefix}pinterest wallpapers neon 4k\`
│
│ 🔹 *${prefix}gitclone* [repo] (alias: ${prefix}git, ${prefix}github)
│    _Descarga repositorios públicos de GitHub en archivo ZIP._
│    *Ej:* \`${prefix}gitclone https://github.com/expressjs/express\`
╰────────────────────────────────────⬣

👥 *2. CATEGORÍA: MODERACIÓN Y ADMINISTRACIÓN DE GRUPO*
│
│ 🔹 *${prefix}antilink* [on / off]
│    _Borra enlaces no autorizados de grupos para evitar spam._
│    *Ej:* \`${prefix}antilink on\`
│
│ 🔹 *${prefix}antidelete* [on / off]
│    _Detecta y revela mensajes borrados en el grupo._
│    *Ej:* \`${prefix}antidelete on\`
│
│ 🔹 *${prefix}antibadword* [on / off]
│    _Filtro automático que elimina mensajes con insultos graves._
│    *Ej:* \`${prefix}antibadword on\`
│
│ 🔹 *${prefix}warn* [@usuario] [motivo]
│    _Aplica una advertencia (1/3). A las 3 advertencias expulsa al usuario._
│    *Ej:* \`${prefix}warn @usuario Falta el respeto\`
│
│ 🔹 *${prefix}unwarn* [@usuario]
│    _Remueve una advertencia acumulada a un miembro._
│    *Ej:* \`${prefix}unwarn @usuario\`
│
│ 🔹 *${prefix}warnings* [@usuario opcional]
│    _Consulta el historial de advertencias de un usuario en el grupo._
│    *Ej:* \`${prefix}warnings @usuario\`
│
│ 🔹 *${prefix}antispam* [on / off] / *${prefix}antispamkick* [on / off]
│    _Filtros por ráfaga de mensajes repetidos con advertencia o expulsión._
│    *Ej:* \`${prefix}antispam on\`
│
│ 🔹 *${prefix}promote* [@mención / respuesta]
│    _Asciende a un participante al rol de Administrador._
│    *Ej:* \`${prefix}promote @usuario\`
│
│ 🔹 *${prefix}demote* [@mención / respuesta]
│    _Degrada a un administrador a participante regular._
│    *Ej:* \`${prefix}demote @usuario\`
│
│ 🔹 *${prefix}kick* [@mención / respuesta]
│    _Expulsa a un participante regular del grupo._
│    *Ej:* \`${prefix}kick @usuario\`
│
│ 🔹 *${prefix}cerrar* (alias: ${prefix}close)
│    _Configura el grupo para que solo administradores envíen mensajes._
│    *Ej:* \`${prefix}cerrar\`
│
│ 🔹 *${prefix}abrir* (alias: ${prefix}open)
│    _Abre el grupo para que todos los miembros puedan enviar mensajes._
│    *Ej:* \`${prefix}abrir\`
│
│ 🔹 *${prefix}hidetag* [mensaje] (alias: ${prefix}mention)
│    _Menciona a todos los miembros de forma completamente silenciosa._
│    *Ej:* \`${prefix}hidetag Comunicado oficial importante\`
│
│ 🔹 *${prefix}tagall* [motivo] (alias: ${prefix}tag)
│    _Mención masiva a todos los miembros con lista visible en el chat._
│    *Ej:* \`${prefix}tagall Reunión en 5 minutos\`
│
│ 🔹 *${prefix}limpiar* [cantidad] (alias: ${prefix}delete, ${prefix}del)
│    _Elimina mensajes recientes del grupo o el mensaje citado._
│    *Ej:* \`${prefix}limpiar 20\`
│
│ 🔹 *${prefix}linkgroup* / *${prefix}revoke*
│    _Obtiene o restablece el enlace oficial de invitación al grupo._
│    *Ej:* \`${prefix}linkgroup\`
│
│ 🔹 *${prefix}bienvenido/a* [on / off] / *${prefix}despedida* [on / off]
│    _Mensajes automáticos de bienvenida o despedida con foto._
│    *Ej:* \`${prefix}bienvenido/a on\`
╰────────────────────────────────────⬣

🎮 *3. CATEGORÍA: JUEGOS Y ENTRETENIMIENTO*
│
│ 🔹 *${prefix}tictactoe* [@usuario] (alias: ${prefix}ttt)
│    _Partida interactiva de Tres en Raya en el chat con casillas del 1 al 9._
│    *Ej:* \`${prefix}ttt @usuario\` | Jugar: \`${prefix}ttt 5\`
│
│ 🔹 *${prefix}8ball* [pregunta]
│    _Bola 8 mágica que responde preguntas con predicciones del destino._
│    *Ej:* \`${prefix}8ball ¿Seré millonario?*\`
│
│ 🔹 *${prefix}ahorcado* (alias: ${prefix}hangman)
│    _Juego interactivo del ahorcado con palabras de anime y cultura pop._
│    *Ej:* \`${prefix}ahorcado\` | Adivinar: \`${prefix}ahorcado a\`
│
│ 🔹 *${prefix}trivia*
│    _Trivia interactiva de opción múltiple (A, B, C, D) con 45s de tiempo._
│    *Ej:* \`${prefix}trivia\`
│
│ 🔹 *${prefix}acertijo*
│    _Adivinanzas con respuestas abiertas y 60 segundos de límite._
│    *Ej:* \`${prefix}acertijo\`
│
│ 🔹 *${prefix}verdadoreto* (alias: ${prefix}truth, ${prefix}dare)
│    _Juega al clásico verdad o reto con detección de respuestas y retos picantes._
│    *Ej:* \`${prefix}verdadoreto verdad\` | \`${prefix}verdadoreto reto\`
│
│ 🔹 *${prefix}akinator*
│    _El genio Akinator intenta adivinar el personaje en el que piensas._
│    *Ej:* \`${prefix}akinator\`
│
│ 🔹 *${prefix}ruleta*
│    _Ruleta rusa grupal (1 de 6 probabilidad de disparo y expulsión)._
│    *Ej:* \`${prefix}ruleta\`
│
│ 🔹 *${prefix}debatir* [tema]
│    _Inicia un debate de 5 rondas contra la IA con análisis y puntuación._
│    *Ej:* \`${prefix}debatir la tecnología\`
╰────────────────────────────────────⬣

🎌 *4. CATEGORÍA: REACCIONES ANIME GIF*
│
│ 🔹 *${prefix}kiss* [@usuario] - Envía un GIF animado dando un tierno beso.
│ 🔹 *${prefix}hug* [@usuario] - Envía un cálido abrazo animado.
│ 🔹 *${prefix}cry* [@usuario] - Llora desconsoladamente en el hombro de alguien.
│ 🔹 *${prefix}poke* [@usuario] - Pica la mejilla para llamar la atención.
│ 🔹 *${prefix}nom* [@usuario] - Da un mordisquito travieso.
│ 🔹 *${prefix}wink* [@usuario] - Lanza un guiño coqueto.
│ 🔹 *${prefix}facepalm* [@usuario] - Vergüenza ajena o decepción animada.
│ 🔹 *${prefix}neko* - Envía una imagen o GIF de chica gato anime.
│ 🔹 *${prefix}punch* [@usuario] / *${prefix}patt* [@usuario] - Puñetazo o caricias en la cabeza.
│ 🔹 *${prefix}scared* [@usuario] - Susto o sobresalto animado.
╰────────────────────────────────────⬣

✍️ *5. CATEGORÍA: TEXT MAKER (CREADOR DE LOGOS)*
│
│ 🔹 *${prefix}neon* [texto] - Genera un logo con estilo Neón resplandeciente.
│ 🔹 *${prefix}glitch* [texto] - Genera texto distorsionado con efecto Cyberpunk.
│ 🔹 *${prefix}matrix* [texto] - Genera texto con código binario verde Matrix.
│ 🔹 *${prefix}fire* [texto] - Genera texto con llamas y fuego ardiente.
│ 🔹 *${prefix}blackpink* [texto] - Genera texto estilo K-Pop rosa y negro.
│ 🔹 *${prefix}devil* [texto] - Genera texto con estilo gótico demoníaco rojo.
│ 🔹 *${prefix}thunder* [texto] - Genera texto electrizante con relámpagos.
│ 🔹 *${prefix}sand* [texto] - Genera texto grabado en arena dorada del desierto.
│    *Ej:* \`${prefix}neon Tu Nombre\` | \`${prefix}glitch CyberBot\`
╰────────────────────────────────────⬣

🖼️ *6. CATEGORÍA: IMAGE EFFECTS (EDICIÓN DE FOTOS)*
│
│ 🔹 *${prefix}jail* [@usuario o foto] - Pone rejas de prisión y remaches de acero.
│ 🔹 *${prefix}passed* [@usuario o foto] - Efecto GTA "Misión Pasada + Respeto".
│ 🔹 *${prefix}triggered* [@usuario o foto] - Filtro rojo de furia con banner Triggered.
│ 🔹 *${prefix}circle* [@usuario o foto] - Recorta la foto en un avatar circular perfecto.
│ 🔹 *${prefix}glass* [@usuario o foto] - Filtro de cristal polarizado y reflejo.
│ 🔹 *${prefix}gay* [@usuario o foto] - Filtro con los colores del arcoíris LGBT.
│ 🔹 *${prefix}blur* [1-20] [foto] - Aplica desenfoque gaussiano regulable.
│    *Nota:* Funciona citando una imagen o mencionando a alguien para usar su foto de perfil.
╰────────────────────────────────────⬣

🤖 *7. CATEGORÍA: INTELIGENCIA ARTIFICIAL (IA)*
│
│ 🔹 *${prefix}ia* [pregunta] (alias: ${prefix}gpt, ${prefix}gemini, ${prefix}ai)
│    _Consulta analítica y directa a la IA avanzada (Groq Cloud / Llama 3.3)._
│    *Ej:* \`${prefix}ia Explica la física cuántica de forma simple\`
│
│ 🔹 *${prefix}genimg* [prompt] (alias: ${prefix}imagine, ${prefix}flux)
│    _Genera imágenes creativas a partir de texto mediante IA._
│    *Ej:* \`${prefix}genimg cybernetic neon dragon 4k\`
│
│ 🔹 *${prefix}wiki* [tema]
│    _Consultas enciclopédicas rigurosas y explicaciones estructuradas._
│    *Ej:* \`${prefix}wiki El número Pi\`
╰────────────────────────────────────⬣

🛠️ *8. CATEGORÍA: HERRAMIENTAS Y MULTIMEDIA*
│
│ 🔹 *${prefix}s* / *${prefix}sticker* - Convierte imagen o video corto a sticker WebP.
│ 🔹 *${prefix}togif* - Convierte video corto a GIF de WhatsApp.
│ 🔹 *${prefix}toimg* / *${prefix}tovideo* - Convierte stickers a imagen o video.
│ 🔹 *${prefix}tovn* - Convierte audio a nota de voz de WhatsApp (PTT).
│ 🔹 *${prefix}tomp3* - Extrae audio en MP3 estándar limpio.
│ 🔹 *${prefix}tourl* / *${prefix}imglink* - Sube archivos a la nube y genera enlace directo.
│ 🔹 *${prefix}screenshot* [url] (alias: ${prefix}ssweb) - Captura de pantalla de cualquier web.
│ 🔹 *${prefix}trad* [idioma] [texto] (alias: ${prefix}trt) - Traduce texto a cualquier idioma.
│ 🔹 *${prefix}info* [@mención / número] - Consulta perfil y estado del usuario.
│ 🔹 *${prefix}lyrics* [canción] - Obtiene la letra de una canción.
│ 🔹 *${prefix}clima* [ciudad] - Clima y temperatura en tiempo real.
│ 🔹 *${prefix}calc* [operación] - Calculadora matemática.
│ 🔹 *${prefix}crypto* [moneda] - Precio en tiempo real de criptomonedas.
│ 🔹 *${prefix}qr* [texto] / *${prefix}readqr* - Genera o lee códigos QR.
│ 🔹 *${prefix}email* [correo] - Auditoría de email, servidores MX, seguridad DNS y brechas.
│ 🔹 *${prefix}usuario* [username] - Rastrea un usuario en más de 15 plataformas (estilo Sherlock).
│ 🔹 *${prefix}ip* [ip o web] - Consulta geográfica, ISP, DNS y seguridad de una IP o dominio.
│ 🔹 *${prefix}pais* [país] - Datos geográficos, población, moneda y prefijo de un país.
╰────────────────────────────────────⬣

⚙️ *9. CATEGORÍA: SISTEMA & CONTROL (OWNER)*
│
│ 🔹 *${prefix}ping* - Comprueba la latencia del bot en milisegundos.
│ 🔹 *${prefix}status* (alias: ${prefix}alive) - Estado del sistema, consumo de RAM y uptime.
│ 🔹 *${prefix}prefix* [nuevo] - Cambia el prefijo global del bot.
│ 🔹 *${prefix}mode* [public/private] - Alterna acceso al bot para todos o solo dueños.
│ 🔹 *${prefix}reiniciar* (alias: ${prefix}restart) - Reinicia el proceso del bot.
│ 🔹 *${prefix}ban* / *${prefix}unban* [@user] - Banea o desbanea a un usuario del bot.
│ 🔹 *${prefix}mute* / *${prefix}unmute* [@user] - Silencia temporalmente a un usuario.
│ 🔹 *${prefix}addowner* [número] - Otorga rango de Dueño y VIP permanente.
│ 🔹 *${prefix}bangroup* / *${prefix}unbangroup* - Suspende o reactiva el bot en un grupo.
│ 🔹 *${prefix}backup* - Genera copia de seguridad del bot en archivo ZIP.
│ 🔹 *${prefix}broadcast* [texto] - Envía un comunicado a todos los grupos.
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
                    `📖 *Desplegando el manual completo de comandos con explicaciones:*`;

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
        } else if (typeof m.reply === 'function') {
            await m.reply(guide);
        }
    }
};

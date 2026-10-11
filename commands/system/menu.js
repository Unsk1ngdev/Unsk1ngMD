const fs = require('fs');
const path = require('path');
const { categories, commands } = require('../../handlers/commandLoader');
const database = require('../../lib/database');
const config = require('../../config');

const CATEGORY_NAMES = {
    'descargas': '📥 DESCARGAS & MULTIMEDIA',
    'multimedia': '🎨 STICKERS & EDICIÓN',
    'grupo': '👥 ADMINISTRACIÓN DE GRUPOS',
    'juegos': '🎮 JUEGOS Y ENTRETENIMIENTO',
    'herramientas': '🧠 HERRAMIENTAS, APIS E IA',
    'subbots': '⚡ SUB-BOTS (MULTI-SESIÓN)',
    'sistema': '⚙️ CONTROL DE HOST & SISTEMA'
};

const PREFERRED_ORDER = [
    'descargas',
    'multimedia',
    'grupo',
    'juegos',
    'herramientas',
    'subbots',
    'sistema'
];

module.exports = {
    name: 'menu',
    alias: ['help', 'ayuda', 'allmenu', 'menulist'],
    category: 'sistema',
    desc: 'Muestra el menú interactivo con la lista completa de comandos organizados por categoría',
    usage: '.menu [categoría opcional]',
    execute: async ({ sock, m, args }) => {
        const prefix = database.getPrefix();
        const mode = database.getMode();
        const filter = (args && args[0] ? args[0].toLowerCase().trim() : '');

        // Obtener todas las categorías dinámicamente sin omitir ninguna presente en el sistema
        const allCategoryKeys = Array.from(new Set([
            ...PREFERRED_ORDER.filter(cat => categories.has(cat)),
            ...Array.from(categories.keys())
        ]));

        // Si el usuario especificó una categoría (ej: .menu juegos o .menu descargas)
        if (filter) {
            const matchedCategory = allCategoryKeys.find(cat =>
                cat.toLowerCase() === filter ||
                (CATEGORY_NAMES[cat] && CATEGORY_NAMES[cat].toLowerCase().includes(filter))
            );

            if (matchedCategory) {
                const cmdList = categories.get(matchedCategory) || [];
                const headerTitle = CATEGORY_NAMES[matchedCategory] || matchedCategory.toUpperCase();
                let catText = `╭━━━〔 *${headerTitle}* 〕━━━⬣\n` +
                              `┃ 📦 *Comandos disponibles:* ${cmdList.length}\n` +
                              `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n`;

                const sortedCmds = [...cmdList].sort((a, b) => a.name.localeCompare(b.name));
                for (const cmd of sortedCmds) {
                    catText += `│ 🔹 *${prefix}${cmd.name}* : _${cmd.desc || 'Sin descripción'}_\n`;
                }

                catText += `╰──────────────────⬣\n\n` +
                           `💡 *Tip:* Usa *${prefix}menu* para ver todas las categorías.`;
                return await m.reply(catText);
            }
        }

        // Construir el texto con el catálogo completo de comandos
        let menuText = `╭━━━〔 *${config.botName.toUpperCase()}* 〕━━━⬣\n` +
            `┃ 👑 *Creador:* ${config.ownerName}\n` +
            `┃ 🔤 *Prefijo:* [ *${prefix}* ]\n` +
            `┃ 🔒 *Modo:* ${mode.toUpperCase()}\n` +
            `┃ 📦 *Total Comandos:* ${commands.size}\n` +
            `╰━━━━━━━━━━━━━━━━━━⬣\n\n`;

        for (const catKey of allCategoryKeys) {
            const cmdList = categories.get(catKey);
            if (cmdList && cmdList.length > 0) {
                const headerTitle = CATEGORY_NAMES[catKey] || `📁 ${catKey.toUpperCase()}`;
                menuText += `╭───〔 *${headerTitle}* (${cmdList.length}) 〕\n`;

                const sortedCmds = [...cmdList].sort((a, b) => a.name.localeCompare(b.name));
                for (const cmd of sortedCmds) {
                    menuText += `│ 🔹 *${prefix}${cmd.name}* : _${cmd.desc || 'Sin descripción'}_\n`;
                }

                menuText += `╰──────────────────⬣\n\n`;
            }
        }

        menuText += `💡 *Consejo:* Escribe *${prefix}comandos* para ver la guía con ejemplos, o *${prefix}menu [categoría]* para filtrar.`;

        // Rutas de archivos multimedia para el menú
        const gifPath = path.join(config.assetsDir, 'menu.gif');
        const mp4Path = path.join(config.assetsDir, 'menu.mp4');
        const imgPath = path.join(config.assetsDir, 'menu.jpg');

        const headerCard =
            `╭━━━〔 *${config.botName.toUpperCase()}* 〕━━━⬣\n` +
            `┃ 👑 *Creador:* ${config.ownerName}\n` +
            `┃ 🔤 *Prefijo:* [ *${prefix}* ]\n` +
            `┃ 🔒 *Modo:* ${mode.toUpperCase()}\n` +
            `┃ 📦 *Total Comandos:* ${commands.size}\n` +
            `╰━━━━━━━━━━━━━━━━━━⬣\n\n` +
            `📜 *Desplegando el catálogo completo (${commands.size} comandos disponibles):*`;

        try {
            // WhatsApp impone un límite estricto de 1024 caracteres en los captions de multimedia.
            // Para garantizar que NUNCA se corten los comandos, enviamos la imagen/video con una
            // ficha estilizada y a continuación el menú íntegro en texto sin truncamientos.
            let mediaSent = false;

            if (fs.existsSync(mp4Path)) {
                const mp4Buffer = fs.readFileSync(mp4Path);
                await sock.sendMessage(m.chat, {
                    video: mp4Buffer,
                    gifPlayback: true,
                    caption: headerCard
                }, { quoted: m });
                mediaSent = true;
            } else if (fs.existsSync(gifPath)) {
                const gifBuffer = fs.readFileSync(gifPath);
                await sock.sendMessage(m.chat, {
                    video: gifBuffer,
                    gifPlayback: true,
                    caption: headerCard
                }, { quoted: m });
                mediaSent = true;
            } else if (fs.existsSync(imgPath)) {
                const imgBuffer = fs.readFileSync(imgPath);
                await sock.sendMessage(m.chat, {
                    image: imgBuffer,
                    caption: headerCard
                }, { quoted: m });
                mediaSent = true;
            }

            // Enviar catálogo completo en formato texto (WhatsApp admite hasta 65.536 caracteres en texto)
            await sock.sendMessage(m.chat, {
                text: menuText
            }, mediaSent ? {} : { quoted: m });
        } catch (err) {
            // Fallback seguro en solo texto
            await m.reply(menuText);
        }
    }
};

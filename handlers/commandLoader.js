const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');

const commands = new Map();
const aliases = new Map();
const categories = new Map();

/**
 * Carga recursivamente todos los comandos desde la carpeta commands/
 */
const loadCommands = (commandsDir = path.join(__dirname, '../commands')) => {
    commands.clear();
    aliases.clear();
    categories.clear();

    if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true });
        return { total: 0, categories: [] };
    }

    const readCommands = (dir) => {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                readCommands(fullPath);
            } else if (file.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(fullPath)];
                    const cmd = require(fullPath);
                    const cmdList = Array.isArray(cmd) ? cmd : [cmd];

                    for (const item of cmdList) {
                        if (item && item.name && typeof item.execute === 'function') {
                            const name = item.name.toLowerCase();
                            commands.set(name, item);

                            // Mapear alias
                            if (Array.isArray(item.alias)) {
                                item.alias.forEach(alias => {
                                    aliases.set(alias.toLowerCase(), name);
                                });
                            }

                            // Categorización
                            const category = item.category || 'otros';
                            if (!categories.has(category)) {
                                categories.set(category, []);
                            }
                            categories.get(category).push(item);
                        }
                    }
                } catch (err) {
                    logger.error(`Error cargando comando ${file}:`, err.message);
                }
            }
        }
    };

    readCommands(commandsDir);
    logger.info(`Comandos cargados: ${commands.size} en ${categories.size} categorías.`);
    return {
        total: commands.size,
        categories: Array.from(categories.keys())
    };
};

/**
 * Obtiene un comando por su nombre o alias
 */
const getCommand = (commandName) => {
    if (!commandName) return null;
    const lower = commandName.toLowerCase();
    if (commands.has(lower)) return commands.get(lower);
    if (aliases.has(lower)) {
        const realName = aliases.get(lower);
        return commands.get(realName);
    }
    return null;
};

module.exports = {
    commands,
    aliases,
    categories,
    loadCommands,
    getCommand
};


const database = require('../../lib/database');

module.exports = {
    name: 'prefix',
    alias: ['setprefix', 'prefijo'],
    category: 'sistema',
    desc: 'Cambia el prefijo global del bot en la base de datos JSON',
    usage: '.prefix [nuevo_prefijo, ej: ! o # o .]',
    ownerOnly: true,
    execute: async ({ sock, m, args }) => {
        const newPrefix = args[0];

        if (!newPrefix || newPrefix.length > 3) {
            return await m.reply(`❌ Debes especificar un prefijo válido de 1 a 3 caracteres.\nEjemplo: *.prefix !* o *.prefix #*`);
        }

        const updated = database.setPrefix(newPrefix);
        await m.reply(`✅ *Prefijo actualizado:* A partir de ahora los comandos responderán con: *${updated}*`);
    }
};


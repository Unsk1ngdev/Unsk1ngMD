const { toggleGroup } = require('../../lib/groupPermissions');

module.exports = {
    name: 'cerrar',
    alias: ['closegroup', 'cerrargrupo', 'close'],
    category: 'grupo',
    desc: 'Restringe el envío de mensajes solo para los administradores',
    usage: '.cerrar',
    groupOnly: true,
    execute: async ({ sock, m }) => {
        await toggleGroup(sock, m.chat, m, m.sender, 'cerrar');
    }
};

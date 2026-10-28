const { toggleGroup } = require('../../lib/groupPermissions');

module.exports = {
    name: 'abrir',
    alias: ['opengroup', 'abrirgrupo', 'open'],
    category: 'grupo',
    desc: 'Permite que todos los miembros puedan enviar mensajes en el grupo',
    usage: '.abrir',
    groupOnly: true,
    execute: async ({ sock, m }) => {
        await toggleGroup(sock, m.chat, m, m.sender, 'abrir');
    }
};

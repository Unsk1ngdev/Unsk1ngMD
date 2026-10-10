module.exports = {
    name: 'restart',
    alias: ['reiniciar', 'reboot'],
    category: 'sistema',
    desc: 'Cierre limpio del proceso para reinicio automático mediante PM2, nodemon o Docker',
    usage: '.restart',
    ownerOnly: true,
    execute: async ({ sock, m }) => {
        await m.reply('🔄 *Reiniciando el bot...*\nEl proceso se cerrará limpiamente y el gestor de procesos (PM2/Docker) lo iniciará de nuevo.');
        
        setTimeout(() => {
            process.exit(0);
        }, 1500);
    }
};


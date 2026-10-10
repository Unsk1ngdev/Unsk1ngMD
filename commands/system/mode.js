const database = require('../../lib/database');

module.exports = {
    name: 'mode',
    alias: ['modo', 'botmode'],
    category: 'sistema',
    desc: 'Cambia el modo de operación del bot (public: para todos, private: solo dueños)',
    usage: '.mode [public/private]',
    ownerOnly: true,
    execute: async ({ sock, m, args }) => {
        const targetMode = args[0]?.toLowerCase();

        if (targetMode !== 'public' && targetMode !== 'private') {
            const current = database.getMode();
            return await m.reply(`🔒 *Modo actual:* ${current.toUpperCase()}\n\nPara cambiarlo escribe:\n*.mode public* (Todos pueden usar el bot)\n*.mode private* (Solo el dueño puede usar el bot)`);
        }

        const newMode = database.setMode(targetMode);
        await m.reply(`✅ *Modo del bot cambiado:* Ahora está en modo *${newMode.toUpperCase()}*.`);
    }
};


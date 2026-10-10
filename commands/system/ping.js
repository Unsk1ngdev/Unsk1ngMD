module.exports = {
    name: 'ping',
    alias: ['p', 'latencia', 'speed'],
    category: 'sistema',
    desc: 'Muestra la velocidad y latencia de respuesta del bot',
    usage: '.ping',
    execute: async ({ sock, m }) => {
        const start = Date.now();
        const msg = await m.reply('🏓 Pong...');
        const latency = Date.now() - start;

        await sock.sendMessage(m.chat, {
            text: `🏓 *¡Pong!*\n⚡ *Latencia de respuesta:* ${latency} ms`
        }, { quoted: msg });
    }
};


'use strict';

/**
 * Comando: .reactch [url_canal] [emoji o texto]
 * Solo el OWNER puede ejecutarlo.
 * Reacciona a un mensaje de un canal de WhatsApp con cualquier emoji o texto estilizado.
 *
 * Uso:
 * - Con emoji: .reactch https://whatsapp.com/channel/XXXXX/MSGID 🔥
 * - Con texto: .reactch https://whatsapp.com/channel/XXXXX/MSGID hola
 * - Quitar:    .reactch https://whatsapp.com/channel/XXXXX/MSGID quitar
 */

const FONT = {
    a:'🅐', b:'🅑', c:'🅒', d:'🅓', e:'🅔', f:'🅕', g:'🅖',
    h:'🅗', i:'🅘', j:'🅙', k:'🅚', l:'🅛', m:'🅜', n:'🅝',
    o:'🅞', p:'🅟', q:'🅠', r:'🅡', s:'🅢', t:'🅣', u:'🅤',
    v:'🅥', w:'🅦', x:'🅧', y:'🅨', z:'🅩',
    '0':'⓿','1':'➊','2':'➋','3':'➌','4':'➍',
    '5':'➎','6':'➏','7':'➐','8':'➑','9':'➒'
};

const stylize = (text) =>
    text.toLowerCase().split('').map(c => {
        if (c === ' ') return '␣';
        return FONT[c] || c;
    }).join('');

module.exports = {
    name: 'reactch',
    alias: ['reaccionarcanal', 'chreact'],
    category: 'tools',
    desc: 'Reacciona a un mensaje de canal de WhatsApp con un emoji o texto (solo owner)',
    usage: '.reactch [url_canal] [emoji o texto]',
    groupOnly: false,
    adminOnly: false,
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner) return;

        const url = args[0] || '';
        const input = args.slice(1).join(' ').trim();

        // ── Validaciones ──────────────────────────────────────────────────────
        if (!url.startsWith('https://whatsapp.com/channel/')) {
            return await sock.sendMessage(m.chat, {
                text: '❌ URL inválida. Uso correcto:\n*.reactch https://whatsapp.com/channel/xxx/yyy [emoji]*\n\n📌 *Ejemplo con emoji:* `.reactch https://whatsapp.com/channel/xxx/yyy 🔥`'
            }, { quoted: m });
        }

        if (!input) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Debes indicar el emoji o texto para la reacción.\n\nEjemplos:\n• `.reactch https://whatsapp.com/channel/xxx/yyy 🔥`\n• `.reactch https://whatsapp.com/channel/xxx/yyy 👑`\n• `.reactch https://whatsapp.com/channel/xxx/yyy quitar`'
            }, { quoted: m });
        }

        // ── Extraer ID del canal e ID del mensaje desde la URL ────────────────
        const partes = url.replace('https://whatsapp.com/channel/', '').split('/');
        const idCanal = partes[0];
        const idMensaje = partes[1];

        if (!idCanal || !idMensaje) {
            return await sock.sendMessage(m.chat, {
                text: '❌ La URL debe incluir tanto el ID del canal como el ID del mensaje.\nEjemplo: `https://whatsapp.com/channel/CANAL/MENSAJE`'
            }, { quoted: m });
        }

        // Determinar si es eliminación o reacción
        const esEliminar = ['quitar', 'remove', 'delete', 'borrar'].includes(input.toLowerCase());
        
        let reaccion = '';
        if (!esEliminar) {
            // Si el input contiene emojis oficiales de Unicode, usarlo directamente
            const tieneEmoji = /\p{Extended_Pictographic}/u.test(input);
            reaccion = tieneEmoji ? input : stylize(input);
        }

        try {
            // Obtener metadatos del canal por su invite code
            const datosCanal = await sock.newsletterMetadata('invite', idCanal);

            // Reaccionar al mensaje del canal (o quitar reacción si es vacía)
            await sock.newsletterReactMessage(datosCanal.id, idMensaje, reaccion);

            const respuesta = esEliminar
                ? `🗑️ Reacción eliminada del mensaje en el canal *${datosCanal.name || idCanal}*\n\n_Powered by Unknown Codexツ</>_`
                : `✅ Reacción *${reaccion}* enviada al canal *${datosCanal.name || idCanal}*\n\n💡 _Tip: Usa emojis reales (🔥, 👑, 💀, ❤️) para que se vean a color en WhatsApp_\n\n_Powered by Unknown Codexツ</>_`;

            await sock.sendMessage(m.chat, { text: respuesta }, { quoted: m });

        } catch (err) {
            console.error('[reactch]', err.message);
            await sock.sendMessage(m.chat, {
                text: `❌ Error al reaccionar.\n_${err.message}_\n\nVerifica que la URL sea correcta y que el canal permita reacciones.`
            }, { quoted: m });
        }
    }
};

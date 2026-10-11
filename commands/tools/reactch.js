'use strict';

/**
 * Comando: .reactch [url_canal] [texto]
 * Solo el OWNER puede ejecutarlo.
 * Reacciona a un mensaje de un canal de WhatsApp con texto estilizado.
 *
 * Uso: .reactch https://whatsapp.com/channel/XXXXX/MSGID hola mundo
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
    desc: 'Reacciona a un mensaje de canal de WhatsApp con texto estilizado (solo owner)',
    usage: '.reactch [url_canal] [texto]',
    groupOnly: false,
    adminOnly: false,
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner) return;

        const url  = args[0] || '';
        const texto = args.slice(1).join(' ').trim();

        // ── Validaciones ──────────────────────────────────────────────────────
        if (!url.startsWith('https://whatsapp.com/channel/')) {
            return await sock.sendMessage(m.chat, {
                text: '❌ URL inválida. Uso correcto:\n*.reactch https://whatsapp.com/channel/xxx/yyy texto*'
            }, { quoted: m });
        }

        if (!texto) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Debes escribir el texto para la reacción.\nEjemplo: `.reactch https://whatsapp.com/channel/xxx/yyy hola`'
            }, { quoted: m });
        }

        // ── Extraer ID del canal e ID del mensaje desde la URL ────────────────
        // Formato: https://whatsapp.com/channel/{channelId}/{messageId}
        const partes    = url.replace('https://whatsapp.com/channel/', '').split('/');
        const idCanal   = partes[0];
        const idMensaje = partes[1];

        if (!idCanal || !idMensaje) {
            return await sock.sendMessage(m.chat, {
                text: '❌ La URL debe incluir tanto el ID del canal como el ID del mensaje.\nEjemplo: `https://whatsapp.com/channel/CANAL/MENSAJE`'
            }, { quoted: m });
        }

        const textoEstilizado = stylize(texto);

        try {
            // Obtener metadatos del canal por su invite code
            const datosCanal = await sock.newsletterMetadata('invite', idCanal);

            // Reaccionar al mensaje del canal
            await sock.newsletterReactMessage(datosCanal.id, idMensaje, textoEstilizado);

            await sock.sendMessage(m.chat, {
                text: `✅ Reacción *${textoEstilizado}* enviada al canal *${datosCanal.name || idCanal}*\n\n_Powered by Unknown Codexツ</>_`
            }, { quoted: m });

        } catch (err) {
            console.error('[reactch]', err.message);
            await sock.sendMessage(m.chat, {
                text: `❌ Error al reaccionar.\n_${err.message}_\n\nVerifica que la URL sea correcta y que el canal exista.`
            }, { quoted: m });
        }
    }
};

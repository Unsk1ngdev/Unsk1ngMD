'use strict';

const axios = require('axios');
const { isFfmpegAvailable, convertGifToMp4 } = require('../../lib/ffmpeg');
const { createTempPath, safeUnlink } = require('../../lib/cleaner');
const fs = require('fs-extra');
const logger = require('../../lib/logger');

// Banco curado de citas motivacionales de alto impacto
const MOTIVATIONAL_QUOTES = [
    'El dolor que sientes hoy es la fuerza que sentirás mañana. ¡Sigue adelante!',
    'No te detengas cuando estés cansado, detente cuando hayas terminado.',
    'Los campeones no se hacen en los gimnasios, se hacen de algo que tienen en su interior: un deseo, un sueño, una visión.',
    'Tu único límite es tu propia mente. Cree en ti y nada podrá pararte.',
    'Cada día es una nueva oportunidad para demostrar de qué estás hecho. ¡A por todas!',
    'El éxito no es un accidente. Es trabajo duro, perseverancia, aprendizaje, estudio y sobre todo amor por lo que haces.',
    'Si el plan no funciona, cambia el plan, pero nunca la meta.',
    'La disciplina tarde o temprano vencerá al talento. Mantén el foco.',
    'Caerse mil veces y levantarse mil una. Esa es la diferencia entre los que triunfan y los que se rinden.',
    'No mires el reloj; haz lo que él hace: sigue moviéndote.',
    'El mayor error que puedes cometer en la vida es tener el miedo continuo de cometer uno.',
    'Hoy haré lo que otros no quieren, para mañana lograr lo que otros no pueden.'
];

// Pool de GIFs / videos cortos de superación y victoria
const MOTIVATIONAL_GIFS = [
    'https://media.giphy.com/media/26AHPxxnSw1L9T1rW/giphy.gif', // Rocky victory
    'https://media.giphy.com/media/GkD4U3vmFg0F2/giphy.gif',     // Goku super saiyan focus
    'https://media.giphy.com/media/d2Z4NRCUxsxZBvag/giphy.gif',   // Just do it
    'https://media.giphy.com/media/yoJC2K6rCzwNY2EngA/giphy.gif', // Celebration triumph
    'https://media.giphy.com/media/pHb82xtBPfqEg/giphy.gif',     // Epic handshake bro
    'https://media.giphy.com/media/11F0d3IVhQbreE/giphy.gif'      // Anime determination
];

module.exports = {
    name: 'motivar',
    alias: ['motivate', 'animo', 'motivacion', 'inspirar', 'fuerza'],
    category: 'diversion',
    desc: 'Envía un mensaje motivacional con GIF animado para inspirar a alguien o a ti mismo',
    usage: '.motivar [@usuario o respuesta]',

    execute: async ({ sock, m }) => {
        const jid = m.chat;

        // 1. Determinar el usuario destinatario (mencionado, citado o el propio remitente)
        let targetJid = m.sender;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted && m.quoted.sender) {
            targetJid = m.quoted.sender;
        }

        const cleanTarget = targetJid.replace(/:\d+@/, '@').trim();
        const targetPhone = cleanTarget.split('@')[0];
        const isSelf = cleanTarget === m.sender.replace(/:\d+@/, '@').trim();

        await m.react?.('💪');

        // 2. Elegir frase aleatoria
        const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        const gifUrl = MOTIVATIONAL_GIFS[Math.floor(Math.random() * MOTIVATIONAL_GIFS.length)];

        const captionText = [
            '🔥 *¡INYECCIÓN DE MOTIVACIÓN!* 🔥',
            '',
            isSelf ? '👑 *Mensaje para ti:*' : `👑 *Para ti:* @${targetPhone}`,
            '',
            `❝ *${quote}* ❞`,
            '',
            '⚡ _¡No bajes la guardia, el éxito te espera!_'
        ].join('\n');

        // 3. Descargar GIF y transcodificar a MP4 para reproducción en bucle continuo (gifPlayback)
        let sentWithVideo = false;

        try {
            const res = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 10000 });
            if (res.status === 200 && res.data && res.data.length > 0) {
                if (isFfmpegAvailable()) {
                    const tempInput = createTempPath('gif');
                    const tempOutput = createTempPath('mp4');

                    try {
                        await fs.writeFile(tempInput, res.data);
                        await convertGifToMp4(tempInput, tempOutput);

                        const videoBuffer = await fs.readFile(tempOutput);

                        await sock.sendMessage(jid, {
                            video: videoBuffer,
                            gifPlayback: true,
                            caption: captionText,
                            mentions: [cleanTarget]
                        }, { quoted: m });

                        sentWithVideo = true;
                    } finally {
                        await safeUnlink(tempInput);
                        await safeUnlink(tempOutput);
                    }
                }
            }
        } catch (err) {
            logger.warn(`[MOTIVAR] Fallback a texto por error en GIF: ${err.message}`);
        }

        // 4. Fallback de texto con mención si el envío multimedia falla
        if (!sentWithVideo) {
            await sock.sendMessage(jid, {
                text: captionText,
                mentions: [cleanTarget]
            }, { quoted: m });
        }

        await m.react?.('✨');
    }
};


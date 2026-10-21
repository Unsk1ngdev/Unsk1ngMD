'use strict';

const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const ffmpeg = require('../../lib/ffmpeg');
const logger = require('../../lib/logger');

/**
 * Normaliza y obtiene el JID limpio
 */
function cleanJid(id) {
    if (!id) return '';
    return id.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

/**
 * Obtiene y convierte un GIF animado de nekos.best a MP4 para gifPlayback en WhatsApp
 */
async function fetchReactionVideo(endpoint) {
    try {
        const res = await axios.get(`https://nekos.best/api/v2/${endpoint}`, { timeout: 6000 });
        const gifUrl = res.data?.results?.[0]?.url;
        if (!gifUrl) return null;

        const gifRes = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const rawBuffer = Buffer.from(gifRes.data);

        if (!ffmpeg.isFfmpegAvailable()) {
            return { type: 'image', buffer: rawBuffer };
        }

        const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const tmpIn = path.join(process.cwd(), `tmp_in_${tmpId}.gif`);
        const tmpOut = path.join(process.cwd(), `tmp_out_${tmpId}.mp4`);

        await fs.writeFile(tmpIn, rawBuffer);
        await ffmpeg.convertGifToMp4(tmpIn, tmpOut);

        if (fs.existsSync(tmpOut)) {
            const videoBuffer = await fs.readFile(tmpOut);
            await fs.remove(tmpIn).catch(() => {});
            await fs.remove(tmpOut).catch(() => {});
            return { type: 'video', buffer: videoBuffer };
        }

        await fs.remove(tmpIn).catch(() => {});
        return { type: 'image', buffer: rawBuffer };
    } catch (err) {
        logger.error(`Error en fetchReactionVideo(${endpoint}):`, err.message);
        return null;
    }
}

/**
 * Resuelve el usuario objetivo (mención o mensaje citado)
 */
function resolveTarget(m, args) {
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        return cleanJid(m.mentionedJid[0]);
    }
    if (m.quoted && m.quoted.sender) {
        return cleanJid(m.quoted.sender);
    }
    if (args && args[0]) {
        const raw = args[0].replace(/[^0-9]/g, '');
        if (raw.length >= 7) return `${raw}@s.whatsapp.net`;
    }
    return null;
}

module.exports = [
    // 1. .punch (Golpear)
    {
        name: 'punch',
        alias: ['golpear', 'pegar', 'trompon'],
        category: 'juegos',
        desc: 'Envía un GIF animado de puñetazo mencionando a otro usuario',
        usage: '.punch @usuario',

        execute: async ({ sock, m, args }) => {
            const jid = m.chat || m.key.remoteJid;
            const sender = cleanJid(m.sender);
            const target = resolveTarget(m, args);

            let caption = '';
            const mentions = [sender];

            if (target && target !== sender) {
                mentions.push(target);
                caption = `👊💥 *@${sender.split('@')[0]}* le acomodó un tremendo puñetazo a *@${target.split('@')[0]}* 💢\n\n_Unknown Codexツ</>_`;
            } else {
                caption = `👊 *@${sender.split('@')[0]}* se dio un puñetazo a sí mismo por accidente... ¡Auch! 🤕\n\n_Unknown Codexツ</>_`;
            }

            const media = await fetchReactionVideo('punch');

            if (media && media.type === 'video') {
                return await sock.sendMessage(jid, {
                    video: media.buffer,
                    gifPlayback: true,
                    caption,
                    mentions
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, { text: caption, mentions }, { quoted: m });
        }
    },

    // 2. .patt (Acariciar / Pat)
    {
        name: 'patt',
        alias: ['pat', 'acariciar', 'mimos', 'mimar'],
        category: 'juegos',
        desc: 'Envía un GIF animado acariciando la cabeza de otro usuario con ternura',
        usage: '.patt @usuario',

        execute: async ({ sock, m, args }) => {
            const jid = m.chat || m.key.remoteJid;
            const sender = cleanJid(m.sender);
            const target = resolveTarget(m, args);

            let caption = '';
            const mentions = [sender];

            if (target && target !== sender) {
                mentions.push(target);
                caption = `✨🥰 *@${sender.split('@')[0]}* le está acariciando la cabecita con mucho cariño a *@${target.split('@')[0]}* 💕\n\n_Unknown Codexツ</>_`;
            } else {
                caption = `🥺 *@${sender.split('@')[0]}* se hace mimos a sí mismo buscando un poco de afecto... ✨\n\n_Unknown Codexツ</>_`;
            }

            const media = await fetchReactionVideo('pat');

            if (media && media.type === 'video') {
                return await sock.sendMessage(jid, {
                    video: media.buffer,
                    gifPlayback: true,
                    caption,
                    mentions
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, { text: caption, mentions }, { quoted: m });
        }
    },

    // 3. .scared (Asustar)
    {
        name: 'scared',
        alias: ['asustar', 'susto', 'shocked'],
        category: 'juegos',
        desc: 'Envía un GIF animado de asustar o llevarse un gran susto',
        usage: '.scared @usuario',

        execute: async ({ sock, m, args }) => {
            const jid = m.chat || m.key.remoteJid;
            const sender = cleanJid(m.sender);
            const target = resolveTarget(m, args);

            let caption = '';
            const mentions = [sender];

            if (target && target !== sender) {
                mentions.push(target);
                caption = `👻⚡ *¡BUUU!* *@${sender.split('@')[0]}* salió de la nada y le pegó un susto de muerte a *@${target.split('@')[0]}* 😱💥\n\n_Unknown Codexツ</>_`;
            } else {
                caption = `😱 *@${sender.split('@')[0]}* vio una sombra en su habitación y casi se muere del susto 🏃💨\n\n_Unknown Codexツ</>_`;
            }

            const media = await fetchReactionVideo('shocked');

            if (media && media.type === 'video') {
                return await sock.sendMessage(jid, {
                    video: media.buffer,
                    gifPlayback: true,
                    caption,
                    mentions
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, { text: caption, mentions }, { quoted: m });
        }
    }
];


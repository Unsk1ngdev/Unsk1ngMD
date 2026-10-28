'use strict';

const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const ffmpeg = require('../../lib/ffmpeg');
const logger = require('../../lib/logger');
const userNames = require('../../lib/userNames');

/**
 * Normaliza y obtiene el JID limpio
 */
function cleanJid(id) {
    if (!id) return '';
    return id.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

/**
 * Obtiene y convierte un GIF animado de nekos.best o waifu.pics a MP4 para gifPlayback en WhatsApp
 */
async function fetchReactionVideo(endpoint) {
    let gifUrl = null;

    // 1. Intento con nekos.best
    try {
        const res = await axios.get(`https://nekos.best/api/v2/${endpoint}`, { timeout: 6000 });
        gifUrl = res.data?.results?.[0]?.url;
    } catch (_) {}

    // 2. Fallback con waifu.pics
    if (!gifUrl) {
        try {
            const res = await axios.get(`https://api.waifu.pics/sfw/${endpoint}`, { timeout: 6000 });
            gifUrl = res.data?.url;
        } catch (_) {}
    }

    if (!gifUrl) return null;

    try {
        const gifRes = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 12000 });
        const rawBuffer = Buffer.from(gifRes.data);

        // Si ya es un video MP4
        if (gifUrl.endsWith('.mp4')) {
            return { type: 'video', buffer: rawBuffer };
        }

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

/**
 * Helper genérico para despachar una reacción anime
 */
async function sendReaction({ sock, m, args, endpoint, actionWithTarget, actionAlone, emoji = '✨' }) {
    const jid = m.chat || m.key.remoteJid;
    const sender = cleanJid(m.sender);
    const target = resolveTarget(m, args);

    const mentions = [sender];
    const senderName = m.pushName || userNames.get(sender) || 'Alguien';
    let caption = '';

    if (target && target !== sender) {
        mentions.push(target);
        const targetName = userNames.get(target) || `@${target.split('@')[0]}`;
        caption = actionWithTarget(senderName, targetName);
    } else {
        caption = actionAlone(senderName);
    }

    caption += `\n\n_Unknown Codexツ</>_`;

    try {
        if (typeof m.react === 'function') await m.react(emoji).catch(() => {});
    } catch (_) {}

    const media = await fetchReactionVideo(endpoint);

    if (media && media.type === 'video') {
        return await sock.sendMessage(jid, {
            video: media.buffer,
            gifPlayback: true,
            caption,
            mentions
        }, { quoted: m });
    }

    if (media && media.type === 'image') {
        return await sock.sendMessage(jid, {
            image: media.buffer,
            caption,
            mentions
        }, { quoted: m });
    }

    return await sock.sendMessage(jid, { text: caption, mentions }, { quoted: m });
}

module.exports = [
    // 1. .punch (Golpear)
    {
        name: 'punch',
        alias: ['golpear', 'pegar', 'trompon'],
        category: 'anime',
        desc: 'Envía un GIF animado de puñetazo mencionando a otro usuario',
        usage: '.punch @usuario',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'punch', emoji: '👊',
            actionWithTarget: (s, t) => `👊💥 *${s}* le acomodó un tremendo puñetazo a *${t}* 💢`,
            actionAlone: (s) => `👊 *${s}* se dio un puñetazo a sí mismo por accidente... ¡Auch! 🤕`
        })
    },

    // 2. .patt (Acariciar / Pat)
    {
        name: 'patt',
        alias: ['pat', 'acariciar', 'mimos', 'mimar'],
        category: 'anime',
        desc: 'Envía un GIF animado acariciando la cabeza de otro usuario con ternura',
        usage: '.patt @usuario',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'pat', emoji: '🥰',
            actionWithTarget: (s, t) => `✨🥰 *${s}* le está acariciando la cabecita con mucho cariño a *${t}* 💕`,
            actionAlone: (s) => `🥺 *${s}* se hace mimos a sí mismo buscando un poco de afecto... ✨`
        })
    },

    // 3. .scared (Asustar)
    {
        name: 'scared',
        alias: ['asustar', 'susto', 'shocked'],
        category: 'anime',
        desc: 'Envía un GIF animado de asustar o llevarse un gran susto',
        usage: '.scared @usuario',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'shocked', emoji: '😱',
            actionWithTarget: (s, t) => `👻⚡ *¡BUUU!* *${s}* salió de la nada y le pegó un susto de muerte a *${t}* 😱💥`,
            actionAlone: (s) => `😱 *${s}* vio una sombra en su habitación y casi se muere del susto 🏃💨`
        })
    },

    // 4. .kiss (Besar)
    {
        name: 'kiss',
        alias: ['besar', 'beso', 'muak'],
        category: 'anime',
        desc: 'Envía un GIF animado dando un tierno o apasionado beso a otro usuario',
        usage: '.kiss @usuario',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'kiss', emoji: '💋',
            actionWithTarget: (s, t) => `💋👩‍❤️‍💋‍👨 *${s}* le acaba de plantar un tierno beso a *${t}* ❤️✨`,
            actionAlone: (s) => `💋 *${s}* manda besos al aire esperando que alguien los atrape... 😘`
        })
    },

    // 5. .hug (Abrazar)
    {
        name: 'hug',
        alias: ['abrazar', 'abrazo'],
        category: 'anime',
        desc: 'Envía un GIF animado dando un cálido abrazo',
        usage: '.hug @usuario',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'hug', emoji: '🫂',
            actionWithTarget: (s, t) => `🫂💖 *${s}* le dio un fuerte y cálido abrazo a *${t}* 🌸`,
            actionAlone: (s) => `🫂 *${s}* necesita un abrazo urgente... ¿Quién se ofrece? 🥺`
        })
    },

    // 6. .cry (Llorar)
    {
        name: 'cry',
        alias: ['llorar', 'llanto', 'sad'],
        category: 'anime',
        desc: 'Envía un GIF animado llorando desconsoladamente',
        usage: '.cry [@usuario opcional]',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'cry', emoji: '😭',
            actionWithTarget: (s, t) => `😭💔 *${s}* se puso a llorar en el hombro de *${t}* desconsoladamente...`,
            actionAlone: (s) => `😭🌊 *${s}* no aguanta más y se soltó a llorar a mares...`
        })
    },

    // 7. .poke (Picar / Molestar)
    {
        name: 'poke',
        alias: ['picar', 'molestar', 'toquetear'],
        category: 'anime',
        desc: 'Envía un GIF animado picando o molestando a alguien para llamar su atención',
        usage: '.poke @usuario',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'poke', emoji: '👉',
            actionWithTarget: (s, t) => `👉 Poke! *${s}* le está picando la mejilla a *${t}* para llamar su atención 👀`,
            actionAlone: (s) => `👉 *${s}* está picando la nada buscando qué hacer... 🥱`
        })
    },

    // 8. .nom (Morder / Comer)
    {
        name: 'nom',
        alias: ['morder', 'bite', 'ñam'],
        category: 'anime',
        desc: 'Envía un GIF animado mordiendo tiernamente a otro usuario',
        usage: '.nom @usuario',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'nom', emoji: '😋',
            actionWithTarget: (s, t) => `😋 Nom nom! *${s}* le dio un mordisquito travieso a *${t}* 🦷✨`,
            actionAlone: (s) => `😋 Nom nom nom... *${s}* se está comiendo algo delicioso 🍙`
        })
    },

    // 9. .wink (Guiñar un ojo)
    {
        name: 'wink',
        alias: ['guiñar', 'guiño'],
        category: 'anime',
        desc: 'Envía un GIF animado guiñando un ojo de forma coqueta',
        usage: '.wink [@usuario opcional]',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'wink', emoji: '😉',
            actionWithTarget: (s, t) => `😉✨ *${s}* le acaba de guiñar el ojo coquetamente a *${t}* 😏`,
            actionAlone: (s) => `😉 *${s}* lanzó un guiño al grupo con estilo y confianza ✨`
        })
    },

    // 10. .facepalm (Vergüenza ajena)
    {
        name: 'facepalm',
        alias: ['desilusion', 'decepcion'],
        category: 'anime',
        desc: 'Envía un GIF animado de facepalm ante una tontería',
        usage: '.facepalm [@usuario opcional]',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'facepalm', emoji: '🤦',
            actionWithTarget: (s, t) => `🤦‍♂️🤦‍♀️ *${s}* no puede creer lo que hizo *${t}* y se llevó la mano a la cara...`,
            actionAlone: (s) => `🤦 *${s}* siente una profunda vergüenza ajena en este momento...`
        })
    },

    // 11. .neko (Chica gato anime)
    {
        name: 'neko',
        alias: ['catgirl', 'gata'],
        category: 'anime',
        desc: 'Envía una imagen o GIF de una chica gato (Neko) anime',
        usage: '.neko',
        execute: async ({ sock, m, args }) => sendReaction({
            sock, m, args, endpoint: 'neko', emoji: '🐾',
            actionWithTarget: (s, t) => `🐾 *¡Nya!* *${s}* le dedica una linda chica gato a *${t}* 🐱`,
            actionAlone: (s) => `🐾 *¡Nyaaa!* Aquí tienes una linda Neko para alegrarte el día 🐱✨`
        })
    }
];

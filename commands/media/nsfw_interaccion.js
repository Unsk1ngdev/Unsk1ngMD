'use strict';

const nsfwManager = require('../../lib/nsfw');
const userNames = require('../../lib/userNames');

module.exports = [

    // ─── 1. .agarrarnalgas (Sin NSFW, solo grupos) ───
    {
        name: 'agarrarnalgas',
        alias: ['nalgas', 'culo', 'agarrarculo'],
        category: 'diversion',
        desc: 'Agarra las nalgas de alguien con GIF animado 🍑',
        usage: '.agarrarnalgas [@usuario]',
        execute: async ({ sock, m }) => {
            const chat = m.chat || m.key?.remoteJid;
            if (!chat?.endsWith('@g.us')) {
                return await sock.sendMessage(chat, { text: '> ♱ Este comando solo funciona en grupos.' }, { quoted: m });
            }

            const who = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || m.message?.extendedTextMessage?.contextInfo?.participant
                || m.quoted?.sender
                || m.sender;

            const senderName = m.pushName || userNames.get(m.sender);
            const isSelf = who === m.sender;
            const targetName = isSelf ? 'sí mismo/a' : userNames.get(who);

            // Videos de alta velocidad verificados en Telegraph CDN
            const gifs = [
                'https://telegra.ph/file/61d85d10baf2e3b9a4cde.mp4',
                'https://telegra.ph/file/538c95e4f1c481bcc3cce.mp4',
                'https://telegra.ph/file/e999ef6e67a1a75a515d6.mp4',
                'https://telegra.ph/file/05c1bd3a2ec54428ac2fc.mp4',
                'https://telegra.ph/file/36149496affe5d02c8965.mp4',
                'https://telegra.ph/file/82d32821f3b57b62359f2.mp4'
            ];
            const gif = gifs[Math.floor(Math.random() * gifs.length)];

            try {
                await sock.sendMessage(chat, { react: { text: '🍑', key: m.key } });
            } catch (_) {}

            try {
                await sock.sendMessage(chat, {
                    video: { url: gif },
                    gifPlayback: true,
                    caption: `> † *${senderName}* está agarrando las nalgas de *${targetName}* 🍑`,
                    mentions: isSelf ? [m.sender] : [m.sender, who]
                }, { quoted: m });
            } catch (err) {
                await sock.sendMessage(chat, {
                    text: `> † *${senderName}* está agarrando las nalgas de *${targetName}* 🍑\n\n_Unknown Codexツ</>_`,
                    mentions: isSelf ? [m.sender] : [m.sender, who]
                }, { quoted: m });
            }
        }
    },

    // ─── 2. .follar (NSFW, requiere grupo con NSFW) ───
    {
        name: 'follar',
        alias: ['coger', 'sexar'],
        category: 'nsfw',
        desc: '[+18] Envía un GIF explícito con texto fuerte',
        usage: '.follar [@usuario]',
        execute: async ({ sock, m }) => {
            const chat = m.chat || m.key?.remoteJid;
            if (!chat?.endsWith('@g.us')) {
                return await sock.sendMessage(chat, { text: '> ♱ Solo en grupos.' }, { quoted: m });
            }

            if (!nsfwManager.isNsfwEnabled(chat)) {
                return await sock.sendMessage(chat, {
                    text: '*[❗] 𝐋𝐨𝐬 𝐜𝐨𝐦𝐚𝐧𝐝𝐨𝐬 +𝟏𝟖 𝐞𝐬𝐭𝐚́𝐧 𝐝𝐞𝐬𝐚𝐜𝐭𝐢𝐯𝐚𝐝𝐨𝐬 𝐞𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨.*\n> 𝐔𝐬𝐚 .nsfw on 𝐩𝐚𝐫𝐚 𝐚𝐜𝐭𝐢𝐯𝐚𝐫𝐥𝐨𝐬.'
                }, { quoted: m });
            }

            const who = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || m.message?.extendedTextMessage?.contextInfo?.participant
                || m.quoted?.sender
                || m.sender;

            const senderName = m.pushName || userNames.get(m.sender);
            const isSelf = who === m.sender;
            const targetName = isSelf ? senderName : userNames.get(who);

            const hasMention = !!(m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]);
            const hasQuote = !!(m.message?.extendedTextMessage?.contextInfo?.participant || m.quoted?.sender);

            const str = isSelf
                ? `\`${senderName}\` *está follando ricamente.*`
                : hasMention
                    ? `\`${senderName}\` *follo fuertemente a la perra de* \`${targetName}\`.`
                    : hasQuote
                        ? `\`${senderName}\` *se la metió durísimo a la perrita de* \`${targetName}\`.`
                        : `\`${senderName}\` *está follando ricamente.*`;

            // Videos explícitos +18 de alta velocidad en Telegraph CDN
            const videos = [
                'https://telegra.ph/file/a2ad1dd463a935d5dfd17.mp4',
                'https://telegra.ph/file/e3abb2e79cd1ccf709e91.mp4',
                'https://telegra.ph/file/c5be4a906531c6731cd41.mp4',
                'https://telegra.ph/file/9c4b894e034c290df75e4.mp4',
                'https://telegra.ph/file/3246f62c61a0ebebcb5c8.mp4',
                'https://telegra.ph/file/820460f05d76bb2329bbc.mp4',
                'https://telegra.ph/file/22d0ef801c93c1b2ac074.mp4',
                'https://telegra.ph/file/6f66fd1974e8df1496768.mp4'
            ];
            const video = videos[Math.floor(Math.random() * videos.length)];

            try {
                await sock.sendMessage(chat, { react: { text: '🥵', key: m.key } });
            } catch (_) {}

            try {
                await sock.sendMessage(chat, {
                    video: { url: video },
                    gifPlayback: true,
                    caption: str,
                    mentions: isSelf ? [m.sender] : [m.sender, who]
                }, { quoted: m });
            } catch (err) {
                await sock.sendMessage(chat, {
                    text: `${str}\n\n_Unknown Codexツ</>_`,
                    mentions: isSelf ? [m.sender] : [m.sender, who]
                }, { quoted: m });
            }
        }
    },

    // ─── 3. .paja (Animación con edit rápida) ───
    {
        name: 'paja',
        alias: ['pajeame', 'hacerseunapaja', 'pajeo'],
        category: 'nsfw',
        desc: '[+18] Animación rápida de paja con edición de mensaje',
        usage: '.paja',
        execute: async ({ sock, m }) => {
            const chat = m.chat || m.key?.remoteJid;
            const res = await sock.sendMessage(chat, {
                text: 'Tas caliente! Ahora te haré una paja 😈'
            }, { quoted: m });

            const key = res?.key;
            if (!key) return;

            const frames = [
                "8==👊==D",  "8===👊=D", "8=👊===D",  "8=👊===D",
                "8==👊==D",  "8===👊=D", "8====👊D",  "8==👊==D",
                "8==👊==D",  "8=👊===D", "8👊====D",  "8=👊===D",
                "8==👊==D",  "8===👊=D", "8====👊D",  "8==👊==D",
                "8===👊=D",  "8=👊===D", "8=👊===D",  "8==👊==D",
                "8===👊=D",  "8====👊D💦"
            ];

            for (const frame of frames) {
                await sock.sendMessage(chat, { text: frame, edit: key });
                await new Promise(r => setTimeout(r, 60));
            }

            await sock.sendMessage(chat, {
                text: `Oh, se corrió en menos de 1 hora! 💦`,
                edit: key,
                mentions: [m.sender]
            });
        }
    },

    // ─── 4. .chaqueta (Animación ASCII con edit) ───
    {
        name: 'chaqueta',
        alias: ['chaqueteame', 'jalame', 'jalamela', 'masturbar', 'hacersela'],
        category: 'nsfw',
        desc: '[+18] Animación ASCII detallada con edición de mensaje',
        usage: '.chaqueta [@usuario]',
        execute: async ({ sock, m }) => {
            const chat = m.chat || m.key?.remoteJid;
            const targetJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || m.message?.extendedTextMessage?.contextInfo?.participant
                || m.quoted?.sender
                || m.sender;

            const sender = m.pushName || userNames.get(m.sender);
            const isSelf = targetJid === m.sender;
            const target = isSelf ? 'sí mismo' : userNames.get(targetJid);

            const frames = [
                `🔥 Iniciando chaqueta...`,
                '╭━━╮╭╭╭╮\n┃▔╲┣╈╈╈╈━━━╮\n┃┈┈▏.╰╯╯╯╭╮━┫\n┃┈--.╭━━━━╈╈━╯\n╰━━╯-.                ╰╯',
                '╭━━╮.    ╭╭╭╮\n┃▔╲┣━━╈╈╈╈━━╮\n┃┈┈▏.    .╰╯╯╯╭╮┫\n┃┈--.╭━━━━━━╈╈╯\n╰━━╯-.           . ╰╯',
                '╭━━╮╭╭╭╮\n┃▔╲┣╈╈╈╈━━━╮\n┃┈┈▏.╰╯╯╯╭╮━┫\n┃┈--.╭━━━━╈╈━╯\n╰━━╯-.                ╰╯',
                '╭━━╮.    ╭╭╭╮\n┃▔╲┣━━╈╈╈╈━━╮\n┃┈┈▏.    .╰╯╯╯╭╮┫\n┃┈--.╭━━━━━━╈╈╯\n╰━━╯-.           . ╰╯',
                '╭━━╮╭╭╭╮\n┃▔╲┣╈╈╈╈━━━╮\n┃┈┈▏.╰╯╯╯╭╮━┫\n┃┈--.╭━━━━╈╈━╯\n╰━━╯-.                ╰╯',
                '╭━━╮.    ╭╭╭╮\n┃▔╲┣━━╈╈╈╈━━╮\n┃┈┈▏.    .╰╯╯╯╭╮┫\n┃┈--.╭━━━━━━╈╈╯\n╰━━╯-.           . ╰╯',
                '╭━━╮╭╭╭╮\n┃▔╲┣╈╈╈╈━━━╮\n┃┈┈▏.╰╯╯╯╭╮━┫\n┃┈--.╭━━━━╈╈━╯\n╰━━╯-.                ╰╯',
                '╭━━╮.    ╭╭╭╮\n┃▔╲┣━━╈╈╈╈━━╮\n┃┈┈▏.    .╰╯╯╯╭╮┫\n┃┈--.╭━━━━━━╈╈╯\n╰━━╯-.           . ╰╯',
                `              .               .   ╭\n╭━━╮╭╭╭╮.           ╭ ╯\n┃▔╲┣╈╈╈╈━━━╮╭╯╭\n┃┈┈▏.╰╯╯╯╭╮━┫  \n┃┈--.╭━━━━╈╈━╯╰╮╰\n╰━━╯-.        ╰╯...-    ╰ ╮\n   .         . .  .  .. . . .  . .. .  ╰\n\n*[ 🔥 ] ${sender} SE HA CORRIDO GRACIAS A ${target}.*`
            ];

            const mentions = isSelf ? [m.sender] : [m.sender, targetJid];
            const res = await sock.sendMessage(chat, {
                text: '🔥 Iniciando chaqueta...',
                mentions
            }, { quoted: m });

            const key = res?.key;
            if (!key) return;

            for (const frame of frames) {
                await sock.sendMessage(chat, {
                    text: frame,
                    edit: key,
                    mentions
                });
                await new Promise(r => setTimeout(r, 80));
            }
        }
    },

    // ─── 5. .grabboobs / .agarrartetas (NSFW, telegra.ph) ───
    {
        name: 'grabboobs',
        alias: ['agarrartetas', 'tetas'],
        category: 'nsfw',
        desc: '[+18] GIF de agarrar tetas con reacción',
        usage: '.grabboobs [@usuario]',
        execute: async ({ sock, m }) => {
            const chat = m.chat || m.key?.remoteJid;
            if (!chat?.endsWith('@g.us')) {
                return await sock.sendMessage(chat, { text: '> ♱ Solo en grupos.' }, { quoted: m });
            }

            if (!nsfwManager.isNsfwEnabled(chat)) {
                return await sock.sendMessage(chat, {
                    text: '*[❗] 𝐋𝐨𝐬 𝐜𝐨𝐦𝐚𝐧𝐝𝐨𝐬 +𝟏𝟖 𝐞𝐬𝐭𝐚́𝐧 𝐝𝐞𝐬𝐚𝐜𝐭𝐢𝐯𝐚𝐝𝐨𝐬 𝐞𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨.*\n> 𝐔𝐬𝐚 .nsfw on 𝐩𝐚𝐫𝐚 𝐚𝐜𝐭𝐢𝐯𝐚𝐫𝐥𝐨𝐬.'
                }, { quoted: m });
            }

            const who = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || m.message?.extendedTextMessage?.contextInfo?.participant
                || m.quoted?.sender
                || m.sender;

            const senderName = m.pushName || userNames.get(m.sender);
            const isSelf = who === m.sender;
            const targetName = isSelf ? 'sus propias tetas' : userNames.get(who);

            const hasMention = !!(m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]);
            const hasQuote = !!(m.message?.extendedTextMessage?.contextInfo?.participant || m.quoted?.sender);

            const str = isSelf
                ? `\`${senderName}\` está agarrando unas ricas tetas >.< 🔥`
                : hasMention
                    ? `\`${senderName}\` le está agarrando las tetas a \`${targetName}\`.`
                    : hasQuote
                        ? `\`${senderName}\` está agarrando las tetas de \`${targetName}\`.`
                        : `\`${senderName}\` está agarrando unas ricas tetas >.< 🔥`;

            const videos = [
                'https://telegra.ph/file/e6bf14b93dfe22c4972d0.mp4',
                'https://telegra.ph/file/075db3ebba7126d2f0d95.mp4',
                'https://telegra.ph/file/37c21753892b5d843b9ce.mp4',
                'https://telegra.ph/file/04bbf490e29158f03e348.mp4',
                'https://telegra.ph/file/82d32821f3b57b62359f2.mp4',
                'https://telegra.ph/file/36149496affe5d02c8965.mp4',
                'https://telegra.ph/file/61d85d10baf2e3b9a4cde.mp4',
                'https://telegra.ph/file/538c95e4f1c481bcc3cce.mp4',
                'https://telegra.ph/file/e999ef6e67a1a75a515d6.mp4',
                'https://telegra.ph/file/05c1bd3a2ec54428ac2fc.mp4'
            ];
            const video = videos[Math.floor(Math.random() * videos.length)];

            try {
                await sock.sendMessage(chat, { react: { text: '🔥', key: m.key } });
            } catch (_) {}

            try {
                await sock.sendMessage(chat, {
                    video: { url: video },
                    gifPlayback: true,
                    caption: str,
                    mentions: isSelf ? [m.sender] : [m.sender, who]
                }, { quoted: m });
            } catch (err) {
                await sock.sendMessage(chat, {
                    text: `${str}\n\n_Unknown Codexツ</>_`,
                    mentions: isSelf ? [m.sender] : [m.sender, who]
                }, { quoted: m });
            }
        }
    },

    // ─── 6. .sexo / .sex (NSFW, telegra.ph) ───
    {
        name: 'sexo',
        alias: ['sex', 'hacersexo'],
        category: 'nsfw',
        desc: '[+18] Video apasionado de interacción sexual',
        usage: '.sexo [@usuario]',
        execute: async ({ sock, m }) => {
            const chat = m.chat || m.key?.remoteJid;
            if (!chat?.endsWith('@g.us')) {
                return await sock.sendMessage(chat, { text: '> ♱ Solo en grupos.' }, { quoted: m });
            }

            if (!nsfwManager.isNsfwEnabled(chat)) {
                return await sock.sendMessage(chat, {
                    text: '*[❗] 𝐋𝐨𝐬 𝐜𝐨𝐦𝐚𝐧𝐝𝐨𝐬 +𝟏𝟖 𝐞𝐬𝐭𝐚́𝐧 𝐝𝐞𝐬𝐚𝐜𝐭𝐢𝐯𝐚𝐝𝐨𝐬 𝐞𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨.*\n> 𝐔𝐬𝐚 .nsfw on 𝐩𝐚𝐫𝐚 𝐚𝐜𝐭𝐢𝐯𝐚𝐫𝐥𝐨𝐬.'
                }, { quoted: m });
            }

            const who = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || m.message?.extendedTextMessage?.contextInfo?.participant
                || m.quoted?.sender
                || m.sender;

            const senderName = m.pushName || userNames.get(m.sender);
            const isSelf = who === m.sender;
            const targetName = isSelf ? senderName : userNames.get(who);

            const text = isSelf
                ? `\`${senderName}\` está disfrutando apasionadamente consigo mismo. 🥵`
                : `\`${senderName}\` está interactuando apasionadamente con \`${targetName}\`. 🥵`;

            const videos = [
                'https://telegra.ph/file/a2ad1dd463a935d5dfd17.mp4',
                'https://telegra.ph/file/e3abb2e79cd1ccf709e91.mp4',
                'https://telegra.ph/file/c5be4a906531c6731cd41.mp4',
                'https://telegra.ph/file/9c4b894e034c290df75e4.mp4',
                'https://telegra.ph/file/3246f62c61a0ebebcb5c8.mp4',
                'https://telegra.ph/file/820460f05d76bb2329bbc.mp4',
                'https://telegra.ph/file/22d0ef801c93c1b2ac074.mp4',
                'https://telegra.ph/file/6f66fd1974e8df1496768.mp4'
            ];
            const video = videos[Math.floor(Math.random() * videos.length)];

            try {
                await sock.sendMessage(chat, { react: { text: '🥵', key: m.key } });
            } catch (_) {}

            try {
                await sock.sendMessage(chat, {
                    video: { url: video },
                    gifPlayback: true,
                    caption: text,
                    mentions: isSelf ? [m.sender] : [m.sender, who]
                }, { quoted: m });
            } catch (err) {
                await sock.sendMessage(chat, {
                    text: `${text}\n\n_Unknown Codexツ</>_`,
                    mentions: isSelf ? [m.sender] : [m.sender, who]
                }, { quoted: m });
            }
        }
    },

    // ─── 7. .penetrar (Texto vulgar +18) ───
    {
        name: 'penetrar',
        alias: ['meter'],
        category: 'nsfw',
        desc: '[+18] Mensaje vulgar exagerado sobre el usuario etiquetado (sin GIF)',
        usage: '.penetrar @usuario',
        execute: async ({ sock, m }) => {
            const chat = m.chat || m.key?.remoteJid;
            if (!chat?.endsWith('@g.us')) {
                return await sock.sendMessage(chat, { text: '> ♱ Solo en grupos.' }, { quoted: m });
            }

            if (!nsfwManager.isNsfwEnabled(chat)) {
                return await sock.sendMessage(chat, {
                    text: '*[❗] 𝐋𝐨𝐬 𝐜𝐨𝐦𝐚𝐧𝐝𝐨𝐬 +𝟏𝟖 𝐞𝐬𝐭𝐚́𝐧 𝐝𝐞𝐬𝐚𝐜𝐭𝐢𝐯𝐚𝐝𝐨𝐬 𝐞𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨.*\n> 𝐔𝐬𝐚 .nsfw on 𝐩𝐚𝐫𝐚 𝐚𝐜𝐭𝐢𝐯𝐚𝐫𝐥𝐨𝐬.'
                }, { quoted: m });
            }

            const who = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                || m.message?.extendedTextMessage?.contextInfo?.participant
                || m.quoted?.sender
                || m.sender;

            const senderName = m.pushName || userNames.get(m.sender);
            const isSelf = who === m.sender;
            const targetName = isSelf ? senderName : userNames.get(who);

            const frases = [
                `📝 ${senderName} agarró a ${targetName} de las caderas sin previo aviso y se lo metió de una sola vez. ${targetName} no supo ni cómo reaccionar. Fue... intenso. Muy intenso. 💦`,
                `📝 Nadie vio lo que hizo ${senderName} con ${targetName} detrás de la puerta. Solo se escucharon gritos. Nadie preguntó. 😳🔥`,
                `📝 ${senderName} fue al grano con ${targetName}: ni "hola", ni "cómo estás". Directo. Sin escalas. ${targetName} tardó 3 días en recuperarse. 💀💦`,
                `📝 El médico le dijo a ${targetName} que lo que le hizo ${senderName} era médicamente imposible. Y aun así pasó. 🏥💦`,
                `📝 ${senderName} le demostró a ${targetName} exactamente cuánto vale cada centímetro. ${targetName} aprendió matemáticas ese día. 📐💦`
            ];

            const selfFrases = [
                `📝 ${senderName} se lo intentó meter solo en el baño... y lo logró. Nadie sabe cómo. Nadie quiere saber. 💀`,
                `📝 ${senderName} pasó toda la noche de forma muy íntima consigo mismo. El vecino escuchó todo. Puso el apartamento en venta al día siguiente. 😭`,
            ];

            const frasesList = isSelf ? selfFrases : frases;
            const txt = frasesList[Math.floor(Math.random() * frasesList.length)];
            const mentions = isSelf ? [m.sender] : [m.sender, who];

            await sock.sendMessage(chat, { text: `${txt}\n\n_Unknown Codexツ</>_`, mentions }, { quoted: m });
        }
    }

];

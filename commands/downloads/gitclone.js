const axios = require('axios');

module.exports = {
    name: 'gitclone',
    alias: ['github', 'repodl'],
    category: 'descargas',
    desc: 'Descarga el código fuente (.zip) de un repositorio público de GitHub',
    usage: '.gitclone [https://github.com/usuario/repositorio]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, proporciona el enlace o usuario/repo de GitHub.\nEjemplo: *.gitclone https://github.com/whiskeysockets/baileys*');
        }

        const match = text.match(/(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/i);
        if (!match) {
            return await m.reply('❌ Enlace o formato de repositorio inválido. Debe ser: usuario/repositorio o URL completa de GitHub.');
        }

        const user = match[1];
        let repo = match[2].replace(/\.git$/i, '');

        await m.react('⏳');

        try {
            // Verificar datos del repositorio
            const repoInfoUrl = `https://api.github.com/repos/${user}/${repo}`;
            const infoRes = await axios.get(repoInfoUrl, {
                timeout: 15000,
                headers: { 'User-Agent': 'WhatsApp-Bot-Downloader' }
            });

            const repoData = infoRes.data;
            const defaultBranch = repoData.default_branch || 'main';
            const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball/${defaultBranch}`;

            const zipRes = await axios.get(zipUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 50 * 1024 * 1024, // Máximo 50MB
                headers: { 'User-Agent': 'WhatsApp-Bot-Downloader' }
            });

            const caption = `📦 *Repositorio:* ${user}/${repo}\n` +
                `⭐ *Estrellas:* ${repoData.stargazers_count}\n` +
                `🌿 *Rama:* ${defaultBranch}\n` +
                (repoData.description ? `📝 *Descripción:* ${repoData.description}\n` : '');

            await sock.sendMessage(m.chat, {
                document: Buffer.from(zipRes.data),
                mimetype: 'application/zip',
                fileName: `${repo}-${defaultBranch}.zip`,
                caption: caption
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            if (err.response && err.response.status === 404) {
                return await m.reply(`❌ El repositorio "${user}/${repo}" no existe o es privado.`);
            }
            throw new Error(`Error descargando repositorio: ${err.message}`);
        }
    }
};


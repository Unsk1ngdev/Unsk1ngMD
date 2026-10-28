const axios = require('axios');

module.exports = {
    name: 'gitclone',
    alias: ['github', 'repodl', 'git', 'sc', 'script'],
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

        m.react('⏳').catch(() => {});

        try {
            // Verificar datos del repositorio
            const repoInfoUrl = `https://api.github.com/repos/${user}/${repo}`;
            const infoRes = await axios.get(repoInfoUrl, {
                timeout: 4500,
                headers: { 'User-Agent': 'WhatsApp-Bot-Downloader' }
            });

            const repoData = infoRes.data;
            const defaultBranch = repoData.default_branch || 'main';
            const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball/${defaultBranch}`;
            const fileName = `${repo}-${defaultBranch}.zip`;

            const caption = `📦 *Repositorio:* ${user}/${repo}\n` +
                `⭐ *Estrellas:* ${repoData.stargazers_count}\n` +
                `🌿 *Rama:* ${defaultBranch}\n` +
                (repoData.description ? `📝 *Descripción:* ${repoData.description}\n` : '');

            // Enviar documento directamente por URL sin saturar la RAM con buffers de 50MB
            try {
                await sock.sendMessage(m.chat, {
                    document: { url: zipUrl },
                    mimetype: 'application/zip',
                    fileName: fileName,
                    caption: caption
                }, { quoted: m });
            } catch (_) {
                // Fallback con buffer sólo si el streaming directo falla
                const zipRes = await axios.get(zipUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    maxContentLength: 45 * 1024 * 1024,
                    headers: { 'User-Agent': 'WhatsApp-Bot-Downloader' }
                });
                await sock.sendMessage(m.chat, {
                    document: Buffer.from(zipRes.data),
                    mimetype: 'application/zip',
                    fileName: fileName,
                    caption: caption
                }, { quoted: m });
            }

            m.react('✅').catch(() => {});
        } catch (err) {
            m.react('❌').catch(() => {});
            if (err.response && err.response.status === 404) {
                return await m.reply(`❌ El repositorio "${user}/${repo}" no existe o es privado.`);
            }
            throw new Error(`Error descargando repositorio: ${err.message}`);
        }
    }
};


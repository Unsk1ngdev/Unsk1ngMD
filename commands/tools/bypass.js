'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

/**
 * Intenta resolver y desentrañar enlaces acortados o con redirecciones
 */
async function resolveShortUrl(rawUrl) {
    let target = rawUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
        target = 'https://' + target;
    }

    // 1. Detección rápida de parámetros con URL embebida (común en ad-links)
    try {
        const parsed = new URL(target);
        const queryParams = ['url', 'u', 'link', 'dest', 'target', 'destination', 'r', 'redirect'];
        for (const p of queryParams) {
            const val = parsed.searchParams.get(p);
            if (val) {
                if (/^https?:\/\//i.test(val)) return val;
                // Intento base64
                try {
                    const b64 = Buffer.from(val, 'base64').toString('utf8');
                    if (/^https?:\/\//i.test(b64)) return b64;
                } catch (_) {}
            }
        }
    } catch (_) {}

    // 2. Seguir la cadena de redirecciones HTTP
    try {
        const res = await axios.get(target, {
            timeout: 10000,
            maxRedirects: 15,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        // URL final tras redirecciones
        const finalUrl = res.request?.res?.responseUrl || res.config?.url;
        if (finalUrl && finalUrl !== target) {
            return finalUrl;
        }

        // 3. Revisar si hay etiqueta meta refresh en el HTML
        if (typeof res.data === 'string') {
            const metaRefresh = res.data.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i);
            if (metaRefresh && metaRefresh[1]) {
                const refreshed = metaRefresh[1].trim();
                return refreshed.startsWith('http') ? refreshed : new URL(refreshed, target).href;
            }

            // Revisar si hay window.location.href en scripts
            const scriptRedirect = res.data.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
            if (scriptRedirect && scriptRedirect[1] && scriptRedirect[1].startsWith('http')) {
                return scriptRedirect[1];
            }
        }
    } catch (err) {
        logger.warn('[BYPASS REDIRECT]:', err.message);
    }

    // 4. Fallback a servicio público desacortador
    try {
        const cleanUriRes = await axios.post('https://cleanuri.com/api/v1/unshorten', `url=${encodeURIComponent(target)}`, {
            timeout: 7000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (cleanUriRes.data?.result_url) {
            return cleanUriRes.data.result_url;
        }
    } catch (_) {}

    return target;
}

module.exports = {
    name: 'bypass',
    alias: ['desacortar', 'unshorten', 'desacortador', 'skiplink', 'unshort'],
    category: 'tools',
    desc: 'Salta enlaces acortados y publicidad (linkvertise, ouo.io, bit.ly, tinyurl, etc.) obteniendo el link directo',
    usage: '.bypass <enlace acortado>',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        let url = (args || []).join(' ').trim();

        if (!url && m.quoted) {
            const qText = m.quoted.body || m.quoted.text || '';
            const match = qText.match(/https?:\/\/[^\s]+/i);
            if (match) url = match[0];
        }

        if (!url) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔗 BYPASS DE ENLACES ACORTADOS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Para qué sirve?*',
                    '┃  Salta publicidad y acortadores para darte',
                    '┃  el link directo y limpio al instante.',
                    '┃',
                    '┃├◆ 📌 *Uso:*',
                    '┃  `.bypass <enlace>`',
                    '┃',
                    '┃├◆ 💡 *Ejemplo:*',
                    '┃  `.bypass https://bit.ly/3xyz123`',
                    '┃  `.bypass https://linkvertise.com/...`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react?.('⏳');

            const resolved = await resolveShortUrl(url);

            await m.react?.('🔗');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔓 ENLACE DESACORTADO / DIRECTO 》 ❐',
                    '┃',
                    '┃├◆ 📥 *Enlace original:*',
                    `┃   ${url}`,
                    '┃',
                    '┃├◆ 🎯 *Enlace directo:*',
                    `┃   ${resolved}`,
                    '┃',
                    resolved === url ? '┃├◆ ⚠️ _El enlace no contenía más redirecciones._' : '┃├◆ ✅ _Publicidad y acortadores saltados exitosamente._',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        } catch (err) {
            logger.error('[BYPASS ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ No se pudo resolver el enlace: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};


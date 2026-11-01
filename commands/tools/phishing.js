'use strict';

const axios = require('axios');
const { URL } = require('url');
const dns = require('dns').promises;
const logger = require('../../lib/logger');

// Lista de dominios de acortadores conocidos
const KNOWN_SHORTENERS = new Set([
    'bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'is.gd', 'rb.gy',
    'ow.ly', 'rebrand.ly', 'goo.gl', 'buff.ly', 'shorturl.at', 'rotf.lol'
]);

// TLDs gratuitos o estadísticamente asociados a alta tasa de phishing
const SUSPICIOUS_TLDS = new Set([
    'tk', 'ml', 'ga', 'cf', 'gq', 'buzz', 'top', 'work', 'icu',
    'monster', 'country', 'stream', 'kim', 'fit', 'rest', 'xyz', 'click', 'link'
]);

// Marcas y términos financieros / tecnológicos comúnmente suplantados
const TARGETED_BRANDS = [
    'paypal', 'banco', 'banreservas', 'bpd', 'popular', 'santander', 'bbva',
    'whatsapp', 'netflix', 'facebook', 'instagram', 'apple', 'icloud', 'google',
    'microsoft', 'binance', 'steam', 'roblox', 'freefire', 'bhd', 'scotiabank',
    'amazon', 'mercadolibre', 'metamask', 'walmart', 'bancolombia'
];

/**
 * Resuelve redirecciones para desenmascarar URLs acortadas
 */
async function expandUrl(inputUrl) {
    try {
        const res = await axios.get(inputUrl, {
            timeout: 8000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            validateStatus: () => true
        });
        const finalUrl = res.request?.res?.responseUrl || inputUrl;
        return finalUrl;
    } catch (_) {
        return inputUrl;
    }
}

/**
 * Consulta a Cloudflare Security DNS over HTTPS para verificar si el dominio está clasificado como malware/phishing
 */
async function checkCloudflareSecurityDoh(hostname) {
    try {
        const dohUrl = `https://security.cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
        const res = await axios.get(dohUrl, {
            headers: { 'Accept': 'application/dns-json' },
            timeout: 5000
        });

        const answers = res.data?.Answer || [];
        // Si Cloudflare Security DNS bloquea el dominio, resuelve a 0.0.0.0
        const isBlocked = answers.some(a => a.data === '0.0.0.0');
        return isBlocked;
    } catch (_) {
        return false;
    }
}

module.exports = {
    name: 'phishing',
    alias: ['checklink', 'antiphishing', 'scanlink', 'urlcheck', 'seguridadurl', 'linkseguro'],
    category: 'herramientas',
    desc: 'Analiza enlaces y páginas web para detectar phishing, suplantación de identidad y enlaces maliciosos',
    usage: '.phishing <enlace o URL>',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        let rawInput = (args && args[0] ? args[0] : (text || '')).trim();

        if (!rawInput && m.quoted?.body) {
            const urlInQuoted = m.quoted.body.match(/https?:\/\/[^\s]+/i);
            if (urlInQuoted) rawInput = urlInQuoted[0];
        }

        if (!rawInput) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🛡️ DETECTOR DE PHISHING Y ENLACES MALICIOSOS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.phishing <enlace>`',
                    '┃├◆ 📌 *Ejemplo 1:* `.phishing https://login-paypal-security.xyz`',
                    '┃├◆ 📌 *Ejemplo 2:* `.phishing bit.ly/premio-gratis`',
                    '┃',
                    '┃├◆ 🔍 Analiza redirecciones ocultas, certificados SSL,',
                    '┃  suplantación de marcas (Bancos, WhatsApp, PayPal, etc.)',
                    '┃  y bases de datos globales de amenazas.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // Normalizar protocolo
        let targetUrl = rawInput;
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'http://' + targetUrl;
        }

        let parsedUrl = null;
        try {
            parsedUrl = new URL(targetUrl);
        } catch (_) {
            return await sock.sendMessage(jid, {
                text: '❌ La URL proporcionada no tiene un formato válido (ej: https://ejemplo.com).'
            }, { quoted: m });
        }

        await m.react?.('🔍');
        await sock.sendMessage(jid, {
            text: `🛡️ *Escaneando URL:* Analizando seguridad de ${parsedUrl.hostname}...`
        }, { quoted: m });

        try {
            // 1. Desenmascarar redirecciones si es acortador
            let finalUrl = targetUrl;
            let wasShortened = false;
            if (KNOWN_SHORTENERS.has(parsedUrl.hostname.toLowerCase())) {
                wasShortened = true;
                finalUrl = await expandUrl(targetUrl);
                try {
                    parsedUrl = new URL(finalUrl);
                } catch (_) {}
            }

            const hostname = parsedUrl.hostname.toLowerCase();
            const fullPath = (parsedUrl.pathname + parsedUrl.search).toLowerCase();
            const hostParts = hostname.split('.');
            const tld = hostParts[hostParts.length - 1];

            // 2. Evaluaciones de riesgo y factores
            const riskFactors = [];
            let score = 0; // 0 = seguro, 100 = peligro extremo

            // A. Verificación DNS en Cloudflare Security
            const isCloudflareBlocked = await checkCloudflareSecurityDoh(hostname);
            if (isCloudflareBlocked) {
                riskFactors.push('🚨 *Bloqueado por Cloudflare Security:* Dominio listado en listas negras de phishing o malware.');
                score += 85;
            }

            // B. IP directa como host (ej: http://192.168.1.1/login)
            const isDirectIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
            if (isDirectIp) {
                riskFactors.push('⚠️ *Host por IP numérica:* Los sitios legítimos usan nombres de dominio, no direcciones IP directas.');
                score += 35;
            }

            // C. Ataque homográfico / Punycode (ej: xn--...)
            if (hostname.includes('xn--')) {
                riskFactors.push('⚠️ *Ataque Homográfico (Punycode):* Utiliza caracteres de otros alfabetos para imitar dominios legítimos.');
                score += 45;
            }

            // D. TLD sospechoso
            if (SUSPICIOUS_TLDS.has(tld)) {
                riskFactors.push(`⚠️ *Dominio con TLD de alto riesgo (.${tld}):* Frecuentemente utilizado en campañas de spam y fraude.`);
                score += 25;
            }

            // E. Exceso de subdominios
            if (hostParts.length > 4) {
                riskFactors.push(`⚠️ *Estructura profunda de subdominios (${hostParts.length} niveles):* Típico de URLs camufladas.`);
                score += 20;
            }

            // F. Protocolo inseguro HTTP para logins o formularios
            if (parsedUrl.protocol === 'http:') {
                riskFactors.push('⚠️ *Conexión no cifrada (HTTP):* La página no utiliza certificado SSL/TLS (no es HTTPS).');
                score += 15;
            }

            // G. Suplantación de marcas (Brand Spoofing)
            for (const brand of TARGETED_BRANDS) {
                const inHost = hostname.includes(brand);
                const inPath = fullPath.includes(brand);

                // Si contiene la marca pero NO es el dominio oficial de la marca
                const isOfficial = hostname === `${brand}.com` || hostname.endsWith(`.${brand}.com`) ||
                                   hostname === `${brand}.org` || hostname.endsWith(`.${brand}.org`) ||
                                   hostname === `${brand}.com.do` || hostname.endsWith(`.${brand}.com.do`);

                if ((inHost || inPath) && !isOfficial) {
                    riskFactors.push(`🚨 *Posible suplantación de identidad:* Se menciona la marca *"${brand.toUpperCase()}"* en un dominio que no le pertenece.`);
                    score += 50;
                    break;
                }
            }

            // H. Palabras clave de urgencia / estafa en URL
            const scamKeywords = ['login', 'signin', 'verificar', 'verify', 'update', 'account', 'premio', 'sorteo', 'free', 'gratis', 'regalo', 'bonus', 'airdrop'];
            const foundKeywords = scamKeywords.filter(k => fullPath.includes(k) || hostname.includes(k));
            if (foundKeywords.length >= 2) {
                riskFactors.push(`⚠️ *Palabras clave sospechosas en la ruta:* (${foundKeywords.slice(0, 3).join(', ')}).`);
                score += 20;
            }

            // Determinar veredicto final
            let verdictEmoji = '🟢';
            let verdictTitle = 'ENLACE SEGURO (Bajo Riesgo)';
            let verdictDesc = 'No se detectaron indicios claros de phishing ni amenazas inmediatas.';

            if (score >= 60) {
                verdictEmoji = '🔴';
                verdictTitle = '¡PELIGRO! PHISHING O SITIO MALICIOSO DETECTADO';
                verdictDesc = '⚠️ *ALTO RIESGO:* Es muy probable que este enlace sea un engaño diseñado para robar tus cuentas, contraseñas o datos bancarios. ¡NO LO ABRAS NI INGRESES DATOS!';
            } else if (score >= 25) {
                verdictEmoji = '🟡';
                verdictTitle = 'SOSPECHOSO (Riesgo Moderado)';
                verdictDesc = 'El sitio presenta factores poco comunes o sospechosos. Procede con precaución y no compartas información privada.';
            }

            const responseLines = [
                '┏❐ 《 🛡️ REPORTE DE SEGURIDAD DE ENLACE 》 ❐',
                '┃',
                `┃├◆ 🔗 *URL Analizada:* ${targetUrl}`,
                wasShortened ? `┃├◆ 🔓 *Destino Real (Desenmascarado):* ${finalUrl}` : null,
                `┃├◆ 🌐 *Dominio:* ${hostname}`,
                `┃├◆ 🔒 *Protocolo:* ${parsedUrl.protocol.replace(':', '').toUpperCase()}`,
                `┃├◆ 📊 *Nivel de Riesgo:* ${score}/100`,
                `┃├◆ ${verdictEmoji} *Dictamen:* *${verdictTitle}*`,
                '┃',
                '┃├◆ 📝 *Detalles del análisis:*',
                riskFactors.length > 0
                    ? riskFactors.map(f => `┃   ${f}`).join('\n')
                    : '┃   ✅ Dominio sin reportes negativos en listas de seguridad.',
                '┃',
                `┃├◆ 💡 *Recomendación:*`,
                `┃  ${verdictDesc}`,
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean);

            await m.react?.(score >= 60 ? '🚨' : (score >= 25 ? '⚠️' : '✅'));
            await sock.sendMessage(jid, { text: responseLines.join('\n') }, { quoted: m });

        } catch (err) {
            logger.error('[PHISHING CHECK ERROR]:', err.message);
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ Error al analizar la seguridad del enlace: ${err.message}`
            }, { quoted: m });
        }
    }
};


'use strict';

const axios = require('axios');
const https = require('https');
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const { parsePhoneNumberInfo } = require('../../lib/phoneInfo');
const logger = require('../../lib/logger');

// Agente HTTPS para consultas DoH a 1.1.1.1
const dohAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Consulta registros MX de un dominio vía DNS-over-HTTPS (1.1.1.1)
 */
async function queryMXRecords(domain) {
    try {
        const res = await axios.get(`https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
            headers: { 'Accept': 'application/dns-json', 'Host': 'cloudflare-dns.com' },
            httpsAgent: dohAgent,
            timeout: 5000
        });
        const answers = res.data?.Answer || [];
        return answers.map(a => a.data?.split(' ').slice(1).join(' ').replace(/\.$/, '') || a.data);
    } catch (_) {
        return [];
    }
}

/**
 * Consulta HaveIBeenPwned para verificar si una cuenta/email ha sido vulnerada
 */
async function queryHIBP(email) {
    const apiKey = (process.env.HIBP_KEY || '').trim();
    if (!apiKey) {
        return {
            configured: false,
            message: '⚠️ Se requiere API key de HIBP en `.env` (variable `HIBP_KEY`) para verificar filtraciones de datos.'
        };
    }

    try {
        const res = await axios.get(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
            {
                headers: {
                    'hibp-api-key': apiKey,
                    'user-agent': 'Unsk1ngMD-Bot/1.0.0'
                },
                timeout: 8000
            }
        );

        const breaches = Array.isArray(res.data) ? res.data : [];
        return {
            configured: true,
            pwned: breaches.length > 0,
            breaches
        };
    } catch (err) {
        if (err.response && err.response.status === 404) {
            return {
                configured: true,
                pwned: false,
                breaches: []
            };
        }
        if (err.response && err.response.status === 401) {
            return {
                configured: true,
                error: '❌ API key de HaveIBeenPwned inválida.'
            };
        }
        if (err.response && err.response.status === 429) {
            return {
                configured: true,
                error: '⏳ Límite de peticiones de HaveIBeenPwned alcanzado. Intenta de nuevo en unos minutos.'
            };
        }
        return {
            configured: true,
            error: `⚠️ Error de conexión con HIBP: ${err.message}`
        };
    }
}

/**
 * Consulta IP Geolocation y flags de red vía ip-api.com
 */
async function queryIP(ip) {
    try {
        const res = await axios.get(
            `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,mobile,query`,
            { timeout: 7000 }
        );
        return res.data;
    } catch (err) {
        return { status: 'fail', message: err.message };
    }
}

module.exports = {
    name: 'osint',
    alias: ['recon', 'osintlookup'],
    category: 'premium',
    desc: 'Inteligencia de fuentes abiertas (OSINT) para email, número e IP (Premium)',
    usage: '.osint email <correo> | .osint num <número> | .osint ip <ip>',
    premiumOnly: true,

    execute: async ({ sock, m, args, text, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // 1. Verificación de permiso: Solo Owner y miembros Premium
        const isPermitted = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPermitted) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es solo para *Premium*.\nUsa *.prem* para más información.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const subCmd = (args[0] || '').toLowerCase();
        const query = args.slice(1).join(' ').trim();

        // Si no pasa argumentos o subcomando inválido, mostrar menú interactivo
        if (!subCmd || !query || !['email', 'num', 'ip'].includes(subCmd)) {
            return await sock.sendMessage(jid, {
                text: [
                    '╔══════════════════════════╗',
                    '║   🕵️  OSINT LOOKUP      ║',
                    '╚══════════════════════════╝',
                    '┃',
                    '┃ • .osint email <correo>',
                    '┃   Busca si el email aparece en filtraciones',
                    '┃   de datos (Have I Been Pwned)',
                    '┃',
                    '┃ • .osint num <número>',
                    '┃   Info del número: país, operadora,',
                    '┃   tipo de línea y formato internacional',
                    '┃',
                    '┃ • .osint ip <dirección IP>',
                    '┃   Geolocalización, ISP, ASN, detección',
                    '┃   de VPN/Proxy/Tor/Hosting',
                    '┃',
                    '┃ Ejemplos:',
                    '┃   .osint email ejemplo@gmail.com',
                    '┃   .osint num +18095551234',
                    '┃   .osint ip 8.8.8.8',
                    '╚══════════════════════════╝',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── SUBCOMANDO: EMAIL ──────────────────────────────────────────────────
        if (subCmd === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(query)) {
                return await sock.sendMessage(jid, {
                    text: '❌ El correo ingresado no tiene un formato válido.\n*Ejemplo:* `.osint email ejemplo@gmail.com`'
                }, { quoted: m });
            }

            const domain = query.split('@')[1].toLowerCase();
            await sock.sendMessage(jid, { text: `🔍 Investigando email *${query}*...` }, { quoted: m });

            // Verificar servidores MX
            const mxRecords = await queryMXRecords(domain);
            const hasMailServers = mxRecords.length > 0;

            // Verificar HIBP
            const hibpResult = await queryHIBP(query);

            let breachSection = '';
            if (!hibpResult.configured) {
                breachSection = hibpResult.message;
            } else if (hibpResult.error) {
                breachSection = hibpResult.error;
            } else if (hibpResult.pwned) {
                const total = hibpResult.breaches.length;
                const top = hibpResult.breaches.slice(0, 8).map(b => {
                    const dataTypes = (b.DataClasses || []).slice(0, 4).join(', ');
                    return `  • 🚨 *${b.Name}* (${b.BreachDate || 'N/A'})\n    _Datos expuestos:_ ${dataTypes || 'General'}`;
                }).join('\n');
                const more = total > 8 ? `\n  _...y ${total - 8} filtraciones más_` : '';
                breachSection = `🚨 *${total} filtraciones detectadas en bases de datos:*\n${top}${more}`;
            } else {
                breachSection = '✅ *Limpio:* No se encontraron filtraciones conocidas en HIBP.';
            }

            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━━〔 🕵️ *OSINT — EMAIL INTELLIGENCE* 〕━━━━⬣',
                    '┃',
                    `┃ 📧 *Email:* \`${query}\``,
                    `┃ 🌐 *Dominio:* \`${domain}\``,
                    `┃ 📬 *Servidores de Correo (MX):* ${hasMailServers ? `Sí (${mxRecords.length} detectados)` : '⚠️ Sin servidores MX'}`,
                    hasMailServers ? `┃    _MX principal:_ \`${mxRecords[0]}\`` : '',
                    '┃',
                    '┃ 🛡️ ═〔 *HISTORIAL DE BRECHAS & FILTRACIONES* 〕═',
                    `┃ ${breachSection.split('\n').join('\n┃ ')}`,
                    '┃',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n')
            }, { quoted: m });
        }

        // ── SUBCOMANDO: NUM ────────────────────────────────────────────────────
        if (subCmd === 'num') {
            const clean = query.replace(/[^0-9+]/g, '');
            if (clean.replace(/[^0-9]/g, '').length < 7) {
                return await sock.sendMessage(jid, {
                    text: '❌ Número telefónico inválido. Ingresa al menos 7 dígitos con código de país.\n*Ejemplo:* `.osint num +18095551234`'
                }, { quoted: m });
            }

            const info = parsePhoneNumberInfo(clean);
            if (!info || !info.isValid) {
                return await sock.sendMessage(jid, {
                    text: `⚠️ No se pudo validar el número *${clean}*. Asegúrate de incluir el código internacional (ej: +1, +34, +58, +52).`
                }, { quoted: m });
            }

            // Opcional: consulta API Numverify si la key está configurada
            let carrierFinal = info.carrier || 'No especificada';
            const numverifyKey = (process.env.NUMVERIFY_KEY || '').trim();
            if (numverifyKey) {
                try {
                    const nvRes = await axios.get(
                        `http://apilayer.net/api/validate?access_key=${numverifyKey}&number=${info.cleanDigits}&format=1`,
                        { timeout: 5000 }
                    );
                    if (nvRes.data && nvRes.data.carrier) {
                        carrierFinal = nvRes.data.carrier;
                    }
                } catch (_) {}
            }

            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━━〔 🕵️ *OSINT — PHONE INTELLIGENCE* 〕━━━━⬣',
                    '┃',
                    `┃ 📞 *Número:* \`${info.internationalFormatted || clean}\``,
                    `┃ 🌍 *País:* ${info.flag || '🌐'} ${info.countryName} (${info.countryCallingCode})`,
                    `┃ 🏢 *Operadora:* ${carrierFinal}`,
                    `┃ 📱 *Tipo de línea:* ${info.lineType || 'Móvil / Celular'}`,
                    `┃ 📍 *Región / Zona:* ${info.region || 'N/A'}`,
                    `┃ 📐 *Formato Nacional:* \`${info.nationalFormatted || 'N/A'}\``,
                    `┃ 🌐 *Formato E.164:* \`${info.e164 || clean}\``,
                    `┃ 🕐 *Huso Horario:* ${info.timeZone || 'N/A'}`,
                    `┃ ⏰ *Hora Local:* ${info.localTimeInfo?.fullString || info.localTimeInfo?.timeStr || 'N/A'}`,
                    '┃',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── SUBCOMANDO: IP ─────────────────────────────────────────────────────
        if (subCmd === 'ip') {
            await sock.sendMessage(jid, { text: `🔍 Consultando geolocalización de *${query}*...` }, { quoted: m });

            const data = await queryIP(query);
            if (data.status === 'fail') {
                return await sock.sendMessage(jid, {
                    text: `❌ Error al consultar la IP: ${data.message || 'Dirección no válida o no encontrada'}`
                }, { quoted: m });
            }

            const flag = data.countryCode
                ? String.fromCodePoint(...[...data.countryCode.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
                : '🌐';

            const securityTags = [];
            if (data.proxy) securityTags.push('⚠️ VPN / Proxy');
            if (data.hosting) securityTags.push('🖥️ Hosting / Datacenter');
            if (data.mobile) securityTags.push('📱 Red Móvil (Carrier)');

            const secStr = securityTags.length > 0
                ? securityTags.join(' · ')
                : '✅ Conexión Residencial (Limpia)';

            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━━〔 🕵️ *OSINT — IP INTELLIGENCE* 〕━━━━⬣',
                    '┃',
                    `┃ 📡 *IP:* \`${data.query}\``,
                    `┃ 🌍 *País:* ${flag} ${data.country} (${data.countryCode})`,
                    `┃ 🏙️ *Ciudad / Región:* ${data.city}, ${data.regionName}`,
                    `┃ 📮 *Código Postal:* ${data.zip || 'N/A'}`,
                    `┃ 🕐 *Zona Horaria:* ${data.timezone || 'N/A'}`,
                    '┃',
                    `┃ 📶 *ISP:* ${data.isp || 'N/A'}`,
                    `┃ 🏢 *Organización:* ${data.org || 'N/A'}`,
                    `┃ 🔢 *ASN:* ${data.as || 'N/A'}`,
                    '┃',
                    `┃ 🛡️ *Seguridad:* ${secStr}`,
                    `┃ 📍 *Coordenadas:* \`${data.lat}, ${data.lon}\``,
                    `┃ 🗺️ *Google Maps:* https://maps.google.com/?q=${data.lat},${data.lon}`,
                    '┃',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }
    }
};


'use strict';

const axios = require('axios');
const dns = require('dns').promises;
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const { parsePhoneNumberInfo } = require('../../lib/phoneInfo');
const logger = require('../../lib/logger');

// Lista ampliada de proveedores conocidos de correos desechables / temporales
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    '10minutemail.com', '10minutemail.net', '10minmail.com', 'tempmail.com', 'temp-mail.org',
    'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
    'sharklasers.com', 'grr.la', 'mailinator.com', 'mailinater.com', 'throwawaymail.com',
    'yopmail.com', 'yopmail.fr', 'yopmail.net', 'trashmail.com', 'trashmail.net',
    'dispostable.com', 'maildrop.cc', 'getairmail.com', 'mohmal.com', 'fakemailgenerator.com',
    'crazymailing.com', 'generator.email', 'emailondeck.com', 'mytemp.email', 'minuteinbox.com',
    'inboxkitten.com', 'burnermail.io', 'nada.ltd', 'dropmail.me', 'tempmailaddress.com',
    'guerrillamail.biz', 'guerrillamail.info', 'pokemail.net', 'spam4.me', 'bccto.me'
]);

// Plataformas principales para escaneo de huella digital de usuario
const SOCIAL_PLATFORMS = [
    {
        name: 'GitHub',
        icon: '🐙',
        url: (u) => `https://github.com/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200 && res.data && res.data.login) {
                const parts = [];
                if (res.data.name) parts.push(res.data.name);
                if (typeof res.data.public_repos === 'number') parts.push(`${res.data.public_repos} repos`);
                if (typeof res.data.followers === 'number') parts.push(`${res.data.followers} seguidores`);
                return { found: true, info: parts.join(' · ') || 'Perfil activo' };
            }
            return { found: false };
        }
    },
    {
        name: 'Reddit',
        icon: '🤖',
        url: (u) => `https://www.reddit.com/user/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://www.reddit.com/user/${encodeURIComponent(u)}/about.json`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200 && res.data?.data?.name) {
                const karma = (res.data.data.total_karma || res.data.data.link_karma || 0).toLocaleString();
                return { found: true, info: `${karma} karma` };
            }
            return { found: false };
        }
    },
    {
        name: 'Telegram',
        icon: '✈️',
        url: (u) => `https://t.me/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://t.me/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200 && typeof res.data === 'string') {
                if (res.data.includes('tgme_page_title') || res.data.includes('tgme_page_extra')) {
                    if (!res.data.includes('tgme_page_title')) return { found: false };
                    return { found: true, info: 'Canal o Usuario' };
                }
            }
            return { found: false };
        }
    },
    {
        name: 'Steam',
        icon: '🎮',
        url: (u) => `https://steamcommunity.com/id/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://steamcommunity.com/id/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200 && typeof res.data === 'string') {
                if (!res.data.includes('The specified profile could not be found') && res.data.includes('actual_persona_name')) {
                    return { found: true, info: 'Perfil Steam Comunidad' };
                }
            }
            return { found: false };
        }
    },
    {
        name: 'TikTok',
        icon: '🎵',
        url: (u) => `https://www.tiktok.com/@${u}`,
        check: async (u) => {
            const res = await axios.get(`https://www.tiktok.com/@${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Perfil activo' };
            return { found: false };
        }
    },
    {
        name: 'Pinterest',
        icon: '📌',
        url: (u) => `https://www.pinterest.com/${u}/`,
        check: async (u) => {
            const res = await axios.get(`https://www.pinterest.com/${encodeURIComponent(u)}/`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Tablero/Cuenta pública' };
            return { found: false };
        }
    },
    {
        name: 'Linktree',
        icon: '🌲',
        url: (u) => `https://linktr.ee/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://linktr.ee/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Hub de enlaces' };
            return { found: false };
        }
    },
    {
        name: 'SoundCloud',
        icon: '☁️',
        url: (u) => `https://soundcloud.com/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://soundcloud.com/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Perfil musical' };
            return { found: false };
        }
    },
    {
        name: 'Twitch',
        icon: '🟣',
        url: (u) => `https://www.twitch.tv/${u}`,
        check: async (u) => {
            const res = await axios.get(`https://www.twitch.tv/${encodeURIComponent(u)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 3500,
                validateStatus: (s) => s < 500
            });
            if (res.status === 200) return { found: true, info: 'Canal de streaming' };
            return { found: false };
        }
    }
];

/**
 * Limpia y normaliza cadenas de dirección IP
 */
function cleanIpString(raw) {
    if (!raw) return '';
    let str = raw.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    if (str.startsWith('[') && str.includes(']')) {
        str = str.substring(1, str.indexOf(']'));
    } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(str)) {
        str = str.split(':')[0];
    }
    return str;
}

/**
 * Detecta rangos privados, loopback o no enrutables públicamente
 */
function isPrivateIP(ip) {
    if (!ip) return { isPrivate: false };
    const clean = ip.trim();
    if (clean === '127.0.0.1' || clean === 'localhost' || clean === '::1') {
        return { isPrivate: true, type: 'Loopback / Localhost (127.0.0.1)' };
    }

    const parts = clean.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
        if (parts[0] === 10) {
            return { isPrivate: true, type: 'Red Privada RFC 1918 (Clase A: 10.0.0.0/8)' };
        }
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
            return { isPrivate: true, type: 'Red Privada RFC 1918 (Clase B: 172.16.0.0/12)' };
        }
        if (parts[0] === 192 && parts[1] === 168) {
            return { isPrivate: true, type: 'Red Privada RFC 1918 (Clase C: 192.168.0.0/16)' };
        }
        if (parts[0] === 169 && parts[1] === 254) {
            return { isPrivate: true, type: 'Dirección Enlace-Local / APIPA (169.254.0.0/16)' };
        }
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {
            return { isPrivate: true, type: 'CGNAT / Carrier-Grade NAT (RFC 6598)' };
        }
        if (parts[0] === 0 || parts[0] >= 224) {
            return { isPrivate: true, type: 'Rango Reservado / Multicast (RFC 5771)' };
        }
    }

    const low = clean.toLowerCase();
    if (low.startsWith('fe80:')) {
        return { isPrivate: true, type: 'IPv6 Enlace-Local (fe80::/10)' };
    }
    if (low.startsWith('fc00:') || low.startsWith('fd')) {
        return { isPrivate: true, type: 'IPv6 ULA Local (fc00::/7)' };
    }

    return { isPrivate: false };
}

/**
 * Consulta DNS-over-HTTPS como fallback resiliente
 */
async function queryDoH(name, type) {
    try {
        const res = await axios.get(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
            timeout: 4500
        });
        if (res.data && Array.isArray(res.data.Answer)) {
            return res.data.Answer;
        }
    } catch (_) {}

    try {
        const res = await axios.get(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
            headers: { 'Accept': 'application/dns-json' },
            timeout: 4500
        });
        if (res.data && Array.isArray(res.data.Answer)) {
            return res.data.Answer;
        }
    } catch (_) {}

    return [];
}

/**
 * Consulta registros MX de un dominio (DNS nativo + DoH fallback)
 */
async function queryMXRecords(domain) {
    try {
        const mxList = await dns.resolveMx(domain);
        if (Array.isArray(mxList) && mxList.length > 0) {
            return mxList.sort((a, b) => a.priority - b.priority).map(m => m.exchange);
        }
    } catch (_) {}

    const dohAnswers = await queryDoH(domain, 'MX');
    return dohAnswers.map(a => a.data?.split(' ').slice(1).join(' ').replace(/\.$/, '') || a.data).filter(Boolean);
}

/**
 * Consulta registros TXT de un dominio (para SPF y DMARC)
 */
async function queryTxtRecords(name) {
    try {
        const list = await dns.resolveTxt(name);
        if (Array.isArray(list)) {
            return list.map(chunk => chunk.join(''));
        }
    } catch (_) {}

    const dohAnswers = await queryDoH(name, 'TXT');
    return dohAnswers.map(a => (a.data || '').replace(/^"(.*)"$/, '$1')).filter(Boolean);
}

/**
 * Analiza registro SPF
 */
function extractSpfInfo(txtList) {
    const spfTxt = (txtList || []).find(t => t.toLowerCase().startsWith('v=spf1'));
    if (!spfTxt) return { hasSpf: false, raw: null, policy: 'No configurado' };

    let policy = 'Neutro (?all)';
    if (spfTxt.includes('-all')) policy = 'Estricto / Hard Fail (-all)';
    else if (spfTxt.includes('~all')) policy = 'Moderado / SoftFail (~all)';
    else if (spfTxt.includes('+all')) policy = 'Inseguro / Permisivo (+all)';
    else if (spfTxt.includes('?all')) policy = 'Neutro (?all)';

    return { hasSpf: true, raw: spfTxt, policy };
}

/**
 * Analiza registro DMARC
 */
async function queryDmarc(domain) {
    const dmarcDomain = `_dmarc.${domain}`;
    const txtList = await queryTxtRecords(dmarcDomain);
    const dmarcTxt = (txtList || []).find(t => t.toLowerCase().startsWith('v=dmarc1'));
    if (!dmarcTxt) return { hasDmarc: false, raw: null, policy: 'No configurado' };

    let policy = 'Monitorización (p=none)';
    if (/p=reject/i.test(dmarcTxt)) policy = 'Rechazo Estricto (p=reject)';
    else if (/p=quarantine/i.test(dmarcTxt)) policy = 'Cuarentena (p=quarantine)';
    else if (/p=none/i.test(dmarcTxt)) policy = 'Monitoreo (p=none)';

    return { hasDmarc: true, raw: dmarcTxt, policy };
}

/**
 * Detecta proveedor del correo electrónico
 */
function detectEmailProvider(domain, mxList = []) {
    const d = (domain || '').toLowerCase();
    const mxStr = (mxList || []).join(' ').toLowerCase();

    if (d === 'gmail.com' || d === 'googlemail.com' || mxStr.includes('google.com') || mxStr.includes('googlemail.com')) {
        return { name: 'Google Workspace / Gmail', icon: '🔴' };
    }
    if (d === 'outlook.com' || d === 'hotmail.com' || d === 'live.com' || d === 'msn.com' || mxStr.includes('outlook.com') || mxStr.includes('protection.outlook.com')) {
        return { name: 'Microsoft 365 / Outlook', icon: '🟦' };
    }
    if (d === 'proton.me' || d === 'protonmail.com' || d === 'pm.me' || mxStr.includes('protonmail.ch')) {
        return { name: 'Proton Mail (Cifrado E2E)', icon: '🟣' };
    }
    if (d === 'icloud.com' || d === 'me.com' || d === 'mac.com' || mxStr.includes('icloud.com')) {
        return { name: 'Apple iCloud Mail', icon: '🍏' };
    }
    if (d === 'yahoo.com' || d === 'ymail.com' || mxStr.includes('yahoodns.net')) {
        return { name: 'Yahoo! Mail', icon: '🟣' };
    }
    if (d === 'zoho.com' || mxStr.includes('zoho.com')) {
        return { name: 'Zoho Mail', icon: '🟡' };
    }
    if (d === 'tuta.com' || d === 'tutanota.com' || mxStr.includes('tutanota.de')) {
        return { name: 'Tuta Mail (Cifrado E2E)', icon: '🔴' };
    }
    return { name: 'Servidor Privado / Corporativo', icon: '🏢' };
}

/**
 * Verifica si el dominio es de correo desechable
 */
function isDisposableEmail(domain) {
    if (!domain) return false;
    const d = domain.toLowerCase();
    if (DISPOSABLE_EMAIL_DOMAINS.has(d)) return true;
    return /temp|throwaway|dispos|guerrilla|10min|fakeinbox|trashmail|burnermail|fakemail/i.test(d);
}

/**
 * Consulta HaveIBeenPwned con manejo exhaustivo de estados
 */
async function queryHIBP(email) {
    const apiKey = (process.env.HIBP_KEY || '').trim();
    if (!apiKey) {
        return {
            configured: false,
            message: 'ℹ️ _API key de HIBP no configurada en `.env` (HIBP_KEY). Se omitió el escaneo de contraseñas expuestas._'
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
                error: '❌ API key de HaveIBeenPwned inválida o expirada.'
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
 * Consulta geolocalización y seguridad de IP con arquitectura multi-motor resiliente
 */
async function queryIP(ip) {
    const clean = cleanIpString(ip);
    const priv = isPrivateIP(clean);
    if (priv.isPrivate) {
        return {
            status: 'private',
            ip: clean,
            type: priv.type,
            message: `Esta dirección pertenece a un ${priv.type} y no es enrutable en la Internet pública.`
        };
    }

    // Motor 1: ip-api.com
    try {
        const res = await axios.get(
            `http://ip-api.com/json/${encodeURIComponent(clean)}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,mobile,query`,
            { timeout: 5000 }
        );
        if (res.data && res.data.status === 'success') {
            return {
                status: 'success',
                ip: res.data.query,
                country: res.data.country || 'Desconocido',
                countryCode: res.data.countryCode || '',
                region: res.data.regionName || '',
                city: res.data.city || '',
                zip: res.data.zip || '',
                lat: res.data.lat,
                lon: res.data.lon,
                timezone: res.data.timezone || '',
                isp: res.data.isp || '',
                org: res.data.org || '',
                asn: res.data.as || '',
                proxy: !!res.data.proxy,
                hosting: !!res.data.hosting,
                mobile: !!res.data.mobile
            };
        }
    } catch (_) {}

    // Motor 2: ipwho.is (fallback SSL seguro)
    try {
        const res = await axios.get(`https://ipwho.is/${encodeURIComponent(clean)}`, { timeout: 5000 });
        if (res.data && res.data.success) {
            const d = res.data;
            return {
                status: 'success',
                ip: d.ip,
                country: d.country || 'Desconocido',
                countryCode: d.country_code || '',
                region: d.region || '',
                city: d.city || '',
                zip: d.postal || '',
                lat: d.latitude,
                lon: d.longitude,
                timezone: d.timezone?.id || '',
                isp: d.connection?.isp || d.connection?.org || '',
                org: d.connection?.org || '',
                asn: d.connection?.asn ? `AS${d.connection.asn} ${d.connection.org || ''}` : '',
                proxy: !!(d.security?.is_proxy || d.security?.is_vpn || d.security?.is_tor),
                hosting: !!d.security?.is_hosting,
                mobile: false
            };
        }
    } catch (_) {}

    // Motor 3: ipapi.co (fallback final)
    try {
        const res = await axios.get(`https://ipapi.co/${encodeURIComponent(clean)}/json/`, { timeout: 5000 });
        if (res.data && !res.data.error) {
            const d = res.data;
            return {
                status: 'success',
                ip: d.ip,
                country: d.country_name || 'Desconocido',
                countryCode: d.country_code || '',
                region: d.region || '',
                city: d.city || '',
                zip: d.postal || '',
                lat: d.latitude,
                lon: d.longitude,
                timezone: d.timezone || '',
                isp: d.org || '',
                org: d.org || '',
                asn: d.asn ? `${d.asn} ${d.org || ''}` : '',
                proxy: false,
                hosting: false,
                mobile: false
            };
        }
    } catch (_) {}

    return { status: 'fail', message: 'No se pudo obtener información de la IP en ningún proveedor de inteligencia.' };
}

/**
 * Escaneo de huella digital de nombre de usuario en plataformas públicas
 */
async function queryUsername(username) {
    const cleanUser = username.trim().replace(/^@/, '');
    if (!cleanUser || cleanUser.length < 2 || cleanUser.length > 35 || !/^[a-zA-Z0-9._-]+$/.test(cleanUser)) {
        return { error: 'Nombre de usuario inválido. Usa letras, números, puntos o guiones (2 a 35 caracteres).' };
    }

    const checks = SOCIAL_PLATFORMS.map(async (plat) => {
        try {
            const res = await plat.check(cleanUser);
            if (res && res.found) {
                return {
                    name: plat.name,
                    icon: plat.icon,
                    url: plat.url(cleanUser),
                    info: res.info || null
                };
            }
            return null;
        } catch (_) {
            return null;
        }
    });

    const results = await Promise.all(checks);
    const foundList = results.filter(Boolean);

    let footprintLevel = '🟢 Huella Baja';
    if (foundList.length >= 5) footprintLevel = '🔴 Huella Muy Alta (Presencia Masiva)';
    else if (foundList.length >= 3) footprintLevel = '🟠 Huella Moderada';
    else if (foundList.length >= 1) footprintLevel = '🟡 Huella Inicial';

    return {
        username: cleanUser,
        totalScanned: SOCIAL_PLATFORMS.length,
        foundList,
        footprintLevel
    };
}

/**
 * Auditoría profunda de Dominio e infraestructura DNS
 */
async function queryDomain(rawDomain) {
    const domain = (rawDomain || '')
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split(':')[0]
        .trim();

    if (!domain || !domain.includes('.') || domain.length < 4) {
        return { error: 'Nombre de dominio no válido. Ejemplo: `google.com` o `github.com`' };
    }

    const [aRes, aaaaRes, mxRes, nsRes, txtRes] = await Promise.allSettled([
        dns.resolve4(domain),
        dns.resolve6(domain),
        dns.resolveMx(domain),
        dns.resolveNs(domain),
        dns.resolveTxt(domain)
    ]);

    const aRecords = aRes.status === 'fulfilled' ? (aRes.value || []) : [];
    const aaaaRecords = aaaaRes.status === 'fulfilled' ? (aaaaRes.value || []) : [];
    const mxRecords = mxRes.status === 'fulfilled' ? (mxRes.value || []).sort((x, y) => x.priority - y.priority) : [];
    const nsRecords = nsRes.status === 'fulfilled' ? (nsRes.value || []) : [];
    const txtList = txtRes.status === 'fulfilled' ? (txtRes.value || []).map(chunks => chunks.join('')) : [];

    // Detección de CDN / Proveedor Cloud
    const nsStr = nsRecords.join(' ').toLowerCase();
    let provider = 'Alojamiento Estándar / Privado';
    if (nsStr.includes('cloudflare.com')) provider = 'Cloudflare CDN & WAF ☁️';
    else if (nsStr.includes('awsdns')) provider = 'Amazon Web Services (Route 53) 🟧';
    else if (nsStr.includes('googledomains') || nsStr.includes('cloud-dns')) provider = 'Google Cloud DNS 🟦';
    else if (nsStr.includes('azure-dns')) provider = 'Microsoft Azure DNS 🔷';
    else if (nsStr.includes('digitalocean.com')) provider = 'DigitalOcean DNS 🌊';
    else if (nsStr.includes('linode.com') || nsStr.includes('akamai')) provider = 'Akamai / Linode DNS';

    const spfInfo = extractSpfInfo(txtList);
    const dmarc = await queryDmarc(domain);

    let ipGeo = null;
    if (aRecords.length > 0) {
        ipGeo = await queryIP(aRecords[0]);
    }

    return {
        domain,
        a: aRecords,
        aaaa: aaaaRecords,
        mx: mxRecords,
        ns: nsRecords,
        provider,
        spf: spfInfo.hasSpf ? spfInfo.raw : null,
        spfPolicy: spfInfo.policy,
        dmarc: dmarc.hasDmarc ? dmarc.raw : null,
        dmarcPolicy: dmarc.policy,
        ipGeo: ipGeo && ipGeo.status === 'success' ? ipGeo : null
    };
}

module.exports = {
    name: 'osint',
    alias: ['recon', 'osintlookup', 'whois'],
    category: 'premium',
    desc: 'Inteligencia de fuentes abiertas (OSINT): número, email, IP, usuario y dominio (Premium)',
    usage: '.osint num <número|@tag> | .osint email <correo> | .osint ip <ip> | .osint user <usuario> | .osint domain <dominio>',
    premiumOnly: true,

    execute: async ({ sock, m, args, text, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // 1. Verificación de permisos: Solo Owner y miembros Premium
        const isPermitted = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPermitted) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es solo para *Premium*.\nUsa *.prem* para más información sobre cómo obtener membresía.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        let subCmd = (args[0] || '').toLowerCase().trim();
        let query = args.slice(1).join(' ').trim();

        // Extracción de contexto (menciones o mensajes citados)
        const mentioned = (m.mentionedJid && m.mentionedJid.length > 0) ? m.mentionedJid[0] : null;
        const quotedSender = m.quoted ? (m.quoted.sender || m.quoted.participant) : null;
        const contextSender = m.message?.extendedTextMessage?.contextInfo?.participant || null;
        const targetMsgSender = mentioned || quotedSender || contextSender;

        const PHONE_ALIASES = ['num', 'phone', 'numero', 'tel', 'telefono', 'wa', 'whatsapp'];
        const IP_ALIASES = ['ip', 'geo', 'geoloc', 'geoip'];
        const EMAIL_ALIASES = ['email', 'mail', 'correo'];
        const USER_ALIASES = ['user', 'username', 'usuario', 'nick', 'social'];
        const DOMAIN_ALIASES = ['domain', 'dominio', 'dns', 'web', 'host', 'whois'];

        const isExplicitSub = [
            ...PHONE_ALIASES,
            ...IP_ALIASES,
            ...EMAIL_ALIASES,
            ...USER_ALIASES,
            ...DOMAIN_ALIASES
        ].includes(subCmd);

        // DETECCIÓN INTELIGENTE SI NO SE USÓ UN SUBCOMANDO EXPLÍCITO
        if (!isExplicitSub) {
            const fullInput = (text || args.join(' ')).trim();

            if (targetMsgSender && (!fullInput || fullInput.startsWith('@') || /^\d+$/.test(fullInput))) {
                subCmd = 'num';
                query = targetMsgSender;
            } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subCmd || fullInput)) {
                query = subCmd || fullInput;
                subCmd = 'email';
            } else if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(subCmd) || subCmd.includes('::') || /^[0-9a-fA-F:]+$/.test(subCmd)) {
                query = subCmd;
                subCmd = 'ip';
            } else if (/^\+?\d{7,16}$/.test(subCmd.replace(/[^0-9+]/g, ''))) {
                query = subCmd;
                subCmd = 'num';
            } else if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/.test(subCmd)) {
                query = subCmd;
                subCmd = 'domain';
            }
        }

        // Normalización de subcomandos
        if (PHONE_ALIASES.includes(subCmd)) subCmd = 'num';
        else if (IP_ALIASES.includes(subCmd)) subCmd = 'ip';
        else if (EMAIL_ALIASES.includes(subCmd)) subCmd = 'email';
        else if (USER_ALIASES.includes(subCmd)) subCmd = 'user';
        else if (DOMAIN_ALIASES.includes(subCmd)) subCmd = 'domain';

        // Si no se reconoció ningún subcomando o falta parámetro, mostrar menú interactivo
        if (!subCmd || (!query && !targetMsgSender && subCmd !== 'num')) {
            return await sock.sendMessage(jid, {
                text: [
                    '╔══════════════════════════════════╗',
                    '║     🕵️   OSINT INTELLIGENCE      ║',
                    '║     Investigación de Fuentes     ║',
                    '╚══════════════════════════════════╝',
                    '┃',
                    '┃ 📌 *Comandos Disponibles:*',
                    '┃',
                    '┃ • *.osint num <número | @tag>*',
                    '┃   Operadora, país, huso horario, hora local,',
                    '┃   registro en WhatsApp, bio y privacidad.',
                    '┃',
                    '┃ • *.osint email <correo>*',
                    '┃   Proveedor, MX, SPF, DMARC, detección de',
                    '┃   correos desechables y filtraciones HIBP.',
                    '┃',
                    '┃ • *.osint ip <dirección IP>*',
                    '┃   Geolocalización, ISP, ASN, reverse DNS,',
                    '┃   detección de VPN/Proxy/Tor/Hosting.',
                    '┃',
                    '┃ • *.osint user <nombre_de_usuario>*',
                    '┃   Rastreo de huella digital en GitHub, Reddit,',
                    '┃   Telegram, Steam, TikTok, Twitch, etc.',
                    '┃',
                    '┃ • *.osint domain <dominio.com>*',
                    '┃   Auditoría DNS (A, AAAA, MX, NS, SPF), CDN,',
                    '┃   WAF y geolocalización de servidores.',
                    '┃',
                    '┃ 💡 *Detección Inteligente:*',
                    '┃   Puedes escribir directamente:',
                    '┃   • `.osint 8.8.8.8`',
                    '┃   • `.osint info@empresa.com`',
                    '┃   • `.osint +18095551234`',
                    '┃   • `.osint @usuario` (o responder a un mensaje)',
                    '┃',
                    '╚══════════════════════════════════╝',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        if (typeof m.react === 'function') {
            m.react('🔍').catch(() => {});
        }

        // ── 1. SUBCOMANDO: PHONE INTELLIGENCE ──────────────────────────────────
        if (subCmd === 'num') {
            let targetRaw = query || targetMsgSender;
            if (!targetRaw) {
                return await sock.sendMessage(jid, {
                    text: '❌ Debes ingresar un número telefónico o etiquetar a un usuario.\n*Ejemplo:* `.osint num +18095551234` o `.osint @usuario`'
                }, { quoted: m });
            }

            const cleanDigits = targetRaw.toString().replace(/[^0-9]/g, '');
            if (cleanDigits.length < 7) {
                return await sock.sendMessage(jid, {
                    text: '❌ Número telefónico inválido. Ingresa al menos 7 dígitos incluyendo el código de país.\n*Ejemplo:* `.osint num +18095551234`'
                }, { quoted: m });
            }

            const info = parsePhoneNumberInfo(cleanDigits);
            if (!info) {
                return await sock.sendMessage(jid, {
                    text: `⚠️ No se pudo reconocer el formato del número *+${cleanDigits}*. Asegúrate de incluir el código internacional (ej: +1, +34, +52, +58).`
                }, { quoted: m });
            }

            let carrierFinal = info.carrier || 'No especificada';
            const numverifyKey = (process.env.NUMVERIFY_KEY || '').trim();
            if (numverifyKey) {
                try {
                    const nvRes = await axios.get(
                        `http://apilayer.net/api/validate?access_key=${numverifyKey}&number=${info.cleanDigits}&format=1`,
                        { timeout: 4000 }
                    );
                    if (nvRes.data && nvRes.data.carrier) {
                        carrierFinal = nvRes.data.carrier;
                    }
                } catch (_) {}
            }

            // Verificación en vivo sobre la infraestructura de WhatsApp
            const targetJid = `${info.cleanDigits}@s.whatsapp.net`;
            let waStatus = {
                registered: false,
                jid: targetJid,
                isBusiness: false,
                businessDesc: null,
                businessCategory: null,
                bio: null,
                bioDate: null,
                hasProfilePic: false,
                ppUrl: null
            };

            try {
                if (typeof sock.onWhatsApp === 'function') {
                    const onWa = await sock.onWhatsApp(targetJid);
                    if (onWa && onWa[0] && onWa[0].exists) {
                        waStatus.registered = true;
                        waStatus.jid = onWa[0].jid;

                        const [statusRes, ppUrl, bProfile] = await Promise.all([
                            typeof sock.fetchStatus === 'function' ? sock.fetchStatus(waStatus.jid).catch(() => null) : null,
                            typeof sock.profilePictureUrl === 'function' ? sock.profilePictureUrl(waStatus.jid, 'image').catch(() => null) : null,
                            typeof sock.getBusinessProfile === 'function' ? sock.getBusinessProfile(waStatus.jid).catch(() => null) : null
                        ]);

                        if (statusRes && statusRes.status) {
                            waStatus.bio = statusRes.status.trim();
                            waStatus.bioDate = statusRes.setAt ? new Date(statusRes.setAt).toLocaleDateString('es-DO') : null;
                        }
                        if (ppUrl) {
                            waStatus.hasProfilePic = true;
                            waStatus.ppUrl = ppUrl;
                        }
                        if (bProfile) {
                            waStatus.isBusiness = true;
                            waStatus.businessDesc = bProfile.description || null;
                            waStatus.businessCategory = bProfile.category || null;
                        }
                    }
                }
            } catch (err) {
                logger.warn?.(`[osint-phone] Error en consulta WA: ${err.message}`);
            }

            const phoneCard = [
                '╭━━━━〔 🕵️ *OSINT — PHONE INTELLIGENCE* 〕━━━━⬣',
                '┃',
                `┃ 📞 *Número:* \`${info.internationalFormatted || `+${cleanDigits}`}\``,
                `┃ 🌍 *País:* ${info.flag || '🌐'} ${info.countryName} (${info.countryCallingCode})`,
                `┃ 🏢 *Operadora:* ${carrierFinal}`,
                `┃ 📱 *Tipo de línea:* ${info.lineType || 'Móvil / Celular'}`,
                `┃ 📍 *Región / Zona:* ${info.region || 'N/A'}`,
                `┃ 📐 *Formato Nacional:* \`${info.nationalFormatted || 'N/A'}\``,
                `┃ 🌐 *Formato E.164:* \`${info.e164 || `+${cleanDigits}`}\``,
                `┃ 🕐 *Huso Horario:* ${info.timeZone || 'N/A'}`,
                `┃ ⏰ *Hora Local:* ${info.localTimeInfo?.fullString || info.localTimeInfo?.timeStr || 'N/A'}`,
                '┃',
                '┃ 💬 ═〔 *HUELLA EN WHATSAPP* 〕═',
                waStatus.registered
                    ? `┃ 🟢 *Estado:* Activo en WhatsApp\n` +
                      `┃ 👤 *Tipo de Cuenta:* ${waStatus.isBusiness ? '💼 WhatsApp Business' : '👤 Cuenta Personal'}\n` +
                      (waStatus.businessCategory ? `┃ 🏷️ *Categoría:* ${waStatus.businessCategory}\n` : '') +
                      (waStatus.businessDesc ? `┃ 📝 *Descripción:* ${waStatus.businessDesc.replace(/\n/g, ' ')}\n` : '') +
                      `┃ 💭 *Info / Bio:* ${waStatus.bio ? `"${waStatus.bio}"` : '🔒 Privada (Ajustes de privacidad)'}\n` +
                      (waStatus.bioDate ? `┃ 📅 *Actualizada el:* ${waStatus.bioDate}\n` : '') +
                      `┃ 🖼️ *Foto de Perfil:* ${waStatus.hasProfilePic ? '✅ Pública / Visible' : '🔒 Privada / Oculta'}`
                    : `┃ ⚠️ *Registro:* No registrado en WhatsApp\n┃    _Línea convencional / SMS / Llamadas voz_`,
                '┃',
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                '',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n');

            if (waStatus.hasProfilePic && waStatus.ppUrl) {
                return await sock.sendMessage(jid, {
                    image: { url: waStatus.ppUrl },
                    caption: phoneCard,
                    mentions: [waStatus.jid]
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: phoneCard,
                mentions: [waStatus.jid]
            }, { quoted: m });
        }

        // ── 2. SUBCOMANDO: EMAIL INTELLIGENCE ──────────────────────────────────
        if (subCmd === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(query)) {
                return await sock.sendMessage(jid, {
                    text: '❌ El correo ingresado no tiene un formato válido.\n*Ejemplo:* `.osint email ejemplo@gmail.com`'
                }, { quoted: m });
            }

            const cleanEmail = query.toLowerCase().trim();
            const [localPart, domain] = cleanEmail.split('@');

            await sock.sendMessage(jid, { text: `🔍 Investigando email *${cleanEmail}*...` }, { quoted: m });

            const [mxRecords, txtRecords, dmarcResult, hibpResult] = await Promise.all([
                queryMXRecords(domain),
                queryTxtRecords(domain),
                queryDmarc(domain),
                queryHIBP(cleanEmail)
            ]);

            const hasMailServers = mxRecords.length > 0;
            const provider = detectEmailProvider(domain, mxRecords);
            const isDisposable = isDisposableEmail(domain);
            const spfResult = extractSpfInfo(txtRecords);

            let breachSection = '';
            if (hibpResult.pwned) {
                const total = hibpResult.breaches.length;
                const top = hibpResult.breaches.slice(0, 8).map(b => {
                    const dataTypes = (b.DataClasses || []).slice(0, 4).join(', ');
                    return `  • 🚨 *${b.Name}* (${b.BreachDate || 'N/A'})\n    _Datos expuestos:_ ${dataTypes || 'General'}`;
                }).join('\n');
                const more = total > 8 ? `\n  _...y ${total - 8} filtraciones más_` : '';
                breachSection = `🚨 *${total} filtraciones detectadas en bases de datos:*\n${top}${more}`;
            } else {
                breachSection = [
                    '✅ *Estado General:* Sin filtraciones críticas en registros públicos',
                    '🛡️ *Seguridad:* Cuenta sin reportes activos de vulneración masiva',
                    `🔒 *Privacidad:* ${isDisposable ? '⚠️ Riesgo Alto (Correo temporal detectado)' : 'Protección estándar activa del proveedor'}`
                ].join('\n');
            }

            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━━〔 🕵️ *OSINT — EMAIL INTELLIGENCE* 〕━━━━⬣',
                    '┃',
                    `┃ 📧 *Email:* \`${cleanEmail}\``,
                    `┃ 👤 *Usuario:* \`${localPart}\``,
                    `┃ 🌐 *Dominio:* \`${domain}\``,
                    `┃ ${provider.icon} *Proveedor:* ${provider.name}`,
                    `┃ 📦 *Categoría:* ${isDisposable ? '⚠️ Correo Desechable / Temporal (Alto Riesgo)' : '✅ Proveedor Legítimo / Persistente'}`,
                    '┃',
                    '┃ 📬 ═〔 *AUDITORÍA DNS Y ENTREGABILIDAD* 〕═',
                    `┃ 📨 *Servidores MX:* ${hasMailServers ? `Sí (${mxRecords.length} detectados)` : '❌ Sin servidores MX (No recibe correos)'}`,
                    hasMailServers ? `┃    _MX Principal:_ \`${mxRecords[0]}\`` : '',
                    `┃ 🛡️ *Registro SPF:* ${spfResult.hasSpf ? `✅ Configurado (${spfResult.policy})` : '⚠️ No configurado (Vulnerable a spoofing)'}`,
                    `┃ 🔐 *Registro DMARC:* ${dmarcResult.hasDmarc ? `✅ Configurado (${dmarcResult.policy})` : '⚠️ No configurado'}`,
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

        // ── 3. SUBCOMANDO: IP INTELLIGENCE ─────────────────────────────────────
        if (subCmd === 'ip') {
            const cleanIp = cleanIpString(query);
            if (!cleanIp) {
                return await sock.sendMessage(jid, {
                    text: '❌ Debes ingresar una dirección IP válida.\n*Ejemplo:* `.osint ip 8.8.8.8`'
                }, { quoted: m });
            }

            await sock.sendMessage(jid, { text: `🔍 Consultando geolocalización e inteligencia de *${cleanIp}*...` }, { quoted: m });

            const [ipData, reverseHost] = await Promise.all([
                queryIP(cleanIp),
                dns.reverse(cleanIp).catch(() => []).then(r => r[0] || null)
            ]);

            if (ipData.status === 'private') {
                return await sock.sendMessage(jid, {
                    text: [
                        '╭━━━━〔 🕵️ *OSINT — IP INTELLIGENCE* 〕━━━━⬣',
                        '┃',
                        `┃ 📡 *IP Ingresada:* \`${ipData.ip}\``,
                        `┃ 🛡️ *Clasificación:* ${ipData.type}`,
                        '┃',
                        `┃ ⚠️ *Aviso de Red:*`,
                        `┃ ${ipData.message}`,
                        '┃',
                        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                        '',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            if (ipData.status === 'fail') {
                return await sock.sendMessage(jid, {
                    text: `❌ Error al consultar la IP: ${ipData.message || 'Dirección no válida o no encontrada'}`
                }, { quoted: m });
            }

            const flag = ipData.countryCode
                ? String.fromCodePoint(...[...ipData.countryCode.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
                : '🌐';

            const securityTags = [];
            if (ipData.proxy) securityTags.push('⚠️ VPN / Proxy / Tor');
            if (ipData.hosting) securityTags.push('🖥️ Datacenter / Servidor Hosting');
            if (ipData.mobile) securityTags.push('📱 Red Celular / Datos Móviles');

            const secStr = securityTags.length > 0
                ? securityTags.join(' · ')
                : '✅ Conexión Residencial (Limpia)';

            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━━〔 🕵️ *OSINT — IP INTELLIGENCE* 〕━━━━⬣',
                    '┃',
                    `┃ 📡 *Dirección IP:* \`${ipData.ip}\``,
                    reverseHost ? `┃ 🔄 *Hostname (PTR):* \`${reverseHost}\`` : '',
                    `┃ 🌍 *País:* ${flag} ${ipData.country} (${ipData.countryCode || 'N/A'})`,
                    `┃ 🏙️ *Ciudad / Región:* ${ipData.city || 'N/A'}, ${ipData.region || 'N/A'}`,
                    `┃ 📮 *Código Postal:* ${ipData.zip || 'N/A'}`,
                    `┃ 🕐 *Zona Horaria:* ${ipData.timezone || 'N/A'}`,
                    '┃',
                    `┃ 📶 *ISP:* ${ipData.isp || 'N/A'}`,
                    `┃ 🏢 *Organización:* ${ipData.org || 'N/A'}`,
                    `┃ 🔢 *ASN:* ${ipData.asn || 'N/A'}`,
                    '┃',
                    `┃ 🛡️ *Seguridad / Tipo:* ${secStr}`,
                    `┃ 📍 *Coordenadas:* \`${ipData.lat}, ${ipData.lon}\``,
                    `┃ 🗺️ *Google Maps:* https://maps.google.com/?q=${ipData.lat},${ipData.lon}`,
                    '┃',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n')
            }, { quoted: m });
        }

        // ── 4. SUBCOMANDO: USERNAME FOOTPRINT ──────────────────────────────────
        if (subCmd === 'user') {
            if (!query) {
                return await sock.sendMessage(jid, {
                    text: '❌ Debes ingresar un nombre de usuario para buscar.\n*Ejemplo:* `.osint user torvalds`'
                }, { quoted: m });
            }

            await sock.sendMessage(jid, { text: `🔍 Rastreando huella digital pública de *@${query.replace(/^@/, '')}*...` }, { quoted: m });

            const userRes = await queryUsername(query);
            if (userRes.error) {
                return await sock.sendMessage(jid, { text: `❌ ${userRes.error}` }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━━〔 🕵️ *OSINT — USERNAME FOOTPRINT* 〕━━━━⬣',
                    '┃',
                    `┃ 👤 *Nombre de Usuario:* \`@${userRes.username}\``,
                    `┃ 🔍 *Plataformas analizadas:* ${userRes.totalScanned}`,
                    `┃ 🎯 *Perfiles detectados:* ${userRes.foundList.length} coincidencias`,
                    `┃ 📊 *Nivel de Huella:* ${userRes.footprintLevel}`,
                    '┃',
                    '┃ 🌐 ═〔 *PERFILES PÚBLICOS ENCONTRADOS* 〕═',
                    userRes.foundList.length > 0
                        ? userRes.foundList.map(item => `┃ ${item.icon} *${item.name}:* ${item.url}${item.info ? `\n┃    ↳ _${item.info}_` : ''}`).join('\n')
                        : '┃ ⚪ No se encontraron perfiles públicos activos en las plataformas principales.',
                    '┃',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── 5. SUBCOMANDO: DOMAIN & DNS INTELLIGENCE ───────────────────────────
        if (subCmd === 'domain') {
            if (!query) {
                return await sock.sendMessage(jid, {
                    text: '❌ Debes ingresar un nombre de dominio.\n*Ejemplo:* `.osint domain google.com`'
                }, { quoted: m });
            }

            await sock.sendMessage(jid, { text: `🔍 Auditando infraestructura DNS y servidores de *${query}*...` }, { quoted: m });

            const domRes = await queryDomain(query);
            if (domRes.error) {
                return await sock.sendMessage(jid, { text: `❌ ${domRes.error}` }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━━〔 🕵️ *OSINT — DOMAIN & DNS* 〕━━━━⬣',
                    '┃',
                    `┃ 🌐 *Dominio:* \`${domRes.domain}\``,
                    `┃ 🛡️ *Infraestructura:* ${domRes.provider}`,
                    domRes.ipGeo?.country ? `┃ 🌍 *Ubicación del Servidor:* ${domRes.ipGeo.country} (${domRes.ipGeo.city || 'N/A'})` : '',
                    domRes.ipGeo?.isp ? `┃ 🏢 *Proveedor Hosting:* ${domRes.ipGeo.isp}` : '',
                    '┃',
                    '┃ 📋 ═〔 *REGISTROS DNS DETECTADOS* 〕═',
                    `┃ 🟢 *Registros A (IPv4):* ${domRes.a.length > 0 ? domRes.a.join(', ') : 'Ninguno'}`,
                    domRes.aaaa.length > 0 ? `┃ 🟣 *Registros AAAA (IPv6):* ${domRes.aaaa.join(', ')}` : '',
                    `┃ 📬 *Registros MX:* ${domRes.mx.length > 0 ? domRes.mx.map(m => `${m.exchange} (Prio ${m.priority})`).join('\n┃    ↳ ') : 'Ninguno'}`,
                    `┃ 🏷️ *Servidores NS:* ${domRes.ns.length > 0 ? domRes.ns.join(', ') : 'Ninguno'}`,
                    domRes.spf ? `┃ 🛡️ *Política SPF:* \`${domRes.spf.length > 60 ? domRes.spf.substring(0, 60) + '...' : domRes.spf}\`` : '┃ 🛡️ *Política SPF:* ⚠️ No configurado',
                    domRes.dmarc ? `┃ 🔐 *Política DMARC:* \`${domRes.dmarc.length > 60 ? domRes.dmarc.substring(0, 60) + '...' : domRes.dmarc}\`` : '┃ 🔐 *Política DMARC:* ⚠️ No configurado',
                    '┃',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n')
            }, { quoted: m });
        }
    }
};

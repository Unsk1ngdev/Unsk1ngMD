'use strict';

const dns = require('dns').promises;
const net = require('net');
const axios = require('axios');
const logger = require('../../lib/logger');

/**
 * Detecta si una IP pertenece a un rango privado, loopback o local (RFC 1918 / Bogon)
 */
function isPrivateIP(ip) {
    if (!ip) return false;
    const lower = ip.toLowerCase();
    if (lower === 'localhost') return true;

    const version = net.isIP(ip);
    if (version === 4) {
        const parts = ip.split('.').map(Number);
        if (parts[0] === 10) return true; // 10.0.0.0/8
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
        if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
        if (parts[0] === 127) return true; // 127.0.0.0/8 (Loopback)
        if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (Link-local)
        if (parts[0] === 0) return true; // 0.0.0.0/8
    } else if (version === 6) {
        if (lower === '::1' || lower === '::') return true;
        if (lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) return true;
    }
    return false;
}

/**
 * Normaliza los datos de geolocalización de distintas APIs a un esquema uniforme
 */
function normalizeGeoData(source, raw, target) {
    if (source === 'ip-api') {
        const flag = raw.countryCode
            ? String.fromCodePoint(...[...raw.countryCode.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
            : '🌐';
        return {
            query: raw.query || target,
            country: raw.country || 'N/A',
            countryCode: raw.countryCode || '',
            flag,
            region: raw.regionName || raw.region || 'N/A',
            city: raw.city || 'N/A',
            district: raw.district || '',
            zip: raw.zip || 'N/A',
            lat: raw.lat,
            lon: raw.lon,
            timezone: raw.timezone || 'N/A',
            isp: raw.isp || 'N/A',
            org: raw.org || 'N/A',
            asn: raw.as || (raw.asname ? `AS ${raw.asname}` : 'N/A'),
            reverse: raw.reverse || '',
            isProxy: raw.proxy === true,
            isHosting: raw.hosting === true,
            isMobile: raw.mobile === true
        };
    } else if (source === 'ipwhois') {
        const flag = raw.flag?.emoji || (raw.country_code
            ? String.fromCodePoint(...[...raw.country_code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
            : '🌐');
        return {
            query: raw.ip || target,
            country: raw.country || 'N/A',
            countryCode: raw.country_code || '',
            flag,
            region: raw.region || 'N/A',
            city: raw.city || 'N/A',
            district: '',
            zip: raw.postal || 'N/A',
            lat: raw.latitude,
            lon: raw.longitude,
            timezone: raw.timezone?.id || 'N/A',
            isp: raw.connection?.isp || 'N/A',
            org: raw.connection?.org || 'N/A',
            asn: raw.connection?.asn ? `AS${raw.connection.asn}` : 'N/A',
            reverse: raw.connection?.domain || '',
            isProxy: false,
            isHosting: false,
            isMobile: false
        };
    } else if (source === 'freeipapi') {
        const flag = raw.countryCode
            ? String.fromCodePoint(...[...raw.countryCode.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
            : '🌐';
        return {
            query: raw.ipAddress || target,
            country: raw.countryName || 'N/A',
            countryCode: raw.countryCode || '',
            flag,
            region: raw.regionName || 'N/A',
            city: raw.cityName || 'N/A',
            district: '',
            zip: raw.zipCode || 'N/A',
            lat: raw.latitude,
            lon: raw.longitude,
            timezone: (raw.timeZones && raw.timeZones[0]) || 'N/A',
            isp: raw.asnOrganization || 'N/A',
            org: raw.asnOrganization || 'N/A',
            asn: raw.asn ? `AS${raw.asn}` : 'N/A',
            reverse: '',
            isProxy: raw.isProxy === true,
            isHosting: false,
            isMobile: false
        };
    } else if (source === 'abstract') {
        const flag = raw.flag?.emoji || (raw.country_code
            ? String.fromCodePoint(...[...raw.country_code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
            : '🌐');
        return {
            query: raw.ip_address || target,
            country: raw.country || 'N/A',
            countryCode: raw.country_code || '',
            flag,
            region: raw.region || 'N/A',
            city: raw.city || 'N/A',
            district: '',
            zip: raw.postal_code || 'N/A',
            lat: raw.latitude,
            lon: raw.longitude,
            timezone: raw.timezone?.name || 'N/A',
            isp: raw.connection?.isp_name || raw.connection?.autonomous_system_organization || 'N/A',
            org: raw.connection?.organization_name || raw.connection?.autonomous_system_organization || 'N/A',
            asn: raw.connection?.autonomous_system_number ? `AS${raw.connection.autonomous_system_number}` : 'N/A',
            reverse: '',
            isProxy: raw.security?.is_vpn === true,
            isHosting: false,
            isMobile: raw.connection?.connection_type === 'Cellular'
        };
    }
    return null;
}

/**
 * Consulta la información de red y geolocalización con cadena de respaldo resiliente
 */
async function fetchGeoData(target, fallbackIp) {
    const ipToQuery = fallbackIp || target;
    const abstractIpKey = (process.env.ABSTRACTAPI_IP_KEY || process.env.ABSTRACTAPI_IP || '').trim();

    // 0. AbstractAPI IP Geolocation (Inteligencia premium si está configurada)
    if (abstractIpKey && net.isIP(ipToQuery)) {
        try {
            const res = await axios.get(
                `https://ipgeolocation.abstractapi.com/v1/?api_key=${abstractIpKey}&ip_address=${encodeURIComponent(ipToQuery)}`,
                { timeout: 4500, headers: { 'User-Agent': 'Unsk1ngMD-Bot' } }
            );
            if (res.data && res.data.ip_address && !res.data.error) {
                return normalizeGeoData('abstract', res.data, target);
            }
        } catch (_) {}
    }

    // 1. ip-api.com (admite tanto dominios como direcciones IP)
    try {
        const res = await axios.get(
            `http://ip-api.com/json/${encodeURIComponent(target)}?fields=status,message,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`,
            {
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            }
        );
        if (res.data && res.data.status === 'success') {
            return normalizeGeoData('ip-api', res.data, target);
        }
    } catch (_) {}

    const ipToQuery = fallbackIp || target;

    // 2. Respaldo: ipwho.is (requiere IP)
    try {
        const res = await axios.get(`https://ipwho.is/${encodeURIComponent(ipToQuery)}`, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (res.data && res.data.success) {
            return normalizeGeoData('ipwhois', res.data, target);
        }
    } catch (_) {}

    // 3. Respaldo: freeipapi.com
    try {
        const res = await axios.get(`https://freeipapi.com/api/json/${encodeURIComponent(ipToQuery)}`, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (res.data && res.data.ipAddress) {
            return normalizeGeoData('freeipapi', res.data, target);
        }
    } catch (_) {}

    return null;
}

/**
 * Inspecciona el estado web HTTP/HTTPS del objetivo
 */
async function inspectWebServer(target) {
    const t0 = Date.now();
    let protocol = 'HTTPS';
    let res = null;

    try {
        res = await axios.get(`https://${target}`, {
            timeout: 3000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            responseType: 'text',
            maxRedirects: 4,
            validateStatus: () => true
        });
    } catch (_) {
        protocol = 'HTTP';
        try {
            res = await axios.get(`http://${target}`, {
                timeout: 2500,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                responseType: 'text',
                maxRedirects: 4,
                validateStatus: () => true
            });
        } catch (__) {}
    }

    if (!res) return null;

    const latency = Date.now() - t0;
    const html = typeof res.data === 'string' ? res.data.slice(0, 30000) : '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 75) : null;
    const server = res.headers['server'] || null;
    const hasCloudflare = Boolean(res.headers['cf-ray'] || (server && server.toLowerCase().includes('cloudflare')));

    return {
        protocol,
        status: res.status,
        statusText: res.statusText || 'OK',
        latency,
        server,
        title,
        hasCloudflare
    };
}

/**
 * Genera un mini mapa mundial en formato texto ASCII con pin dinámico (📍) según coordenadas
 */
function renderAsciiMap(lat, lon) {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;

    const numRows = 7;
    const numCols = 28;

    const baseGrid = [
        '  ..·´¯¯`·.     .·´¯`·.     ', // Fila 0: Ártico / Norte
        ' /   NA   \\   /   EU  \\.-.  ', // Fila 1: NA / EU / Asia N
        '|          \\_/     AS     | ', // Fila 2: Caribe / Medio Oriente / Asia
        ' \\_   SA   / \\     AF    /  ', // Fila 3: SA / África
        '   \\      /   \\         /   ', // Fila 4: Cono Sur / Sur África
        '    `·..·´     \\   OC  /    ', // Fila 5: Oceanía
        '      AN        `·...·´     '  // Fila 6: Antártida
    ];

    let r = Math.round(((90 - lat) / 180) * (numRows - 1));
    r = Math.max(0, Math.min(numRows - 1, r));

    let c = Math.round(((lon + 180) / 360) * (numCols - 1));
    c = Math.max(0, Math.min(numCols - 1, c));

    const borderTop = '┌────────────────────────────┐';
    const borderBottom = '└────────────────────────────┘';

    const lines = baseGrid.map((rowStr, rowIndex) => {
        if (rowIndex === r) {
            const arr = Array.from(rowStr.padEnd(numCols, ' '));
            arr[c] = '📍';
            if (c + 1 < arr.length && arr[c + 1] === ' ') {
                arr.splice(c + 1, 1);
            }
            return '│' + arr.join('') + '│';
        }
        return '│' + rowStr.padEnd(numCols, ' ') + '│';
    });

    return [borderTop, ...lines, borderBottom].join('\n');
}

module.exports = {
    name: 'ip',
    alias: ['iplookup', 'whois', 'lookupip', 'ipinfo', 'hostinfo'],
    category: 'herramientas',
    desc: 'Obtiene información avanzada, geográfica, DNS y de servidor de una IP o página web',
    usage: '.ip [dirección IP o página web/dominio]',

    execute: async ({ sock, m, args }) => {
        const rawInput = (args && args[0] ? args[0].trim() : '');

        if (!rawInput) {
            return await sock.sendMessage(m.chat, {
                text: '❌ *Uso correcto del comando:*\n' +
                      '• *.ip [dirección IP, dominio o URL]*\n\n' +
                      '📌 *Ejemplos prácticos:*\n' +
                      '• *.ip google.com*\n' +
                      '• *.ip https://www.github.com*\n' +
                      '• *.ip 1.1.1.1*\n' +
                      '• *.ip 2606:4700:4700::1111*\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // Limpieza de URL, protocolo, puertos y barras
        let clean = rawInput.trim().replace(/^https?:\/\//i, '');
        let target = clean.split('/')[0].split('?')[0].split('#')[0].trim();

        // Manejo de IPv6 entre corchetes [2001:...]:puerto
        if (target.startsWith('[') && target.includes(']')) {
            target = target.slice(1, target.indexOf(']'));
        } else if (target.includes(':') && net.isIP(target) === 0) {
            // Puerto en hostname o IPv4 (ej: domain.com:8080 o 1.2.3.4:8080)
            const parts = target.split(':');
            if (parts.length === 2 && /^\d+$/.test(parts[1])) {
                target = parts[0];
            }
        }

        if (!target) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Ingresa un dominio o dirección IP válidos.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 1. Detección de IP privada / local
        if (isPrivateIP(target)) {
            return await sock.sendMessage(m.chat, {
                text: `╭━━━〔 ⚠️ IP PRIVADA / LOCAL 〕━━━⬣\n` +
                      `┃ 🔍 *Dirección:* \`${target}\`\n` +
                      `┃ 🔒 *Tipo:* Red Privada / Loopback (RFC 1918)\n` +
                      `┃ ℹ️ Esta dirección pertenece a una red local\n` +
                      `┃    o bucle interno de un dispositivo.\n` +
                      `┃    No tiene enrutamiento ni geolocalización\n` +
                      `┃    pública en Internet.\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        try {
            await m.react('🔍');

            const ipVersion = net.isIP(target);
            const isDomain = (ipVersion === 0);

            // 2. Resolución de nombres DNS si es dominio/página web
            let resolvedIPs = [];
            if (isDomain) {
                try {
                    const lookups = await dns.lookup(target, { all: true });
                    resolvedIPs = lookups.map(l => ({
                        ip: l.address,
                        type: l.family === 6 ? 'IPv6' : 'IPv4'
                    }));
                } catch (dnsErr) {
                    logger.debug(`[IP LOOKUP] DNS lookup error para ${target}:`, dnsErr.message);
                }
            }

            const primaryResolvedIp = resolvedIPs[0]?.ip || null;

            // 3. Ejecución simultánea de Geolocalización e Inspección Web
            const [geo, web] = await Promise.all([
                fetchGeoData(target, primaryResolvedIp),
                inspectWebServer(target)
            ]);

            if (!geo) {
                await m.react('❌');
                return await sock.sendMessage(m.chat, {
                    text: `❌ No se pudo obtener información de *${target}*.\n` +
                          `_Verifica que la página web o dirección IP sea pública y esté escrita correctamente._\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            // Cálculo de hora local en la zona horaria del objetivo
            let localTimeStr = '';
            if (geo.timezone && geo.timezone !== 'N/A') {
                try {
                    localTimeStr = new Date().toLocaleTimeString('es-ES', {
                        timeZone: geo.timezone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                } catch (_) {}
            }

            // Determinación del tipo de objetivo
            let tipoStr = '🌐 Página Web / Dominio';
            if (ipVersion === 4) tipoStr = '🔢 Dirección IP Pública (IPv4)';
            else if (ipVersion === 6) tipoStr = '🔢 Dirección IP Pública (IPv6)';

            const secciones = [];

            // ── Bloque 1: Cabecera Principal ──
            secciones.push(
                `╭━━━〔 🌐 NETWORK & IP INTEL 〕━━━⬣\n` +
                `┃ 🎯 *Objetivo:* ${target}\n` +
                `┃ 🏷️ *Tipo:* ${tipoStr}\n` +
                `┃ 📌 *IP Principal:* \`${geo.query}\`\n` +
                (geo.reverse && geo.reverse !== geo.query ? `┃ 🔄 *Reverse DNS:* _${geo.reverse}_\n` : '') +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣`
            );

            // ── Bloque 2: Resolución DNS (si es dominio y tiene múltiples IPs) ──
            if (resolvedIPs.length > 0) {
                const uniqueIps = [];
                const seen = new Set();
                for (const item of resolvedIPs) {
                    if (!seen.has(item.ip)) {
                        seen.add(item.ip);
                        uniqueIps.push(item);
                    }
                }

                const lines = uniqueIps.slice(0, 4).map(r => `│ 🔹 \`${r.ip}\` _(${r.type})_`).join('\n');
                const extra = uniqueIps.length > 4 ? `\n│ ➕ _y ${uniqueIps.length - 4} direcciones más..._` : '';
                secciones.push(
                    `╭───〔 📡 RESOLUCIÓN DNS (${uniqueIps.length}) 〕───⬣\n` +
                    `${lines}${extra}\n` +
                    `╰──────────────────────────⬣`
                );
            }

            // ── Bloque 3: Análisis de Servidor Web & HTTP (si respondió) ──
            if (web) {
                const webLines = [
                    web.title ? `│ 🏷️ *Título:* _${web.title}_` : null,
                    `│ ⚡ *Estado:* ${web.status} ${web.statusText} (${web.latency}ms)`,
                    `│ 🔒 *Protocolo:* ${web.protocol} ${web.protocol === 'HTTPS' ? '_(TLS Seguro)_' : '_(Sin cifrar)_'}`,
                    web.server ? `│ 🖥️ *Servidor Web:* ${web.server}` : null,
                    web.hasCloudflare ? `│ 🛡️ *Protección:* Cloudflare WAF / CDN Activo` : null
                ].filter(Boolean).join('\n');

                secciones.push(
                    `╭───〔 💻 SERVIDOR WEB / HTTP 〕───⬣\n` +
                    `${webLines}\n` +
                    `╰──────────────────────────⬣`
                );
            }

            // ── Bloque 4: Geolocalización Física ──
            const geoLines = [
                `│ ${geo.flag} *País:* ${geo.country} ${geo.countryCode ? `(${geo.countryCode})` : ''}`,
                geo.city !== 'N/A' ? `│ 🏙️ *Ciudad:* ${geo.city}` : null,
                geo.region !== 'N/A' ? `│ 📍 *Región / Estado:* ${geo.region}` : null,
                geo.zip !== 'N/A' ? `│ 📮 *Código Postal:* ${geo.zip}` : null,
                geo.timezone !== 'N/A' ? `│ 🕐 *Zona Horaria:* ${geo.timezone}${localTimeStr ? ` (${localTimeStr})` : ''}` : null,
                (geo.lat != null && geo.lon != null) ? `│ 🧭 *Coordenadas:* \`${geo.lat}, ${geo.lon}\`` : null
            ].filter(Boolean).join('\n');

            secciones.push(
                `╭───〔 📍 GEOLOCALIZACIÓN 〕───⬣\n` +
                `${geoLines}\n` +
                `╰──────────────────────────⬣`
            );

            // ── Bloque 5: Mini Mapa de Ubicación (ASCII) ──
            if (geo.lat != null && geo.lon != null) {
                const asciiMap = renderAsciiMap(geo.lat, geo.lon);
                if (asciiMap) {
                    secciones.push(
                        `╭───〔 🗺️ MINI MAPA MUNDIAL 〕───⬣\n` +
                        `\`\`\`\n${asciiMap}\n\`\`\`\n` +
                        `│ 📌 *Google Maps:* https://www.google.com/maps?q=${geo.lat},${geo.lon}\n` +
                        `╰──────────────────────────⬣`
                    );
                }
            }

            // ── Bloque 6: Proveedor de Internet & Seguridad (VPN / Proxy / Tor) ──
            const fullAuditStr = `${geo.isp} ${geo.org} ${geo.asn} ${geo.reverse}`.toLowerCase();
            const isTor = /tor[-.]exit|torproject|onion|tor[-.]relay/i.test(fullAuditStr);
            const isKnownVpn = /mullvad|nordvpn|expressvpn|surfshark|proton|cyberghost|windscribe|ovpn|privateinternetaccess|purevpn|ipvanish|torguard|hidemyass|vyprvpn/i.test(fullAuditStr);
            const isVpn = isKnownVpn || (geo.isProxy && geo.isHosting);

            const netLines = [
                geo.isp !== 'N/A' ? `│ 📡 *ISP / Operador:* ${geo.isp}` : null,
                (geo.org !== 'N/A' && geo.org !== geo.isp) ? `│ 🏢 *Organización:* ${geo.org}` : null,
                geo.asn !== 'N/A' ? `│ 🔢 *ASN:* \`${geo.asn}\`` : null,
                `│ 🛡️ *VPN:* ${isVpn ? '⚠️ SÍ (Detectado)' : '✅ NO'}`,
                `│ 🧅 *Tor:* ${isTor ? '⚠️ SÍ (Nodo de salida)' : '✅ NO'}`,
                `│ 🔒 *Proxy:* ${geo.isProxy ? '⚠️ SÍ (Detectado)' : '✅ NO'}`,
                `│ 🖥️ *Hosting / Cloud:* ${geo.isHosting ? '🖥️ SÍ (Datacenter)' : '👤 NO (Residencial)'}`,
                geo.isMobile ? `│ 📱 *Red Móvil (Celular):* 📱 SÍ` : null
            ].filter(Boolean).join('\n');

            secciones.push(
                `╭───〔 🛡️ AUDITORÍA DE RED & SEGURIDAD 〕───⬣\n` +
                `${netLines}\n` +
                `╰──────────────────────────⬣`
            );

            const respuestaFinal = `${secciones.join('\n\n')}\n\n     _Unknown Codexツ</>_`;

            await sock.sendMessage(m.chat, { text: respuestaFinal }, { quoted: m });
            await m.react('✅');

        } catch (err) {
            logger.error('[IP LOOKUP ERROR]:', err);
            await m.react('❌');
            await sock.sendMessage(m.chat, {
                text: `❌ Error al consultar el objetivo: ${err.message || 'Error de conexión'}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

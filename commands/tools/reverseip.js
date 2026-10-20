'use strict';

const dns = require('dns').promises;
const https = require('https');
const axios = require('axios');
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const logger = require('../../lib/logger');

// Agente HTTPS para consultas directas a 1.1.1.1 DoH
const dohAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Resuelve un dominio a su dirección IPv4
 */
async function resolveHostToIP(host) {
    try {
        const lookup = await dns.lookup(host);
        if (lookup && lookup.address) return lookup.address;
    } catch (_) {}

    // Fallback: DoH a 1.1.1.1
    try {
        const res = await axios.get(`https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`, {
            headers: { 'Accept': 'application/dns-json', 'Host': 'cloudflare-dns.com' },
            httpsAgent: dohAgent,
            timeout: 5000
        });
        const aRecord = res.data?.Answer?.find(r => r.type === 1);
        if (aRecord && aRecord.data) return aRecord.data;
    } catch (_) {}

    return null;
}

/**
 * Obtiene el registro PTR (Reverse DNS) de una dirección IP
 */
async function getReverseDNS(ip) {
    // Si es IPv4, construir query .in-addr.arpa
    const parts = ip.split('.');
    if (parts.length === 4) {
        const ptrQuery = `${parts.reverse().join('.')}.in-addr.arpa`;
        try {
            const res = await axios.get(`https://1.1.1.1/dns-query?name=${encodeURIComponent(ptrQuery)}&type=PTR`, {
                headers: { 'Accept': 'application/dns-json', 'Host': 'cloudflare-dns.com' },
                httpsAgent: dohAgent,
                timeout: 5000
            });
            const ptrAnswer = res.data?.Answer?.[0]?.data;
            if (ptrAnswer) return ptrAnswer.replace(/\.$/, '');
        } catch (_) {}
    }

    try {
        const reverseList = await dns.reverse(ip);
        if (reverseList && reverseList.length > 0) return reverseList[0];
    } catch (_) {}

    return 'No asignado o no encontrado';
}

/**
 * Consulta HackerTarget para obtener dominios alojados en la misma IP
 */
async function queryHackerTarget(ip) {
    try {
        const res = await axios.get(`https://api.hackertarget.com/reverseiplookup/?q=${encodeURIComponent(ip)}`, {
            timeout: 8000,
            headers: { 'User-Agent': 'Unsk1ngMD-Bot/1.0.0' }
        });
        const text = (res.data || '').toString().trim();
        if (
            !text ||
            text.includes('error') ||
            text.includes('No DNS A records found') ||
            text.includes('API count exceeded') ||
            text.includes('No records')
        ) {
            return [];
        }

        const lines = text.split('\n').map(d => d.trim()).filter(d => d && d.length > 0);
        return [...new Set(lines)];
    } catch (_) {
        return [];
    }
}

/**
 * Consulta geolocalización y datos de red vía ip-api.com
 */
async function getIPInfo(ip) {
    try {
        const res = await axios.get(
            `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,isp,org,as,hosting,proxy`,
            { timeout: 6000 }
        );
        return res.data?.status === 'success' ? res.data : null;
    } catch (_) {
        return null;
    }
}

module.exports = {
    name: 'reverseip',
    alias: ['revip', 'rdns', 'reverse-dns'],
    category: 'premium',
    desc: 'Reverse DNS y búsqueda de sitios web alojados en una dirección IP (Premium)',
    usage: '.reverseip <ip/dominio>',
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

        const input = (args[0] || text || '').trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

        // Si no pasa parámetros, mostrar el menú
        if (!input) {
            return await sock.sendMessage(jid, {
                text: [
                    '╔══════════════════════════╗',
                    '║  🔄  REVERSE IP          ║',
                    '╚══════════════════════════╝',
                    '┃',
                    '┃ • .reverseip <ip>',
                    '┃   Muestra todos los dominios alojados',
                    '┃   en esa dirección IP (reverse DNS +',
                    '┃   hosting compartido).',
                    '┃',
                    '┃ • .reverseip <dominio>',
                    '┃   Resuelve el dominio a IP y luego',
                    '┃   busca todos los sitios en esa IP.',
                    '┃',
                    '┃ Ejemplos:',
                    '┃   .reverseip 104.21.45.23',
                    '┃   .reverseip google.com',
                    '╚══════════════════════════╝',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await sock.sendMessage(jid, {
            text: `🔍 Realizando Reverse IP en *${input}*...`
        }, { quoted: m });

        let ip = input;
        let resolvedFrom = null;

        const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(input);
        const isIPv6 = input.includes(':');

        if (!isIPv4 && !isIPv6) {
            const resolved = await resolveHostToIP(input);
            if (!resolved) {
                return await sock.sendMessage(jid, {
                    text: `❌ No se pudo resolver la dirección IP para el host: *${input}*`
                }, { quoted: m });
            }
            resolvedFrom = input;
            ip = resolved;
        }

        // Consultas en paralelo para máxima rapidez
        const [ptrRecord, domains, geo] = await Promise.all([
            getReverseDNS(ip),
            queryHackerTarget(ip),
            getIPInfo(ip)
        ]);

        const flag = geo?.countryCode
            ? String.fromCodePoint(...[...geo.countryCode.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
            : '🌐';

        const lines = [
            '╭━━━━〔 🔄 *REVERSE IP & SHARED HOSTING* 〕━━━━⬣',
            '┃',
            resolvedFrom ? `┃ 🌐 *Host:* \`${resolvedFrom}\` → \`${ip}\`` : `┃ 📡 *IP:* \`${ip}\``,
            `┃ 🏷️ *PTR (rDNS):* \`${ptrRecord}\``,
            `┃ 🌍 *País:* ${flag} ${geo?.country || 'Desconocido'} (${geo?.city || 'N/A'})`,
            `┃ 📶 *ISP:* ${geo?.isp || 'Desconocido'}`,
            `┃ 🏢 *Organización:* ${geo?.org || 'Desconocido'}`,
            `┃ 🖥️ *Infraestructura:* ${geo?.hosting ? '🖥️ Hosting / Datacenter' : '🏠 Red Residencial / ISP'}`,
            '┃'
        ];

        if (domains.length === 0) {
            lines.push('┃ ℹ️ _No se detectaron dominios adicionales compartidos en esta IP (posible IP dedicada)._');
        } else {
            lines.push(`┃ 🌐 ═〔 *DOMINIOS ALOJADOS (${domains.length})* 〕═`);
            const topDomains = domains.slice(0, 20);
            topDomains.forEach(d => {
                lines.push(`┃  • ${d}`);
            });
            if (domains.length > 20) {
                lines.push(`┃  _...y ${domains.length - 20} dominios más_`);
            }
        }

        lines.push('┃');
        lines.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣');
        lines.push('');
        lines.push('_Unknown Codexツ</>_');

        return await sock.sendMessage(jid, { text: lines.join('\n') }, { quoted: m });
    }
};


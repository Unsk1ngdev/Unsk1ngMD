'use strict';

const net = require('net');
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const logger = require('../../lib/logger');

// Lista de los 20 puertos estándar más comunes y su servicio asociado
const COMMON_PORTS = [
    [21, 'FTP (File Transfer)'],
    [22, 'SSH (Secure Shell)'],
    [23, 'Telnet'],
    [25, 'SMTP (Email Routing)'],
    [53, 'DNS (Domain Name System)'],
    [80, 'HTTP (Web)'],
    [110, 'POP3 (Email Retrieval)'],
    [143, 'IMAP (Email Access)'],
    [443, 'HTTPS (Secure Web)'],
    [445, 'SMB (File Sharing)'],
    [1433, 'MSSQL (SQL Server)'],
    [3306, 'MySQL / MariaDB'],
    [3389, 'RDP (Remote Desktop)'],
    [5432, 'PostgreSQL'],
    [6379, 'Redis (Cache / DB)'],
    [8080, 'HTTP-Alt (Proxy / Dev)'],
    [8443, 'HTTPS-Alt (Admin Web)'],
    [27017, 'MongoDB'],
    [5900, 'VNC (Virtual Network)'],
    [11211, 'Memcached']
];

/**
 * Verifica si un host o IP corresponde a un rango privado / loopback
 */
function isPrivateHost(host) {
    if (!host) return false;
    const lower = host.toLowerCase().trim();
    if (lower === 'localhost' || lower === '::1' || lower === '0.0.0.0') return true;

    if (net.isIPv4(lower)) {
        const parts = lower.split('.').map(Number);
        if (parts[0] === 127) return true; // 127.0.0.0/8
        if (parts[0] === 10) return true;  // 10.0.0.0/8
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
        if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
        if (parts[0] === 169 && parts[1] === 254) return true; // Link-local
    }
    return false;
}

/**
 * Comprueba un puerto TCP con timeout configurable vía net.Socket
 */
function checkTcpPort(host, port, timeout = 2500) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const finish = (isOpen) => {
            if (settled) return;
            settled = true;
            try {
                socket.destroy();
            } catch (_) {}
            resolve(isOpen);
        };

        socket.setTimeout(timeout);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));

        try {
            socket.connect(port, host);
        } catch (_) {
            finish(false);
        }
    });
}

module.exports = {
    name: 'portcheck',
    alias: ['checkport', 'portscan', 'puerto'],
    category: 'premium',
    desc: 'Escanea y verifica disponibilidad de puertos TCP en servidores (Premium)',
    usage: '.portcheck <ip/dominio> <puerto> | .portcheck <ip/dominio> common',
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

        const hostRaw = (args[0] || '').trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
        const portArg = (args[1] || '').trim().toLowerCase();

        // Si no se especifican argumentos, mostrar el menú
        if (!hostRaw || !portArg) {
            return await sock.sendMessage(jid, {
                text: [
                    '╔══════════════════════════╗',
                    '║   🔌  PORT CHECK         ║',
                    '╚══════════════════════════╝',
                    '┃',
                    '┃ • .portcheck <ip/dominio> <puerto>',
                    '┃   Verifica el estado de un puerto TCP (1-65535).',
                    '┃',
                    '┃ • .portcheck <ip/dominio> common',
                    '┃   Escaneo rápido de los 20 puertos estándar más comunes:',
                    '┃   HTTP, HTTPS, SSH, FTP, MySQL, DNS, RDP, Redis, etc.',
                    '┃',
                    '┃ Ejemplos:',
                    '┃   .portcheck google.com 443',
                    '┃   .portcheck 1.1.1.1 53',
                    '┃   .portcheck mi-servidor.com common',
                    '╚══════════════════════════╝',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // Protección SSRF: Solo el Owner puede escanear loopback/privadas
        if (isPrivateHost(hostRaw) && !isOwner) {
            return await sock.sendMessage(jid, {
                text: '⛔ No está permitido escanear direcciones de red privadas o locales (localhost/RFC 1918).'
            }, { quoted: m });
        }

        // ── MODO 1: COMMON PORTS SCAN ─────────────────────────────────────────
        if (portArg === 'common') {
            await sock.sendMessage(jid, {
                text: `🔍 Escaneando 20 puertos estándar en *${hostRaw}*...\n_Por favor espera unos segundos..._`
            }, { quoted: m });

            const results = [];
            const batchSize = 5;

            for (let i = 0; i < COMMON_PORTS.length; i += batchSize) {
                const batch = COMMON_PORTS.slice(i, i + batchSize);
                const batchChecks = await Promise.all(
                    batch.map(([p, name]) =>
                        checkTcpPort(hostRaw, p, 2500).then(open => ({ port: p, name, open }))
                    )
                );
                results.push(...batchChecks);
            }

            const openList = results.filter(r => r.open);
            const closedList = results.filter(r => !r.open);

            const openText = openList.length > 0
                ? openList.map(r => `┃  • 🟢 *${r.port}* — ${r.name}`).join('\n')
                : '┃  _Ningún puerto común abierto detectado_';

            const closedSummary = closedList.map(r => r.port).join(', ');

            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━━〔 🔌 *PORT SCAN (COMMON)* 〕━━━━⬣',
                    '┃',
                    `┃ 🖥️ *Host:* \`${hostRaw}\``,
                    `┃ 📊 *Resumen:* *${openList.length}* abiertos / *${closedList.length}* cerrados (Total: ${results.length})`,
                    '┃',
                    '┃ 🟢 ═〔 *PUERTOS ABIERTOS* 〕═',
                    openText,
                    '┃',
                    '┃ 🔴 ═〔 *PUERTOS CERRADOS / FILTRADOS* 〕═',
                    `┃ ${closedSummary}`,
                    '┃',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── MODO 2: PUERTO INDIVIDUAL ─────────────────────────────────────────
        const port = parseInt(portArg, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            return await sock.sendMessage(jid, {
                text: '❌ Puerto inválido. Debe ser un número entero entre 1 y 65535 (o la palabra `common`).\n*Ejemplo:* `.portcheck google.com 443`'
            }, { quoted: m });
        }

        await sock.sendMessage(jid, {
            text: `🔍 Verificando puerto *${port}* en *${hostRaw}*...`
        }, { quoted: m });

        const knownService = COMMON_PORTS.find(([p]) => p === port)?.[1] || 'Servicio personalizado';
        const isOpen = await checkTcpPort(hostRaw, port, 3000);

        const statusTag = isOpen
            ? '🟢 *ABIERTO* — Servicio activo y respondiendo conexiones'
            : '🔴 *CERRADO / FILTRADO* — No hay respuesta o bloqueado por firewall';

        return await sock.sendMessage(jid, {
            text: [
                '╭━━━━〔 🔌 *PORT CHECK* 〕━━━━⬣',
                '┃',
                `┃ 🖥️ *Host:* \`${hostRaw}\``,
                `┃ 🔢 *Puerto:* \`${port}\` (${knownService})`,
                `┃ 📊 *Estado:* ${statusTag}`,
                '┃',
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                '',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};


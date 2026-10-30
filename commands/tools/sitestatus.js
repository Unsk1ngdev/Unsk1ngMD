'use strict';

const tls = require('tls');
const axios = require('axios');
const config = require('../../config');
const logger = require('../../lib/logger');

/**
 * Inspecciona el certificado SSL/TLS de un host mediante tls.connect
 */
const checkSsl = (hostname, port = 443, timeout = 7000) => {
    return new Promise((resolve) => {
        let finished = false;

        const socket = tls.connect({
            host: hostname,
            port: Number(port) || 443,
            servername: hostname, // SNI habilitado
            timeout: timeout,
            rejectUnauthorized: false // Permite inspeccionar certificados expirados o autofirmados sin abortar
        }, () => {
            if (finished) return;
            finished = true;

            const cert = socket.getPeerCertificate();
            const authorized = socket.authorized;
            const authError = socket.authorizationError;
            const protocol = socket.getProtocol();

            socket.end();

            if (!cert || Object.keys(cert).length === 0) {
                return resolve({
                    hasSsl: false,
                    error: 'El servidor no proporcionó ningún certificado SSL'
                });
            }

            const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
            const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
            const now = new Date();

            let daysRemaining = null;
            let isExpired = false;

            if (validTo) {
                daysRemaining = Math.round((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                isExpired = daysRemaining < 0;
            }

            resolve({
                hasSsl: true,
                authorized: Boolean(authorized) && !isExpired,
                authError: authError ? String(authError) : (isExpired ? 'CERT_HAS_EXPIRED' : null),
                issuer: cert.issuer?.O || cert.issuer?.CN || 'Desconocido',
                subject: cert.subject?.CN || hostname,
                validFrom: validFrom ? validFrom.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
                validTo: validTo ? validTo.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
                daysRemaining: daysRemaining,
                isExpired: isExpired,
                protocol: protocol || 'TLS'
            });
        });

        socket.on('error', (err) => {
            if (finished) return;
            finished = true;
            resolve({
                hasSsl: false,
                error: err.message
            });
        });

        socket.on('timeout', () => {
            if (finished) return;
            finished = true;
            try { socket.destroy(); } catch (_) {}
            resolve({
                hasSsl: false,
                error: 'Tiempo de espera agotado al conectar al puerto SSL'
            });
        });
    });
};

module.exports = {
    name: 'sitestatus',
    alias: ['webstatus', 'checksite', 'pingurl', 'estado', 'checkweb'],
    category: 'herramientas',
    desc: 'Verifica si un sitio web está caído, su tiempo de respuesta, headers HTTP, estado de HTTPS y certificado SSL',
    usage: '.sitestatus <url o dominio>',

    execute: async ({ sock, m, text }) => {
        const jid = m.chat;

        if (!text || !text.trim()) {
            const prefix = config.defaultPrefix || '.';
            return await sock.sendMessage(jid, {
                text: [
                    '🌐 *VERIFICADOR DE ESTADO WEB (.sitestatus)* 🌐',
                    '',
                    '❌ *Debes proporcionar una URL o dominio a analizar.*',
                    '',
                    '📌 *Ejemplos de uso:*',
                    `• *${prefix}sitestatus google.com*`,
                    `• *${prefix}sitestatus https://github.com*`,
                    `• *${prefix}sitestatus cloudflare.com*`,
                    `• *${prefix}sitestatus https://whatsapp.com*`,
                    '',
                    `_${config.authorName || 'Unknown Codexツ</>'}_`
                ].join('\n')
            }, { quoted: m });
        }

        let rawInput = text.trim();

        // Normalizar URL (si el usuario pone "google.com" agregamos "https://")
        if (!/^https?:\/\//i.test(rawInput)) {
            rawInput = 'https://' + rawInput;
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(rawInput);
        } catch (_) {
            return await sock.sendMessage(jid, {
                text: '❌ La URL proporcionada no es válida. Asegúrate de escribir un dominio correcto (ej: google.com).'
            }, { quoted: m });
        }

        const isHttps = parsedUrl.protocol === 'https:';
        const hostname = parsedUrl.hostname;
        const port = parsedUrl.port || (isHttps ? 443 : 80);

        await m.react?.('🔍');

        // 1. Medir tiempo de respuesta y headers HTTP con Axios
        const startTime = Date.now();
        let httpResult = null;
        let fetchError = null;

        try {
            const res = await axios.get(parsedUrl.href, {
                timeout: 10000,
                validateStatus: () => true, // Captura todos los códigos (200, 301, 404, 500, etc.)
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (Unsk1ngMD Web Monitor)'
                }
            });

            const latency = Date.now() - startTime;
            httpResult = {
                status: res.status,
                statusText: res.statusText || 'OK',
                latency,
                headers: res.headers || {}
            };
        } catch (err) {
            fetchError = err;
        }

        // 2. Si el sitio está caído o no resolvió
        if (!httpResult) {
            await m.react?.('🔴');

            let diagnosis = 'El servidor no responde o está completamente inaccesible.';
            if (fetchError?.code === 'ENOTFOUND') {
                diagnosis = 'El dominio no existe o no resuelve en los servidores DNS.';
            } else if (fetchError?.code === 'ECONNREFUSED') {
                diagnosis = 'Conexión rechazada por el servidor (puerto cerrado o firewall).';
            } else if (fetchError?.code === 'ETIMEDOUT' || fetchError?.code === 'ECONNABORTED') {
                diagnosis = 'Tiempo de espera agotado (+10 segundos sin respuesta).';
            } else if (fetchError?.message) {
                diagnosis = fetchError.message;
            }

            return await sock.sendMessage(jid, {
                text: [
                    '🌐 *REPORTE DE ESTADO DE SITIO WEB* 🌐',
                    '',
                    `🔗 *Host:* ${hostname}`,
                    '🔴 *Estado:* *CAÍDO / INACCESIBLE*',
                    '',
                    `⚠️ *Diagnóstico:* ${diagnosis}`,
                    '⏱️ *Latencia:* Timeout (> 10s)',
                    `🔒 *Protocolo Solicitado:* ${isHttps ? 'HTTPS' : 'HTTP'}`,
                    '',
                    `_${config.authorName || 'Unknown Codexツ</>'}_`
                ].join('\n')
            }, { quoted: m });
        }

        // 3. Inspeccionar Certificado SSL si es HTTPS
        let sslData = null;
        if (isHttps) {
            sslData = await checkSsl(hostname, port);
        }

        await m.react?.('✅');

        // 4. Formatear Indicadores y Headers
        const latency = httpResult.latency;
        let speedLabel = '🚀 Excelente';
        if (latency > 800) speedLabel = '🐌 Lento';
        else if (latency > 350) speedLabel = '⚡ Moderado';

        const isOkStatus = httpResult.status >= 200 && httpResult.status < 400;
        const statusEmoji = isOkStatus ? '🟢 ONLINE' : (httpResult.status >= 500 ? '🔴 ERROR DE SERVIDOR' : '🟠 ADVERTENCIA');

        const headers = httpResult.headers;
        const serverHeader = headers['server'] || headers['x-powered-by'] || 'No revelado (Oculto por seguridad)';
        const contentType = headers['content-type'] ? headers['content-type'].split(';')[0] : 'N/A';
        const hasHsts = Boolean(headers['strict-transport-security']);
        const cdnDetected = headers['cf-ray'] ? 'Cloudflare CDN' : (headers['x-cache'] ? `Proxy/CDN (${headers['x-cache']})` : 'Directo / No detectado');

        // Formato SSL
        let sslSection = ['🔒 *SEGURIDAD & CERTIFICADO SSL:*', '• *Protocolo:* HTTP Inseguro ⚠️ (Sin cifrado SSL)'];

        if (isHttps) {
            if (sslData && sslData.hasSsl) {
                const sslStatusText = sslData.authorized
                    ? '✅ Válido y Confiable'
                    : (sslData.isExpired ? '❌ EXPIRADO' : `⚠️ Inválido (${sslData.authError || 'No verificado'})`);

                let daysText = 'N/A';
                if (sslData.daysRemaining !== null) {
                    if (sslData.daysRemaining > 0) {
                        daysText = `${sslData.daysRemaining} días restantes`;
                    } else {
                        daysText = `Expiró hace ${Math.abs(sslData.daysRemaining)} días`;
                    }
                }

                sslSection = [
                    '🔒 *SEGURIDAD & CERTIFICADO SSL:*',
                    `• *HTTPS:* Activo ✅`,
                    `• *Certificado:* ${sslStatusText}`,
                    `• *Emisor (CA):* ${sslData.issuer}`,
                    `• *Cifrado:* ${sslData.protocol}`,
                    `• *Emitido:* ${sslData.validFrom}`,
                    `• *Expira el:* ${sslData.validTo} _(${daysText})_`
                ];
            } else {
                sslSection = [
                    '🔒 *SEGURIDAD & CERTIFICADO SSL:*',
                    `• *HTTPS:* Error al establecer handshake TLS`,
                    `• *Detalle:* ${sslData?.error || 'Certificado no disponible'}`
                ];
            }
        }

        const reportLines = [
            '🌐 *REPORTE DE ESTADO DE SITIO WEB* 🌐',
            '',
            `🔗 *URL Analizada:* ${parsedUrl.origin}`,
            `📡 *Estado HTTP:* *${statusEmoji} (${httpResult.status} ${httpResult.statusText})*`,
            `⏱️ *Tiempo de Respuesta:* *${latency} ms* _(${speedLabel})_`,
            '',
            ...sslSection,
            '',
            '📊 *CABECERAS & TECNOLOGÍA:*',
            `• *Servidor Web:* ${serverHeader}`,
            `• *Tipo de Contenido:* ${contentType}`,
            `• *Red CDN / Proxy:* ${cdnDetected}`,
            `• *Seguridad HSTS:* ${hasHsts ? 'Activado ✅' : 'Desactivado ⚠️'}`,
            '',
            `_${config.authorName || 'Unknown Codexツ</>'}_`
        ];

        await sock.sendMessage(jid, {
            text: reportLines.join('\n')
        }, { quoted: m });
    }
};


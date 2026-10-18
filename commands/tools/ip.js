'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

module.exports = {
    name: 'ip',
    alias: ['iplookup', 'whois', 'lookupip'],
    category: 'herramientas',
    desc: 'Obtiene información completa, geográfica y de red de una IP o dominio',
    usage: '.ip [dirección IP o dominio]',

    execute: async ({ sock, m, args }) => {
        const rawObjetivo = (args && args[0] ? args[0].trim() : '');

        if (!rawObjetivo) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Uso: *.ip [dirección ip o dominio]*\n\n' +
                      'Ejemplos:\n' +
                      '*.ip 8.8.8.8*\n' +
                      '*.ip google.com*'
            }, { quoted: m });
        }

        // Limpiar protocolo y barras si se introdujo como URL (ej: https://google.com/)
        const objetivo = rawObjetivo
            .replace(/^https?:\/\//i, '')
            .replace(/\/.*$/, '')
            .trim();

        try {
            await m.react('🔍');

            // ip-api.com — servicio público y gratuito sin API key
            const endpoint = `http://ip-api.com/json/${encodeURIComponent(objetivo)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,query`;
            const response = await axios.get(endpoint, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 8000
            });

            const data = response.data;

            if (!data || data.status === 'fail') {
                await m.react('❌');
                return await sock.sendMessage(m.chat, {
                    text: `❌ No se pudo obtener info de *${objetivo}*.\n` +
                          `Razón: ${data?.message || 'Host no encontrado o no responde'}\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            // Detectar banderas de seguridad
            const esVPN = data.proxy ? '⚠️ SÍ (VPN/Proxy)' : '✅ NO';
            const esHosting = data.hosting ? '🖥️ SÍ (Servidor/Hosting)' : '👤 NO';

            // Convertir código ISO de 2 letras a bandera Emoji usando indicadores regionales Unicode
            const bandera = (data.countryCode && data.countryCode.length === 2)
                ? String.fromCodePoint(
                    ...[...data.countryCode.toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65)
                  )
                : '🌐';

            const info =
                `╔══════════════════╗\n` +
                `║   🌐 *IP LOOKUP*    ║\n` +
                `╚══════════════════╝\n\n` +
                `🔍 *IP/Dominio:* ${data.query || objetivo}\n\n` +
                `${bandera} *País:* ${data.country || 'N/A'}\n` +
                `🏙️ *Ciudad:* ${data.city || 'N/A'}\n` +
                `📍 *Región:* ${data.regionName || 'N/A'}\n` +
                `📮 *Código postal:* ${data.zip || 'N/A'}\n` +
                `🕐 *Zona horaria:* ${data.timezone || 'N/A'}\n` +
                `🌐 *Coordenadas:* ${data.lat ?? 'N/A'}, ${data.lon ?? 'N/A'}\n\n` +
                `📡 *ISP:* ${data.isp || 'N/A'}\n` +
                `🏢 *Organización:* ${data.org || 'N/A'}\n` +
                `🔢 *AS:* ${data.as || 'N/A'}\n\n` +
                `🛡️ *VPN/Proxy:* ${esVPN}\n` +
                `🖥️ *Hosting/Bot:* ${esHosting}\n\n` +
                `_Unknown Codexツ</>_`;

            await sock.sendMessage(m.chat, { text: info }, { quoted: m });
            await m.react('✅');

        } catch (err) {
            logger.error('[IP LOOKUP ERROR]:', err.message);
            await m.react('❌');
            await sock.sendMessage(m.chat, {
                text: `❌ Error al consultar la IP: ${err.message || 'Error de conexión'}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};


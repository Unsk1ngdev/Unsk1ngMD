'use strict';

const axios = require('axios');

// Cache local en memoria para no descargar la base de países repetidamente
let countriesCache = null;
const paisMemoryCache = new Map();

const loadCountriesBackup = async () => {
    if (countriesCache && countriesCache.length > 0) return countriesCache;
    try {
        const res = await axios.get('https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json', { timeout: 4500 });
        if (Array.isArray(res.data) && res.data.length > 0) {
            countriesCache = res.data;
            return countriesCache;
        }
    } catch (_) {}
    return [];
};

module.exports = {
    name: 'pais',
    alias: ['country', 'nacion', 'bandera'],
    category: 'herramientas',
    desc: 'Busca información geográfica, política y bandera oficial de cualquier país',
    usage: '.pais [nombre del país]',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const nombre = text?.trim() || args.join(' ').trim();

        if (!nombre) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.pais [nombre]*\nEjemplo: *.pais dominicana*'
            }, { quoted: m });
        }

        try {
            const cacheKey = nombre.toLowerCase().trim();
            const cached = paisMemoryCache.get(cacheKey);
            if (cached && (Date.now() - cached.time < 60000)) {
                if (cached.bandera && cached.bandera.startsWith('http')) {
                    return await sock.sendMessage(jid, {
                        image: { url: cached.bandera },
                        caption: cached.info
                    }, { quoted: m });
                }
                return await sock.sendMessage(jid, { text: cached.info }, { quoted: m });
            }

            let pais = null;

            // 1. Intento con RestCountries API v3.1
            try {
                let res = await axios.get(`https://restcountries.com/v3.1/translation/${encodeURIComponent(nombre)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 4500
                }).catch(() => null);
                if (Array.isArray(res.data) && res.data.length > 0) {
                    pais = res.data[0];
                } else {
                    res = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(nombre)}`, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        timeout: 5000
                    });
                    if (Array.isArray(res.data) && res.data.length > 0) {
                        pais = res.data[0];
                    }
                }
            } catch (_) {}

            // 2. Respaldo directo de alta velocidad con base de países CDN (mledoze/countries)
            if (!pais) {
                const list = await loadCountriesBackup();
                if (list.length > 0) {
                    const norm = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                    const qNorm = norm(nombre);

                    // Búsqueda exacta primero
                    pais = list.find(c => {
                        const common = norm(c.name?.common);
                        const spa = norm(c.translations?.spa?.common);
                        return common === qNorm || spa === qNorm;
                    });

                    // Si no, búsqueda parcial
                    if (!pais) {
                        pais = list.find(c => {
                            const common = norm(c.name?.common);
                            const spa = norm(c.translations?.spa?.common);
                            const spaOff = norm(c.translations?.spa?.official);
                            const alts = (c.altSpellings || []).map(norm);
                            return common.includes(qNorm) || spa.includes(qNorm) || spaOff.includes(qNorm) || alts.some(a => a.includes(qNorm));
                        });
                    }
                }
            }

            if (!pais) {
                return await sock.sendMessage(jid, {
                    text: `❌ No se encontró el país *${nombre}*.\nIntenta en español o inglés.`
                }, { quoted: m });
            }

            // Procesar y verificar cada campo
            const nombreComun = pais.translations?.spa?.common || pais.name?.common || nombre;
            const nombreOficial = pais.translations?.spa?.official || pais.name?.official || 'N/A';
            const capital = Array.isArray(pais.capital) ? pais.capital[0] : (pais.capital || 'N/A');
            const poblacion = pais.population ? pais.population.toLocaleString('es-ES') : 'N/A';
            const area = pais.area ? `${pais.area.toLocaleString('es-ES')} km²` : 'N/A';
            const continente = Array.isArray(pais.continents) ? pais.continents[0] : (pais.region || 'N/A');
            const subregion = pais.subregion || 'N/A';

            // Idiomas
            const idiomas = pais.languages && typeof pais.languages === 'object'
                ? Object.values(pais.languages).join(', ')
                : 'N/A';

            // Monedas
            let monedas = 'N/A';
            if (pais.currencies && typeof pais.currencies === 'object') {
                monedas = Object.values(pais.currencies)
                    .map(c => `${c.name || ''}${c.symbol ? ` (${c.symbol})` : ''}`.trim())
                    .filter(Boolean)
                    .join(', ') || 'N/A';
            }

            // Zonas horarias
            const zonas = Array.isArray(pais.timezones) ? pais.timezones[0] : (pais.timezones || 'N/A');

            // Código de marcación telefónica
            const codigoTel = pais.idd?.root
                ? `${pais.idd.root}${pais.idd.suffixes?.[0] || ''}`
                : 'N/A';

            // Bandera oficial
            const cca2Code = (pais.cca2 || '').toLowerCase();
            const bandera = pais.flags?.png || (cca2Code ? `https://flagcdn.com/w320/${cca2Code}.png` : null);
            const emoji = pais.flag || '';

            const info =
                `🌍 *${nombreComun}* ${emoji}\n` +
                `📋 _${nombreOficial}_\n\n` +
                `🏙️ *Capital:* ${capital}\n` +
                `👥 *Población:* ${poblacion}\n` +
                `📏 *Área:* ${area}\n` +
                `🌎 *Continente:* ${continente}\n` +
                `📍 *Región:* ${subregion}\n` +
                `🗣️ *Idiomas:* ${idiomas}\n` +
                `💰 *Moneda:* ${monedas}\n` +
                `📞 *Código tel:* ${codigoTel}\n` +
                `🕐 *Zona horaria:* ${zonas}\n\n` +
                `_Unknown Codexツ</>_`;

            paisMemoryCache.set(cacheKey, { bandera, info, time: Date.now() });

            if (bandera && bandera.startsWith('http')) {
                try {
                    await sock.sendMessage(jid, {
                        image: { url: bandera },
                        caption: info
                    }, { quoted: m });
                    return;
                } catch (_) {}
            }

            await sock.sendMessage(jid, { text: info }, { quoted: m });

        } catch (e) {
            console.error('[PAIS ERROR]:', e.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al consultar el país: ${e.message}`
            }, { quoted: m });
        }
    }
};


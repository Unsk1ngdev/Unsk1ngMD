const axios = require('axios');

// Caché en memoria para respuestas meteorológicas con TTL de 60 segundos
const climaMemoryCache = new Map();
const CLIMA_CACHE_TTL = 60 * 1000;

module.exports = {
    name: 'clima',
    alias: ['weather', 'tiempo'],
    category: 'herramientas',
    desc: 'Consulta el pronóstico del clima en tiempo real para cualquier ciudad',
    usage: '.clima [nombre de la ciudad]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, escribe la ciudad que deseas consultar.\nEjemplo: *.clima Madrid* o *.clima Buenos Aires*');
        }

        const queryKey = text.trim().toLowerCase();
        const cached = climaMemoryCache.get(queryKey);
        if (cached && (Date.now() - cached.timestamp < CLIMA_CACHE_TTL)) {
            return await m.reply(cached.data);
        }

        m.react('⛅').catch(() => {});

        try {
            const url = `https://wttr.in/${encodeURIComponent(text)}?format=j1&lang=es`;
            const response = await axios.get(url, {
                timeout: 4500,
                headers: { 'User-Agent': 'curl/7.68.0' }
            });

            const data = response.data;
            const current = data.current_condition?.[0];
            const area = data.nearest_area?.[0];

            if (!current) {
                throw new Error('No se encontró información meteorológica para esa ciudad.');
            }

            const cityName = area?.areaName?.[0]?.value || text;
            const country = area?.country?.[0]?.value || '';
            const tempC = current.temp_C;
            const feelsLikeC = current.FeelsLikeC;
            const desc = current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || 'Despejado';
            const humidity = current.humidity;
            const wind = current.windspeedKmph;

            const weatherMsg = `🌤️ *Pronóstico del Clima*\n` +
                `📍 *Ubicación:* ${cityName}, ${country}\n` +
                `🌡️ *Temperatura:* ${tempC}°C\n` +
                `🤔 *Sensación térmica:* ${feelsLikeC}°C\n` +
                `💧 *Humedad:* ${humidity}%\n` +
                `💨 *Viento:* ${wind} km/h\n` +
                `📋 *Condición:* ${desc}`;

            climaMemoryCache.set(queryKey, {
                timestamp: Date.now(),
                data: weatherMsg
            });

            await m.reply(weatherMsg);
            m.react('✅').catch(() => {});
        } catch (err) {
            m.react('❌').catch(() => {});
            throw new Error(`No se pudo obtener el clima de "${text}": ${err.message}`);
        }
    }
};


'use strict';

const axios = require('axios');
const premium = require('../../lib/premium');

module.exports = {
    name: 'ubicacion',
    alias: ['location', 'gps', 'geo'],
    category: 'herramientas',
    desc: 'Envía un pin de ubicación real de cualquier ciudad en WhatsApp (Premium)',
    usage: '.ubicacion [ciudad]',

    execute: async ({ sock, m, args, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const ciudad = args.join(' ').trim();
        if (!ciudad) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.ubicacion [ciudad]*\nEjemplo: *.ubicacion Santo Domingo*\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        try {
            const res = await axios.get(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ciudad)}&format=json&limit=1`,
                {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 8000
                }
            );

            const json = res.data;
            if (!json || !Array.isArray(json) || json.length === 0) {
                return await sock.sendMessage(jid, {
                    text: `❌ No se encontró la ubicación de *${ciudad}*.\nIntenta con otro nombre.\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            const lugar = json[0];
            const lat = parseFloat(lugar.lat);
            const lon = parseFloat(lugar.lon);
            const nombre = lugar.display_name;

            // Enviar como ubicación real de WhatsApp
            await sock.sendMessage(jid, {
                location: {
                    degreesLatitude: lat,
                    degreesLongitude: lon,
                    name: ciudad,
                    address: nombre
                }
            }, { quoted: m });

            await sock.sendMessage(jid, {
                text: `📍 *Ubicación encontrada*\n\n` +
                      `🏙️ *Ciudad:* ${ciudad}\n` +
                      `📌 *Dirección:* ${nombre.split(',').slice(0, 3).join(',')}\n` +
                      `🌐 *Coordenadas:* ${lat.toFixed(4)}, ${lon.toFixed(4)}\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });

        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ Error al buscar la ubicación: ${e.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};


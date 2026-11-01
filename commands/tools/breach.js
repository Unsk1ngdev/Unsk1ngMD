'use strict';

const axios = require('axios');
const querystring = require('querystring');
const logger = require('../../lib/logger');

module.exports = {
    name: 'breach',
    alias: ['leaks', 'leakcheck', 'pwned', 'breached', 'periksadata'],
    category: 'herramientas',
    desc: 'Verifica si un correo electrónico fue filtrado en brechas de datos o hackeos públicos',
    usage: '.breach <correo@ejemplo.com>',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const rawEmail = (args && args[0] ? args[0] : (text || '')).trim().toLowerCase();

        // 1. Validación de entrada
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!rawEmail || !emailRegex.test(rawEmail)) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔍 VERIFICADOR DE BRECHAS DE DATOS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.breach <correo@ejemplo.com>`',
                    '┃├◆ 📌 *Ejemplo:* `.breach usuario@gmail.com`',
                    '┃',
                    '┃├◆ 🛡️ Consulta bases de datos de filtraciones públicas',
                    '┃  para saber si tu correo y contraseñas fueron expuestos.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('🔍');
        await sock.sendMessage(jid, {
            text: `🔎 Analizando el correo *${rawEmail}* en bases de datos de brechas y filtraciones...`
        }, { quoted: m });

        let breachesFound = [];
        let sourceUsed = '';

        // ── Intento 1: API XposedOrNot (Rápida, JSON estructurado de HIBP) ──
        try {
            const resX = await axios.get(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(rawEmail)}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (resX.data && resX.data.breaches && Array.isArray(resX.data.breaches)) {
                // breaches es un array de arrays o strings con los nombres de las filtraciones
                const rawBreaches = Array.isArray(resX.data.breaches[0]) ? resX.data.breaches[0] : resX.data.breaches;
                breachesFound = rawBreaches.map(b => String(b).trim()).filter(Boolean);
                sourceUsed = 'XposedOrNot / Pwned DB';
            }
        } catch (errX) {
            // Un status 404 en XposedOrNot significa que el correo está limpio (no hay filtraciones)
            if (errX.response?.status === 404) {
                await m.react?.('✅');
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 🛡️ RESULTADO DE SEGURIDAD 》 ❐',
                        '┃',
                        `┃├◆ 📧 *Correo:* ${rawEmail}`,
                        '┃├◆ 🟢 *Estado:* ¡CORREO SEGURO Y LIMPIO!',
                        '┃├◆ ✅ *Brechas detectadas:* 0',
                        '┃',
                        '┃├◆ 💡 *Nota:* No se encontraron registros públicos',
                        '┃  de filtraciones ni contraseñas expuestas para este correo.',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }
            logger.warn(`[BREACH] XposedOrNot error: ${errX.message}, intentando con PeriksaData...`);
        }

        // ── Intento 2: Scraper PeriksaData.com ──
        if (breachesFound.length === 0) {
            try {
                const postData = querystring.stringify({ email: rawEmail });
                const resP = await axios.post('https://periksadata.com/', postData, {
                    timeout: 12000,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': 'https://periksadata.com',
                        'Referer': 'https://periksadata.com/'
                    }
                });

                const h5Matches = resP.data.matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>/gi);
                for (const match of h5Matches) {
                    const title = match[1].replace(/<[^>]+>/g, '').trim();
                    if (title && !breachesFound.includes(title)) {
                        breachesFound.push(title);
                    }
                }

                if (breachesFound.length > 0) {
                    sourceUsed = 'PeriksaData — Registro de Brechas';
                }
            } catch (errP) {
                logger.warn(`[BREACH] PeriksaData error: ${errP.message}`);
            }
        }

        // ── Formatear y Enviar Resultado ──
        if (breachesFound.length > 0) {
            await m.react?.('⚠️');
            const total = breachesFound.length;
            const topBreaches = breachesFound.slice(0, 10).map((b, i) => `┃  ${i + 1}. ⚠️ *${b}*`).join('\n');
            const extra = total > 10 ? `\n┃  _...y ${total - 10} brechas adicionales._` : '';

            const msg = [
                '┏❐ 《 ⚠️ ¡ALERTA DE SEGURIDAD! 》 ❐',
                '┃',
                `┃├◆ 📧 *Correo:* ${rawEmail}`,
                `┃├◆ 🔴 *Estado:* ¡COMPROMETIDO!`,
                `┃├◆ 🚨 *Brechas encontradas:* ${total}`,
                '┃',
                '┃├◆ 📁 *Plataformas afectadas:*',
                topBreaches + extra,
                '┃',
                '┃├◆ 🛡️ *Recomendaciones urgentes:*',
                '┃  • Cambia inmediatamente la contraseña de este correo.',
                '┃  • No reutilices la misma clave en otras aplicaciones.',
                '┃  • Activa la Verificación en 2 Pasos (2FA / MFA).',
                '┃',
                `┃├◆ 📡 *Fuente:* ${sourceUsed || 'Bases de datos de ciberseguridad'}`,
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n');

            return await sock.sendMessage(jid, { text: msg }, { quoted: m });
        } else {
            await m.react?.('✅');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🛡️ RESULTADO DE SEGURIDAD 》 ❐',
                    '┃',
                    `┃├◆ 📧 *Correo:* ${rawEmail}`,
                    '┃├◆ 🟢 *Estado:* ¡CORREO SEGURO Y LIMPIO!',
                    '┃├◆ ✅ *Brechas detectadas:* 0',
                    '┃',
                    '┃├◆ 💡 *Nota:* No se encontraron registros públicos de filtraciones',
                    '┃  para este correo electrónico. ¡Tus datos están a salvo!',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }
    }
};

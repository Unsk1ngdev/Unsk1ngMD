'use strict';

const axios = require('axios');
const https = require('https');
const logger = require('../../lib/logger');

// Agente HTTPS con bypass seguro de certificados incompletos en servidores estatales
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Caché en memoria del nonce del portal DHSES para acelerar las respuestas
let cachedNonce = null;
let nonceTimestamp = 0;
const NONCE_TTL_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Decodifica entidades HTML a texto legible
 */
function decodeHtmlEntities(str) {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&ntilde;/g, 'ñ')
        .replace(/&Ntilde;/g, 'Ñ')
        .replace(/&aacute;/g, 'á')
        .replace(/&eacute;/g, 'é')
        .replace(/&iacute;/g, 'í')
        .replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú')
        .replace(/&Aacute;/g, 'Á')
        .replace(/&Eacute;/g, 'É')
        .replace(/&Iacute;/g, 'Í')
        .replace(/&Oacute;/g, 'Ó')
        .replace(/&Uacute;/g, 'Ú')
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
        .trim();
}

/**
 * Obtiene el token 'nonce' de la pasarela pública de DHSES
 */
async function obtenerNonce() {
    const ahora = Date.now();
    if (cachedNonce && (ahora - nonceTimestamp < NONCE_TTL_MS)) {
        return cachedNonce;
    }

    try {
        const res = await axios.get('https://dhses.msp.gob.do/establecimientos/', {
            httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 10000
        });

        const match = res.data?.match(/"nonce":"([a-zA-Z0-9]+)"/);
        if (match && match[1]) {
            cachedNonce = match[1];
            nonceTimestamp = ahora;
            return cachedNonce;
        }
    } catch (err) {
        logger.warn('[MSP DHSES] Error obteniendo nonce:', err.message);
    }

    return cachedNonce || 'fe9a0e659e'; // Nonce de contingencia
}

/**
 * Parsea el HTML devuelto por admin-ajax.php con las tarjetas de centros habilitados
 */
function parsearCentros(html) {
    if (!html || typeof html !== 'string') return [];
    const centros = [];
    const cardRegex = /<div class="dhses-tarjeta">([\s\S]*?)<\/div>/gi;
    let match;

    while ((match = cardRegex.exec(html)) !== null) {
        const cardHtml = match[1];

        const nombreMatch = cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
        const ubicacionMatch = cardHtml.match(/<p class="dhses-ubicacion"[^>]*>([\s\S]*?)<\/p>/i);
        const direccionMatch = cardHtml.match(/<p class="dhses-direccion"[^>]*>([\s\S]*?)<\/p>/i);
        const nivelMatch = cardHtml.match(/<p class="dhses-nivel"[^>]*>([\s\S]*?)<\/p>/i);
        const badgeMatch = cardHtml.match(/<span class="dhses-badge[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

        centros.push({
            nombre: decodeHtmlEntities(nombreMatch ? nombreMatch[1].replace(/<[^>]+>/g, '') : 'Centro de Salud'),
            ubicacion: decodeHtmlEntities(ubicacionMatch ? ubicacionMatch[1].replace(/<[^>]+>/g, '') : 'No especificada'),
            direccion: decodeHtmlEntities(direccionMatch ? direccionMatch[1].replace(/<[^>]+>/g, '') : 'No especificada'),
            nivel: decodeHtmlEntities(nivelMatch ? nivelMatch[1].replace(/<[^>]+>/g, '').replace(/^Nivel:\s*/i, '') : 'Atención General'),
            estado: decodeHtmlEntities(badgeMatch ? badgeMatch[1].replace(/<[^>]+>/g, '') : 'HABILITADO')
        });
    }

    return centros;
}

module.exports = {
    name: 'msp',
    alias: ['clinica', 'hospital', 'habilitacion', 'centrosalud', 'saludpublica', 'dgiha', 'dhses'],
    category: 'herramientas',
    desc: 'Consulta y verifica en tiempo real clínicas, hospitales, laboratorios y centros de salud habilitados por el Ministerio de Salud Pública (MISPAS/DHSES)',
    usage: '.msp [NOMBRE DEL CENTRO, CLÍNICA U HOSPITAL]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const busqueda = (args && args.length > 0 ? args.join(' ').trim() : '');

        // 1. Menú de ayuda y explicación del comando si no se proporciona argumento
        if (!busqueda) {
            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━〔 🏥 VERIFICACIÓN DE CENTROS DE SALUD (MSP) 〕━━━⬣',
                    '┃ 📋 *¿Para qué sirve este comando?*',
                    '┃ Permite consultar en la base de datos oficial del',
                    '┃ *Ministerio de Salud Pública y Asistencia Social (MISPAS)*',
                    '┃ si una clínica, hospital, consultorio, laboratorio o centro',
                    '┃ estético/dental cuenta con *Licencia de Habilitación Oficial*.',
                    '┃',
                    '┃ 🔎 *Uso:*',
                    '┃ • `.msp [NOMBRE DEL CENTRO]`',
                    '┃ • `.clinica [NOMBRE]`',
                    '┃ • `.hospital [NOMBRE]`',
                    '┃',
                    '┃ 💡 *Ejemplos prácticos:*',
                    '┃ • `.msp HOMS`',
                    '┃ • `.msp Cedimat`',
                    '┃ • `.msp Plaza de la Salud`',
                    '┃ • `.msp Corominas`',
                    '┃ • `.clinica Dental Baní`',
                    '┃ • `.hospital Cabral y Báez`',
                    '┃',
                    '┃ 🏛️ *Fuente oficial:* Dirección de Habilitación de Servicios',
                    '┃ y Establecimientos de Salud (DHSES / MISPAS)',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Notificar inicio de la consulta
        await sock.sendMessage(jid, {
            text: `🔍 Consultando en los registros oficiales del *Ministerio de Salud Pública (DHSES)* por: *"${busqueda}"*...`
        }, { quoted: m });

        try {
            let nonce = await obtenerNonce();

            // Función interna para realizar la petición AJAX al servidor del MSP
            const realizarConsulta = async (n) => {
                const params = new URLSearchParams();
                params.append('action', 'dhses_buscar_centro');
                params.append('nonce', n);
                params.append('q', busqueda);

                return await axios.post('https://dhses.msp.gob.do/wp-admin/admin-ajax.php', params.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    httpsAgent,
                    timeout: 12000
                });
            };

            let res = await realizarConsulta(nonce);

            // Si el nonce expiró, forzar renovación y reintentar una vez
            if (!res.data?.success && res.data?.data === 'nonce_invalido') {
                cachedNonce = null;
                nonce = await obtenerNonce();
                res = await realizarConsulta(nonce);
            }

            const html = res.data?.data?.html || '';
            const centros = parsearCentros(html);

            // 3. Caso: Ningún centro coincide con la búsqueda
            if (centros.length === 0) {
                return await sock.sendMessage(jid, {
                    text: [
                        '╭━━━〔 🏥 RESULTADO DE SALUD PÚBLICA 〕━━━⬣',
                        `┃ ⚠️ No se encontraron centros registrados que coincidan con:`,
                        `┃ 👉 *"${busqueda}"*`,
                        '┃',
                        '┃ ℹ️ *Posibles causas:*',
                        '┃ • El centro no cuenta con licencia de habilitación vigente.',
                        '┃ • Está registrado bajo una razón social o nombre distinto.',
                        '┃ • Escribe una palabra clave más corta (ej: `.msp HOMS`).',
                        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                        '',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            // 4. Caso: Centros encontrados (mostrar hasta un máximo de 5 para no saturar WhatsApp)
            const MAX_ITEMS = 5;
            const mostrados = centros.slice(0, MAX_ITEMS);
            const total = centros.length;

            const lineas = [
                '╭━━━〔 🏥 SALUD PÚBLICA — CENTROS HABILITADOS 〕━━━⬣',
                `┃ 🔍 *Búsqueda:* "${busqueda}"`,
                `┃ 📊 *Centros encontrados:* ${total}`,
                '┃ ─────────────────────────'
            ];

            mostrados.forEach((c, idx) => {
                const iconoNumero = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][idx] || `[${idx + 1}]`;
                const estadoIcono = c.estado.toUpperCase().includes('HABILITADO') ? '✅' : '⚠️';

                lineas.push(`┃ ${iconoNumero} *${c.nombre}*`);
                if (c.ubicacion && c.ubicacion !== 'No especificada') {
                    lineas.push(`┃    📍 *Ubicación:* ${c.ubicacion}`);
                }
                if (c.direccion && c.direccion !== 'No especificada') {
                    lineas.push(`┃    📌 *Dirección:* ${c.direccion}`);
                }
                if (c.nivel) {
                    lineas.push(`┃    🩺 *Nivel de Atención:* ${c.nivel} Nivel`);
                }
                lineas.push(`┃    🛡️ *Estado:* ${estadoIcono} *${c.estado}*`);

                if (idx < mostrados.length - 1) {
                    lineas.push('┃ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄');
                }
            });

            if (total > MAX_ITEMS) {
                lineas.push('┃ ─────────────────────────');
                lineas.push(`┃ ℹ️ _...y ${total - MAX_ITEMS} centros más. Sé más específico para filtrar._`);
            }

            lineas.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣');
            lineas.push('');
            lineas.push('🏛️ _Ministerio de Salud Pública y Asistencia Social (MISPAS)_');
            lineas.push('_Dirección de Habilitación de Servicios y Establecimientos (DHSES)_');
            lineas.push('');
            lineas.push('_Unknown Codexツ</>_');

            return await sock.sendMessage(jid, {
                text: lineas.join('\n')
            }, { quoted: m });

        } catch (error) {
            logger.error('[MSP ERROR]:', error.message);
            return await sock.sendMessage(jid, {
                text: [
                    '❌ Error al consultar la base de datos de Salud Pública.',
                    `Detalle: _${error.message}_`,
                    '',
                    'Por favor intenta de nuevo en unos momentos.',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }
    }
};


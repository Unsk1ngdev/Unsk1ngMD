'use strict';

const axios = require('axios');
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const config = require('../../config');
const logger = require('../../lib/logger');

/**
 * Valida matemáticamente el algoritmo oficial (Luhn / Módulo 10) de la cédula dominicana
 */
function validarLuhnRD(cedula) {
    const clean = cedula.replace(/\D/g, '');
    if (clean.length !== 11) return false;
    let suma = 0;
    const multiplicadores = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
    const verificador = parseInt(clean.charAt(10), 10);
    for (let i = 0; i < 10; i++) {
        let dig = parseInt(clean.charAt(i), 10);
        let op = dig * multiplicadores[i];
        if (op >= 10) op = Math.floor(op / 10) + (op % 10);
        suma += op;
    }
    const mod = suma % 10;
    const esperado = (mod === 0) ? 0 : 10 - mod;
    return esperado === verificador;
}

module.exports = {
    name: 'cedula',
    alias: ['dni', 'consultacedula', 'consultadni', 'identidad'],
    category: 'premium',
    desc: 'Consulta información pública de cédulas y DNI de países latinoamericanos (Premium)',
    usage: '.cedula [PAÍS]-[NÚMERO]',
    premiumOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // 1. Verificación de permiso: Solo Owner y miembros Premium
        const isPermitted = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPermitted) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es exclusivo para usuarios *Premium*.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const input = (args && args.length > 0 ? args.join('-').trim().toUpperCase() : '');

        // 2. Menú de ayuda
        if (!input) {
            return await sock.sendMessage(jid, {
                text: `╭━━━〔 🪪 CONSULTA DE CÉDULA / DNI 〕━━━⬣\n` +
                      `┃ 📋 *Uso:* \`.cedula [PAÍS]-[NÚMERO]\`\n` +
                      `┃ \n` +
                      `┃ 🌍 *Países disponibles:*\n` +
                      `┃ 🇩🇴 \`.cedula RD-402-1234567-8\` → República Dominicana\n` +
                      `┃ 🇨🇷 \`.cedula CR-117240417\` → Costa Rica\n` +
                      `┃ 🇵🇪 \`.cedula PE-12345678\` → Perú\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ══════════════════════════════════════════
        // 🇩🇴 REPÚBLICA DOMINICANA
        // ══════════════════════════════════════════
        if (input.startsWith('RD-') || input.startsWith('DO-')) {
            const num = input.replace(/^(RD|DO)-/i, '').replace(/\D/g, '');
            if (num.length !== 11) {
                return await sock.sendMessage(jid, {
                    text: '❌ Formato incorrecto para República Dominicana.\nLa cédula debe contener exactamente 11 dígitos.\nEjemplo: `.cedula RD-001-1684343-4`\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            await sock.sendMessage(jid, { text: `🔍 Consultando información de la cédula *${num}*...` }, { quoted: m });

            let encontrado = false;

            // Intento 1: Consulta completa con fotografía
            try {
                const [resData, resPhoto] = await Promise.allSettled([
                    axios.get(`https://api.digital.gob.do/v3/cedulas/${num}`, {
                        timeout: 8000,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        }
                    }),
                    axios.get(`https://api.digital.gob.do/v3/cedulas/${num}/photo`, {
                        timeout: 6000,
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        }
                    })
                ]);

                if (resData.status === 'fulfilled' && resData.value.data && resData.value.data.success && resData.value.data.data) {
                    const d = resData.value.data.data;
                    const nombre = [d.names, d.firstSurname, d.secondSurname].filter(Boolean).join(' ');
                    const nacimiento = d.birthDate ? new Date(d.birthDate).toLocaleDateString('es-DO', { timeZone: 'UTC' }) : 'N/A';
                    const genero = d.gender === 'M' ? '♂️ Masculino' : (d.gender === 'F' ? '♀️ Femenino' : 'N/A');
                    const lugar = d.birthPlace ? d.birthPlace.trim() : 'N/A';

                    const msg =
                        `╭━━━〔 🇩🇴 CÉDULA DOMINICANA 〕━━━⬣\n` +
                        `┃ 👤 *Nombre:* ${nombre || 'N/A'}\n` +
                        `┃ 🪪 *Cédula:* ${num}\n` +
                        `┃ 🎂 *Nacimiento:* ${nacimiento}\n` +
                        `┃ ⚧️ *Género:* ${genero}\n` +
                        `┃ 📍 *Lugar:* ${lugar}\n` +
                        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                        `_Unknown Codexツ</>_`;

                    let photoBuffer = null;
                    if (resPhoto.status === 'fulfilled' && resPhoto.value.data && resPhoto.value.data.length > 100) {
                        photoBuffer = Buffer.from(resPhoto.value.data);
                    }

                    if (photoBuffer) {
                        await sock.sendMessage(jid, {
                            image: photoBuffer,
                            caption: msg
                        }, { quoted: m });
                    } else {
                        await sock.sendMessage(jid, { text: msg }, { quoted: m });
                    }

                    encontrado = true;
                    return;
                }
            } catch (_) {}

            // Intento 2: Respaldo
            if (!encontrado) {
                try {
                    const resSec = await axios.get(`https://api.directoriornc.com/api/DGII/${num}`, {
                        timeout: 7000
                    });

                    if (resSec.data && resSec.data.nombreCompleto) {
                        const d = resSec.data;
                        const msg =
                            `╭━━━〔 🇩🇴 CÉDULA DOMINICANA 〕━━━⬣\n` +
                            `┃ 👤 *Nombre:* ${d.nombreCompleto}\n` +
                            `┃ 🪪 *Cédula:* ${d.rnc || num}\n` +
                            `┃ 🏛️ *Estado:* ${d.estado || 'ACTIVO'}\n` +
                            (d.actividad ? `┃ 💼 *Actividad:* ${d.actividad}\n` : '') +
                            (d.categoria ? `┃ 📋 *Categoría:* ${d.categoria}\n` : '') +
                            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                            `_Unknown Codexツ</>_`;

                        encontrado = true;
                        return await sock.sendMessage(jid, { text: msg }, { quoted: m });
                    }
                } catch (_) {}
            }

            // Si no se encontró
            const esLuhnValido = validarLuhnRD(num);
            const detalle = esLuhnValido
                ? `_El número tiene formato matemáticamente válido pero no arrojó registros activos._`
                : `_El número introducido no coincide con un dígito verificador válido._`;

            return await sock.sendMessage(jid, {
                text: `❌ Cédula dominicana *${num}* no encontrada.\n${detalle}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ══════════════════════════════════════════
        // 🇨🇷 COSTA RICA
        // ══════════════════════════════════════════
        if (input.startsWith('CR-')) {
            const num = input.replace(/^CR-/i, '').replace(/\D/g, '');
            if (!num || num.length < 9 || num.length > 12) {
                return await sock.sendMessage(jid, {
                    text: '❌ Formato incorrecto para Costa Rica.\nLa cédula debe contener entre 9 y 10 dígitos.\nEjemplo: `.cedula CR-117240417`\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            await sock.sendMessage(jid, { text: `🔍 Consultando información de la cédula *${num}*...` }, { quoted: m });

            try {
                const res = await axios.get(`https://api.hacienda.go.cr/fe/ae?identificacion=${num}`, {
                    timeout: 8000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                const d = res.data;
                const tipos = {
                    '01': 'Cédula Física (Persona)',
                    '02': 'Cédula Jurídica (Empresa)',
                    '03': 'DIMEX (Extranjero)',
                    '04': 'NITE'
                };
                const tipoTexto = tipos[d.tipoIdentificacion] || 'Identificación';
                const estado = d.situacion?.estado || 'N/A';
                const moroso = d.situacion?.moroso === 'SI' ? '⚠️ Sí' : '✅ No';
                const omiso = d.situacion?.omiso === 'SI' ? '⚠️ Sí' : '✅ No';

                const msg =
                    `╭━━━〔 🇨🇷 CÉDULA COSTA RICA 〕━━━⬣\n` +
                    `┃ 👤 *Nombre:* ${d.nombre || 'N/A'}\n` +
                    `┃ 🪪 *Identificación:* ${num}\n` +
                    `┃ 📋 *Tipo:* ${tipoTexto}\n` +
                    `┃ 🏛️ *Estado:* ${estado}\n` +
                    `┃ ⚖️ *Moroso:* ${moroso} | *Omiso:* ${omiso}\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                    `_Unknown Codexツ</>_`;

                // Soporte para envío de fotografía si está disponible
                let photoBuffer = null;
                const rawPhoto = d.foto || d.photo || d.imagen || d.avatar;
                if (rawPhoto) {
                    try {
                        if (rawPhoto.startsWith('data:image') || !rawPhoto.startsWith('http')) {
                            photoBuffer = Buffer.from(rawPhoto.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                        } else {
                            const pRes = await axios.get(rawPhoto, { responseType: 'arraybuffer', timeout: 5000 });
                            if (pRes.data && pRes.data.length > 100) photoBuffer = Buffer.from(pRes.data);
                        }
                    } catch (_) {}
                }

                if (photoBuffer) {
                    return await sock.sendMessage(jid, {
                        image: photoBuffer,
                        caption: msg
                    }, { quoted: m });
                } else {
                    return await sock.sendMessage(jid, { text: msg }, { quoted: m });
                }
            } catch (errCR) {
                if (errCR.response?.status === 404) {
                    return await sock.sendMessage(jid, {
                        text: `❌ Cédula *${num}* no encontrada en los registros de Costa Rica.\n\n_Unknown Codexツ</>_`
                    }, { quoted: m });
                }
                logger.error('[CEDULA CR ERROR]:', errCR.message);
                return await sock.sendMessage(jid, {
                    text: `❌ Error al consultar la cédula de Costa Rica: ${errCR.message}\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }
        }

        // ══════════════════════════════════════════
        // 🇵🇪 PERÚ
        // ══════════════════════════════════════════
        if (input.startsWith('PE-')) {
            const num = input.replace(/^PE-/i, '').replace(/\D/g, '');
            if (num.length !== 8) {
                return await sock.sendMessage(jid, {
                    text: '❌ El DNI peruano debe tener exactamente 8 dígitos.\nEjemplo: `.cedula PE-12345678`\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const peruToken = (process.env.PERU_TOKEN || config.peruToken || '').trim();
            if (!peruToken) {
                const esAdmin = isOwner || database.isOwner(sender, sock);
                const aviso = esAdmin
                    ? '⚙️ *Configuración requerida:*\nAgrega `PERU_TOKEN=tu_token` en tu archivo `.env` para activar las consultas de este país.'
                    : '⚠️ El servicio de consulta para este país se encuentra en mantenimiento temporalmente.';

                return await sock.sendMessage(jid, {
                    text: `${aviso}\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            await sock.sendMessage(jid, { text: `🔍 Consultando información del DNI *${num}*...` }, { quoted: m });

            let persona = null;

            // Intento 1: Proveedor principal
            try {
                const res1 = await axios.get(`https://api.apis.net.pe/v2/reniec/dni?numero=${num}`, {
                    headers: {
                        'Authorization': `Bearer ${peruToken}`,
                        'Accept': 'application/json'
                    },
                    timeout: 8000
                });

                if (res1.data && (res1.data.nombres || res1.data.numeroDocumento)) {
                    persona = {
                        nombre: [res1.data.nombres, res1.data.apellidoPaterno, res1.data.apellidoMaterno].filter(Boolean).join(' '),
                        dni: res1.data.numeroDocumento || num,
                        codVerifica: res1.data.codVerifica || res1.data.digitoVerificador || 'N/A',
                        foto: res1.data.foto || res1.data.photo || null
                    };
                }
            } catch (_) {}

            // Intento 2: Proveedor de respaldo
            if (!persona) {
                try {
                    const res2 = await axios.post(`https://my.apiconsulta.dev/api/dni`, {
                        dni: num
                    }, {
                        headers: {
                            'Authorization': `Bearer ${peruToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        timeout: 8000
                    });

                    const d2 = res2.data?.data || res2.data;
                    if (d2 && (d2.nombres || d2.numero)) {
                        persona = {
                            nombre: [d2.nombres, d2.apellido_paterno || d2.apellidoPaterno, d2.apellido_materno || d2.apellidoMaterno].filter(Boolean).join(' '),
                            dni: d2.numero || num,
                            codVerifica: d2.codigo_verificacion || d2.codVerifica || 'N/A',
                            foto: d2.foto_base64 || d2.foto || d2.imagen || null
                        };
                    }
                } catch (_) {}
            }

            if (!persona) {
                return await sock.sendMessage(jid, {
                    text: `❌ DNI peruano *${num}* no encontrado en los registros de Perú.\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            const msg =
                `╭━━━〔 🇵🇪 DNI PERUANO 〕━━━⬣\n` +
                `┃ 👤 *Nombre:* ${persona.nombre || 'N/A'}\n` +
                `┃ 🪪 *DNI:* ${persona.dni}\n` +
                `┃ 🔢 *Dígito verificador:* ${persona.codVerifica}\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                `_Unknown Codexツ</>_`;

            // Soporte para envío de fotografía si está disponible
            let photoBuffer = null;
            if (persona.foto) {
                try {
                    if (persona.foto.startsWith('data:image') || !persona.foto.startsWith('http')) {
                        photoBuffer = Buffer.from(persona.foto.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                    } else {
                        const pRes = await axios.get(persona.foto, { responseType: 'arraybuffer', timeout: 5000 });
                        if (pRes.data && pRes.data.length > 100) photoBuffer = Buffer.from(pRes.data);
                    }
                } catch (_) {}
            }

            if (photoBuffer) {
                return await sock.sendMessage(jid, {
                    image: photoBuffer,
                    caption: msg
                }, { quoted: m });
            } else {
                return await sock.sendMessage(jid, { text: msg }, { quoted: m });
            }
        }

        // Prefijo de país no reconocido
        return await sock.sendMessage(jid, {
            text: `❌ Prefijo de país no reconocido: *${input}*\n\n` +
                  `🌍 *Países disponibles:*\n` +
                  `• \`RD-\` → República Dominicana 🇩🇴\n` +
                  `• \`CR-\` → Costa Rica 🇨🇷\n` +
                  `• \`PE-\` → Perú 🇵🇪\n\n` +
                  `Ejemplo: \`.cedula RD-001-1684343-4\` o \`.cedula PE-12345678\`\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

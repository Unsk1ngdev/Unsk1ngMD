'use strict';

const axios = require('axios');
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const config = require('../../config');
const logger = require('../../lib/logger');

/**
 * Tabla de oficialías y municipios de emisión según los primeros 3 dígitos de la cédula dominicana
 */
const MUNICIPIOS_RD = {
    '001': 'Distrito Nacional (Santo Domingo)',
    '002': 'Baní (Peravia)',
    '003': 'San Cristóbal',
    '004': 'San José de Ocoa',
    '005': 'Yaguate (San Cristóbal)',
    '006': 'Villa Altagracia (San Cristóbal)',
    '007': 'Bajos de Haina (San Cristóbal)',
    '008': 'Bonao (Monseñor Nouel)',
    '009': 'Maimón (Monseñor Nouel)',
    '010': 'Azua de Compostela',
    '011': 'San Juan de la Maguana',
    '012': 'Concepción de La Vega',
    '013': 'Santa Cruz de Barahona',
    '014': 'Neiba (Bahoruco)',
    '015': 'Tamayo (Bahoruco)',
    '016': 'Jimaní (Independencia)',
    '017': 'Duvergé (Independencia)',
    '018': 'Pedernales',
    '019': 'Cotuí (Sánchez Ramírez)',
    '020': 'Cevicos (Sánchez Ramírez)',
    '021': 'Constanza (La Vega)',
    '022': 'Jarabacoa (La Vega)',
    '023': 'San Pedro de Macorís',
    '024': 'Santa Cruz de El Seibo',
    '025': 'Higüey (La Altagracia)',
    '026': 'La Romana',
    '027': 'Hato Mayor del Rey',
    '028': 'Sabana de la Mar (Hato Mayor)',
    '029': 'Comendador (Elías Piña)',
    '030': 'Las Matas de Farfán (San Juan)',
    '031': 'Santiago de los Caballeros',
    '032': 'San José de las Matas (Santiago)',
    '033': 'Jánico (Santiago)',
    '034': 'Bisonó / Navarrete (Santiago)',
    '035': 'Licey al Medio (Santiago)',
    '036': 'Tamboril (Santiago)',
    '037': 'San Felipe de Puerto Plata',
    '038': 'Altamira (Puerto Plata)',
    '039': 'Luperón (Puerto Plata)',
    '040': 'Imbert (Puerto Plata)',
    '041': 'Sosúa (Puerto Plata)',
    '042': 'Gaspar Hernández (Espaillat)',
    '043': 'Cayetano Germosén (Espaillat)',
    '044': 'Jamao al Norte (Espaillat)',
    '045': 'Salcedo (Hermanas Mirabal)',
    '046': 'Tenares (Hermanas Mirabal)',
    '047': 'San Francisco de Macorís (Duarte)',
    '048': 'Castillo (Duarte)',
    '049': 'Pimentel (Duarte)',
    '050': 'Villa Riva (Duarte)',
    '051': 'Santa Bárbara de Samaná',
    '052': 'Sánchez (Samaná)',
    '053': 'Nagua (María Trinidad Sánchez)',
    '054': 'Moca (Espaillat)',
    '055': 'Monción (Santiago Rodríguez)',
    '056': 'San Ignacio de Sabaneta (Santiago Rodríguez)',
    '057': 'Mao (Valverde)',
    '058': 'Esperanza (Valverde)',
    '059': 'Laguna Salada (Valverde)',
    '060': 'San Fernando de Montecristi',
    '061': 'Guayubín (Montecristi)',
    '062': 'Villa Vásquez (Montecristi)',
    '063': 'Pepillo Salcedo / Manzanillo (Montecristi)',
    '064': 'Dajabón',
    '065': 'Loma de Cabrera (Dajabón)',
    '066': 'Restauración (Dajabón)',
    '067': 'Monte Plata',
    '068': 'Bayaguana (Monte Plata)',
    '069': 'Sabana Grande de Boyá (Monte Plata)',
    '070': 'Yamasá (Monte Plata)',
    '071': 'Cabrera (María Trinidad Sánchez)',
    '072': 'Río San Juan (María Trinidad Sánchez)',
    '073': 'Villa Tapia (Hermanas Mirabal)',
    '074': 'Las Terrenas (Samaná)',
    '075': 'Arenoso (Duarte)',
    '076': 'Fantino (Sánchez Ramírez)',
    '077': 'La Mata (Sánchez Ramírez)',
    '078': 'El Factor (María Trinidad Sánchez)',
    '079': 'Las Guáranas (Duarte)',
    '080': 'Los Hidalgos (Puerto Plata)',
    '081': 'Villa Isabela (Puerto Plata)',
    '082': 'Guananico (Puerto Plata)',
    '083': 'Villa González (Santiago)',
    '084': 'Puñal (Santiago)',
    '085': 'Sabana Iglesia (Santiago)',
    '086': 'Baitoa (Santiago)',
    '223': 'Santo Domingo Este',
    '224': 'Santo Domingo Norte',
    '225': 'Santo Domingo Oeste',
    '226': 'Los Alcarrizos (Santo Domingo)',
    '227': 'Pedro Brand (Santo Domingo)',
    '228': 'Boca Chica (Santo Domingo)',
    '229': 'San Antonio de Guerra (Santo Domingo)',
    '402': 'Serie Nacional Centralizada (Rep. Dominicana)'
};

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

/**
 * Calcula la edad en años a partir de la fecha de nacimiento
 */
function calcularEdad(fechaStr) {
    if (!fechaStr) return null;
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getUTCFullYear() - fecha.getUTCFullYear();
    const m = hoy.getUTCMonth() - fecha.getUTCMonth();
    if (m < 0 || (m === 0 && hoy.getUTCDate() < fecha.getUTCDate())) {
        edad--;
    }
    return edad >= 0 ? edad : null;
}

/**
 * Determina el signo zodiacal a partir de la fecha de nacimiento
 */
function obtenerZodiaco(fechaStr) {
    if (!fechaStr) return null;
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return null;
    const dia = d.getUTCDate();
    const mes = d.getUTCMonth() + 1; // 1 - 12

    if ((mes === 3 && dia >= 21) || (mes === 4 && dia <= 19)) return '♈ Aries';
    if ((mes === 4 && dia >= 20) || (mes === 5 && dia <= 20)) return '♉ Tauro';
    if ((mes === 5 && dia >= 21) || (mes === 6 && dia <= 20)) return '♊ Géminis';
    if ((mes === 6 && dia >= 21) || (mes === 7 && dia <= 22)) return '♋ Cáncer';
    if ((mes === 7 && dia >= 23) || (mes === 8 && dia <= 22)) return '♌ Leo';
    if ((mes === 8 && dia >= 23) || (mes === 9 && dia <= 22)) return '♍ Virgo';
    if ((mes === 9 && dia >= 23) || (mes === 10 && dia <= 22)) return '♎ Libra';
    if ((mes === 10 && dia >= 23) || (mes === 11 && dia <= 21)) return '♏ Escorpio';
    if ((mes === 11 && dia >= 22) || (mes === 12 && dia <= 21)) return '♐ Sagitario';
    if ((mes === 12 && dia >= 22) || (mes === 1 && dia <= 19)) return '♑ Capricornio';
    if ((mes === 1 && dia >= 20) || (mes === 2 && dia <= 18)) return '♒ Acuario';
    if ((mes === 2 && dia >= 19) || (mes === 3 && dia <= 20)) return '♓ Piscis';
    return null;
}

/**
 * Traduce el código de estado civil a texto legible
 */
function traducirEstadoCivil(codigo) {
    if (!codigo) return 'No registrado / Privado';
    const c = codigo.toString().trim().toUpperCase();
    if (c === 'S' || c === 'SOLTERO' || c === 'SOLTERA') return 'Soltero(a)';
    if (c === 'C' || c === 'CASADO' || c === 'CASADA') return 'Casado(a)';
    if (c === 'U' || c === 'UNION LIBRE' || c === 'CONVIVIENTE') return 'Unión Libre';
    if (c === 'D' || c === 'DIVORCIADO' || c === 'DIVORCIADA') return 'Divorciado(a)';
    if (c === 'V' || c === 'VIUDO' || c === 'VIUDA') return 'Viudo(a)';
    return codigo;
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
                    text: '❌ Formato incorrecto para República Dominicana.\nLa cédula debe contener exactamente 11 dígitos.\nEjemplo: `.cedula RD-001-1684343-4` o `.cedula RD-00116843434`\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const cedulaFormateada = `${num.slice(0, 3)}-${num.slice(3, 10)}-${num.slice(10)}`;
            const serie = num.slice(0, 3);
            const municipioSerie = MUNICIPIOS_RD[serie] || 'Jurisdicción Nacional';

            await sock.sendMessage(jid, { text: `🔍 Consultando información de la cédula *${cedulaFormateada}*...` }, { quoted: m });

            let encontrado = false;

            // Intento 1: Registro civil con fotografía oficial
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
                    const nombres = d.names || '';
                    const primerApellido = d.firstSurname || '';
                    const segundoApellido = d.secondSurname || '';
                    const nombreCompleto = [nombres, primerApellido, segundoApellido].filter(Boolean).join(' ');

                    // Formateo de fecha y edad
                    const fechaNac = d.birthDate ? new Date(d.birthDate).toLocaleDateString('es-DO', { timeZone: 'UTC' }) : 'N/A';
                    const edad = calcularEdad(d.birthDate);
                    const edadTexto = edad !== null ? ` (${edad} años)` : '';
                    const zodiaco = obtenerZodiaco(d.birthDate) || 'N/A';

                    // Género y estado civil
                    const genero = d.gender === 'M' ? '♂️ Masculino' : (d.gender === 'F' ? '♀️ Femenino' : 'N/A');
                    const estadoCivil = traducirEstadoCivil(d.civilStatus);
                    const lugarOrigen = d.birthPlace ? d.birthPlace.trim().replace(/\s+/g, ' ') : 'N/A';
                    const esLuhnValido = validarLuhnRD(num);
                    const validacionTexto = esLuhnValido ? '✅ Documento Oficial Válido' : '⚠️ Algoritmo no coincidente';

                    const msg =
                        `╭━━━〔 🇩🇴 FICHA DE IDENTIDAD DOMINICANA 〕━━━⬣\n` +
                        `┃ 👤 *Nombre Completo:* ${nombreCompleto || 'N/A'}\n` +
                        `┃ 🪪 *Cédula:* ${cedulaFormateada}\n` +
                        `┃ 🎂 *Nacimiento:* ${fechaNac}${edadTexto}\n` +
                        `┃ ♈ *Signo Zodiacal:* ${zodiaco}\n` +
                        `┃ ⚧️ *Género:* ${genero}\n` +
                        `┃ 💍 *Estado Civil:* ${estadoCivil}\n` +
                        `┃ 📍 *Lugar de Origen:* ${lugarOrigen}\n` +
                        `┃ 🏛️ *Serie de Emisión:* Serie ${serie} (${municipioSerie})\n` +
                        `┃ 🛡️ *Verificación:* ${validacionTexto}\n` +
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

            // Intento 2: Registro de respaldo
            if (!encontrado) {
                try {
                    const resSec = await axios.get(`https://api.directoriornc.com/api/DGII/${num}`, {
                        timeout: 7000
                    });

                    if (resSec.data && resSec.data.nombreCompleto) {
                        const d = resSec.data;
                        const esLuhnValido = validarLuhnRD(num);
                        const validacionTexto = esLuhnValido ? '✅ Documento Oficial Válido' : '⚠️ Algoritmo no coincidente';

                        const msg =
                            `╭━━━〔 🇩🇴 FICHA DE IDENTIDAD DOMINICANA 〕━━━⬣\n` +
                            `┃ 👤 *Nombre:* ${d.nombreCompleto}\n` +
                            `┃ 🪪 *Cédula:* ${cedulaFormateada}\n` +
                            `┃ 🏛️ *Estado Registrado:* ${d.estado || 'ACTIVO'}\n` +
                            (d.actividad ? `┃ 💼 *Actividad:* ${d.actividad}\n` : '') +
                            (d.categoria ? `┃ 📋 *Categoría:* ${d.categoria}\n` : '') +
                            `┃ 🏛️ *Serie de Emisión:* Serie ${serie} (${municipioSerie})\n` +
                            `┃ 🛡️ *Verificación:* ${validacionTexto}\n` +
                            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                            `_Unknown Codexツ</>_`;

                        encontrado = true;
                        return await sock.sendMessage(jid, { text: msg }, { quoted: m });
                    }
                } catch (_) {}
            }

            // Si no se encontró en ninguna fuente
            const esLuhnValido = validarLuhnRD(num);
            const detalle = esLuhnValido
                ? `_El número tiene formato matemáticamente válido pero no arrojó registros activos._`
                : `_El número introducido no coincide con un dígito verificador válido._`;

            return await sock.sendMessage(jid, {
                text: `❌ Cédula dominicana *${cedulaFormateada}* no encontrada.\n${detalle}\n\n_Unknown Codexツ</>_`
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

            // Formato oficial de Costa Rica con guiones si tiene 9 dígitos (X-XXXX-XXXX)
            let formateadaCR = num;
            if (num.length === 9) {
                formateadaCR = `${num.charAt(0)}-${num.slice(1, 5)}-${num.slice(5)}`;
            } else if (num.length === 10) {
                formateadaCR = `${num.slice(0, 2)}-${num.slice(2, 6)}-${num.slice(6)}`;
            }

            await sock.sendMessage(jid, { text: `🔍 Consultando información de la cédula *${formateadaCR}*...` }, { quoted: m });

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
                const tipoTexto = tipos[d.tipoIdentificacion] || 'Identificación Oficial';
                const estado = d.situacion?.estado || 'No especificado';
                const regimen = d.regimen?.descripcion || 'General / No especificado';
                const moroso = d.situacion?.moroso === 'SI' ? '⚠️ Sí (Moroso)' : '✅ Al día (No)';
                const omiso = d.situacion?.omiso === 'SI' ? '⚠️ Sí (Omiso)' : '✅ Al día (No)';
                const administracion = d.situacion?.administracionTributaria ? d.situacion.administracionTributaria : 'Nacional';

                let actividadesTexto = '';
                if (d.actividades && Array.isArray(d.actividades) && d.actividades.length > 0) {
                    const lista = d.actividades.slice(0, 2).map(a => `┃ 💼 *Actividad:* ${a.descripcion} (${a.estado || 'Activo'})`).join('\n');
                    actividadesTexto = `${lista}\n`;
                }

                const msg =
                    `╭━━━〔 🇨🇷 FICHA DE IDENTIDAD COSTA RICA 〕━━━⬣\n` +
                    `┃ 👤 *Nombre / Razón Social:* ${d.nombre || 'N/A'}\n` +
                    `┃ 🪪 *Identificación:* ${formateadaCR}\n` +
                    `┃ 📋 *Tipo:* ${tipoTexto}\n` +
                    `┃ 🏛️ *Estado Registrado:* ${estado}\n` +
                    `┃ 📋 *Régimen:* ${regimen}\n` +
                    `┃ 📍 *Administración:* ${administracion}\n` +
                    `┃ ⚖️ *Estado Tributario:* Moroso: ${moroso} | Omiso: ${omiso}\n` +
                    (actividadesTexto ? actividadesTexto : '') +
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
                        text: `❌ Cédula *${formateadaCR}* no encontrada en los registros de Costa Rica.\n\n_Unknown Codexツ</>_`
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
                        nombres: res1.data.nombres || 'N/A',
                        apellidoPaterno: res1.data.apellidoPaterno || '',
                        apellidoMaterno: res1.data.apellidoMaterno || '',
                        nombreCompleto: [res1.data.nombres, res1.data.apellidoPaterno, res1.data.apellidoMaterno].filter(Boolean).join(' '),
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
                            nombres: d2.nombres || 'N/A',
                            apellidoPaterno: d2.apellido_paterno || d2.apellidoPaterno || '',
                            apellidoMaterno: d2.apellido_materno || d2.apellidoMaterno || '',
                            nombreCompleto: [d2.nombres, d2.apellido_paterno || d2.apellidoPaterno, d2.apellido_materno || d2.apellidoMaterno].filter(Boolean).join(' '),
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

            const apellidos = [persona.apellidoPaterno, persona.apellidoMaterno].filter(Boolean).join(' ') || 'N/A';

            const msg =
                `╭━━━〔 🇵🇪 FICHA DE IDENTIDAD PERÚ 〕━━━⬣\n` +
                `┃ 👤 *Nombre Completo:* ${persona.nombreCompleto || 'N/A'}\n` +
                `┃ 👤 *Nombres:* ${persona.nombres}\n` +
                `┃ 👤 *Apellidos:* ${apellidos}\n` +
                `┃ 🪪 *DNI:* ${persona.dni} - ${persona.codVerifica}\n` +
                `┃ 🔢 *Dígito Verificador:* ${persona.codVerifica}\n` +
                `┃ 📋 *Tipo:* Documento Nacional de Identidad (DNI)\n` +
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

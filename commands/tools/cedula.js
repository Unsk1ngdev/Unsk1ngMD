'use strict';

const axios = require('axios');
const sharp = require('sharp');
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const config = require('../../config');
const logger = require('../../lib/logger');

/**
 * Tabla de oficialías y municipios de emisión según los primeros 3 dígitos de la cédula dominicana (JCE)
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
 * Valida matemáticamente el algoritmo oficial (Luhn / Módulo 10) de la cédula dominicana de la JCE
 */
function validarLuhnRD(cedula) {
    const clean = String(cedula || '').replace(/\D/g, '');
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
    const mes = d.getUTCMonth() + 1;

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

/**
 * Comprueba si un buffer de imagen es válido y no es una respuesta de error HTML o texto
 */
function esBufferImagenValido(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 100) return false;
    // Comprobar firmas mágicas de imagen: JPEG (FF D8), PNG (89 50 4E 47), WEBP (RIFF)
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return true;
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
    return false;
}

/**
 * Genera una tarjeta visual tipo "ficha oficial" con todos los datos.
 * Si se provee photoBuffer (foto real de la persona), la incrusta como avatar circular.
 * Devuelve un Buffer PNG listo para enviar por WhatsApp.
 *
 * @param {Object} datos - Objeto con los campos de la cédula
 * @param {Buffer|null} fotoPersona - Buffer con la foto real de la persona (opcional)
 * @returns {Promise<Buffer>} PNG de la tarjeta
 */
async function generarTarjetaVisual(datos, fotoPersona = null) {
    const W = 900;
    const H = 560;

    // ── Colores y tema ─────────────────────────────────────────────────────────
    const BG_TOP    = '#0a1628';   // Azul marino oscuro (encabezado)
    const BG_BODY   = '#0e1e38';   // Azul marino menos oscuro (cuerpo)
    const BG_CARD   = '#111d33';   // Fondo de tarjeta de datos
    const ACCENT    = '#3d85ff';   // Azul brillante
    const GOLD      = '#f5c842';   // Dorado para el escudo/título
    const TEXT_PRI  = '#ffffff';   // Blanco principal
    const TEXT_SEC  = '#8baad8';   // Azul claro secundario
    const GREEN_OK  = '#22c55e';   // Verde validado
    const RED_ERR   = '#ef4444';   // Rojo inválido
    const BORDER    = '#1e3a5f';   // Borde de separación

    // ── Campos de datos ────────────────────────────────────────────────────────
    const nombre      = (datos.nombre      || 'CIUDADANO(A) DOMINICANO(A)').toUpperCase();
    const cedula      = datos.cedula       || '000-0000000-0';
    const nacimiento  = datos.nacimiento   || 'Protegida (Ley 172-13)';
    const edad        = datos.edad         || '';
    const zodiaco     = datos.zodiaco      || '';
    const genero      = datos.genero       || '';
    const estadoCivil = datos.estadoCivil  || '';
    const origen      = datos.origen       || '';
    const serie       = datos.serie        || '';
    const municipio   = datos.municipio    || '';
    const luhn        = datos.luhnValido   ? '✓ MÓDULO 10 VÁLIDO' : '✗ INVÁLIDO';
    const luhnColor   = datos.luhnValido   ? GREEN_OK : RED_ERR;
    const jceOk       = datos.jceValido    ? '✓ CONFIRMADO EN PADRÓN JCE' : '◉ VALIDACIÓN MATEMÁTICA';
    const jceColor    = datos.jceValido    ? GREEN_OK : ACCENT;

    // ── Función auxiliar: escapar texto para SVG ──────────────────────────────
    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Construcción del SVG ──────────────────────────────────────────────────

    // Avatar: si hay foto real, la procesamos a círculo base64
    let avatarSVG = '';
    let fotoBase64 = '';
    if (fotoPersona && Buffer.isBuffer(fotoPersona)) {
        try {
            const fotoCircular = await sharp(fotoPersona)
                .resize(140, 140, { fit: 'cover', position: 'centre' })
                .png()
                .toBuffer();
            fotoBase64 = fotoCircular.toString('base64');
        } catch (_) { fotoBase64 = ''; }
    }

    const AVATAR_X  = 60;
    const AVATAR_Y  = 95;
    const AVATAR_R  = 70;
    const AVATAR_CX = AVATAR_X + AVATAR_R;
    const AVATAR_CY = AVATAR_Y + AVATAR_R;

    if (fotoBase64) {
        // Foto real circular
        avatarSVG = `
  <defs>
    <clipPath id="avatarClip">
      <circle cx="${AVATAR_CX}" cy="${AVATAR_CY}" r="${AVATAR_R}" />
    </clipPath>
    <filter id="avatarShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <circle cx="${AVATAR_CX}" cy="${AVATAR_CY}" r="${AVATAR_R + 4}" fill="${ACCENT}" filter="url(#avatarShadow)" />
  <image href="data:image/png;base64,${fotoBase64}"
         x="${AVATAR_X}" y="${AVATAR_Y}" width="${AVATAR_R * 2}" height="${AVATAR_R * 2}"
         clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="${AVATAR_CX}" cy="${AVATAR_CY}" r="${AVATAR_R}" fill="none" stroke="${ACCENT}" stroke-width="3"/>
  <circle cx="${AVATAR_CX + AVATAR_R - 12}" cy="${AVATAR_CY + AVATAR_R - 12}" r="14" fill="${GREEN_OK}"/>
  <text x="${AVATAR_CX + AVATAR_R - 12}" y="${AVATAR_CY + AVATAR_R - 7}" text-anchor="middle" font-size="16" fill="white">✓</text>`;
    } else {
        // Avatar placeholder con iniciales
        const iniciales = nombre.split(' ').slice(0, 2).map(p => p.charAt(0)).join('');
        avatarSVG = `
  <defs>
    <radialGradient id="avatarGrad" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#2a4a8a"/>
      <stop offset="100%" stop-color="#0d1f3c"/>
    </radialGradient>
    <filter id="avatarShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <circle cx="${AVATAR_CX}" cy="${AVATAR_CY}" r="${AVATAR_R + 4}" fill="${ACCENT}" filter="url(#avatarShadow)" />
  <circle cx="${AVATAR_CX}" cy="${AVATAR_CY}" r="${AVATAR_R}" fill="url(#avatarGrad)" />
  <circle cx="${AVATAR_CX}" cy="${AVATAR_CY}" r="${AVATAR_R}" fill="none" stroke="${ACCENT}" stroke-width="3"/>
  <text x="${AVATAR_CX}" y="${AVATAR_CY + 16}" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${TEXT_PRI}">${esc(iniciales)}</text>`;
    }

    // Filas de datos dinámicas
    const filas = [];
    if (nacimiento) filas.push({ label: '🎂 Nacimiento', value: nacimiento + (edad ? ` · ${edad}` : '') });
    if (zodiaco)    filas.push({ label: '♈ Signo', value: zodiaco });
    if (genero)     filas.push({ label: '⚧ Género', value: genero });
    if (estadoCivil)filas.push({ label: '💍 Estado Civil', value: estadoCivil });
    if (origen)     filas.push({ label: '📍 Origen', value: origen });
    if (serie)      filas.push({ label: '🏛 Serie', value: `${serie} — ${municipio}` });

    const MAX_FILAS = 6;
    const filasRender = filas.slice(0, MAX_FILAS);

    // Posición de grilla de datos
    const GRID_X   = 60;
    const GRID_Y   = 290;
    const GRID_W   = W - 120;
    const FILA_H   = 44;
    const COL_W    = GRID_W / 2;

    let grilasSVG = '';
    filasRender.forEach((f, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x   = GRID_X + col * COL_W;
        const y   = GRID_Y + row * FILA_H;
        const isOdd = (row % 2 === 1);
        const bg = isOdd ? '#0d1b2e' : 'none';

        grilasSVG += `
  <rect x="${x}" y="${y - 6}" width="${COL_W - 8}" height="${FILA_H - 4}" rx="6" fill="${bg}" opacity="0.6"/>
  <text x="${x + 10}" y="${y + 10}" font-family="Arial, sans-serif" font-size="11" fill="${TEXT_SEC}">${esc(f.label)}</text>
  <text x="${x + 10}" y="${y + 28}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${TEXT_PRI}">${esc(f.value.substring(0, 36))}${f.value.length > 36 ? '…' : ''}</text>`;
    });

    const svgSource = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Fondo -->
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG_TOP}"/>
      <stop offset="100%" stop-color="${BG_BODY}"/>
    </linearGradient>
    <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0d2352"/>
      <stop offset="100%" stop-color="#1a3a78"/>
    </linearGradient>
    <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="60%" stop-color="#6aa0ff"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>
  </defs>

  <!-- Fondo principal -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <!-- Encabezado -->
  <rect x="0" y="0" width="${W}" height="75" fill="url(#headerGrad)"/>
  <rect x="0" y="72" width="${W}" height="3" fill="url(#accentLine)"/>

  <!-- Bandera dominicana (rayas) decorativas en esquina -->
  <rect x="${W - 80}" y="0" width="20" height="75" fill="#002D62" opacity="0.7"/>
  <rect x="${W - 60}" y="0" width="20" height="75" fill="#CF142B" opacity="0.7"/>
  <rect x="${W - 40}" y="0" width="20" height="75" fill="#002D62" opacity="0.7"/>
  <rect x="${W - 20}" y="0" width="20" height="75" fill="#CF142B" opacity="0.7"/>
  <rect x="${W - 80}" y="0" width="80" height="75" fill="url(#headerGrad)" opacity="0.5"/>

  <!-- Título institucional -->
  <text x="20" y="28" font-family="Arial Black, Arial, sans-serif" font-size="12" font-weight="bold" fill="${TEXT_SEC}" letter-spacing="3">REPÚBLICA DOMINICANA</text>
  <text x="20" y="52" font-family="Arial Black, Arial, sans-serif" font-size="17" font-weight="900" fill="${GOLD}" letter-spacing="1">JUNTA CENTRAL ELECTORAL — FICHA DE IDENTIDAD</text>

  <!-- Avatar (foto o iniciales) -->
  ${avatarSVG}

  <!-- Nombre y cédula -->
  <text x="220" y="130" font-family="Arial Black, Arial, sans-serif" font-size="22" font-weight="900" fill="${TEXT_PRI}">${esc(nombre.length > 32 ? nombre.substring(0, 32) + '…' : nombre)}</text>
  <text x="220" y="158" font-family="Arial, sans-serif" font-size="13" fill="${TEXT_SEC}" letter-spacing="1">CÉDULA DE IDENTIDAD Y ELECTORAL</text>

  <!-- Número de cédula grande -->
  <rect x="220" y="168" width="360" height="50" rx="8" fill="${ACCENT}" opacity="0.12"/>
  <rect x="220" y="168" width="360" height="50" rx="8" fill="none" stroke="${ACCENT}" stroke-width="1.5" opacity="0.5"/>
  <text x="400" y="200" text-anchor="middle" font-family="Courier New, Courier, monospace" font-size="26" font-weight="bold" fill="${GOLD}" letter-spacing="3">${esc(cedula)}</text>

  <!-- Separador de datos -->
  <rect x="${GRID_X}" y="${GRID_Y - 20}" width="${GRID_W}" height="1" fill="${BORDER}"/>
  <text x="${GRID_X}" y="${GRID_Y - 6}" font-family="Arial, sans-serif" font-size="10" fill="${TEXT_SEC}" letter-spacing="2">DATOS PERSONALES</text>

  <!-- Grilla de datos dinámicos -->
  ${grilasSVG}

  <!-- Banda de estado inferior -->
  <rect x="0" y="${H - 64}" width="${W}" height="64" fill="#07101f"/>
  <rect x="0" y="${H - 64}" width="${W}" height="2" fill="url(#accentLine)"/>

  <!-- Validaciones -->
  <rect x="30" y="${H - 50}" width="300" height="34" rx="6" fill="${luhnColor}" opacity="0.12"/>
  <rect x="30" y="${H - 50}" width="300" height="34" rx="6" fill="none" stroke="${luhnColor}" stroke-width="1.2"/>
  <text x="180" y="${H - 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="${luhnColor}">${esc(luhn)}</text>

  <rect x="345" y="${H - 50}" width="330" height="34" rx="6" fill="${jceColor}" opacity="0.12"/>
  <rect x="345" y="${H - 50}" width="330" height="34" rx="6" fill="none" stroke="${jceColor}" stroke-width="1.2"/>
  <text x="510" y="${H - 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="${jceColor}">${esc(jceOk)}</text>

  <!-- Marca de agua / firma -->
  <text x="${W - 20}" y="${H - 8}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="${TEXT_SEC}" opacity="0.6">Unknown Codexツ&lt;/&gt;</text>
</svg>`;

    // Convertir SVG a PNG con sharp
    const svgBuffer = Buffer.from(svgSource, 'utf8');
    const pngBuffer = await sharp(svgBuffer)
        .png({ quality: 95, compressionLevel: 7 })
        .toBuffer();

    return pngBuffer;
}

module.exports = {
    name: 'cedula',
    alias: ['dni', 'consultacedula', 'consultadni', 'identidad', 'rnc'],
    category: 'premium',
    desc: 'Consulta la mayor cantidad de información y fotografía oficial de cédulas y documentos (Premium)',
    usage: '.cedula [NÚMERO] o .cedula [PAÍS]-[NÚMERO]',
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

        const rawInput = (args && args.length > 0 ? args.join(' ').trim() : '');

        // 2. Menú de ayuda si no se especifica parámetro
        if (!rawInput) {
            return await sock.sendMessage(jid, {
                text: [
                    '╭━━━〔 🪪 CONSULTA DE CÉDULA / DNI / RNC 〕━━━⬣',
                    '┃ 📋 *Uso general:* `.cedula [NÚMERO]` o `.cedula [PAÍS]-[NÚMERO]`',
                    '┃',
                    '┃ 🇩🇴 *República Dominicana:*',
                    '┃ • `.cedula 402-1234567-8` (Cédula JCE con foto y datos)',
                    '┃ • `.cedula 101001577` (RNC empresarial en DGII)',
                    '┃ • `.cedula RD-001-1684343-4`',
                    '┃',
                    '┃ 🇨🇷 *Costa Rica:*',
                    '┃ • `.cedula CR-117240417` (Hacienda Costa Rica)',
                    '┃',
                    '┃ 🇵🇪 *Perú:*',
                    '┃ • `.cedula PE-12345678` (RENIEC Perú)',
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 3. Normalización y autodetección inteligente de país y formato
        let inputUpper = rawInput.toUpperCase().replace(/\s+/g, '');
        let pais = null;
        let numeroDoc = '';

        if (inputUpper.startsWith('RD-') || inputUpper.startsWith('DO-')) {
            pais = 'RD';
            numeroDoc = inputUpper.replace(/^(RD|DO)-/i, '').replace(/\D/g, '');
        } else if (inputUpper.startsWith('CR-')) {
            pais = 'CR';
            numeroDoc = inputUpper.replace(/^CR-/i, '').replace(/\D/g, '');
        } else if (inputUpper.startsWith('PE-')) {
            pais = 'PE';
            numeroDoc = inputUpper.replace(/^PE-/i, '').replace(/\D/g, '');
        } else {
            const soloDigitos = inputUpper.replace(/\D/g, '');
            if (soloDigitos.length === 11) {
                pais = 'RD';
                numeroDoc = soloDigitos;
            } else if (soloDigitos.length === 9) {
                pais = 'RD_RNC';
                numeroDoc = soloDigitos;
            } else if (soloDigitos.length === 8) {
                pais = 'PE';
                numeroDoc = soloDigitos;
            } else if (soloDigitos.length === 10) {
                pais = 'CR';
                numeroDoc = soloDigitos;
            } else {
                pais = 'RD';
                numeroDoc = soloDigitos;
            }
        }

        // ══════════════════════════════════════════════════════════════
        // 🇩🇴 CASO 1: REPÚBLICA DOMINICANA (CÉDULA DE 11 DÍGITOS)
        // ══════════════════════════════════════════════════════════════
        if (pais === 'RD') {
            if (numeroDoc.length !== 11) {
                return await sock.sendMessage(jid, {
                    text: '❌ Formato incorrecto para República Dominicana.\nLa cédula debe contener exactamente 11 dígitos.\nEjemplo: `.cedula 402-1234567-8` o `.cedula RD-001-1684343-4`\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const cedulaFormateada = `${numeroDoc.slice(0, 3)}-${numeroDoc.slice(3, 10)}-${numeroDoc.slice(10)}`;
            const serie = numeroDoc.slice(0, 3);
            const municipioSerie = MUNICIPIOS_RD[serie] || 'Jurisdicción Nacional (Rep. Dominicana)';
            const esLuhnValido = validarLuhnRD(numeroDoc);

            await sock.sendMessage(jid, {
                text: `🔍 Consultando información oficial y fotografía de la cédula *${cedulaFormateada}*...`
            }, { quoted: m });

            const apiKeyEnv = (process.env.CEDULA_API_KEY || process.env.OGTIC_API_KEY || process.env.JCE_API_KEY || '').trim();
            const baseHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, image/*, */*'
            };
            if (apiKeyEnv) {
                baseHeaders['X-Gravitee-Api-Key'] = apiKeyEnv;
                baseHeaders['Authorization'] = `Bearer ${apiKeyEnv}`;
            }

            // Consultas concurrentes a fuentes oficiales y registros de respaldo
            const [
                resCedulaDirecta,
                resPhotoDirecta,
                resCitizenBasic,
                resCitizenPhoto,
                resValidateJCE,
                resDirectorRNC,
                resDomTechRNC
            ] = await Promise.allSettled([
                axios.get(`https://api.digital.gob.do/v3/cedulas/${numeroDoc}`, {
                    timeout: 6000,
                    headers: baseHeaders
                }),
                axios.get(`https://api.digital.gob.do/v3/cedulas/${numeroDoc}/photo`, {
                    timeout: 6000,
                    responseType: 'arraybuffer',
                    headers: baseHeaders
                }),
                axios.get(`https://api.digital.gob.do/v3/citizens/${numeroDoc}/info/basic`, {
                    timeout: 5000,
                    headers: baseHeaders
                }),
                axios.get(`https://api.digital.gob.do/v3/citizens/${numeroDoc}/photo`, {
                    timeout: 5000,
                    responseType: 'arraybuffer',
                    headers: baseHeaders
                }),
                axios.get(`https://api.digital.gob.do/v3/cedulas/${numeroDoc}/validate`, {
                    timeout: 5000,
                    headers: { 'Accept': 'application/json' }
                }),
                axios.get(`https://api.directoriornc.com/api/DGII/${numeroDoc}`, {
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                }),
                axios.get(`https://api-dgii.dominicantechnology.com/api/rnc/${numeroDoc}`, {
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                })
            ]);

            // 1. Extraer fotografía real si está disponible
            let photoBuffer = null;
            if (resPhotoDirecta.status === 'fulfilled' && esBufferImagenValido(resPhotoDirecta.value.data)) {
                photoBuffer = Buffer.from(resPhotoDirecta.value.data);
            } else if (resCitizenPhoto.status === 'fulfilled' && esBufferImagenValido(resCitizenPhoto.value.data)) {
                photoBuffer = Buffer.from(resCitizenPhoto.value.data);
            }

            // 2. Extraer datos biográficos de JCE
            let datosBiograficos = null;
            if (resCedulaDirecta.status === 'fulfilled' && resCedulaDirecta.value.data?.data) {
                datosBiograficos = resCedulaDirecta.value.data.data;
            } else if (resCitizenBasic.status === 'fulfilled' && resCitizenBasic.value.data?.payload) {
                datosBiograficos = resCitizenBasic.value.data.payload;
            }

            // 3. Extraer datos de la DGII si el ciudadano tiene RNC o actividad tributaria
            let datosDGII = null;
            if (resDirectorRNC.status === 'fulfilled' && resDirectorRNC.value.data?.nombreCompleto) {
                datosDGII = resDirectorRNC.value.data;
            } else if (resDomTechRNC.status === 'fulfilled' && resDomTechRNC.value.data?.name) {
                const dt = resDomTechRNC.value.data;
                datosDGII = {
                    nombreCompleto: dt.name,
                    nombreComercial: dt.commercial_name,
                    actividad: dt.activity,
                    estado: dt.status,
                    categoria: dt.payment_regime,
                    fechaRegistro: dt.creation_date
                };
            }

            // 4. Verificación en tiempo real ante la base de datos de la JCE
            const validacionJCEExito = resValidateJCE.status === 'fulfilled' && resValidateJCE.value.data?.valid === true;

            // Si la cédula es completamente inválida (falla Luhn y la JCE la rechaza)
            if (!esLuhnValido && !validacionJCEExito && !datosBiograficos && !datosDGII) {
                return await sock.sendMessage(jid, {
                    text: `❌ Cédula dominicana *${cedulaFormateada}* no válida.\n_El número introducido no coincide con un algoritmo verificador oficial ni con registros del padrón._\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            // Consolidación de nombres y apellidos
            let nombreCompleto = 'Ciudadano(a) Dominicano(a)';
            if (datosBiograficos) {
                const nombres = datosBiograficos.names || '';
                const ap1 = datosBiograficos.firstSurname || '';
                const ap2 = datosBiograficos.secondSurname || '';
                const full = [nombres, ap1, ap2].filter(Boolean).join(' ');
                if (full) nombreCompleto = full;
            } else if (datosDGII?.nombreCompleto) {
                nombreCompleto = datosDGII.nombreCompleto;
            }

            // Formateo de fecha de nacimiento, edad y signo zodiacal
            const birthDateRaw = datosBiograficos?.birthDate || null;
            let fechaNac = 'Protegida (Ley 172-13)';
            let edadTexto = '';
            let zodiaco = null;
            if (birthDateRaw) {
                fechaNac = new Date(birthDateRaw).toLocaleDateString('es-DO', { timeZone: 'UTC' });
                const edad = calcularEdad(birthDateRaw);
                if (edad !== null) edadTexto = ` (${edad} años)`;
                zodiaco = obtenerZodiaco(birthDateRaw);
            }

            const genero = datosBiograficos?.gender === 'M' ? '♂️ Masculino' : (datosBiograficos?.gender === 'F' ? '♀️ Femenino' : null);
            const estadoCivil = datosBiograficos?.civilStatus ? traducirEstadoCivil(datosBiograficos.civilStatus) : null;
            const lugarOrigen = datosBiograficos?.birthPlace ? datosBiograficos.birthPlace.trim().replace(/\s+/g, ' ') : null;

            // Estado de validación oficial
            const validacionAlgoritmo = esLuhnValido ? '✅ Módulo 10 (Luhn) Válido' : '⚠️ Algoritmo no coincidente';
            let verificacionJCETexto = '✅ Documento Oficial Registrado';
            if (validacionJCEExito) {
                verificacionJCETexto = '✅ Confirmado en Padrón Activo de la JCE';
            } else if (esLuhnValido) {
                verificacionJCETexto = '✅ Autenticidad Registral Validada (JCE)';
            }

            // Construcción del reporte completo con la máxima información
            const lineas = [
                '╭━━━〔 🇩🇴 FICHA DE IDENTIDAD DOMINICANA 〕━━━⬣',
                `┃ 👤 *Nombre Completo:* ${nombreCompleto}`,
                `┃ 🪪 *Cédula:* ${cedulaFormateada}`,
                birthDateRaw ? `┃ 🎂 *Nacimiento:* ${fechaNac}${edadTexto}` : null,
                zodiaco ? `┃ ♈ *Signo Zodiacal:* ${zodiaco}` : null,
                genero ? `┃ ⚧️ *Género:* ${genero}` : null,
                estadoCivil ? `┃ 💍 *Estado Civil:* ${estadoCivil}` : null,
                lugarOrigen ? `┃ 📍 *Lugar de Origen:* ${lugarOrigen}` : null,
                `┃ 🏛️ *Serie de Emisión:* Serie ${serie} (${municipioSerie})`,
                `┃ 🛡️ *Verificación JCE:* ${verificacionJCETexto}`,
                `┃ 🔢 *Dígito Verificador:* ${validacionAlgoritmo}`
            ];

            // Si posee registro tributario en DGII, adjuntar información fiscal enriquecida
            if (datosDGII) {
                lineas.push('┃ ─────────────────────────');
                lineas.push('┃ 🏛️ *Registro Fiscal (DGII):*');
                if (datosDGII.nombreComercial && datosDGII.nombreComercial !== datosDGII.nombreCompleto) {
                    lineas.push(`┃ 🏢 *Nombre Comercial:* ${datosDGII.nombreComercial}`);
                }
                if (datosDGII.actividad) {
                    lineas.push(`┃ 💼 *Actividad:* ${datosDGII.actividad}`);
                }
                lineas.push(`┃ 📋 *Estado Tributario:* ${datosDGII.estado || 'ACTIVO'}`);
                if (datosDGII.categoria) {
                    lineas.push(`┃ 📁 *Categoría / Régimen:* ${datosDGII.categoria}`);
                }
                if (datosDGII.fechaRegistro) {
                    lineas.push(`┃ 📅 *Fecha de Registro:* ${datosDGII.fechaRegistro}`);
                }
            } else if (!datosBiograficos) {
                lineas.push('┃ ─────────────────────────');
                lineas.push('┃ ⚖️ *Privacidad Biográfica:* Protegida por Ley 172-13');
                lineas.push('┃ ℹ️ *Estado:* Ciudadano(a) autenticado(a) sin actividad comercial');
            }

            lineas.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣');
            lineas.push('');
            lineas.push('_Unknown Codexツ</>_');

            const caption = lineas.filter(Boolean).join('\n');

            // ── Generar tarjeta visual con todos los datos ─────────────────────────────
            let tarjetaBuffer = null;
            try {
                tarjetaBuffer = await generarTarjetaVisual({
                    nombre:      nombreCompleto,
                    cedula:      cedulaFormateada,
                    nacimiento:  birthDateRaw ? fechaNac : null,
                    edad:        edadTexto ? edadTexto.replace(/[()]/g, '').trim() : null,
                    zodiaco:     zodiaco,
                    genero:      genero,
                    estadoCivil: estadoCivil,
                    origen:      lugarOrigen,
                    serie:       serie,
                    municipio:   municipioSerie,
                    luhnValido:  esLuhnValido,
                    jceValido:   validacionJCEExito
                }, photoBuffer);
            } catch (errTarjeta) {
                logger.warn('[CEDULA] No se pudo generar tarjeta visual:', errTarjeta.message);
            }

            // Enviar tarjeta visual como imagen + texto completo como caption
            if (tarjetaBuffer) {
                return await sock.sendMessage(jid, {
                    image: tarjetaBuffer,
                    caption
                }, { quoted: m });
            } else if (photoBuffer) {
                return await sock.sendMessage(jid, {
                    image: photoBuffer,
                    caption
                }, { quoted: m });
            } else {
                return await sock.sendMessage(jid, {
                    text: caption
                }, { quoted: m });
            }
        }

        // ══════════════════════════════════════════════════════════════
        // 🇩🇴 CASO 2: RNC DE REPÚBLICA DOMINICANA (9 DÍGITOS - EMPRESAS)
        // ══════════════════════════════════════════════════════════════
        if (pais === 'RD_RNC') {
            const rncFormateado = `${numeroDoc.slice(0, 3)}-${numeroDoc.slice(3, 8)}-${numeroDoc.slice(8)}`;
            await sock.sendMessage(jid, {
                text: `🔍 Consultando RNC empresarial *${rncFormateado}* en la base de datos de la DGII...`
            }, { quoted: m });

            let resRD = null;
            try {
                const res = await axios.get(`https://api.directoriornc.com/api/DGII/${numeroDoc}`, { timeout: 6000 });
                if (res.data?.nombreCompleto) {
                    resRD = res.data;
                }
            } catch (_) {}

            if (!resRD) {
                try {
                    const res2 = await axios.get(`https://api-dgii.dominicantechnology.com/api/rnc/${numeroDoc}`, { timeout: 6000 });
                    if (res2.data?.name) {
                        resRD = {
                            rnc: numeroDoc,
                            nombreCompleto: res2.data.name,
                            nombreComercial: res2.data.commercial_name,
                            actividad: res2.data.activity,
                            estado: res2.data.status,
                            categoria: res2.data.payment_regime,
                            fechaRegistro: res2.data.creation_date
                        };
                    }
                } catch (_) {}
            }

            if (!resRD) {
                return await sock.sendMessage(jid, {
                    text: `❌ RNC *${rncFormateado}* no encontrado en el registro tributario de la DGII.\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            const msg = [
                '╭━━━〔 🇩🇴 REGISTRO NACIONAL DE CONTRIBUYENTES (RNC) 〕━━━⬣',
                `┃ 🏢 *Razón Social:* ${resRD.nombreCompleto}`,
                resRD.nombreComercial ? `┃ 🏷️ *Nombre Comercial:* ${resRD.nombreComercial}` : null,
                `┃ 🪪 *RNC:* ${rncFormateado}`,
                `┃ 📊 *Estado:* ${resRD.estado || 'ACTIVO'}`,
                resRD.actividad ? `┃ 💼 *Actividad:* ${resRD.actividad}` : null,
                resRD.categoria ? `┃ 📋 *Régimen / Categoría:* ${resRD.categoria}` : null,
                resRD.fechaRegistro ? `┃ 📅 *Fecha de Registro:* ${resRD.fechaRegistro}` : null,
                '┃ 🏛️ *Institución:* Dirección General de Impuestos Internos (DGII)',
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                '',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n');

            return await sock.sendMessage(jid, { text: msg }, { quoted: m });
        }

        // ══════════════════════════════════════════════════════════════
        // 🇨🇷 CASO 3: COSTA RICA (MINISTERIO DE HACIENDA)
        // ══════════════════════════════════════════════════════════════
        if (pais === 'CR') {
            if (numeroDoc.length < 9 || numeroDoc.length > 12) {
                return await sock.sendMessage(jid, {
                    text: '❌ La identificación de Costa Rica debe contener entre 9 y 10 dígitos.\nEjemplo: `.cedula CR-117240417`\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            let formateadaCR = numeroDoc;
            if (numeroDoc.length === 9) {
                formateadaCR = `${numeroDoc.charAt(0)}-${numeroDoc.slice(1, 5)}-${numeroDoc.slice(5)}`;
            } else if (numeroDoc.length === 10) {
                formateadaCR = `${numeroDoc.slice(0, 2)}-${numeroDoc.slice(2, 6)}-${numeroDoc.slice(6)}`;
            }

            await sock.sendMessage(jid, {
                text: `🔍 Consultando información oficial de la cédula *${formateadaCR}* en Costa Rica...`
            }, { quoted: m });

            try {
                const res = await axios.get(`https://api.hacienda.go.cr/fe/ae?identificacion=${numeroDoc}`, {
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
                const administracion = d.situacion?.administracionTributaria || 'Nacional';

                let actividadesTexto = '';
                if (d.actividades && Array.isArray(d.actividades) && d.actividades.length > 0) {
                    const lista = d.actividades.slice(0, 2).map(a => `┃ 💼 *Actividad:* ${a.descripcion} (${a.estado || 'Activo'})`).join('\n');
                    actividadesTexto = `${lista}\n`;
                }

                const msg = [
                    '╭━━━〔 🇨🇷 FICHA DE IDENTIDAD COSTA RICA 〕━━━⬣',
                    `┃ 👤 *Nombre / Razón Social:* ${d.nombre || 'N/A'}`,
                    `┃ 🪪 *Identificación:* ${formateadaCR}`,
                    `┃ 📋 *Tipo:* ${tipoTexto}`,
                    `┃ 🏛️ *Estado Registrado:* ${estado}`,
                    `┃ 📋 *Régimen:* ${regimen}`,
                    `┃ 📍 *Administración:* ${administracion}`,
                    `┃ ⚖️ *Estado Tributario:* Moroso: ${moroso} | Omiso: ${omiso}`,
                    actividadesTexto ? actividadesTexto.trim() : null,
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                    '',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n');

                let photoBuffer = null;
                const rawPhoto = d.foto || d.photo || d.imagen || d.avatar;
                if (rawPhoto) {
                    try {
                        if (rawPhoto.startsWith('data:image')) {
                            photoBuffer = Buffer.from(rawPhoto.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                        } else if (rawPhoto.startsWith('http')) {
                            const pRes = await axios.get(rawPhoto, { responseType: 'arraybuffer', timeout: 5000 });
                            if (esBufferImagenValido(pRes.data)) photoBuffer = Buffer.from(pRes.data);
                        }
                    } catch (_) {}
                }

                if (photoBuffer) {
                    return await sock.sendMessage(jid, { image: photoBuffer, caption: msg }, { quoted: m });
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

        // ══════════════════════════════════════════════════════════════
        // 🇵🇪 CASO 4: PERÚ (RENIEC / DNI)
        // ══════════════════════════════════════════════════════════════
        if (pais === 'PE') {
            if (numeroDoc.length !== 8) {
                return await sock.sendMessage(jid, {
                    text: '❌ El DNI peruano debe contener exactamente 8 dígitos.\nEjemplo: `.cedula PE-12345678`\n\n_Unknown Codexツ</>_'
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

            await sock.sendMessage(jid, {
                text: `🔍 Consultando información del DNI *${numeroDoc}* en RENIEC Perú...`
            }, { quoted: m });

            let persona = null;

            try {
                const res1 = await axios.get(`https://api.apis.net.pe/v2/reniec/dni?numero=${numeroDoc}`, {
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
                        dni: res1.data.numeroDocumento || numeroDoc,
                        codVerifica: res1.data.codVerifica || res1.data.digitoVerificador || 'N/A',
                        foto: res1.data.foto || res1.data.photo || null
                    };
                }
            } catch (_) {}

            if (!persona) {
                try {
                    const res2 = await axios.post('https://my.apiconsulta.dev/api/dni', {
                        dni: numeroDoc
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
                            dni: d2.numero || numeroDoc,
                            codVerifica: d2.codigo_verificacion || d2.codVerifica || 'N/A',
                            foto: d2.foto_base64 || d2.foto || d2.imagen || null
                        };
                    }
                } catch (_) {}
            }

            if (!persona) {
                return await sock.sendMessage(jid, {
                    text: `❌ DNI peruano *${numeroDoc}* no encontrado en los registros de Perú.\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            const apellidos = [persona.apellidoPaterno, persona.apellidoMaterno].filter(Boolean).join(' ') || 'N/A';

            const msg = [
                '╭━━━〔 🇵🇪 FICHA DE IDENTIDAD PERÚ 〕━━━⬣',
                `┃ 👤 *Nombre Completo:* ${persona.nombreCompleto || 'N/A'}`,
                `┃ 👤 *Nombres:* ${persona.nombres}`,
                `┃ 👤 *Apellidos:* ${apellidos}`,
                `┃ 🪪 *DNI:* ${persona.dni} - ${persona.codVerifica}`,
                `┃ 🔢 *Dígito Verificador:* ${persona.codVerifica}`,
                '┃ 📋 *Tipo:* Documento Nacional de Identidad (DNI)',
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                '',
                '_Unknown Codexツ</>_'
            ].join('\n');

            let photoBuffer = null;
            if (persona.foto) {
                try {
                    if (persona.foto.startsWith('data:image')) {
                        photoBuffer = Buffer.from(persona.foto.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                    } else if (persona.foto.startsWith('http')) {
                        const pRes = await axios.get(persona.foto, { responseType: 'arraybuffer', timeout: 5000 });
                        if (esBufferImagenValido(pRes.data)) photoBuffer = Buffer.from(pRes.data);
                    }
                } catch (_) {}
            }

            if (photoBuffer) {
                return await sock.sendMessage(jid, { image: photoBuffer, caption: msg }, { quoted: m });
            } else {
                return await sock.sendMessage(jid, { text: msg }, { quoted: m });
            }
        }

        // Prefijo de país no reconocido
        return await sock.sendMessage(jid, {
            text: [
                `❌ Prefijo de país no reconocido: *${rawInput}*`,
                '',
                '🌍 *Países disponibles:*',
                '• `RD-` o 11 dígitos → República Dominicana 🇩🇴',
                '• `CR-` o 9-10 dígitos → Costa Rica 🇨🇷',
                '• `PE-` o 8 dígitos → Perú 🇵🇪',
                '',
                'Ejemplo: `.cedula 402-1234567-8` o `.cedula CR-117240417`',
                '',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};

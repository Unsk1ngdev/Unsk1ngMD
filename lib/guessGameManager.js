'use strict';

const sharp = require('sharp');
const economy = require('./economy');
const logger = require('./logger');

// Sesiones activas por chat normalizado
// tebakbendera: chatId -> { picked, timer, rewardCoins, rewardExp, startedAt, messageId }
const benderaSessions = new Map();

// tebaklirik: chatId -> { picked, timer, rewardCoins, rewardExp, startedAt, messageId }
const lirikSessions = new Map();

// suitpvp: chatId -> { p1, p2, p1Move, p2Move, bet, timer, startedAt }
const suitSessions = new Map();

function cleanChatId(id) {
    if (!id) return '';
    return String(id).replace(/:\d+@/, '@').trim().toLowerCase();
}

function cleanStr(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'¡¿]/g, '')
        .trim();
}

// Banderas del mundo con capital, continente y aliases exhaustivos
const BANDERAS = [
    { country: 'República Dominicana', aliases: ['republica dominicana', 'rd', 'dominicana', 'dominican republic', 'rep dominicana'], code: 'DO', continent: 'América / El Caribe', capital: 'Santo Domingo' },
    { country: 'México', aliases: ['mexico', 'mejico'], code: 'MX', continent: 'América del Norte', capital: 'Ciudad de México' },
    { country: 'España', aliases: ['espana', 'spain'], code: 'ES', continent: 'Europa', capital: 'Madrid' },
    { country: 'Argentina', aliases: ['argentina'], code: 'AR', continent: 'América del Sur', capital: 'Buenos Aires' },
    { country: 'Colombia', aliases: ['colombia'], code: 'CO', continent: 'América del Sur', capital: 'Bogotá' },
    { country: 'Perú', aliases: ['peru'], code: 'PE', continent: 'América del Sur', capital: 'Lima' },
    { country: 'Chile', aliases: ['chile'], code: 'CL', continent: 'América del Sur', capital: 'Santiago' },
    { country: 'Estados Unidos', aliases: ['estados unidos', 'usa', 'eeuu', 'united states', 'ee uu'], code: 'US', continent: 'América del Norte', capital: 'Washington D.C.' },
    { country: 'Brasil', aliases: ['brasil', 'brazil'], code: 'BR', continent: 'América del Sur', capital: 'Brasilia' },
    { country: 'Japón', aliases: ['japon', 'japan'], code: 'JP', continent: 'Asia', capital: 'Tokio' },
    { country: 'Francia', aliases: ['francia', 'france'], code: 'FR', continent: 'Europa', capital: 'París' },
    { country: 'Alemania', aliases: ['alemania', 'germany'], code: 'DE', continent: 'Europa', capital: 'Berlín' },
    { country: 'Italia', aliases: ['italia', 'italy'], code: 'IT', continent: 'Europa', capital: 'Roma' },
    { country: 'Canadá', aliases: ['canada'], code: 'CA', continent: 'América del Norte', capital: 'Ottawa' },
    { country: 'Corea del Sur', aliases: ['corea del sur', 'south korea', 'corea'], code: 'KR', continent: 'Asia', capital: 'Seúl' },
    { country: 'Reino Unido', aliases: ['reino unido', 'uk', 'gran bretana', 'inglaterra', 'united kingdom'], code: 'GB', continent: 'Europa', capital: 'Londres' },
    { country: 'Venezuela', aliases: ['venezuela', 'ven'], code: 'VE', continent: 'América del Sur', capital: 'Caracas' },
    { country: 'Uruguay', aliases: ['uruguay'], code: 'UY', continent: 'América del Sur', capital: 'Montevideo' },
    { country: 'Cuba', aliases: ['cuba'], code: 'CU', continent: 'América / El Caribe', capital: 'La Habana' },
    { country: 'Portugal', aliases: ['portugal'], code: 'PT', continent: 'Europa', capital: 'Lisboa' }
];

// SVGs auténticos e inconfundibles de las banderas nacionales (600x400)
const FLAG_SVGS = {
    DO: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="200" fill="#002F6C"/>
        <rect x="300" width="300" height="200" fill="#CE1126"/>
        <rect y="200" width="300" height="200" fill="#CE1126"/>
        <rect x="300" y="200" width="300" height="200" fill="#002F6C"/>
        <rect x="264" width="72" height="400" fill="#FFFFFF"/>
        <rect y="164" width="600" height="72" fill="#FFFFFF"/>
        <rect x="280" y="180" width="40" height="40" rx="4" fill="#002F6C" stroke="#CE1126" stroke-width="3"/>
        <rect x="286" y="186" width="28" height="28" fill="#15803d"/>
        <path d="M295 190 L305 190 M300 186 L300 200" stroke="#FFFFFF" stroke-width="2"/>
    </svg>`,

    MX: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="400" fill="#006847"/>
        <rect x="200" width="200" height="400" fill="#FFFFFF"/>
        <rect x="400" width="200" height="400" fill="#CE1126"/>
        <ellipse cx="300" cy="225" rx="40" ry="12" fill="#15803d"/>
        <path d="M290 220 Q300 170 300 160 Q310 170 310 220 Z" fill="#78350f"/>
        <circle cx="300" cy="165" r="18" fill="#92400e"/>
        <path d="M305 160 L325 168 L305 174 Z" fill="#eab308"/>
        <path d="M312 166 Q325 155 330 175 Q320 185 305 178" stroke="#15803d" stroke-width="4" fill="none"/>
    </svg>`,

    ES: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="100" fill="#AA151B"/>
        <rect y="100" width="600" height="200" fill="#F1BF00"/>
        <rect y="300" width="600" height="100" fill="#AA151B"/>
        <rect x="180" y="165" width="50" height="65" rx="8" fill="#AA151B" stroke="#F1BF00" stroke-width="2"/>
        <rect x="185" y="170" width="40" height="55" fill="#FFFFFF"/>
        <line x1="165" y1="160" x2="165" y2="235" stroke="#FFFFFF" stroke-width="5"/>
        <line x1="245" y1="160" x2="245" y2="235" stroke="#FFFFFF" stroke-width="5"/>
        <circle cx="205" cy="155" r="8" fill="#F1BF00"/>
    </svg>`,

    AR: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="133" fill="#74ACDF"/>
        <rect y="133" width="600" height="134" fill="#FFFFFF"/>
        <rect y="267" width="600" height="133" fill="#74ACDF"/>
        <circle cx="300" cy="200" r="32" fill="#F6B40E" stroke="#B45309" stroke-width="1.5"/>
        <circle cx="300" cy="200" r="22" fill="#FDE047"/>
        <g stroke="#F6B40E" stroke-width="3">
            <line x1="300" y1="160" x2="300" y2="240"/>
            <line x1="260" y1="200" x2="340" y2="200"/>
            <line x1="272" y1="172" x2="328" y2="228"/>
            <line x1="272" y1="228" x2="328" y2="172"/>
        </g>
    </svg>`,

    CO: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="200" fill="#FCD116"/>
        <rect y="200" width="600" height="100" fill="#003893"/>
        <rect y="300" width="600" height="100" fill="#CE1126"/>
    </svg>`,

    PE: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="400" fill="#D91023"/>
        <rect x="200" width="200" height="400" fill="#FFFFFF"/>
        <rect x="400" width="200" height="400" fill="#D91023"/>
        <rect x="275" y="170" width="50" height="60" rx="6" fill="#FCD116" stroke="#15803d" stroke-width="3"/>
        <rect x="280" y="175" width="20" height="25" fill="#74ACDF"/>
        <rect x="300" y="175" width="20" height="25" fill="#FFFFFF"/>
        <rect x="280" y="200" width="40" height="25" fill="#D91023"/>
    </svg>`,

    CL: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#0039A6"/>
        <rect x="200" width="400" height="200" fill="#FFFFFF"/>
        <rect y="200" width="600" height="200" fill="#D52B1E"/>
        <polygon points="100,55 113,95 155,95 121,120 134,160 100,135 66,160 79,120 45,95 87,95" fill="#FFFFFF"/>
    </svg>`,

    US: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#FFFFFF"/>
        <rect y="0" width="600" height="31" fill="#B22234"/>
        <rect y="62" width="600" height="31" fill="#B22234"/>
        <rect y="123" width="600" height="31" fill="#B22234"/>
        <rect y="185" width="600" height="31" fill="#B22234"/>
        <rect y="246" width="600" height="31" fill="#B22234"/>
        <rect y="308" width="600" height="31" fill="#B22234"/>
        <rect y="369" width="600" height="31" fill="#B22234"/>
        <rect width="250" height="216" fill="#3C3B6E"/>
        <g fill="#FFFFFF" font-family="'Segoe UI', sans-serif" font-size="18" text-anchor="middle">
            <text x="45" y="45">★</text><text x="95" y="45">★</text><text x="145" y="45">★</text><text x="195" y="45">★</text>
            <text x="70" y="80">★</text><text x="120" y="80">★</text><text x="170" y="80">★</text>
            <text x="45" y="115">★</text><text x="95" y="115">★</text><text x="145" y="115">★</text><text x="195" y="115">★</text>
            <text x="70" y="150">★</text><text x="120" y="150">★</text><text x="170" y="150">★</text>
            <text x="45" y="185">★</text><text x="95" y="185">★</text><text x="145" y="185">★</text><text x="195" y="185">★</text>
        </g>
    </svg>`,

    BR: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#009739"/>
        <polygon points="300,45 540,200 300,355 60,200" fill="#FEDD00"/>
        <circle cx="300" cy="200" r="95" fill="#012169"/>
        <path d="M210 220 Q300 170 390 220 Q300 180 210 220" fill="#FFFFFF"/>
    </svg>`,

    JP: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#FFFFFF"/>
        <circle cx="300" cy="200" r="110" fill="#BC002D"/>
    </svg>`,

    FR: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="400" fill="#002654"/>
        <rect x="200" width="200" height="400" fill="#FFFFFF"/>
        <rect x="400" width="200" height="400" fill="#ED2939"/>
    </svg>`,

    DE: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="133" fill="#000000"/>
        <rect y="133" width="600" height="134" fill="#DD0000"/>
        <rect y="267" width="600" height="133" fill="#FFCE00"/>
    </svg>`,

    IT: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="400" fill="#009246"/>
        <rect x="200" width="200" height="400" fill="#FFFFFF"/>
        <rect x="400" width="200" height="400" fill="#CE2B37"/>
    </svg>`,

    CA: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="150" height="400" fill="#FF0000"/>
        <rect x="150" width="300" height="400" fill="#FFFFFF"/>
        <rect x="450" width="150" height="400" fill="#FF0000"/>
        <polygon points="300,105 315,150 345,140 335,170 375,175 355,200 370,225 330,220 335,245 305,240 305,295 295,295 295,240 265,245 270,220 230,225 245,200 225,175 265,170 255,140 285,150" fill="#FF0000"/>
    </svg>`,

    KR: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#FFFFFF"/>
        <g transform="translate(300, 200)">
            <path d="M-80 0 A80 80 0 0 1 80 0 A40 40 0 0 1 0 0 A40 40 0 0 0 -80 0" fill="#CD2E3A"/>
            <path d="M80 0 A80 80 0 0 1 -80 0 A40 40 0 0 1 0 0 A40 40 0 0 0 80 0" fill="#0047A0"/>
        </g>
        <rect x="100" y="80" width="60" height="10" fill="#000000"/>
        <rect x="100" y="95" width="60" height="10" fill="#000000"/>
        <rect x="100" y="110" width="60" height="10" fill="#000000"/>
        <rect x="440" y="280" width="60" height="10" fill="#000000"/>
        <rect x="440" y="295" width="60" height="10" fill="#000000"/>
        <rect x="440" y="310" width="60" height="10" fill="#000000"/>
    </svg>`,

    GB: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#012169"/>
        <line x1="0" y1="0" x2="600" y2="400" stroke="#FFFFFF" stroke-width="70"/>
        <line x1="600" y1="0" x2="0" y2="400" stroke="#FFFFFF" stroke-width="70"/>
        <line x1="0" y1="0" x2="600" y2="400" stroke="#C8102E" stroke-width="35"/>
        <line x1="600" y1="0" x2="0" y2="400" stroke="#C8102E" stroke-width="35"/>
        <rect x="250" width="100" height="400" fill="#FFFFFF"/>
        <rect y="150" width="600" height="100" fill="#FFFFFF"/>
        <rect x="270" width="60" height="400" fill="#C8102E"/>
        <rect y="170" width="600" height="60" fill="#C8102E"/>
    </svg>`,

    VE: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="133" fill="#FCE300"/>
        <rect y="133" width="600" height="134" fill="#00247D"/>
        <rect y="267" width="600" height="133" fill="#CF142B"/>
        <g fill="#FFFFFF" font-family="'Segoe UI', sans-serif" font-size="20" text-anchor="middle">
            <text x="230" y="215">★</text><text x="250" y="195">★</text><text x="275" y="185">★</text><text x="300" y="180">★</text><text x="325" y="185">★</text><text x="350" y="195">★</text><text x="370" y="215">★</text>
        </g>
    </svg>`,

    UY: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#FFFFFF"/>
        <rect y="44" width="600" height="44" fill="#0038A8"/>
        <rect y="133" width="600" height="44" fill="#0038A8"/>
        <rect y="222" width="600" height="44" fill="#0038A8"/>
        <rect y="311" width="600" height="44" fill="#0038A8"/>
        <rect width="180" height="180" fill="#FFFFFF"/>
        <circle cx="90" cy="90" r="30" fill="#FCD116" stroke="#B45309" stroke-width="2"/>
        <g stroke="#FCD116" stroke-width="4">
            <line x1="90" y1="45" x2="90" y2="135"/>
            <line x1="45" y1="90" x2="135" y2="90"/>
            <line x1="58" y1="58" x2="122" y2="122"/>
            <line x1="58" y1="122" x2="122" y2="58"/>
        </g>
    </svg>`,

    CU: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#FFFFFF"/>
        <rect y="0" width="600" height="80" fill="#002A8F"/>
        <rect y="160" width="600" height="80" fill="#002A8F"/>
        <rect y="320" width="600" height="80" fill="#002A8F"/>
        <polygon points="0,0 240,200 0,400" fill="#CF142B"/>
        <polygon points="80,140 88,168 116,168 93,186 102,214 80,196 58,214 67,186 44,168 72,168" fill="#FFFFFF"/>
    </svg>`,

    PT: () => `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="240" height="400" fill="#046A38"/>
        <rect x="240" width="360" height="400" fill="#DA291C"/>
        <circle cx="240" cy="200" r="55" fill="#FEDD00" stroke="#B45309" stroke-width="3"/>
        <rect x="220" y="175" width="40" height="50" rx="8" fill="#FFFFFF" stroke="#00247D" stroke-width="3"/>
        <rect x="226" y="183" width="28" height="34" fill="#DA291C"/>
    </svg>`
};

/**
 * Genera tarjeta visual en PNG de la bandera con Sharp (diseño vectorizado de alta calidad)
 */
async function generateFlagBuffer(bandera) {
    const flagSvgFn = FLAG_SVGS[bandera.code];
    const innerFlag = flagSvgFn ? flagSvgFn() : `<rect width="600" height="400" fill="#334155"/>`;

    const cardSvg = `
    <svg width="700" height="520" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0b0f19"/>
                <stop offset="50%" stop-color="#111827"/>
                <stop offset="100%" stop-color="#0f172a"/>
            </linearGradient>
            <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.6"/>
            </filter>
            <clipPath id="flagClip">
                <rect x="75" y="85" width="550" height="340" rx="14"/>
            </clipPath>
        </defs>

        <!-- Fondo principal -->
        <rect width="700" height="520" rx="20" fill="url(#bgGrad)"/>
        <rect x="2" y="2" width="696" height="516" rx="19" fill="none" stroke="#334155" stroke-width="2"/>

        <!-- Header -->
        <rect x="235" y="16" width="230" height="26" rx="13" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
        <text x="350" y="34" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#60a5fa" text-anchor="middle">🚩 ADIVINA LA BANDERA</text>
        <text x="350" y="66" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="bold" fill="#f8fafc" text-anchor="middle">¿A qué país pertenece esta bandera?</text>

        <!-- Contenedor y Bandera centrada con proporciones exactas -->
        <g filter="url(#cardShadow)">
            <rect x="75" y="85" width="550" height="340" rx="14" fill="#ffffff"/>
            <g clip-path="url(#flagClip)">
                <g transform="translate(75, 85) scale(0.916666, 0.85)">
                    ${innerFlag.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
                </g>
            </g>
            <rect x="75" y="85" width="550" height="340" rx="14" fill="none" stroke="#475569" stroke-width="3"/>
        </g>

        <!-- Pie informativo -->
        <rect x="75" y="445" width="550" height="50" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
        <text x="350" y="475" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">
            ⏱️ <tspan fill="#f59e0b" font-weight="bold">45 Segundos</tspan>  •  💡 Escribe el país en el chat o usa .bandera &lt;país&gt;
        </text>
    </svg>`;

    return await sharp(Buffer.from(cardSvg)).png().toBuffer();
}

/**
 * Validador inteligente de coincidencias de país
 */
function isCountryMatch(input, countryObj) {
    const cleanIn = cleanStr(input);
    if (!cleanIn) return false;

    // Remover preposiciones y frases habituales
    const stripped = cleanIn
        .replace(/^(es|el|la|los|las|un|una|unos|unas|pais|el\s+pais|la\s+bandera|creo\s+que\s+es|de)\s+/g, '')
        .replace(/\s+(es|pais|bandera)$/g, '')
        .trim();

    const target = cleanStr(countryObj.country);
    if (cleanIn === target || stripped === target) return true;

    for (const alias of countryObj.aliases) {
        const cleanA = cleanStr(alias);
        if (cleanA.length <= 2) {
            // Comparar palabra exacta para evitar falsos positivos con 'rd', 'us', 'es', 'uk'
            const words = cleanIn.split(/\s+/);
            if (words.includes(cleanA) || stripped === cleanA) return true;
        } else {
            if (cleanIn === cleanA || stripped === cleanA) return true;
            if (cleanIn.includes(cleanA) || stripped.includes(cleanA)) return true;
        }
    }
    return false;
}

/**
 * Verifica si un texto corresponde a algún país de la base de datos
 */
function isAnyKnownCountry(input) {
    const cleanIn = cleanStr(input);
    if (!cleanIn) return null;
    for (const b of BANDERAS) {
        if (isCountryMatch(input, b)) return b;
    }
    return null;
}

// Base de datos de letras de canciones famosas
const CANCIONES_LIRIK = [
    {
        title: 'Despacito',
        artist: 'Luis Fonsi & Daddy Yankee',
        lyric: 'Sí, sabes que ya llevo un rato mirándote, tengo que bailar contigo hoy...',
        aliases: ['despacito', 'despasito']
    },
    {
        title: 'Ella Baila Sola',
        artist: 'Peso Pluma & Eslabón Armado',
        lyric: 'Compa, ¿qué le parece esa morra? La que anda bailando sola me gusta pa mí...',
        aliases: ['ella baila sola', 'ella baila']
    },
    {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        lyric: 'Is this the real life? Is this just fantasy? Caught in a landslide, no escape from reality...',
        aliases: ['bohemian rhapsody', 'queen']
    },
    {
        title: 'Titi Me Preguntó',
        artist: 'Bad Bunny',
        lyric: 'Ey, Tití me preguntó si tengo muchas novia\', muchas novia\', hoy tengo a una, mañana otra...',
        aliases: ['titi me pregunto', 'titi', 'titi me pregunto bad bunny']
    },
    {
        title: 'Danza Kuduro',
        artist: 'Don Omar & Lucenzo',
        lyric: 'La mano arriba, cintura sola, da media vuelta, danza kuduro...',
        aliases: ['danza kuduro', 'kuduro']
    },
    {
        title: 'Gasolina',
        artist: 'Daddy Yankee',
        lyric: 'A ella le gusta la gasolina, dame más gasolina, como le encanta la gasolina...',
        aliases: ['gasolina', 'la gasolina']
    },
    {
        title: 'Bichota',
        artist: 'Karol G',
        lyric: 'Salgo acicalá\' de pies a tope, porque puede ser que con el mío me tope...',
        aliases: ['bichota']
    },
    {
        title: 'Billie Jean',
        artist: 'Michael Jackson',
        lyric: 'Billie Jean is not my lover, she\'s just a girl who claims that I am the one...',
        aliases: ['billie jean', 'billy jean']
    }
];

const guessGameManager = {
    hasActiveGame(chatId) {
        const id = cleanChatId(chatId);
        return benderaSessions.has(id) || lirikSessions.has(id) || suitSessions.has(id);
    },

    cancelAll() {
        for (const s of benderaSessions.values()) { if (s.timer) clearTimeout(s.timer); }
        for (const s of lirikSessions.values()) { if (s.timer) clearTimeout(s.timer); }
        for (const s of suitSessions.values()) { if (s.timer) clearTimeout(s.timer); }
        benderaSessions.clear();
        lirikSessions.clear();
        suitSessions.clear();
    },

    // ── 1. TEBAKBENDERA ──
    async startBendera(sock, m) {
        const chatId = cleanChatId(m.chat || m.key?.remoteJid);
        if (benderaSessions.has(chatId)) {
            const current = benderaSessions.get(chatId);
            const timePassed = Math.floor((Date.now() - current.startedAt) / 1000);
            const timeLeft = Math.max(0, 45 - timePassed);
            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 🚩 ADIVINA LA BANDERA ACTIVA 》 ❐',
                    '┃',
                    '┃├◆ ⚠️ *¡Ya hay una bandera activa por adivinar en este chat!*',
                    `┃├◆ ⏱️ Te quedan *${timeLeft} segundos*.`,
                    '┃',
                    '┃├◆ 💡 *Opciones:*',
                    '┃  • Escribe el nombre del país directamente.',
                    '┃  • Usa: `.bandera <nombre del país>`',
                    '┃  • Pide ayuda: `.bandera pista`',
                    '┃  • Rendirse: `.bandera cancelar`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const picked = BANDERAS[Math.floor(Math.random() * BANDERAS.length)];
        const rewardCoins = Math.floor(Math.random() * 1501) + 1500; // $1,500 - $3,000
        const rewardExp = 120;

        const timer = setTimeout(async () => {
            if (benderaSessions.has(chatId)) {
                benderaSessions.delete(chatId);
                await sock.sendMessage(chatId, {
                    text: [
                        '┏❐ 《 ⏳ TIEMPO AGOTADO 》 ❐',
                        '┃',
                        '┃├◆ Nadie logró adivinar la bandera a tiempo.',
                        `┃├◆ 🌍 *País correcto:* ${picked.country}`,
                        `┃├◆ 🏛️ *Capital:* ${picked.capital}`,
                        `┃├◆ 🗺️ *Continente:* ${picked.continent}`,
                        '┃',
                        '┃├◆ 💡 _Usa *.bandera* para jugar otra ronda._',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                });
            }
        }, 45000);

        const session = {
            picked,
            timer,
            rewardCoins,
            rewardExp,
            startedAt: Date.now(),
            messageId: null
        };
        benderaSessions.set(chatId, session);

        const imageBuf = await generateFlagBuffer(picked);

        const sent = await sock.sendMessage(chatId, {
            image: imageBuf,
            caption: [
                '┏❐ 《 🚩 ADIVINA LA BANDERA 》 ❐',
                '┃',
                '┃├◆ ❓ *¿A qué país pertenece esta bandera?*',
                '┃├◆ ⏱️ Tienes *45 segundos* para responder.',
                `┃├◆ 💰 *Recompensa:* +$${economy.formatNumber(rewardCoins)} monedas`,
                `┃├◆ 🔮 *Experiencia:* +${rewardExp} EXP`,
                '┃',
                '┃├◆ 💡 *Formas de responder:*',
                '┃  • Escribe el país directamente en el chat',
                '┃  • Cita / Responde a esta imagen',
                '┃  • Usa: `.bandera <país>`',
                '┃  • Ayuda: `.bandera pista`',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });

        if (sent?.key?.id) {
            session.messageId = sent.key.id;
        }
    },

    /**
     * Envío de respuesta directo mediante comando .bandera <intento>
     */
    async submitBenderaAnswer(sock, m, rawInput) {
        const chatId = cleanChatId(m.chat || m.key?.remoteJid);
        const sender = m.sender || m.key?.participant || chatId;
        const cleanInput = cleanStr(rawInput);

        if (!benderaSessions.has(chatId)) {
            return await sock.sendMessage(chatId, {
                text: '🚩 *[ADIVINA LA BANDERA]* No hay ninguna partida activa en este chat.\nEscribe *.bandera* para iniciar una nueva ronda.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const session = benderaSessions.get(chatId);
        const timePassed = Math.floor((Date.now() - session.startedAt) / 1000);
        const timeLeft = Math.max(0, 45 - timePassed);

        // Pista
        if (cleanInput === 'pista' || cleanInput === 'hint' || cleanInput === 'ayuda') {
            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 💡 PISTA DE LA BANDERA 》 ❐',
                    '┃',
                    `┃├◆ 🌍 *Continente:* ${session.picked.continent}`,
                    `┃├◆ 🔤 *Empieza con:* "${session.picked.country[0].toUpperCase()}"`,
                    `┃├◆ 🏛️ *Capital:* ${session.picked.capital}`,
                    `┃├◆ ⏱️ *Tiempo restante:* ${timeLeft}s`,
                    '┃',
                    '┃├◆ 💡 _Escribe directamente el país en el chat._',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // Cancelar o rendirse
        if (cleanInput === 'cancelar' || cleanInput === 'rendirse' || cleanInput === 'stop') {
            clearTimeout(session.timer);
            benderaSessions.delete(chatId);
            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 🏳️ PARTIDA CANCELADA 》 ❐',
                    '┃',
                    '┃├◆ La partida de bandera ha sido cancelada.',
                    `┃├◆ 🌍 *País correcto:* ${session.picked.country}`,
                    `┃├◆ 🏛️ *Capital:* ${session.picked.capital}`,
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // Comprobar respuesta
        if (isCountryMatch(rawInput, session.picked)) {
            clearTimeout(session.timer);
            benderaSessions.delete(chatId);

            economy.addCoins(sender, session.rewardCoins);
            const expRes = economy.addExp(sender, session.rewardExp);

            await m.react?.('🎉');
            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 🏆 ¡RESPUESTA CORRECTA! 》 ❐',
                    '┃',
                    `┃├◆ 👑 ¡Felicidades @${sender.split('@')[0]}!`,
                    `┃├◆ 🌍 *País:* ${session.picked.country}`,
                    `┃├◆ 🏛️ *Capital:* ${session.picked.capital}`,
                    `┃├◆ 💰 *Ganaste:* +$${economy.formatNumber(session.rewardCoins)} monedas`,
                    `┃├◆ 🔮 *Experiencia:* +${session.rewardExp} EXP`,
                    expRes.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${expRes.level}!*` : '',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n'),
                mentions: [sender]
            }, { quoted: m });
        } else {
            await m.react?.('❌');
            return await sock.sendMessage(chatId, {
                text: `❌ *"${rawInput}" no es el país correcto.* ¡Sigue intentando!\n⏱️ Te quedan *${timeLeft}s* (puedes pedir *.bandera pista*)\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    },

    // ── 2. TEBAKLIRIK ──
    async startLirik(sock, m) {
        const chatId = cleanChatId(m.chat || m.key?.remoteJid);
        if (lirikSessions.has(chatId)) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Ya hay un fragmento de letra activo por adivinar en este chat. ¡Envía el título de la canción!'
            }, { quoted: m });
        }

        const picked = CANCIONES_LIRIK[Math.floor(Math.random() * CANCIONES_LIRIK.length)];
        const rewardCoins = Math.floor(Math.random() * 1501) + 1500;
        const rewardExp = 120;

        const timer = setTimeout(async () => {
            if (lirikSessions.has(chatId)) {
                lirikSessions.delete(chatId);
                await sock.sendMessage(chatId, {
                    text: `⏳ *¡TIEMPO AGOTADO!*\nNadie adivinó la canción.\n🎵 *Canción:* ${picked.title} - ${picked.artist}\n\n_Unknown Codexツ</>_`
                });
            }
        }, 45000);

        lirikSessions.set(chatId, {
            picked,
            timer,
            rewardCoins,
            rewardExp,
            startedAt: Date.now()
        });

        await sock.sendMessage(chatId, {
            text: [
                '┏❐ 《 🎵 ADIVINA LA CANCIÓN 》 ❐',
                '┃',
                '┃├◆ 📜 *Fragmento de la letra:*',
                `┃   _"${picked.lyric}"_`,
                '┃',
                '┃├◆ ⏱️ Tienes *45 segundos* para adivinar el título.',
                `┃├◆ 💰 *Recompensa:* +$${economy.formatNumber(rewardCoins)} monedas`,
                `┃├◆ 🔮 *Experiencia:* +${rewardExp} EXP`,
                '┃',
                '┃├◆ 💡 _Escribe el título de la canción en el chat o usa .tebaklirik <título>._',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    },

    /**
     * Envío de respuesta directo mediante comando .tebaklirik <canción>
     */
    async submitLirikAnswer(sock, m, rawInput) {
        const chatId = cleanChatId(m.chat || m.key?.remoteJid);
        const sender = m.sender || m.key?.participant || chatId;
        const clean = cleanStr(rawInput);

        if (!lirikSessions.has(chatId)) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *[ADIVINA LA CANCIÓN]* No hay ninguna partida activa en este chat.\nEscribe *.tebaklirik* para iniciar una nueva ronda.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const session = lirikSessions.get(chatId);
        const matches = session.picked.aliases.some(alias => clean.includes(cleanStr(alias)));

        if (matches) {
            clearTimeout(session.timer);
            lirikSessions.delete(chatId);

            economy.addCoins(sender, session.rewardCoins);
            const expRes = economy.addExp(sender, session.rewardExp);

            await m.react?.('🎤');
            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 🏆 ¡CANCIÓN ADIVINADA! 》 ❐',
                    '┃',
                    `┃├◆ 👑 ¡Acertaste @${sender.split('@')[0]}!`,
                    `┃├◆ 🎵 *Canción:* ${session.picked.title}`,
                    `┃├◆ 👤 *Artista:* ${session.picked.artist}`,
                    `┃├◆ 💰 *Ganaste:* +$${economy.formatNumber(session.rewardCoins)} monedas`,
                    `┃├◆ 🔮 *Experiencia:* +${session.rewardExp} EXP`,
                    expRes.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${expRes.level}!*` : '',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n'),
                mentions: [sender]
            }, { quoted: m });
        } else {
            await m.react?.('❌');
            return await sock.sendMessage(chatId, {
                text: `❌ *"${rawInput}" no es la canción correcta.* ¡Sigue intentando!\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    },

    // ── 3. SUIT PVP (.suitpvp @tag) ──
    async startSuitPvp(sock, m, targetJid, bet = 1000) {
        const chatId = cleanChatId(m.chat || m.key?.remoteJid);
        const sender = m.sender || m.key?.participant || chatId;

        if (suitSessions.has(chatId)) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Ya hay un duelo de Piedra, Papel o Tijera activo en este chat.'
            }, { quoted: m });
        }

        const timer = setTimeout(async () => {
            if (suitSessions.has(chatId)) {
                suitSessions.delete(chatId);
                await sock.sendMessage(chatId, {
                    text: `⏳ *¡DUELO CANCELADO POR TIEMPO!*\nLos jugadores no completaron sus jugadas a tiempo.\n\n_Unknown Codexツ</>_`
                });
            }
        }, 30000);

        suitSessions.set(chatId, {
            p1: sender,
            p2: targetJid,
            p1Move: null,
            p2Move: null,
            bet: Math.max(0, parseInt(bet, 10) || 1000),
            timer,
            startedAt: Date.now()
        });

        await sock.sendMessage(chatId, {
            text: [
                '┏❐ 《 ✂️ DUELO PIEDRA, PAPEL O TIJERA PVP 》 ❐',
                '┃',
                `┃├◆ 🥊 @${sender.split('@')[0]} reta a @${targetJid.split('@')[0]}`,
                `┃├◆ 💰 *Apuesta:* $${economy.formatNumber(bet)} monedas`,
                '┃├◆ ⏱️ Tienen *30 segundos* para responder.',
                '┃',
                '┃├◆ ✍️ Ambos jugadores deben escribir:',
                '┃   👉 *piedra*, *papel* o *tijera*',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender, targetJid]
        }, { quoted: m });
    },

    // ── EVALUADOR DE RESPUESTAS EN MENSAJES ENTRANTES ──
    async checkAnswer(sock, m) {
        const chatId = cleanChatId(m.chat || m.key?.remoteJid);
        const sender = m.sender || m.key?.participant || chatId;
        const rawText = (m.body || m.text || '').trim();
        const clean = cleanStr(rawText);

        if (!clean) return false;

        // 1. Verificar Tebakbendera
        if (benderaSessions.has(chatId)) {
            const session = benderaSessions.get(chatId);
            const timePassed = Math.floor((Date.now() - session.startedAt) / 1000);
            const timeLeft = Math.max(0, 45 - timePassed);

            const isQuotingFlag = Boolean(
                session.messageId && m.quoted &&
                ((m.quoted.id && m.quoted.id === session.messageId) ||
                 (m.quoted.key?.id && m.quoted.key.id === session.messageId))
            );

            // Pista en chat
            if (clean === 'pista' || clean === 'hint' || clean === 'ayuda') {
                await sock.sendMessage(chatId, {
                    text: [
                        '┏❐ 《 💡 PISTA DE LA BANDERA 》 ❐',
                        '┃',
                        `┃├◆ 🌍 *Continente:* ${session.picked.continent}`,
                        `┃├◆ 🔤 *Empieza con:* "${session.picked.country[0].toUpperCase()}"`,
                        `┃├◆ 🏛️ *Capital:* ${session.picked.capital}`,
                        `┃├◆ ⏱️ *Tiempo restante:* ${timeLeft}s`,
                        '┃',
                        '┃├◆ 💡 _Escribe directamente el país en el chat._',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
                return true;
            }

            // Cancelar en chat
            if (clean === 'cancelar' || clean === 'rendirse') {
                clearTimeout(session.timer);
                benderaSessions.delete(chatId);
                await sock.sendMessage(chatId, {
                    text: [
                        '┏❐ 《 🏳️ PARTIDA CANCELADA 》 ❐',
                        '┃',
                        '┃├◆ Partida cancelada por el usuario.',
                        `┃├◆ 🌍 *País correcto:* ${session.picked.country}`,
                        `┃├◆ 🏛️ *Capital:* ${session.picked.capital}`,
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
                return true;
            }

            // ¿Acierto correcto?
            if (isCountryMatch(rawText, session.picked)) {
                clearTimeout(session.timer);
                benderaSessions.delete(chatId);

                economy.addCoins(sender, session.rewardCoins);
                const expRes = economy.addExp(sender, session.rewardExp);

                await m.react?.('🎉');
                await sock.sendMessage(chatId, {
                    text: [
                        '┏❐ 《 🏆 ¡RESPUESTA CORRECTA! 》 ❐',
                        '┃',
                        `┃├◆ 👑 ¡Felicidades @${sender.split('@')[0]}!`,
                        `┃├◆ 🌍 *País:* ${session.picked.country}`,
                        `┃├◆ 🏛️ *Capital:* ${session.picked.capital}`,
                        `┃├◆ 💰 *Ganaste:* +$${economy.formatNumber(session.rewardCoins)} monedas`,
                        `┃├◆ 🔮 *Experiencia:* +${session.rewardExp} EXP`,
                        expRes.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${expRes.level}!*` : '',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].filter(Boolean).join('\n'),
                    mentions: [sender]
                }, { quoted: m });

                return true;
            }

            // Si citó directamente la bandera y falló
            if (isQuotingFlag) {
                await m.react?.('❌');
                await sock.sendMessage(chatId, {
                    text: `❌ *"${rawText}" no es el país correcto.* ¡Sigue intentando!\n⏱️ Te quedan *${timeLeft}s* (escribe *pista* si necesitas ayuda)`
                }, { quoted: m });
                return true;
            }

            // Si no citó pero escribió el nombre de algún país conocido de la base de datos
            const guessedCountry = isAnyKnownCountry(rawText);
            if (guessedCountry) {
                await m.react?.('❌');
                return true;
            }
        }

        // 2. Verificar Tebaklirik
        if (lirikSessions.has(chatId)) {
            const session = lirikSessions.get(chatId);
            const matches = session.picked.aliases.some(alias => clean.includes(cleanStr(alias)));

            if (matches) {
                clearTimeout(session.timer);
                lirikSessions.delete(chatId);

                economy.addCoins(sender, session.rewardCoins);
                const expRes = economy.addExp(sender, session.rewardExp);

                await m.react?.('🎤');
                await sock.sendMessage(chatId, {
                    text: [
                        '┏❐ 《 🏆 ¡CANCIÓN ADIVINADA! 》 ❐',
                        '┃',
                        `┃├◆ 👑 ¡Acertaste @${sender.split('@')[0]}!`,
                        `┃├◆ 🎵 *Canción:* ${session.picked.title}`,
                        `┃├◆ 👤 *Artista:* ${session.picked.artist}`,
                        `┃├◆ 💰 *Ganaste:* +$${economy.formatNumber(session.rewardCoins)} monedas`,
                        `┃├◆ 🔮 *Experiencia:* +${session.rewardExp} EXP`,
                        expRes.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${expRes.level}!*` : '',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].filter(Boolean).join('\n'),
                    mentions: [sender]
                }, { quoted: m });

                return true;
            }
        }

        // 3. Verificar Suit PVP
        if (suitSessions.has(chatId)) {
            const session = suitSessions.get(chatId);
            const validMoves = ['piedra', 'papel', 'tijera'];
            const move = validMoves.find(v => clean.includes(v));

            if (move) {
                const isP1 = sender === session.p1;
                const isP2 = sender === session.p2;

                if (isP1 && !session.p1Move) {
                    session.p1Move = move;
                    await m.react?.('👌');
                } else if (isP2 && !session.p2Move) {
                    session.p2Move = move;
                    await m.react?.('👌');
                }

                if (session.p1Move && session.p2Move) {
                    clearTimeout(session.timer);
                    suitSessions.delete(chatId);

                    const m1 = session.p1Move;
                    const m2 = session.p2Move;
                    let winner = null; // null = empate, 'p1', 'p2'

                    if (m1 === m2) {
                        winner = null;
                    } else if (
                        (m1 === 'piedra' && m2 === 'tijera') ||
                        (m1 === 'papel' && m2 === 'piedra') ||
                        (m1 === 'tijera' && m2 === 'papel')
                    ) {
                        winner = 'p1';
                    } else {
                        winner = 'p2';
                    }

                    if (winner === null) {
                        await sock.sendMessage(chatId, {
                            text: [
                                '┏❐ 《 🤝 EMPATE EN SUIT PVP 》 ❐',
                                '┃',
                                `┃├◆ @${session.p1.split('@')[0]} eligió: *${m1}*`,
                                `┃├◆ @${session.p2.split('@')[0]} eligió: *${m2}*`,
                                '┃├◆ ¡Ambos jugadores quedan empatados!',
                                '┗❐\n',
                                '_Unknown Codexツ</>_'
                            ].join('\n'),
                            mentions: [session.p1, session.p2]
                        });
                    } else {
                        const winnerJid = winner === 'p1' ? session.p1 : session.p2;
                        const loserJid = winner === 'p1' ? session.p2 : session.p1;
                        const winMove = winner === 'p1' ? m1 : m2;
                        const loseMove = winner === 'p1' ? m2 : m1;

                        const totalPrize = session.bet * 2;
                        economy.addCoins(winnerJid, session.bet);
                        economy.removeCoins(loserJid, session.bet);
                        const expRes = economy.addExp(winnerJid, 150);

                        await sock.sendMessage(chatId, {
                            text: [
                                '┏❐ 《 🏆 ¡TENEMOS UN GANADOR! 》 ❐',
                                '┃',
                                `┃├◆ 👑 *Ganador:* @${winnerJid.split('@')[0]} (*${winMove}*)`,
                                `┃├◆ 💀 *Perdedor:* @${loserJid.split('@')[0]} (*${loseMove}*)`,
                                `┃├◆ 💰 *Premio:* $${economy.formatNumber(totalPrize)} monedas`,
                                `┃├◆ 🔮 *Experiencia:* +150 EXP`,
                                expRes.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${expRes.level}!*` : '',
                                '┗❐\n',
                                '_Unknown Codexツ</>_'
                            ].filter(Boolean).join('\n'),
                            mentions: [winnerJid, loserJid]
                        });
                    }
                    return true;
                }
            }
        }

        return false;
    }
};

module.exports = guessGameManager;
module.exports.BANDERAS = BANDERAS;
module.exports.CANCIONES_LIRIK = CANCIONES_LIRIK;
module.exports.isCountryMatch = isCountryMatch;
module.exports.cleanChatId = cleanChatId;
module.exports.benderaSessions = benderaSessions;
module.exports.lirikSessions = lirikSessions;
module.exports.suitSessions = suitSessions;

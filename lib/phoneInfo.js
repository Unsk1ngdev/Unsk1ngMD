'use strict';

const { PhoneNumberUtil, PhoneNumberType, PhoneNumberFormat } = require('google-libphonenumber');
const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Convierte un código ISO de 2 letras en su emoji de bandera oficial
 */
const getFlagEmoji = (isoCode) => {
    if (!isoCode || isoCode.length !== 2) return '🌐';
    const codePoints = isoCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

/**
 * Obtiene el nombre en español del país
 */
const getCountryName = (isoCode) => {
    if (!isoCode || isoCode === 'ZZ') return 'Desconocido';
    try {
        const displayNames = new Intl.DisplayNames(['es'], { type: 'region' });
        return displayNames.of(isoCode.toUpperCase()) || isoCode;
    } catch (_) {
        return isoCode;
    }
};

/**
 * Traduce el tipo de línea telefónica a formato legible
 */
const getLineTypeName = (type) => {
    switch (type) {
        case PhoneNumberType.MOBILE:
            return 'Móvil / Celular';
        case PhoneNumberType.FIXED_LINE:
            return 'Línea Fija (Residencial/Comercial)';
        case PhoneNumberType.FIXED_LINE_OR_MOBILE:
            return 'Móvil / Fijo';
        case PhoneNumberType.TOLL_FREE:
            return 'Línea Gratuita (Toll-Free)';
        case PhoneNumberType.VOIP:
            return 'Voz sobre IP (VoIP / Virtual)';
        case PhoneNumberType.PAGER:
            return 'Buscapersonas (Pager)';
        case PhoneNumberType.UAN:
            return 'Número Universal (UAN)';
        case PhoneNumberType.PERSONAL_NUMBER:
            return 'Número Personal';
        case PhoneNumberType.PREMIUM_RATE:
            return 'Tarifa Especial (Premium)';
        default:
            return 'Móvil / Celular';
    }
};

/**
 * Resuelve la zona horaria IANA correspondiente al número telefónico y su prefijo regional
 */
const resolveTimeZone = (isoCode, nationalNumberStr) => {
    const num = (nationalNumberStr || '').replace(/[^0-9]/g, '');

    switch (isoCode) {
        case 'DO': // República Dominicana
            return 'America/Santo_Domingo';

        case 'VE': // Venezuela
            return 'America/Caracas';

        case 'CO': // Colombia
            return 'America/Bogota';

        case 'PE': // Perú
            return 'America/Lima';

        case 'EC': // Ecuador
            return 'America/Guayaquil';

        case 'CL': // Chile
            return 'America/Santiago';

        case 'AR': // Argentina
            return 'America/Argentina/Buenos_Aires';

        case 'UY': // Uruguay
            return 'America/Montevideo';

        case 'PY': // Paraguay
            return 'America/Asuncion';

        case 'BO': // Bolivia
            return 'America/La_Paz';

        case 'CR': // Costa Rica
            return 'America/Costa_Rica';

        case 'PA': // Panamá
            return 'America/Panama';

        case 'GT': // Guatemala
            return 'America/Guatemala';

        case 'HN': // Honduras
            return 'America/Tegucigalpa';

        case 'SV': // El Salvador
            return 'America/El_Salvador';

        case 'NI': // Nicaragua
            return 'America/Managua';

        case 'CU': // Cuba
            return 'America/Havana';

        case 'PR': // Puerto Rico
            return 'America/Puerto_Rico';

        case 'MX': // México (múltiples zonas horarias)
            if (/^(664|686|661|646)/.test(num)) return 'America/Tijuana'; // Baja California (Noroeste)
            if (/^(662|644|631|622|653)/.test(num)) return 'America/Hermosillo'; // Sonora (Pacífico)
            if (/^(998|984|983)/.test(num)) return 'America/Cancun'; // Quintana Roo (Sureste)
            if (/^(612|624|613)/.test(num)) return 'America/Mazatlan'; // Baja California Sur / Sinaloa
            return 'America/Mexico_City'; // Centro de México

        case 'ES': // España
            if (/^(928|922|828|822)/.test(num)) return 'Atlantic/Canary'; // Islas Canarias
            return 'Europe/Madrid';

        case 'US': // Estados Unidos
        case 'CA': // Canadá
            if (/^(206|209|213|253|310|323|360|408|415|425|442|503|509|510|530|541|559|562|619|626|628|650|661|702|707|714|725|760|775|805|818|831|858|909|916|925|949|951|971)/.test(num)) {
                return 'America/Los_Angeles'; // Pacífico
            }
            if (/^(208|303|307|385|406|435|480|505|520|575|602|623|719|720|801|928|970)/.test(num)) {
                return 'America/Denver'; // Montaña
            }
            if (/^(205|210|214|217|218|219|224|225|228|251|254|256|260|262|281|308|309|312|314|316|318|319|320|325|331|334|337|361|402|405|409|414|417|430|432|469|479|501|504|507|512|515|531|534|539|563|573|601|605|608|612|615|618|620|630|636|641|651|660|662|682|701|708|712|713|715|731|763|769|773|779|785|806|815|816|817|830|832|847|870|872|901|903|913|918|920|931|936|940|952|956|972|979)/.test(num)) {
                return 'America/Chicago'; // Central
            }
            if (/^(907)/.test(num)) return 'America/Anchorage';
            if (/^(808)/.test(num)) return 'Pacific/Honolulu';
            return 'America/New_York'; // Este (defecto US)

        case 'BR': // Brasil
            return 'America/Sao_Paulo';

        case 'PT': // Portugal
            return 'Europe/Lisbon';

        case 'FR': // Francia
            return 'Europe/Paris';

        case 'IT': // Italia
            return 'Europe/Rome';

        case 'DE': // Alemania
            return 'Europe/Berlin';

        case 'GB': // Reino Unido
            return 'Europe/London';

        default:
            return 'UTC';
    }
};

/**
 * Calcula los detalles de la hora local en tiempo real para una zona horaria
 */
const getLocalTimeInfo = (timeZone) => {
    try {
        const now = new Date();
        const timeStr = new Intl.DateTimeFormat('es-DO', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).format(now);

        const weekdayRaw = new Intl.DateTimeFormat('es-DO', {
            timeZone,
            weekday: 'long'
        }).format(now);
        const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);

        const dateStr = new Intl.DateTimeFormat('es-DO', {
            timeZone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(now);

        // Diferencia UTC en horas
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
        const diffHours = Math.round((tzDate - utcDate) / (1000 * 60 * 60));
        const offsetStr = `GMT${diffHours >= 0 ? '+' : ''}${diffHours}`;

        // Período del día
        const hour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(now), 10);
        let period = '☀️ Tarde';
        if (hour >= 6 && hour < 12) period = '🌅 Mañana';
        else if (hour >= 12 && hour < 19) period = '☀️ Tarde';
        else if (hour >= 19 && hour < 24) period = '🌙 Noche';
        else period = '🌌 Madrugada';

        return {
            timeZone,
            timeStr,
            weekday,
            dateStr,
            offsetStr,
            period,
            fullString: `${timeStr} (${offsetStr}) • ${period}, ${weekday}`
        };
    } catch (_) {
        return null;
    }
};

/**
 * Resuelve operador y región geográfica específica según prefijos locales ampliados
 */
const resolveCarrierAndRegion = (isoCode, nationalNumberStr, lineType) => {
    const num = (nationalNumberStr || '').replace(/[^0-9]/g, '');

    let carrier = 'Operador local no especificado';
    let region = 'Cobertura Nacional';

    // 🇩🇴 República Dominicana
    if (isoCode === 'DO') {
        if (num.startsWith('809')) {
            carrier = 'Claro / Altice / Viva';
            region = 'Santo Domingo, Distrito Nacional y Región Sur/Este';
        } else if (num.startsWith('829')) {
            carrier = 'Altice / Claro / Viva';
            region = 'Santiago, Cibao Central y Región Norte';
        } else if (num.startsWith('849')) {
            carrier = 'Claro / Viva / Altice Dominicana';
            region = 'Red Nacional Móvil (4G / 5G)';
        } else {
            carrier = 'Claro / Altice / Viva Dominicana';
            region = 'República Dominicana';
        }
        return { carrier, region };
    }

    // 🇻🇪 Venezuela
    if (isoCode === 'VE') {
        if (num.startsWith('412')) {
            carrier = 'Digitel GSM (4G LTE / 5G Ready)';
            region = 'Venezuela (Red Móvil Digitel)';
        } else if (num.startsWith('414') || num.startsWith('424')) {
            carrier = 'Movistar (Telefónica Venezuela)';
            region = 'Venezuela (Red Móvil Movistar)';
        } else if (num.startsWith('416') || num.startsWith('426')) {
            carrier = 'Movilnet (CANTV Telecomunicaciones)';
            region = 'Venezuela (Red Móvil Movilnet)';
        } else if (num.startsWith('212')) {
            carrier = 'CANTV (Red Fija)';
            region = 'Caracas, Gran Miranda y La Guaira';
        } else if (/^24[1-5]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Valencia / Maracay (Carabobo y Aragua)';
        } else if (/^26[1-5]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Maracaibo / Costa Oriental (Zulia)';
        } else if (/^25[1-4]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Barquisimeto / San Felipe (Lara y Yaracuy)';
        } else if (/^27[1-4]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Mérida / Valera / Barinas (Andes venezolanos)';
        } else if (/^27[6-8]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'San Cristóbal / Frontera (Táchira)';
        } else if (/^28[1-4]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Barcelona / Puerto La Cruz (Anzoátegui)';
        } else if (/^28[5-6]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Ciudad Bolívar / Puerto Ordaz (Bolívar)';
        } else if (/^29[1-5]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Maturín / Cumaná (Monagas y Sucre)';
        } else if (num.startsWith('295')) {
            carrier = 'CANTV (Red Fija)';
            region = 'Porlamar / Isla de Margarita (Nueva Esparta)';
        } else if (/^26[8-9]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Coro / Punto Fijo (Falcón)';
        } else if (/^25[8-9]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'San Carlos / Guanare (Cojedes y Portuguesa)';
        } else {
            carrier = 'CANTV / Telecomunicaciones Nacionales';
            region = 'Venezuela';
        }
        return { carrier, region };
    }

    // 🇨🇴 Colombia
    if (isoCode === 'CO') {
        if (/^30[0-5]/.test(num)) {
            carrier = 'Tigo Colombia (Millicom)';
            region = 'Colombia (Móvil Nacional)';
        } else if (/^31[0-4]|^32[0-3]/.test(num)) {
            carrier = 'Claro Colombia (Comcel S.A.)';
            region = 'Colombia (Móvil Nacional)';
        } else if (/^31[5-9]/.test(num)) {
            carrier = 'Movistar Colombia (Telefónica)';
            region = 'Colombia (Móvil Nacional)';
        } else if (/^35[0-1]/.test(num)) {
            carrier = 'WOM Colombia (Partners Telecom)';
            region = 'Colombia (Móvil Nacional)';
        } else if (/^601|^1/.test(num)) {
            carrier = 'ETB / Claro Fijo';
            region = 'Bogotá D.C. y Cundinamarca';
        } else if (/^604|^4/.test(num)) {
            carrier = 'EPM / Tigo Fijo';
            region = 'Medellín y Departamento de Antioquia';
        } else if (/^602|^2/.test(num)) {
            carrier = 'EMCALI / Movistar Fijo';
            region = 'Cali y Valle del Cauca';
        } else if (/^605|^5/.test(num)) {
            carrier = 'Claro / Tigo Fijo';
            region = 'Barranquilla, Cartagena y Región Caribe';
        } else if (/^606/.test(num)) {
            carrier = 'Tigo / Movistar Fijo';
            region = 'Pereira, Manizales y Armenia (Eje Cafetero)';
        } else if (/^607/.test(num)) {
            carrier = 'Claro / Movistar Fijo';
            region = 'Bucaramanga y Santanderes';
        } else {
            carrier = 'Claro / Movistar / Tigo Colombia';
            region = 'Colombia';
        }
        return { carrier, region };
    }

    // 🇲🇽 México
    if (isoCode === 'MX') {
        carrier = 'Telcel (América Móvil) / AT&T México / Movistar';
        if (num.startsWith('55') || num.startsWith('56')) {
            region = 'Ciudad de México y Área Metropolitana';
        } else if (num.startsWith('33')) {
            region = 'Guadalajara y Zona Metropolitana (Jalisco)';
        } else if (num.startsWith('81')) {
            region = 'Monterrey y Zona Metropolitana (Nuevo León)';
        } else if (num.startsWith('664')) {
            region = 'Tijuana / Playas de Rosarito (Baja California)';
        } else if (num.startsWith('998')) {
            region = 'Cancún y Riviera Maya (Quintana Roo)';
        } else if (num.startsWith('999')) {
            region = 'Mérida y Progreso (Yucatán)';
        } else if (num.startsWith('222')) {
            region = 'Puebla de Zaragoza (Puebla)';
        } else if (num.startsWith('477')) {
            region = 'León (Guanajuato)';
        } else if (num.startsWith('442')) {
            region = 'Santiago de Querétaro (Querétaro)';
        } else if (num.startsWith('656')) {
            region = 'Ciudad Juárez (Chihuahua)';
        } else if (num.startsWith('614')) {
            region = 'Chihuahua Capital';
        } else if (num.startsWith('667')) {
            region = 'Culiacán (Sinaloa)';
        } else if (num.startsWith('777')) {
            region = 'Cuernavaca (Morelos)';
        } else if (num.startsWith('229')) {
            region = 'Veracruz / Boca del Río';
        } else {
            region = 'México (Cobertura Nacional)';
        }
        return { carrier, region };
    }

    // 🇵🇪 Perú
    if (isoCode === 'PE') {
        carrier = 'Claro Perú / Movistar / Entel Perú / Bitel';
        if (num.startsWith('9')) {
            region = 'Perú (Red Móvil Nacional)';
        } else if (num.startsWith('1')) {
            region = 'Lima Metropolitana y Provincia Constitucional del Callao';
        } else if (num.startsWith('54')) {
            region = 'Arequipa';
        } else if (num.startsWith('44')) {
            region = 'Trujillo (La Libertad)';
        } else if (num.startsWith('74')) {
            region = 'Chiclayo (Lambayeque)';
        } else if (num.startsWith('73')) {
            region = 'Piura';
        } else if (num.startsWith('84')) {
            region = 'Cusco';
        } else {
            region = 'Perú';
        }
        return { carrier, region };
    }

    // 🇨🇱 Chile
    if (isoCode === 'CL') {
        carrier = 'Entel Chile / Movistar / Claro / WOM';
        if (num.startsWith('9')) {
            region = 'Chile (Red Móvil Nacional)';
        } else if (num.startsWith('2')) {
            region = 'Santiago de Chile y Región Metropolitana';
        } else if (num.startsWith('32')) {
            region = 'Valparaíso / Viña del Mar';
        } else if (num.startsWith('41')) {
            region = 'Concepción / Gran Concepción (Biobío)';
        } else if (num.startsWith('51')) {
            region = 'La Serena / Coquimbo';
        } else {
            region = 'Chile';
        }
        return { carrier, region };
    }

    // 🇦🇷 Argentina
    if (isoCode === 'AR') {
        carrier = 'Personal (Telecom Argentina) / Claro / Movistar';
        if (num.startsWith('11') || num.startsWith('911')) {
            region = 'Buenos Aires (CABA y Gran Buenos Aires / AMBA)';
        } else if (num.startsWith('351')) {
            region = 'Córdoba Capital';
        } else if (num.startsWith('341')) {
            region = 'Rosario (Santa Fe)';
        } else if (num.startsWith('261')) {
            region = 'Mendoza Capital y Gran Mendoza';
        } else if (num.startsWith('221')) {
            region = 'La Plata (Buenos Aires)';
        } else if (num.startsWith('381')) {
            region = 'San Miguel de Tucumán';
        } else if (num.startsWith('223')) {
            region = 'Mar del Plata';
        } else {
            region = 'Argentina';
        }
        return { carrier, region };
    }

    // 🇪🇸 España
    if (isoCode === 'ES') {
        if (/^[67]/.test(num)) {
            carrier = 'Telefónica Movistar / Orange / Vodafone / MásMóvil / Digi';
            region = 'España (Red Móvil Nacional)';
        } else if (/^91|^81/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Comunidad de Madrid';
        } else if (/^93|^83/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Barcelona (Cataluña)';
        } else if (/^96|^86/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Comunidad Valenciana / Alicante';
        } else if (/^95|^85/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Sevilla / Málaga / Granada (Andalucía)';
        } else if (/^94|^84/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Bilbao / San Sebastián / Navarra (Norte)';
        } else if (/^928|^922/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Islas Canarias (Las Palmas / Tenerife)';
        } else {
            carrier = 'Telefónica / Red Española';
            region = 'España';
        }
        return { carrier, region };
    }

    // 🇺🇸 Estados Unidos
    if (isoCode === 'US') {
        carrier = 'Verizon Wireless / AT&T Mobility / T-Mobile US';
        if (/^(212|332|646|718|917|929)/.test(num)) {
            region = 'Nueva York (NY Metro / Manhattan / Brooklyn)';
        } else if (/^(213|310|323|424|661|818|626)/.test(num)) {
            region = 'Los Ángeles, California (CA)';
        } else if (/^(415|628|510|650|408)/.test(num)) {
            region = 'San Francisco / Silicon Valley (CA)';
        } else if (/^(305|786)/.test(num)) {
            region = 'Miami / Dade County, Florida (FL)';
        } else if (/^(407|321|689)/.test(num)) {
            region = 'Orlando / Condado de Orange, Florida (FL)';
        } else if (/^(312|773|872)/.test(num)) {
            region = 'Chicago, Illinois (IL)';
        } else if (/^(713|281|832)/.test(num)) {
            region = 'Houston, Texas (TX)';
        } else if (/^(214|469|972)/.test(num)) {
            region = 'Dallas / Fort Worth, Texas (TX)';
        } else if (/^(206|425|253)/.test(num)) {
            region = 'Seattle, Washington (WA)';
        } else if (/^(702|725)/.test(num)) {
            region = 'Las Vegas, Nevada (NV)';
        } else if (/^(404|678|470)/.test(num)) {
            region = 'Atlanta, Georgia (GA)';
        } else {
            region = 'Estados Unidos (Nacional)';
        }
        return { carrier, region };
    }

    // 🇨🇷 Costa Rica
    if (isoCode === 'CR') {
        carrier = 'Kölbi (ICE) / Liberty Costa Rica / Claro';
        region = 'Costa Rica (Cobertura Nacional)';
        return { carrier, region };
    }

    // 🇵🇦 Panamá
    if (isoCode === 'PA') {
        carrier = 'Tigo Panamá / +Móvil (C&W) / Claro';
        region = 'Panamá (Cobertura Nacional)';
        return { carrier, region };
    }

    // 🇪🇨 Ecuador
    if (isoCode === 'EC') {
        carrier = 'Claro Ecuador (Conecel) / Movistar (Otecel) / CNT';
        if (num.startsWith('9')) {
            region = 'Ecuador (Red Móvil Nacional)';
        } else if (num.startsWith('2')) {
            region = 'Quito / Provincia de Pichincha';
        } else if (num.startsWith('4')) {
            region = 'Guayaquil / Provincia del Guayas';
        } else {
            region = 'Ecuador';
        }
        return { carrier, region };
    }

    // 🇬🇹 Guatemala
    if (isoCode === 'GT') {
        carrier = 'Tigo Guatemala / Claro Guatemala';
        region = 'Guatemala (Cobertura Nacional)';
        return { carrier, region };
    }

    // 🇭🇳 Honduras
    if (isoCode === 'HN') {
        carrier = 'Tigo Honduras / Claro Honduras';
        region = 'Honduras (Cobertura Nacional)';
        return { carrier, region };
    }

    // 🇸🇻 El Salvador
    if (isoCode === 'SV') {
        carrier = 'Tigo El Salvador / Claro / Movistar / Digicel';
        region = 'El Salvador (Cobertura Nacional)';
        return { carrier, region };
    }

    // 🇳🇮 Nicaragua
    if (isoCode === 'NI') {
        carrier = 'Claro Nicaragua / Tigo Nicaragua';
        region = 'Nicaragua (Cobertura Nacional)';
        return { carrier, region };
    }

    // 🇧🇴 Bolivia
    if (isoCode === 'BO') {
        carrier = 'Entel Bolivia / Tigo Bolivia / Viva';
        region = 'Bolivia (Cobertura Nacional)';
        return { carrier, region };
    }

    // 🇵🇾 Paraguay
    if (isoCode === 'PY') {
        carrier = 'Tigo Paraguay / Personal / Claro / Vox';
        region = 'Paraguay (Cobertura Nacional)';
        return { carrier, region };
    }

    // 🇺🇾 Uruguay
    if (isoCode === 'UY') {
        carrier = 'Antel Uruguay / Movistar / Claro';
        region = 'Uruguay (Cobertura Nacional)';
        return { carrier, region };
    }

    const cName = getCountryName(isoCode);
    return {
        carrier: 'Operador de Telecomunicaciones',
        region: cName !== 'Desconocido' ? `${cName} (Nacional)` : 'Internacional'
    };
};

/**
 * Parsea y resuelve todos los detalles geográficos, horarios y de red de un número
 */
const parsePhoneNumberInfo = (rawNumber) => {
    try {
        const cleanDigits = (rawNumber || '').toString().replace(/[^0-9]/g, '');
        if (!cleanDigits || cleanDigits.length < 6) {
            return null;
        }

        const formattedWithPlus = '+' + cleanDigits;
        const parsed = phoneUtil.parse(formattedWithPlus);
        const isValid = phoneUtil.isValidNumber(parsed);
        const isoCode = phoneUtil.getRegionCodeForNumber(parsed) || 'ZZ';
        const countryName = getCountryName(isoCode);
        const flag = getFlagEmoji(isoCode);
        const type = phoneUtil.getNumberType(parsed);
        const lineType = getLineTypeName(type);
        const nationalNumber = parsed.getNationalNumber().toString();
        const countryCallingCode = `+${parsed.getCountryCode()}`;

        const { carrier, region } = resolveCarrierAndRegion(isoCode, nationalNumber, lineType);
        const internationalFormatted = phoneUtil.format(parsed, PhoneNumberFormat.INTERNATIONAL);
        const nationalFormatted = phoneUtil.format(parsed, PhoneNumberFormat.NATIONAL);
        const e164 = phoneUtil.format(parsed, PhoneNumberFormat.E164);

        // Huso horario y hora local
        const timeZone = resolveTimeZone(isoCode, nationalNumber);
        const localTimeInfo = getLocalTimeInfo(timeZone);

        return {
            isValid,
            cleanDigits,
            isoCode,
            countryName,
            countryCallingCode,
            flag,
            lineType,
            carrier,
            region,
            regionOrZone: region, // Compatibilidad retroactiva
            internationalFormatted,
            nationalFormatted,
            e164,
            timeZone,
            localTimeInfo
        };
    } catch (_) {
        return null;
    }
};

module.exports = {
    parsePhoneNumberInfo,
    getFlagEmoji,
    getCountryName,
    getLineTypeName,
    resolveTimeZone,
    getLocalTimeInfo
};

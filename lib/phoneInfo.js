const { PhoneNumberUtil, PhoneNumberType, PhoneNumberFormat } = require('google-libphonenumber');
const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Convierte un código ISO de 2 letras en su emoji de bandera
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
 * Traduce el tipo de número a texto legible
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
 * Resuelve operador y región geográfica específica según prefijos locales
 */
const resolveCarrierAndRegion = (isoCode, nationalNumberStr, lineType) => {
    const num = nationalNumberStr.replace(/[^0-9]/g, '');

    let carrier = 'Operador local no especificado';
    let region = 'Cobertura Nacional';

    if (isoCode === 'VE') { // Venezuela
        if (num.startsWith('412')) {
            carrier = 'Digitel';
            region = 'Venezuela (Móvil)';
        } else if (num.startsWith('414') || num.startsWith('424')) {
            carrier = 'Movistar (Telefónica)';
            region = 'Venezuela (Móvil)';
        } else if (num.startsWith('416') || num.startsWith('426')) {
            carrier = 'Movilnet (CANTV)';
            region = 'Venezuela (Móvil)';
        } else if (num.startsWith('212')) {
            carrier = 'CANTV (Red Fija)';
            region = 'Caracas / Miranda / La Guaira';
        } else if (/^24[1-5]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Valencia / Maracay (Carabobo / Aragua)';
        } else if (/^26[1-5]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Maracaibo / Costa Oriental (Zulia)';
        } else if (/^25[1-4]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Barquisimeto / San Felipe (Lara / Yaracuy)';
        } else if (/^27[1-4]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Mérida / Valera / Barinas (Andes)';
        } else if (/^27[6-8]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'San Cristóbal (Táchira)';
        } else if (/^28[1-4]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Barcelona / Puerto La Cruz (Anzoátegui)';
        } else if (/^28[5-6]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Ciudad Bolívar / Puerto Ordaz (Bolívar)';
        } else if (/^29[1-5]/.test(num)) {
            carrier = 'CANTV (Red Fija)';
            region = 'Maturín / Cumaná / Porlamar (Oriente)';
        } else {
            carrier = 'CANTV / Operador Nacional';
            region = 'Venezuela';
        }
        return { carrier, region };
    }

    if (isoCode === 'DO') { // República Dominicana
        if (num.startsWith('809')) {
            carrier = 'Claro / Altice Dominicana';
            region = 'Santo Domingo / Región Nacional';
        } else if (num.startsWith('829')) {
            carrier = 'Altice / Claro Dominicana';
            region = 'Santiago / Región Norte';
        } else if (num.startsWith('849')) {
            carrier = 'Viva / Altice Dominicana';
            region = 'Santo Domingo / Nacional';
        } else {
            carrier = 'Claro / Altice / Viva';
            region = 'República Dominicana';
        }
        return { carrier, region };
    }

    if (isoCode === 'CO') { // Colombia
        if (/^30[0-5]/.test(num)) {
            carrier = 'Tigo Colombia';
            region = 'Colombia (Móvil)';
        } else if (/^31[0-4]|^32[0-3]/.test(num)) {
            carrier = 'Claro Colombia (Comcel)';
            region = 'Colombia (Móvil)';
        } else if (/^31[5-9]/.test(num)) {
            carrier = 'Movistar Colombia';
            region = 'Colombia (Móvil)';
        } else if (/^35[0-1]/.test(num)) {
            carrier = 'WOM / Avantel';
            region = 'Colombia (Móvil)';
        } else if (num.startsWith('1')) {
            carrier = 'ETB / Claro Fijo';
            region = 'Bogotá D.C. / Cundinamarca';
        } else if (num.startsWith('4')) {
            carrier = 'EPM / Tigo Fijo';
            region = 'Medellín / Antioquia';
        } else if (num.startsWith('2')) {
            carrier = 'EMCALI / Movistar';
            region = 'Cali / Valle del Cauca';
        } else if (num.startsWith('5')) {
            carrier = 'Claro / Tigo Fijo';
            region = 'Barranquilla / Costa Atlántica';
        }
        return { carrier, region };
    }

    if (isoCode === 'MX') { // México
        carrier = 'Telcel / AT&T / Movistar';
        if (num.startsWith('55') || num.startsWith('56')) {
            region = 'Ciudad de México y Área Metropolitana';
        } else if (num.startsWith('33')) {
            region = 'Guadalajara, Jalisco';
        } else if (num.startsWith('81')) {
            region = 'Monterrey, Nuevo León';
        } else if (num.startsWith('664')) {
            region = 'Tijuana, Baja California';
        } else if (num.startsWith('998')) {
            region = 'Cancún, Quintana Roo';
        } else if (num.startsWith('999')) {
            region = 'Mérida, Yucatán';
        } else if (num.startsWith('222')) {
            region = 'Puebla, Puebla';
        } else if (num.startsWith('442')) {
            region = 'Querétaro, Querétaro';
        } else if (num.startsWith('777')) {
            region = 'Cuernavaca, Morelos';
        } else if (num.startsWith('656')) {
            region = 'Ciudad Juárez, Chihuahua';
        } else {
            region = 'México';
        }
        return { carrier, region };
    }

    if (isoCode === 'ES') { // España
        if (/^[67]/.test(num)) {
            carrier = 'Telefónica / Orange / Vodafone / MásMóvil';
            region = 'España (Móvil Nacional)';
        } else if (/^91|^81/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Comunidad de Madrid';
        } else if (/^93|^83/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Barcelona, Cataluña';
        } else if (/^96|^86/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Comunidad Valenciana';
        } else if (/^95|^85/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Sevilla / Málaga (Andalucía)';
        } else if (/^94|^84/.test(num)) {
            carrier = 'Telefónica de España';
            region = 'Bilbao / San Sebastián / Navarra';
        } else {
            carrier = 'Telefónica / Red Nacional';
            region = 'España';
        }
        return { carrier, region };
    }

    if (isoCode === 'US') { // Estados Unidos
        carrier = 'Verizon / AT&T / T-Mobile';
        if (/^(212|332|646|718|917|929)/.test(num)) {
            region = 'Nueva York (NY)';
        } else if (/^(213|310|323|424|661|818|626)/.test(num)) {
            region = 'Los Ángeles, California (CA)';
        } else if (/^(415|628|510|650|408)/.test(num)) {
            region = 'San Francisco / Silicon Valley (CA)';
        } else if (/^(305|786)/.test(num)) {
            region = 'Miami / Dade County, Florida (FL)';
        } else if (/^(407|321|689)/.test(num)) {
            region = 'Orlando, Florida (FL)';
        } else if (/^(312|773|872)/.test(num)) {
            region = 'Chicago, Illinois (IL)';
        } else if (/^(713|281|832)/.test(num)) {
            region = 'Houston, Texas (TX)';
        } else if (/^(214|469|972)/.test(num)) {
            region = 'Dallas, Texas (TX)';
        } else if (/^(206|425|253)/.test(num)) {
            region = 'Seattle, Washington (WA)';
        } else if (/^(702|725)/.test(num)) {
            region = 'Las Vegas, Nevada (NV)';
        } else if (/^(404|678|470)/.test(num)) {
            region = 'Atlanta, Georgia (GA)';
        } else {
            region = 'Estados Unidos';
        }
        return { carrier, region };
    }

    if (isoCode === 'AR') { // Argentina
        carrier = 'Claro / Movistar / Personal';
        if (num.startsWith('11') || num.startsWith('911')) {
            region = 'Buenos Aires / AMBA';
        } else if (num.startsWith('351')) {
            region = 'Córdoba Capital';
        } else if (num.startsWith('341')) {
            region = 'Rosario, Santa Fe';
        } else if (num.startsWith('261')) {
            region = 'Mendoza';
        } else {
            region = 'Argentina';
        }
        return { carrier, region };
    }

    if (isoCode === 'CL') { // Chile
        carrier = 'Entel / Movistar / Claro / WOM';
        if (num.startsWith('9')) {
            region = 'Chile (Móvil Nacional)';
        } else if (num.startsWith('2')) {
            region = 'Santiago de Chile / Región Metropolitana';
        } else if (num.startsWith('32')) {
            region = 'Valparaíso / Viña del Mar';
        } else {
            region = 'Chile';
        }
        return { carrier, region };
    }

    if (isoCode === 'PE') { // Perú
        carrier = 'Claro / Movistar / Entel / Bitel';
        if (num.startsWith('9')) {
            region = 'Perú (Móvil Nacional)';
        } else if (num.startsWith('1')) {
            region = 'Lima y Callao';
        } else if (num.startsWith('54')) {
            region = 'Arequipa';
        } else {
            region = 'Perú';
        }
        return { carrier, region };
    }

    if (isoCode === 'EC') { // Ecuador
        carrier = 'Claro / Movistar / CNT';
        if (num.startsWith('9')) {
            region = 'Ecuador (Móvil Nacional)';
        } else if (num.startsWith('2')) {
            region = 'Quito / Pichincha';
        } else if (num.startsWith('4')) {
            region = 'Guayaquil / Guayas';
        } else {
            region = 'Ecuador';
        }
        return { carrier, region };
    }

    const cName = getCountryName(isoCode);
    return {
        carrier: 'Operador de Telecomunicaciones',
        region: cName !== 'Desconocido' ? `${cName} (Nacional)` : 'Internacional'
    };
};

/**
 * Parsea y resuelve todos los detalles geográficos y de línea de un número telefónico
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
        const { carrier, region } = resolveCarrierAndRegion(isoCode, nationalNumber, lineType);
        const internationalFormatted = phoneUtil.format(parsed, PhoneNumberFormat.INTERNATIONAL);

        return {
            isValid,
            cleanDigits,
            isoCode,
            countryName,
            flag,
            lineType,
            carrier,
            region,
            regionOrZone: region, // Compatibilidad retroactiva
            internationalFormatted
        };
    } catch (_) {
        return null;
    }
};

module.exports = {
    parsePhoneNumberInfo,
    getFlagEmoji,
    getCountryName,
    getLineTypeName
};

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Limpieza y formateo de número de teléfono a JID
const formatJid = (number) => {
    if (!number) return '';
    const cleaned = number.toString().replace(/[^0-9]/g, '');
    return cleaned ? `${cleaned}@s.whatsapp.net` : '';
};

const ownerNumber = process.env.OWNER_NUMBER || '584160666286';
const ownerJid = formatJid(ownerNumber);

module.exports = {
    // Nombre del bot y dueño
    botName: process.env.BOT_NAME || 'Unsk1ngMD',
    ownerName: process.env.OWNER_NAME || 'Unknown Codexツ</>',
    ownerNumber: ownerNumber.replace(/[^0-9]/g, ''),
    ownerJid: ownerJid,
    owners: [ownerJid, '18494509905@s.whatsapp.net'], // Lista de administradores globales

    // Prefijo predeterminado
    defaultPrefix: process.env.DEFAULT_PREFIX || '.',

    // Metadatos de Stickers (WebP EXIF)
    packName: process.env.PACK_NAME || 'Unsk1ngMD',
    authorName: process.env.AUTHOR_NAME || 'Unknown Codexツ</>',

    // Modo de operación: 'public' o 'private'
    defaultMode: process.env.BOT_MODE || 'public',

    // Rutas de almacenamiento local
    sessionDir: path.join(__dirname, 'auth_info'),
    subbotsDir: path.join(__dirname, 'subbots'),
    tempDir: path.join(__dirname, 'tmp'),
    databaseDir: path.join(__dirname, 'database'),
    assetsDir: path.join(__dirname, 'assets'),

    // APIs
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    aiApiUrl: process.env.AI_API_URL || '',
    aiApiKey: process.env.AI_API_KEY || '',
    aiModel: process.env.AI_MODEL || 'deepseek',

    // Configuración de límites y memoria
    maxMediaSizeMB: 50,
    tempFileMaxAgeMs: 10 * 60 * 1000 // 10 minutos para limpieza automática
};

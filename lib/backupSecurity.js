'use strict';

const crypto = require('crypto');

const MAGIC_HEADER = Buffer.from('UNSK1NG_BACKUP_V1'); // 17 bytes
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // GCM standard IV length
const TAG_LENGTH = 16; // GCM auth tag length
const KEY_LENGTH = 32; // 256 bits

/**
 * Cifra un buffer con AES-256-GCM usando una contraseña segura
 * @param {Buffer} dataBuffer - Datos en bruto (ej: ZIP de la sesión)
 * @param {string} password - Contraseña o clave secreta
 * @returns {Buffer} Buffer cifrado con cabecera mágica, sal, iv, auth tag y payload
 */
function encryptBackup(dataBuffer, password) {
    if (!password || typeof password !== 'string' || password.trim().length < 8) {
        throw new Error('La contraseña de cifrado debe tener al menos 8 caracteres.');
    }
    if (!Buffer.isBuffer(dataBuffer) || dataBuffer.length === 0) {
        throw new Error('El buffer de datos a cifrar no es válido o está vacío.');
    }

    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.scryptSync(password, salt, KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Formato empaquetado:
    // [MAGIC_HEADER (17B)] + [SALT (16B)] + [IV (12B)] + [AUTH_TAG (16B)] + [ENCRYPTED_PAYLOAD]
    return Buffer.concat([
        MAGIC_HEADER,
        salt,
        iv,
        tag,
        encrypted
    ]);
}

/**
 * Descifra un buffer generado por encryptBackup con AES-256-GCM
 * @param {Buffer} encryptedBuffer - Buffer cifrado
 * @param {string} password - Contraseña con la que fue cifrado
 * @returns {Buffer} Buffer descifrado original
 */
function decryptBackup(encryptedBuffer, password) {
    if (!password || typeof password !== 'string') {
        throw new Error('Se requiere una contraseña para descifrar la copia de seguridad.');
    }
    if (!Buffer.isBuffer(encryptedBuffer)) {
        throw new Error('Los datos proporcionados no son un Buffer válido.');
    }

    const minLength = MAGIC_HEADER.length + SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;
    if (encryptedBuffer.length < minLength) {
        throw new Error('El archivo de copia de seguridad está corrupto o es demasiado corto.');
    }

    // Verificar cabecera mágica
    const fileHeader = encryptedBuffer.subarray(0, MAGIC_HEADER.length);
    if (!fileHeader.equals(MAGIC_HEADER)) {
        throw new Error('Formato de copia de seguridad no reconocido o versión incompatible.');
    }

    let offset = MAGIC_HEADER.length;
    const salt = encryptedBuffer.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    const iv = encryptedBuffer.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const tag = encryptedBuffer.subarray(offset, offset + TAG_LENGTH);
    offset += TAG_LENGTH;

    const ciphertext = encryptedBuffer.subarray(offset);

    const key = crypto.scryptSync(password, salt, KEY_LENGTH);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    try {
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted;
    } catch (_) {
        // En AES-GCM, cualquier alteración o contraseña incorrecta dispara una falla en el tag
        throw new Error('Fallo de autenticación: Contraseña incorrecta o archivo de copia de seguridad modificado.');
    }
}

module.exports = {
    encryptBackup,
    decryptBackup,
    MAGIC_HEADER
};


'use strict';

const assert = require('assert');
const { encryptBackup, decryptBackup, MAGIC_HEADER } = require('../lib/backupSecurity');

console.log('🧪 [TEST] Iniciando pruebas de seguridad para Backup (AES-256-GCM)...');

// 1. Prueba de Cifrado y Descifrado con clave correcta
{
    const originalText = 'Datos-Sensibles-De-Autenticacion-Baileys-Creds-123456789';
    const originalBuffer = Buffer.from(originalText, 'utf8');
    const password = 'ClaveUltraSecretaDePrueba2026';

    const encrypted = encryptBackup(originalBuffer, password);
    assert(Buffer.isBuffer(encrypted), 'El resultado debe ser un Buffer');
    assert(encrypted.length > originalBuffer.length, 'El buffer cifrado debe incluir encabezado, sal, iv y tag');
    assert(encrypted.subarray(0, MAGIC_HEADER.length).equals(MAGIC_HEADER), 'Debe iniciar con MAGIC_HEADER');

    const decrypted = decryptBackup(encrypted, password);
    assert.strictEqual(decrypted.toString('utf8'), originalText, 'El texto descifrado debe ser idéntico al original');
    console.log('  ✅ Prueba 1 superada: Cifrado y descifrado idéntico con clave válida.');
}

// 2. Prueba con contraseña incorrecta
{
    const originalBuffer = Buffer.from('Credenciales-Secretas-WhatsApp', 'utf8');
    const correctPassword = 'PasswordCorrecto123';
    const wrongPassword = 'PasswordIncorrecto456';

    const encrypted = encryptBackup(originalBuffer, correctPassword);
    let errorThrown = false;

    try {
        decryptBackup(encrypted, wrongPassword);
    } catch (err) {
        errorThrown = true;
        assert(err.message.includes('Fallo de autenticación') || err.message.includes('incorrecta'));
    }

    assert(errorThrown, 'Debe lanzar error al intentar descifrar con contraseña incorrecta');
    console.log('  ✅ Prueba 2 superada: Rechazo controlado con contraseña incorrecta (sin revelar secretos).');
}

// 3. Prueba de detección de archivo manipulado (tampered ciphertext o tag)
{
    const originalBuffer = Buffer.from('Informacion-Critica-Intacta', 'utf8');
    const password = 'PasswordSeguro999';

    const encrypted = encryptBackup(originalBuffer, password);
    
    // Corromper intencionalmente un byte en el payload
    const corrupted = Buffer.from(encrypted);
    corrupted[corrupted.length - 5] ^= 0xFF;

    let tamperedError = false;
    try {
        decryptBackup(corrupted, password);
    } catch (err) {
        tamperedError = true;
    }

    assert(tamperedError, 'AES-256-GCM debe rechazar inmediatamente cualquier archivo alterado');
    console.log('  ✅ Prueba 3 superada: Detección estricta de manipulación e integridad garantizada.');
}

// 4. Prueba con contraseñas demasiado cortas
{
    let shortPassError = false;
    try {
        encryptBackup(Buffer.from('test'), 'corta');
    } catch (err) {
        shortPassError = true;
    }
    assert(shortPassError, 'Debe rechazar contraseñas de menos de 8 caracteres');
    console.log('  ✅ Prueba 4 superada: Validación estricta de longitud mínima de clave.');
}

console.log('🎉 [TEST] ¡Todas las pruebas de seguridad de backup pasaron exitosamente!\n');


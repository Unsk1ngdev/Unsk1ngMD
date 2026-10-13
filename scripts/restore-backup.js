'use strict';

/**
 * Script de Restauración y Verificación de Copias de Seguridad Cifradas
 * Uso:
 *   node scripts/restore-backup.js <archivo.enc> <contraseña> [carpeta_destino]
 *
 * Ejemplo:
 *   node scripts/restore-backup.js Backup-Unsk1ngMD.enc "MiContraseñaSuperSegura"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { decryptBackup, MAGIC_HEADER } = require('../lib/backupSecurity');

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('\n❌ Uso incorrecto.');
    console.log('📖 Sintaxis: node scripts/restore-backup.js <archivo.enc> <contraseña> [carpeta_destino]\n');
    process.exit(1);
}

const encFilePath = path.resolve(args[0]);
const password = args[1];
const targetDir = args[2] ? path.resolve(args[2]) : path.resolve(__dirname, '../auth_info');

if (!fs.existsSync(encFilePath)) {
    console.error(`\n❌ Error: El archivo "${encFilePath}" no existe.`);
    process.exit(1);
}

console.log('\n🔐 Iniciando descifrado y validación de seguridad...');

try {
    const encryptedData = fs.readFileSync(encFilePath);
    const decryptedZip = decryptBackup(encryptedData, password);

    console.log('✅ Autenticación AES-256-GCM exitosa: El archivo es auténtico y no ha sido alterado.');

    // Crear carpeta destino si no existe
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Guardar temporalmente el ZIP limpio
    const tempZipPath = path.join(targetDir, '__temp_restore.zip');
    fs.writeFileSync(tempZipPath, decryptedZip);

    console.log(`📦 Extrayendo sesión en: ${targetDir}...`);

    let extracted = false;

    // Intentar extracción con tar (disponible de forma nativa en Windows 10/11, Linux, macOS y Termux)
    try {
        execSync(`tar -xf "${tempZipPath}" -C "${targetDir}"`, { stdio: 'pipe' });
        extracted = true;
    } catch (_) {}

    // Fallback en Linux/Termux con unzip
    if (!extracted) {
        try {
            execSync(`unzip -o -q "${tempZipPath}" -d "${targetDir}"`, { stdio: 'pipe' });
            extracted = true;
        } catch (_) {}
    }

    // Fallback en Windows con PowerShell Expand-Archive
    if (!extracted && process.platform === 'win32') {
        try {
            execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'pipe' });
            extracted = true;
        } catch (_) {}
    }

    // Limpieza estricta del archivo temporal
    if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
    }

    if (extracted) {
        console.log('🎉 ¡Restauración completada con éxito!');
        console.log(`📂 Credenciales listas en: ${targetDir}`);
        console.log('🚀 Ahora puedes ejecutar: npm start\n');
    } else {
        // Si no hay herramientas de descompresión disponibles, guardar el ZIP descifrado intacto
        const outputZip = path.join(targetDir, 'session_restored.zip');
        fs.writeFileSync(outputZip, decryptedZip);
        console.log(`⚠️ Archivo descifrado guardado como "${outputZip}". Descomprímelo manualmente en "${targetDir}".\n`);
    }

} catch (err) {
    console.error(`\n❌ Error de restauración: ${err.message}\n`);
    process.exit(1);
}


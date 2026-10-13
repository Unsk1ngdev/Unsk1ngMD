'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');
const { encryptBackup } = require('../lib/backupSecurity');

console.log('🧪 [TEST] Iniciando prueba end-to-end de restauración de backup...');

const testDir = path.resolve(__dirname, '__temp_test_restore');
const testAuthDir = path.resolve(testDir, 'test_auth');
const testRestoreDir = path.resolve(testDir, 'test_restored');

fs.mkdirSync(testAuthDir, { recursive: true });
fs.writeFileSync(path.join(testAuthDir, 'creds.json'), JSON.stringify({ testToken: 'SESSION-TOKEN-TEST-2026' }));
fs.writeFileSync(path.join(testAuthDir, 'test-key.json'), 'CLAVE-INTERNA-PRUEBA');

// Crear un ZIP en memoria
const memoryChunks = [];
const archive = archiver('zip', { zlib: { level: 9 } });
archive.on('data', c => memoryChunks.push(c));

archive.on('end', () => {
    const zipBuf = Buffer.concat(memoryChunks);
    const password = 'PasswordDePruebaSeguro2026';
    const encryptedBuf = encryptBackup(zipBuf, password);

    const encFilePath = path.join(testDir, 'test_backup.enc');
    fs.writeFileSync(encFilePath, encryptedBuf);

    console.log('  📦 Archivo cifrado creado en:', encFilePath);

    // Ejecutar el script restore-backup.js
    const scriptPath = path.resolve(__dirname, '../scripts/restore-backup.js');
    try {
        const output = execSync(`node "${scriptPath}" "${encFilePath}" "${password}" "${testRestoreDir}"`, { encoding: 'utf8' });
        console.log('  📜 Salida de restore-backup.js:\n' + output.trim().split('\n').map(l => '    ' + l).join('\n'));

        // Verificar que creds.json y test-key.json se hayan extraído correctamente
        const restoredCreds = path.join(testRestoreDir, 'creds.json');
        const restoredKey = path.join(testRestoreDir, 'test-key.json');

        if (fs.existsSync(restoredCreds) && fs.existsSync(restoredKey)) {
            const credsData = JSON.parse(fs.readFileSync(restoredCreds, 'utf8'));
            if (credsData.testToken === 'SESSION-TOKEN-TEST-2026') {
                console.log('  ✅ Prueba superada: creds.json extraído y coincide al 100%.');
            } else {
                throw new Error('El contenido de creds.json no coincide');
            }
        } else {
            // Si el sistema no tenía herramienta de descompresión y generó session_restored.zip, verificar el zip
            const restoredZip = path.join(testRestoreDir, 'session_restored.zip');
            if (fs.existsSync(restoredZip)) {
                console.log('  ✅ Prueba superada: session_restored.zip generado correctamente.');
            } else {
                throw new Error('Los archivos restaurados no se encontraron.');
            }
        }

        console.log('🎉 [TEST] ¡Prueba end-to-end de restauración completada con éxito!\n');
    } catch (err) {
        console.error('❌ Error ejecutando restore-backup.js:', err.message);
        process.exit(1);
    } finally {
        // Limpieza de carpeta de prueba
        try {
            fs.rmSync(testDir, { recursive: true, force: true });
        } catch (_) {}
    }
});

archive.directory(testAuthDir, false);
archive.finalize();


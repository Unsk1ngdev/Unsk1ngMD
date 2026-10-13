'use strict';

const assert = require('assert');
const archiver = require('archiver');
const fs = require('fs-extra');
const path = require('path');

console.log('🧪 [TEST] Iniciando prueba de empaquetado de backup ZIP en memoria...');

async function runZipTest() {
    const tempDir = path.join(__dirname, '__temp_test_zip');
    fs.ensureDirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, 'creds.json'), JSON.stringify({ me: { id: 'test' } }));

    const memoryChunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('data', chunk => memoryChunks.push(chunk));

    await new Promise((resolve, reject) => {
        archive.on('end', resolve);
        archive.on('error', reject);
        archive.directory(tempDir, false);
        archive.finalize();
    });

    const zipBuffer = Buffer.concat(memoryChunks);
    assert(zipBuffer.length > 0, 'El ZIP debe contener datos');
    // Magic header de un archivo ZIP: 0x50 0x4B 0x03 0x04 (PK..)
    assert.strictEqual(zipBuffer[0], 0x50);
    assert.strictEqual(zipBuffer[1], 0x4B);

    // Limpieza
    fs.removeSync(tempDir);
    console.log('  ✅ Prueba superada: ZIP generado correctamente en memoria con cabecera PK válida.');
    console.log('🎉 [TEST] ¡Prueba de backup ZIP completada con éxito!');
}

runZipTest().catch(err => {
    console.error('❌ Error en prueba:', err);
    process.exit(1);
});


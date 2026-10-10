const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

const TEMP_DIR = config.tempDir;
fs.ensureDirSync(TEMP_DIR);

/**
 * Genera una ruta única para archivos temporales
 */
const createTempPath = (extension = 'tmp') => {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    const filename = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    return path.join(TEMP_DIR, filename);
};

/**
 * Elimina un archivo temporal de forma segura
 */
const safeUnlink = async (filePath) => {
    if (!filePath) return;
    try {
        if (await fs.pathExists(filePath)) {
            await fs.unlink(filePath);
        }
    } catch (err) {
        // Ignorar errores de archivo bloqueado temporalmente
    }
};

/**
 * Limpia todos los archivos en /tmp más antiguos que maxAgeMs
 */
const cleanTempDirectory = async (maxAgeMs = config.tempFileMaxAgeMs) => {
    try {
        const files = await fs.readdir(TEMP_DIR);
        const now = Date.now();

        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            try {
                const stat = await fs.stat(filePath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    await fs.unlink(filePath);
                }
            } catch (e) {
                // archivo posiblemente en uso
            }
        }
    } catch (err) {
        console.error('[CLEANER] Error limpiando directorio temporal:', err.message);
    }
};

/**
 * Inicia el cronómetro de limpieza periódica de memoria y archivos temporales
 */
const startCleanerInterval = (intervalMs = 5 * 60 * 1000) => {
    cleanTempDirectory();
    return setInterval(() => {
        cleanTempDirectory();
        // Optimización de recolección de basura si node se ejecuta con --expose-gc
        if (global.gc) {
            try { global.gc(); } catch (e) {}
        }
    }, intervalMs);
};

module.exports = {
    TEMP_DIR,
    createTempPath,
    safeUnlink,
    cleanTempDirectory,
    startCleanerInterval
};


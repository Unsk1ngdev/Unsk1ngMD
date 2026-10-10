const fs = require('fs');
const path = require('path');

/**
 * Módulo de Inicialización y Resiliencia (Preflight Check)
 * Garantiza que el entorno cumpla con todos los requisitos antes de arrancar Baileys.
 */
function runPreflight() {
    const rootDir = process.cwd();

    // 1. Verificación estricta de la versión de Node.js (Mínimo v18)
    const nodeVersion = process.versions.node;
    const majorVersion = parseInt(nodeVersion.split('.')[0], 10);

    if (isNaN(majorVersion) || majorVersion < 18) {
        console.error('\x1b[41m\x1b[37m%s\x1b[0m', ' ❌ [ERROR CRÍTICO]: Versión de Node.js no compatible ');
        console.error('\x1b[31m%s\x1b[0m', `   Se requiere Node.js v18.0.0 o superior. Versión detectada: v${nodeVersion}`);
        console.error('\x1b[33m%s\x1b[0m', '   Por favor actualiza tu contenedor o entorno Node.js a v18, v20 o v22.\n');
        process.exit(1);
    }

    // 2. Comprobación y aprovisionamiento seguro de variables de entorno (.env)
    const envPath = path.join(rootDir, '.env');
    const envExamplePath = path.join(rootDir, '.env.example');

    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(envExamplePath)) {
            try {
                fs.copyFileSync(envExamplePath, envPath);
                console.warn('\x1b[33m%s\x1b[0m', '⚠️ [PREFLIGHT]: Archivo .env no encontrado. Se ha creado automáticamente a partir de .env.example.');
                console.warn('\x1b[33m%s\x1b[0m', '👉 Por favor edita el archivo .env para agregar tu GROQ_API_KEY y OWNER_NUMBER.\n');
            } catch (err) {
                console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PREFLIGHT]: No se pudo copiar .env.example: ${err.message}`);
            }
        } else {
            console.warn('\x1b[33m%s\x1b[0m', '⚠️ [PREFLIGHT]: No se encontró .env ni .env.example en la raíz del proyecto.\n');
        }
    }

    // Cargar variables de entorno
    try {
        require('dotenv').config();
    } catch (_) {}

    // 3. Creación sincrónica de directorios requeridos por el sistema
    const requiredDirs = [
        path.join(rootDir, 'tmp'),
        path.join(rootDir, 'bin'),
        path.join(rootDir, 'auth_info'),
        path.join(rootDir, 'subbots'),
        path.join(rootDir, 'database')
    ];

    for (const dir of requiredDirs) {
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (dirErr) {
                console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PREFLIGHT]: No se pudo crear el directorio ${dir}: ${dirErr.message}`);
            }
        }
    }

    // 4. Verificación no bloqueante de dependencias nativas/opcionales
    let sharpAvailable = false;
    try {
        require('sharp');
        sharpAvailable = true;
    } catch (sharpErr) {
        console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PREFLIGHT]: Módulo nativo 'sharp' no disponible en este entorno (${sharpErr.message}). El procesamiento de imágenes y stickers operará en modo reducido.`);
    }

    let ffmpegAvailable = false;
    try {
        const ffmpegStatic = require('ffmpeg-static');
        if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
            ffmpegAvailable = true;
        } else {
            console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PREFLIGHT]: Binario ffmpeg-static no hallado en la ruta provista.`);
        }
    } catch (ffmpegErr) {
        console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PREFLIGHT]: No se pudo inicializar ffmpeg-static (${ffmpegErr.message}). Las conversiones multimedia se verán afectadas.`);
    }

    // 5. Configurar manejadores globales de tolerancia a fallos
    if (!global.__preflightHandlersSet) {
        global.__preflightHandlersSet = true;

        process.on('uncaughtException', (err) => {
            const msg = err?.message || String(err);
            // Ignorar errores de red y cierre abrupto de sockets comunes en Baileys
            if (
                msg.includes('Connection Closed') ||
                msg.includes('Timed Out') ||
                msg.includes('ECONNRESET') ||
                msg.includes('ENOTFOUND') ||
                msg.includes('EPIPE') ||
                msg.includes('rate-overlimit') ||
                msg.includes('QR refs attempts ended')
            ) {
                console.warn('\x1b[33m%s\x1b[0m', `⚠️ [SOCKET/RED RESILIENTE]: Interrupción de red no crítica: ${msg}`);
                return;
            }
            console.error('\x1b[31m%s\x1b[0m', `💥 [UNCAUGHT EXCEPTION]: ${err?.stack || msg}`);
        });

        process.on('unhandledRejection', (reason) => {
            const msg = reason?.message || String(reason);
            if (
                msg.includes('Connection Closed') ||
                msg.includes('Timed Out') ||
                msg.includes('ECONNRESET') ||
                msg.includes('ENOTFOUND') ||
                msg.includes('rate-overlimit')
            ) {
                console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PROMISE/RED RESILIENTE]: Rechazo de red no crítico: ${msg}`);
                return;
            }
            console.error('\x1b[33m%s\x1b[0m', `⚠️ [UNHANDLED REJECTION]: ${reason?.stack || msg}`);
        });
    }

    return {
        nodeVersion,
        sharpAvailable,
        ffmpegAvailable,
        dirsCreated: requiredDirs.length
    };
}

module.exports = runPreflight;


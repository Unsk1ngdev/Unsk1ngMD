const fs = require('fs');
const path = require('path');

/**
 * Módulo de Inicialización y Resiliencia (Preflight Check)
 * Garantiza que el entorno cumpla con todos los requisitos antes de arrancar Baileys.
 */
function runPreflight() {
    const rootDir = process.cwd();
    // Detección proactiva de entorno Android Termux
    const isTermuxEnv = Boolean(process.env.PREFIX && process.env.PREFIX.includes('com.termux'));
    if (isTermuxEnv) {
        console.log('\x1b[36m%s\x1b[0m', '📱 [ENTORNO ANDROID TERMUX DETECTADO]:');
        console.log('\x1b[33m%s\x1b[0m', '   💡 Consejo 1: Ejecuta "termux-wake-lock" para evitar que Android suspenda el bot.');
        console.log('\x1b[33m%s\x1b[0m', '   💡 Consejo 2: Si vinculas con código, se recomienda la opción [2] (Pairing Code).\n');
    }


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
    const baseDir = fs.existsSync(path.join(__dirname, '..', '.env')) 
        ? path.join(__dirname, '..') 
        : rootDir;
    const envPath = path.join(baseDir, '.env');
    const envExamplePath = path.join(baseDir, '.env.example');

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

    // Cargar variables de entorno de forma explícita
    try {
        require('dotenv').config({ path: envPath });
    } catch (_) {
        try { require('dotenv').config(); } catch (__) {}
    }

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
        const { getFfmpegPath } = require('./ffmpeg');
        const resolvedPath = getFfmpegPath();
        if (resolvedPath) {
            ffmpegAvailable = true;
        } else {
            console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PREFLIGHT]: Binario FFmpeg no hallado (ni en el sistema ni en ffmpeg-static). Las conversiones multimedia se verán afectadas.`);
        }
    } catch (ffmpegErr) {
        console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PREFLIGHT]: No se pudo resolver FFmpeg (${ffmpegErr.message}). Las conversiones multimedia se verán afectadas.`);
    }

    // 5. Configurar manejadores globales de tolerancia a fallos con filtrado insensible a mayúsculas y estrangulamiento
    if (!global.__preflightHandlersSet) {
        global.__preflightHandlersSet = true;

        const isTransient = (err) => {
            const msg = String(err?.message || err?.stack || err || '').toLowerCase();
            return /connection closed|timed out|timeout|econnreset|enotfound|epipe|rate-overlimit|qr refs attempts ended|bad mac|session error|sessionerror|stream errored|conflict|websocket error|query timed out|socket hang up|broken pipe/i.test(msg);
        };

        let lastWarn = 0;
        let throttled = 0;

        process.on('uncaughtException', (err) => {
            const msg = err?.message || String(err);
            if (isTransient(err)) {
                const now = Date.now();
                if (now - lastWarn > 8000) {
                    if (throttled > 0) {
                        console.warn('\x1b[33m%s\x1b[0m', `⚠️ [RED RESILIENTE]: ${throttled} advertencias de red adicionales silenciadas para proteger la fluidez del bot.`);
                        throttled = 0;
                    }
                    console.warn('\x1b[33m%s\x1b[0m', `⚠️ [SOCKET/RED RESILIENTE]: ${msg}`);
                    lastWarn = now;
                } else {
                    throttled++;
                }
                return;
            }
            console.error('\x1b[31m%s\x1b[0m', `💥 [UNCAUGHT EXCEPTION]: ${err?.stack || msg}`);
        });

        process.on('unhandledRejection', (reason) => {
            const msg = reason?.message || String(reason);
            if (isTransient(reason)) {
                const now = Date.now();
                if (now - lastWarn > 8000) {
                    if (throttled > 0) {
                        console.warn('\x1b[33m%s\x1b[0m', `⚠️ [RED RESILIENTE]: ${throttled} rechazos de red adicionales silenciados para proteger la fluidez del bot.`);
                        throttled = 0;
                    }
                    console.warn('\x1b[33m%s\x1b[0m', `⚠️ [PROMISE/RED RESILIENTE]: ${msg}`);
                    lastWarn = now;
                } else {
                    throttled++;
                }
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


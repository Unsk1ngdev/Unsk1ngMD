const path = require('path');
const fs = require('fs-extra');
const { spawn, execSync } = require('child_process');
const logger = require('./logger');

let cachedFfmpegPath = null;
let pathChecked = false;

/**
 * Detecta y devuelve la ruta binaria válida de FFmpeg
 * 1. Intenta usar el binario autocontenido de ffmpeg-static
 * 2. Fallback al comando 'ffmpeg' del sistema operativo
 */
const getFfmpegPath = () => {
    if (pathChecked && cachedFfmpegPath) {
        return cachedFfmpegPath;
    }

    // 1. Prioridad: ffmpeg-static
    try {
        const staticPath = require('ffmpeg-static');
        if (staticPath && fs.existsSync(staticPath)) {
            cachedFfmpegPath = staticPath;
            pathChecked = true;
            return cachedFfmpegPath;
        }
    } catch (_) {}

    // 2. Fallback: FFmpeg instalado en el sistema operativo
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        cachedFfmpegPath = 'ffmpeg';
        pathChecked = true;
        return cachedFfmpegPath;
    } catch (_) {}

    pathChecked = true;
    cachedFfmpegPath = null;
    return null;
};

/**
 * Comprueba si FFmpeg está disponible en el entorno
 */
const isFfmpegAvailable = () => {
    return Boolean(getFfmpegPath());
};

/**
 * Ejecuta comandos de FFmpeg mediante child_process.spawn con control de timeouts
 * y captura de logs de error en stderr para evitar procesos zombie
 * 
 * @param {string[]} args - Argumentos de línea de comandos para FFmpeg
 * @param {object} options - Opciones de ejecución (timeout, cwd, etc.)
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
const runFfmpeg = (args, options = {}) => {
    return new Promise((resolve, reject) => {
        const ffmpegBin = getFfmpegPath();
        if (!ffmpegBin) {
            return reject(new Error('FFmpeg no está disponible en este sistema (falta ffmpeg-static o binario global).'));
        }

        const timeoutMs = options.timeout || 180000; // 3 minutos por defecto
        let stdoutData = '';
        let stderrData = '';
        let timedOut = false;

        const proc = spawn(ffmpegBin, args, {
            cwd: options.cwd || process.cwd(),
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const timer = setTimeout(() => {
            timedOut = true;
            logger.warn(`[FFMPEG] Proceso excedió el tiempo límite de ${timeoutMs / 1000}s. Terminando...`);
            try {
                proc.kill('SIGKILL');
            } catch (_) {
                try { proc.kill(); } catch (__) {}
            }
        }, timeoutMs);

        proc.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString();
        });

        proc.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`Error al iniciar FFmpeg: ${err.message}`));
        });

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (timedOut) {
                return reject(new Error(`La conversión multimedia con FFmpeg excedió el tiempo límite (${timeoutMs / 1000}s).`));
            }
            if (code !== 0) {
                const recentErr = stderrData.trim().split('\n').slice(-10).join('\n') || `Código de salida: ${code}`;
                return reject(new Error(`FFmpeg falló (código ${code}):\n${recentErr}`));
            }
            resolve({
                stdout: stdoutData,
                stderr: stderrData,
                code
            });
        });
    });
};

/**
 * Convierte cualquier flujo de audio a MP3 estándar compatible (128kbps, 44.1kHz, estéreo)
 */
const convertToMp3 = async (inputPath, outputPath, options = {}) => {
    const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        outputPath
    ];
    return await runFfmpeg(args, options);
};

/**
 * Transcodifica video a MP4 compatible con WhatsApp (H.264 + AAC + faststart)
 */
const convertToMp4 = async (inputPath, outputPath, options = {}) => {
    const args = [
        '-y',
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '26',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputPath
    ];
    return await runFfmpeg(args, options);
};

/**
 * Transcodifica audio a Opus/OGG para notas de voz de WhatsApp (PTT)
 */
const convertToOpus = async (inputPath, outputPath, options = {}) => {
    const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'libopus',
        '-b:a', '64k',
        '-vbr', 'on',
        '-ar', '48000',
        '-ac', '1',
        outputPath
    ];
    return await runFfmpeg(args, options);
};

module.exports = {
    getFfmpegPath,
    isFfmpegAvailable,
    runFfmpeg,
    convertToMp3,
    convertToMp4,
    convertToOpus
};


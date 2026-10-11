const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const { spawn } = require('child_process');
const logger = require('./logger');
const { getFfmpegPath, isFfmpegAvailable } = require('./ffmpeg');

const binDir = path.join(process.cwd(), 'bin');
const isWindows = process.platform === 'win32';
const binFileName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const binPath = path.join(binDir, binFileName);
const updateFlagFile = path.join(binDir, '.last_update');

let isAvailable = false;
let isDownloading = false;
let downloadPromise = null;

/**
 * Determina el nombre del asset de yt-dlp según el sistema operativo y arquitectura
 */
const getAssetName = () => {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'win32') {
        return 'yt-dlp.exe';
    }
    if (platform === 'darwin') {
        return 'yt-dlp_macos';
    }
    if (platform === 'linux') {
        const isMusl = () => {
            try {
                if (fs.existsSync('/etc/alpine-release')) return true;
                const report = process.report?.getReport();
                if (report?.header?.glibcVersionRuntime === undefined && report?.header?.dumpEventReason) return true;
                if (fs.existsSync('/lib/ld-musl-x86_64.so.1') || fs.existsSync('/lib/ld-musl-aarch64.so.1')) return true;
            } catch (_) {}
            return false;
        };

        if (isMusl() && (arch === 'x64' || arch === 'amd64')) {
            return 'yt-dlp_musllinux';
        }
        if (arch === 'arm64' || arch === 'aarch64') {
            return 'yt-dlp_linux_aarch64';
        }
        if (arch === 'arm') {
            return 'yt-dlp_linux_armv7l';
        }
        return 'yt-dlp_linux';
    }
    return 'yt-dlp';
};

/**
 * Obtiene la versión actual de yt-dlp si el binario es ejecutable
 */
const getYtdlpVersion = () => {
    return new Promise((resolve) => {
        if (!fs.existsSync(binPath)) return resolve(null);
        try {
            const proc = spawn(binPath, ['--version'], {
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let out = '';
            proc.stdout.on('data', (d) => { out += d.toString(); });

            const timer = setTimeout(() => {
                try { proc.kill(); } catch (_) {}
                resolve(null);
            }, 8000);

            proc.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0 && out.trim()) {
                    resolve(out.trim());
                } else {
                    resolve(null);
                }
            });

            proc.on('error', () => {
                clearTimeout(timer);
                resolve(null);
            });
        } catch (_) {
            resolve(null);
        }
    });
};

/**
 * Descarga el binario oficial de yt-dlp directamente desde GitHub Releases
 */
const downloadYtdlp = async () => {
    if (isDownloading && downloadPromise) {
        return downloadPromise;
    }

    isDownloading = true;
    downloadPromise = (async () => {
        try {
            fs.ensureDirSync(binDir);

            const asset = getAssetName();
            const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
            const tempDownloadPath = path.join(binDir, `${binFileName}.download.${Date.now()}.tmp`);

            logger.info(`[YT-DLP] Descargando binario autónomo para ${process.platform}-${process.arch}...`);
            logger.info(`[YT-DLP] Origen: ${downloadUrl}`);

            const response = await axios({
                method: 'GET',
                url: downloadUrl,
                responseType: 'stream',
                maxRedirects: 10,
                headers: {
                    'User-Agent': 'Unsk1ngMD-Bot/1.0 (Node.js; WhatsApp Baileys)'
                },
                timeout: 120000 // 2 minutos para descarga
            });

            const writer = fs.createWriteStream(tempDownloadPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.on('error', reject);
            });

            // Otorgar permisos de ejecución en Linux y macOS
            if (!isWindows) {
                try {
                    fs.chmodSync(tempDownloadPath, 0o755);
                } catch (chmodErr) {
                    logger.warn('[YT-DLP] Advertencia asignando permisos chmod 755:', chmodErr.message);
                }
            }

            // Reemplazo atómico del binario
            if (fs.existsSync(binPath)) {
                try {
                    fs.unlinkSync(binPath);
                } catch (_) {}
            }
            fs.renameSync(tempDownloadPath, binPath);

            // Re-otorgar permisos tras renombramiento
            if (!isWindows) {
                try {
                    fs.chmodSync(binPath, 0o755);
                } catch (_) {}
            }

            // Verificar operatividad ejecutando --version
            const ver = await getYtdlpVersion();
            if (ver) {
                logger.success(`[YT-DLP] Binario verificado exitosamente (v${ver}). Listo para descargas.`);
                isAvailable = true;
                return true;
            } else {
                throw new Error('El binario descargado no responde al comando --version');
            }
        } catch (err) {
            logger.warn(`⚠️ [AVISO YT-DLP]: No se pudo descargar o validar yt-dlp (${err.message}). Los comandos de YouTube estarán temporalmente deshabilitados.`);
            isAvailable = false;
            return false;
        } finally {
            isDownloading = false;
            downloadPromise = null;
        }
    })();

    return downloadPromise;
};

/**
 * Comprueba e inicia la actualización de yt-dlp en segundo plano como máximo una vez al día
 */
const checkDailyUpdateInBackground = async () => {
    if (!isAvailable || !fs.existsSync(binPath)) return;

    try {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        if (fs.existsSync(updateFlagFile)) {
            const lastUpdate = Number(fs.readFileSync(updateFlagFile, 'utf8')) || 0;
            if (Date.now() - lastUpdate < ONE_DAY_MS) {
                return; // Ya se comprobó hoy
            }
        }

        // Marcar actualización comprobada hoy
        fs.writeFileSync(updateFlagFile, String(Date.now()));

        logger.info('[YT-DLP] Comprobando actualizaciones de yt-dlp en segundo plano...');
        const proc = spawn(binPath, ['-U'], {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        proc.on('close', (code) => {
            if (code === 0) {
                logger.info('[YT-DLP] Comprobación de actualización completada.');
            }
        });

        proc.on('error', () => {});
    } catch (_) {}
};

/**
 * Asegura la presencia y disponibilidad del binario yt-dlp
 */
const ensureYtdlp = async () => {
    if (isAvailable && fs.existsSync(binPath)) {
        return true;
    }

    if (fs.existsSync(binPath)) {
        const ver = await getYtdlpVersion();
        if (ver) {
            isAvailable = true;
            // Disparar comprobación diaria en segundo plano sin bloquear
            checkDailyUpdateInBackground().catch(() => {});
            return true;
        }
    }

    // Si no existe o no es ejecutable, descargarlo bajo demanda
    const downloaded = await downloadYtdlp();
    return downloaded;
};

const YTDLP_EVASION_ARGS = [
    '--extractor-args', 'youtube:player_client=android,ios',
    '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    '--no-check-certificates',
    '--prefer-free-formats'
];

/**
 * Ejecuta yt-dlp mediante child_process.spawn con soporte para timeouts e inyección automática de FFmpeg
 */
const execYtdlp = async (args, options = {}) => {
    const ready = await ensureYtdlp();
    if (!ready || !fs.existsSync(binPath)) {
        throw new Error('El servicio de descarga de YouTube (yt-dlp) no está disponible en este momento. Inténtalo más tarde.');
    }

    const finalArgs = [...args];

    // 1. Inyectar parámetros anti-bloqueo 403 (clientes móviles android,ios para Data Centers)
    if (!finalArgs.includes('--extractor-args')) {
        finalArgs.push('--extractor-args', 'youtube:player_client=android,ios');
    }
    if (!finalArgs.includes('--user-agent')) {
        finalArgs.push('--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    }
    if (!finalArgs.includes('--no-check-certificates')) {
        finalArgs.push('--no-check-certificates');
    }
    if (!finalArgs.includes('--prefer-free-formats')) {
        finalArgs.push('--prefer-free-formats');
    }

    // 2. Inyectar ubicación de FFmpeg únicamente si es una ruta absoluta a un binario válido (como ffmpeg-static)
    // Si es 'ffmpeg' nativo del sistema, yt-dlp lo detecta automáticamente del PATH sin arrojar WARNING
    const ffmpegPath = getFfmpegPath();
    if (ffmpegPath && ffmpegPath !== 'ffmpeg' && fs.existsSync(ffmpegPath) && !finalArgs.includes('--ffmpeg-location')) {
        finalArgs.push('--ffmpeg-location', ffmpegPath);
    }

    const timeoutMs = options.timeout || 300000; // 5 minutos por defecto
    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;

    return new Promise((resolve, reject) => {
        const proc = spawn(binPath, finalArgs, {
            cwd: options.cwd || process.cwd(),
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const timer = setTimeout(() => {
            timedOut = true;
            logger.warn(`[YT-DLP] Comando excedió tiempo límite de ${timeoutMs / 1000}s. Terminando...`);
            try { proc.kill('SIGKILL'); } catch (_) {
                try { proc.kill(); } catch (__) {}
            }
        }, timeoutMs);

        proc.stdout.on('data', (d) => { stdoutData += d.toString(); });
        proc.stderr.on('data', (d) => { stderrData += d.toString(); });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`Error ejecutando yt-dlp: ${err.message}`));
        });

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (timedOut) {
                return reject(new Error(`El procesamiento con yt-dlp excedió el tiempo límite (${timeoutMs / 1000}s).`));
            }
            if (code !== 0) {
                const recentErr = stderrData.trim().split('\n').slice(-6).join(' ') || `Código de salida ${code}`;
                return reject(new Error(`yt-dlp finalizó con error (${recentErr})`));
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
 * Extrae metadatos en formato JSON de una URL sin descargar el contenido
 */
const getYtMetadata = async (url) => {
    const res = await execYtdlp([
        '--dump-json',
        '--no-warnings',
        '--no-playlist',
        url
    ], { timeout: 45000 });

    try {
        return JSON.parse(res.stdout);
    } catch (err) {
        throw new Error('No se pudo analizar la información del video de YouTube.');
    }
};

/**
 * Extrae el ID de 11 caracteres de un enlace de YouTube (estándar, shorts, music, embed)
 */
const extractYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
    return match ? match[1] : null;
};

/**
 * Formatea duración en segundos a mm:ss o hh:mm:ss
 */
const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return 'Desconocida';
    const s = Math.round(Number(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Limpia el título para usarlo como nombre de archivo seguro
 */
const sanitizeTitle = (title) => {
    if (!title) return 'archivo';
    return title.replace(/[\\/:*?"<>|#%&{}\\<>*?/$!'":@+`|=]/g, '').trim().slice(0, 60) || 'archivo';
};

module.exports = {
    binPath,
    ensureYtdlp,
    execYtdlp,
    getYtMetadata,
    extractYouTubeId,
    formatDuration,
    sanitizeTitle,
    YTDLP_EVASION_ARGS,
    isYtdlpAvailable: () => isAvailable
};


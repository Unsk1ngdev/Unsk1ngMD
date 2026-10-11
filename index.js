require('./lib/preflight')();
const stalkearManager = require('./lib/stalkear');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');
const cfonts = require('cfonts');
const chalk = require('chalk');

const config = require('./config');
const logger = require('./lib/logger');
const { startCleanerInterval } = require('./lib/cleaner');
const { loadCommands } = require('./handlers/commandLoader');
const { handleMessage } = require('./handlers/messageHandler');
const { handleGroupUpdate } = require('./handlers/groupHandler');
const antispamMiddleware = require('./middlewares/antispam');
const { ensureYtdlp } = require('./lib/ytdlp');

/**
 * Renderiza el banner cyberpunk con cfonts y la caja de información neón
 */
const renderBanner = (socketStatus = 'Iniciando conexión...') => {
    console.clear();

    // Tipografía de bloque retro y colores degradados cyberpunk (cyan y magenta)
    cfonts.say('Unsk1ngMD', {
        font: 'block',
        align: 'center',
        colors: ['cyan', 'magenta'],
        background: 'transparent',
        letterSpacing: 1,
        lineHeight: 1,
        space: false,
        maxLength: '0',
        gradient: ['cyan', 'magenta'],
        independentGradient: false,
        transitionGradient: false,
        env: 'node'
    });

    // Caja de información formateada con colores neón
    const boxWidth = 56;
    const border = (charLeft, charRight) => 
        chalk.hex('#00f7ff')(`${charLeft}${'─'.repeat(boxWidth)}${charRight}`);

    const infoLine = (label, value, valColor) => {
        const cleanLabel = ` ${label}: `;
        const cleanValue = `${value}`;
        const totalPad = boxWidth - cleanLabel.length - cleanValue.length;
        const padding = ' '.repeat(Math.max(0, totalPad));

        return chalk.hex('#00f7ff')('│') +
            chalk.hex('#ff007f').bold(cleanLabel) +
            valColor(cleanValue) +
            padding +
            chalk.hex('#00f7ff')('│');
    };

    console.log(border('┌', '┐'));
    console.log(infoLine('Creador', 'Castrodev', chalk.hex('#00ff66').bold));
    console.log(infoLine('Contacto', '+584160666286', chalk.hex('#38bdf8').bold));
    console.log(infoLine('Versión', 'Dev', chalk.hex('#facc15').bold));
    console.log(infoLine('Estado del socket', socketStatus, chalk.hex('#e879f9').bold));
    console.log(border('└', '┘') + '\n');
};

// Función auxiliar para entradas interactivas por consola
const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans.trim());
        });
    });
};

/**
 * Función principal de arranque del socket de WhatsApp
 */
const startBot = async () => {
    // 0. Crear directorios base esenciales si no existen
    const tmpDir = path.join(process.cwd(), 'tmp');
    const binDir = path.join(process.cwd(), 'bin');
    fs.ensureDirSync(tmpDir);
    fs.ensureDirSync(binDir);
    fs.ensureDirSync(config.sessionDir);

    renderBanner('Iniciando conexión...');

    // 1. Cargar catálogo modular de comandos
    loadCommands();

    // 2. Inicializar almacenamiento global en memoria para sesiones y moderación
    global.akinatorSessions = global.akinatorSessions || new Map();
    global.spamTracker = global.spamTracker || new Map();

    // 3. Comprobación segura de variables de entorno (.env)
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        console.warn(chalk.yellow.bold('\n⚠️ [CONFIGURACIÓN] Archivo .env no encontrado en la raíz.'));
        console.warn(chalk.yellow('Variables recomendadas:'));
        console.warn(chalk.white('  • GROQ_API_KEY (Para IA y enciclopedia .wiki)'));
        console.warn(chalk.white('  • OWNER_NUMBER (Tu número internacional, ej: 584160666286)'));
        console.warn(chalk.white('  • PREFIX       (Prefijo de comandos, por defecto: .)'));
        console.warn(chalk.cyan('El bot continuará iniciando con valores predeterminados.\n'));
    }

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === '') {
        console.warn('⚠️ [AVISO]: GROQ_API_KEY no detectada en .env. Comandos de IA deshabilitados.');
    } else {
        console.log('✅ [GROQ]: API Key detectada correctamente.');
    }

    // 4. Iniciar verificación y preparación de yt-dlp en segundo plano (sin retrasar el arranque)
    ensureYtdlp().catch((err) => {
        logger.warn('[YT-DLP] Inicialización en segundo plano pospuesta:', err.message);
    });

    // 5. Iniciar limpieza periódica de /tmp y optimización de memoria
    startCleanerInterval(config.tempFileMaxAgeMs);

    // 3. Preparar estado de autenticación multi-archivo
    fs.ensureDirSync(config.sessionDir);
    const credsFile = path.join(config.sessionDir, 'creds.json');
    const isSessionActive = fs.existsSync(credsFile);

    let authMethod = '1'; // 1 = QR, 2 = Pairing Code
    let pairingNumber = '';

    // Autenticación dual interactiva si no hay credenciales existentes
    if (!isSessionActive) {
        console.log(chalk.cyan.bold('\n📱 [AUTENTICACIÓN REQUERIDA] No se encontró una sesión activa previa.'));
        console.log(chalk.yellow('Selecciona el método de vinculación:'));
        console.log(chalk.white(' [1] Código QR en terminal'));
        console.log(chalk.white(' [2] Código de emparejamiento de 8 dígitos (Pairing Code)\n'));

        authMethod = await askQuestion(chalk.green.bold('Elige una opción (1 o 2): '));

        if (authMethod === '2') {
            pairingNumber = await askQuestion(chalk.green.bold('Ingresa tu número de teléfono con código de país (ej: 18494509905): '));
            pairingNumber = pairingNumber.replace(/[^0-9]/g, '');

            if (!pairingNumber || pairingNumber.length < 8) {
                logger.error('Número de teléfono inválido. Reinicia el bot e intenta de nuevo.');
                process.exit(1);
            }
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Usando versión de WhatsApp Web v${version.join('.')} (Última: ${isLatest})`);

    // 4. Inicialización optimizada de Baileys Socket (< 250MB RAM)
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Silenciar logs internos de Baileys para no llenar RAM
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: authMethod === '2' ? ['Ubuntu', 'Chrome', '20.0.04'] : [config.botName, 'Chrome', '1.0.0'],
        syncFullHistory: false, // Fundamental: evita cargar historiales antiguos a la RAM
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        getMessage: async () => ({ conversation: '' })
    });

    // 5. Manejo del código de emparejamiento interactivo
    if (!isSessionActive && authMethod === '2' && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                logger.info(`Solicitando código de emparejamiento para el número: +${pairingNumber}...`);
                const code = await sock.requestPairingCode(pairingNumber);
                const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                console.log('\n' + chalk.bgGreen.black.bold(' ═══════════════════════════════════════════ '));
                console.log(chalk.bgGreen.black.bold(`      CÓDIGO DE EMPAREJAMIENTO: ${formattedCode}      `));
                console.log(chalk.bgGreen.black.bold(' ═══════════════════════════════════════════ \n'));
                console.log(chalk.cyan('👉 Abre WhatsApp > Dispositivos vinculados > Vincular con el número de teléfono e ingresa este código.\n'));
            } catch (err) {
                logger.error('Error al generar código de emparejamiento:', err.message);
            }
        }, 3000);
    }

    // 6. Eventos de Conexión y Reconexión Automática
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && authMethod === '1' && !isSessionActive) {
            console.log(chalk.cyan('\n📷 Escanea este código QR con WhatsApp:'));
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            renderBanner(shouldReconnect ? 'Desconectado - Reconectando...' : 'Sesión cerrada');
            logger.warn(`Conexión cerrada. Razón: ${statusCode || 'Desconocida'}. Reconectando: ${shouldReconnect}`);

            if (statusCode === DisconnectReason.loggedOut) {
                logger.error('Sesión cerrada desde el teléfono. Eliminando credenciales...');
                try {
                    await fs.remove(config.sessionDir);
                } catch (e) {}
                logger.info('Credenciales eliminadas. Inicia el bot para volver a vincular.');
                process.exit(1);
            } else {
                // Reconexión automática con breve espera de red
                setTimeout(() => {
                    startBot();
                }, 4000);
            }
        } else if (connection === 'open') {
            renderBanner('Conectado y Operativo ⚡');
            logger.success(`¡Bot conectado exitosamente como ${sock.user.name || sock.user.id}!`);
            logger.info(`Listo para recibir comandos. Prefijo actual: "${config.defaultPrefix}"`);
        }
    });

    // Guardar credenciales actualizadas
    sock.ev.on('creds.update', saveCreds);

    // 7. Evento de Mensajes entrantes
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (chatUpdate.type !== 'notify') return;
            for (const rawMsg of chatUpdate.messages) {
                // Middleware Anti-Spam: Regla estricta de 3 mensajes en 10s con advertencia y expulsión
                const isSpam = await antispamMiddleware(sock, rawMsg);
                if (isSpam) continue;

                await handleMessage(sock, rawMsg);
            }
        } catch (err) {
            logger.error('Error procesando messages.upsert:', err);
        }
    });

    // 8. Evento de Participantes de Grupos
    sock.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupUpdate(sock, update);
        } catch (err) {
            logger.error('Error procesando group-participants.update:', err);
        }
    });

    // 9. Evento de Presencia (para .stalkear)
    sock.ev.on('presence.update', async (update) => {
        try {
            await stalkearManager.handlePresence(sock, update);
        } catch (err) {
            logger.error('Error procesando presence.update:', err);
        }
    });

    return sock;
};

// Manejo robusto de excepciones no capturadas para mantener el servidor siempre activo
process.on('uncaughtException', (err) => {
    logger.error('💥 [UNCAUGHT EXCEPTION]:', err?.stack || err?.message || err);
});

process.on('unhandledRejection', (reason) => {
    logger.error('⚠️ [UNHANDLED REJECTION]:', reason?.stack || reason?.message || reason);
});

process.on('SIGINT', () => {
    logger.warn('Recibida señal SIGINT. Cerrando bot de forma segura...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.warn('Recibida señal SIGTERM. Cerrando bot...');
    process.exit(0);
});

// Arrancar el bot
startBot();


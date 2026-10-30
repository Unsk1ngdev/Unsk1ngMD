require('./lib/preflight')();
const stalkearManager = require('./lib/stalkear');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');
const cfonts = require('cfonts');
const chalk = require('chalk');

const config = require('./config');
const database = require('./lib/database');
const logger = require('./lib/logger');
const { startCleanerInterval } = require('./lib/cleaner');
const { loadCommands } = require('./handlers/commandLoader');
const { handleMessage } = require('./handlers/messageHandler');
const { handleGroupUpdate } = require('./handlers/groupHandler');
const antispamMiddleware = require('./middlewares/antispam');
const { ensureYtdlp } = require('./lib/ytdlp');
const connectionManager = require('./lib/connectionManager');
const recentMessagesManager = require('./lib/recentMessages');
const userNames = require('./lib/userNames');

/**
 * Renderiza el banner cyberpunk con cfonts y la caja de información neón
 */
let isFirstRender = true;
const renderBanner = (socketStatus = 'Iniciando conexión...') => {
    if (isFirstRender) {
        console.clear();
        isFirstRender = false;
    }

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
    console.log(infoLine('Creador', 'Unknonw Codexツ</>', chalk.hex('#00ff66').bold));
    console.log(infoLine('Contacto', '+584160666286', chalk.hex('#38bdf8').bold));
    console.log(infoLine('Versión', '1.0.0', chalk.hex('#facc15').bold));
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
            resolve(ans ? ans.trim() : '');
        });
    });
};

/**
 * Función principal de arranque del socket de WhatsApp
 */
const startBot = async () => {
    // Control de concurrencia: evitar que dos instancias de startBot() se ejecuten simultáneamente
    if (connectionManager.isStarting) {
        logger.warn('[SISTEMA] Intento de inicio concurrente de startBot() bloqueado.');
        return;
    }
    connectionManager.isStarting = true;

    // Limpiar socket anterior y sus listeners para evitar duplicaciones
    connectionManager.cleanupSocket();

    let sock = null;
    try {
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

    // 3. Comprobación limpia de variables de entorno (.env)
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        logger.info('Iniciando con configuración predeterminada.');
    }

    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
        logger.info('Motor de IA: Groq Cloud activo.');
    } else {
        logger.info('Motor de IA: Fallback gratuito (Pollinations AI) activo.');
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
    let isSessionRegistered = false;
    if (fs.existsSync(credsFile)) {
        try {
            const rawCreds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
            // Una sesión está registrada si completó el emparejamiento por código (registered: true)
            // o por código QR (contiene me y account generados tras pair-success)
            isSessionRegistered = Boolean(rawCreds.registered || (rawCreds.me && rawCreds.account));
        } catch (_) {
            isSessionRegistered = false;
        }
    }

    // Si existen archivos de sesión pero NO está registrada (intento previo fallido, interrumpido o cancelado),
    // limpiar la carpeta para evitar que WhatsApp rechace nuevos intentos por claves previas corruptas o desfasadas.
    if (!isSessionRegistered && fs.existsSync(config.sessionDir)) {
        try {
            fs.emptyDirSync(config.sessionDir);
        } catch (_) {}
    }

    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
    const isSessionActive = Boolean(
        isSessionRegistered ||
        state?.creds?.registered ||
        (state?.creds?.me && state?.creds?.account)
    );

    const argv = process.argv.slice(2);
    let authMethod = global.authMethod || process.env.AUTH_METHOD || '';
    let pairingNumber = global.pairingNumber || process.env.PAIRING_NUMBER || '';

    // Soporte para banderas por línea de comandos (ej: node index.js --qr o node index.js --code 18494509905)
    if (argv.includes('--qr')) {
        authMethod = '1';
    } else if (argv.includes('--code') || argv.includes('--pairing')) {
        authMethod = '2';
        const codeIdx = argv.findIndex(a => a === '--code' || a === '--pairing');
        if (codeIdx !== -1 && argv[codeIdx + 1] && !argv[codeIdx + 1].startsWith('--')) {
            pairingNumber = argv[codeIdx + 1];
        }
    }

    // Autenticación dual interactiva normal si no hay credenciales existentes
    if (!isSessionActive) {
        if (!authMethod) {
            console.log(chalk.cyan.bold('\n📱 [AUTENTICACIÓN REQUERIDA] No se encontró una sesión activa previa.'));
            console.log(chalk.yellow('Selecciona el método de vinculación:'));
            console.log(chalk.white(' [1] Código QR en terminal'));
            console.log(chalk.white(' [2] Código de emparejamiento de 8 dígitos (Pairing Code)\n'));

            authMethod = (await askQuestion(chalk.green.bold('Elige una opción (1 o 2): '))).trim();
            while (authMethod !== '1' && authMethod !== '2') {
                console.log(chalk.red('Opción no válida. Por favor escribe 1 o 2:'));
                authMethod = (await askQuestion(chalk.green.bold('Elige una opción (1 o 2): '))).trim();
            }
        }
        global.authMethod = authMethod;

        if (authMethod === '2') {
            if (!pairingNumber) {
                pairingNumber = (await askQuestion(chalk.green.bold('Ingresa tu número de teléfono con código de país (ej: 18494509905): '))).trim();
            }
            pairingNumber = String(pairingNumber || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
            while (!pairingNumber || pairingNumber.length < 8 || pairingNumber.length > 16) {
                console.log(chalk.red('Número inválido. Debe contener entre 8 y 16 dígitos numéricos sin símbolos (+):'));
                pairingNumber = (await askQuestion(chalk.green.bold('Ingresa tu número de teléfono: '))).trim();
                pairingNumber = String(pairingNumber || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
            }
            global.pairingNumber = pairingNumber;
            console.log(chalk.cyan(`\n⏳ Solicitando código de emparejamiento para +${pairingNumber}...`));
        } else {
            console.log(chalk.cyan('\n⏳ Conectando con los servidores de WhatsApp para generar código QR...'));
        }
    } else {
        logger.info('Sesión enlazada o en proceso de vinculación detectada. Conectando...');
    }

    let version = global.cachedBaileysVersion || [2, 3000, 1043857760];
    if (!global.cachedBaileysVersion) {
        try {
            const vResult = await Promise.race([
                fetchLatestBaileysVersion(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
            if (vResult?.version) {
                version = vResult.version;
                global.cachedBaileysVersion = version;
            }
        } catch (_) {}
    }

    // 4. Inicialización optimizada de Baileys Socket (< 250MB RAM)
    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Silenciar logs internos de Baileys para no llenar RAM
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false, // Fundamental: evita cargar historiales antiguos a la RAM
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        defaultQueryTimeoutMs: 30000,
        // Recuperación de mensajes reales o undefined para evitar tormentas de reintentos
        getMessage: async (key) => recentMessagesManager.getMessage(key)
    });

    // Exponer el socket principal de forma global para sub-bots y comandos
    global.mainSock = sock;

    // 5. Manejo del código de emparejamiento interactivo (Sincronizado con el estado real del WebSocket)
    if (!isSessionActive && authMethod === '2' && !sock.authState.creds.registered && !global.pairingCodeDone) {
        (async () => {
            try {
                // Esperar a que el WebSocket complete la apertura física
                let waited = 0;
                while ((!sock.ws || !sock.ws.isOpen) && waited < 12000) {
                    await new Promise(res => setTimeout(res, 250));
                    waited += 250;
                }

                // Pausa de 2.5s para permitir que el handshake Noise y el intercambio inicial concluyan
                await new Promise(res => setTimeout(res, 2500));

                if (sock.authState?.creds?.registered || global.pairingCodeDone) return;

                logger.info(`[VINCULACIÓN] Solicitando código de emparejamiento para: +${pairingNumber}...`);
                const code = await sock.requestPairingCode(pairingNumber);
                if (code) {
                    global.pairingCodeDone = true;
                    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                    console.log('\n' + chalk.cyan.bold('╭───────────────────────────────────────────────╮'));
                    console.log(chalk.cyan.bold('│ ') + chalk.white.bold('        🔑 CÓDIGO DE VINCULACIÓN:             ') + chalk.cyan.bold('│'));
                    console.log(chalk.cyan.bold('│                                               │'));
                    console.log(chalk.cyan.bold('│ ') + chalk.yellow.bold(`              👉  ${formattedCode}  👈              `) + chalk.cyan.bold('│'));
                    console.log(chalk.cyan.bold('│                                               │'));
                    console.log(chalk.cyan.bold('╰───────────────────────────────────────────────╯\n'));
                    console.log(chalk.white(' Código listo para copiar: ') + chalk.bgBlack.white.bold(` ${formattedCode} `) + '\n');
                    console.log(chalk.cyan('👉 Abre WhatsApp > Dispositivos vinculados > Vincular con el número de teléfono e ingresa este código.\n'));
                }
            } catch (err) {
                logger.error('Error al generar código de emparejamiento:', err.message);
                console.log(chalk.yellow('💡 Comprueba que tu número esté bien escrito y que tengas conexión de red estable.'));
            }
        })();
    }

    // 6. Eventos de Conexión y Reconexión Automática Controlada
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && authMethod === '1' && !isSessionActive) {
            console.log(chalk.cyan('\n📷 Escanea este código QR con WhatsApp:'));
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            if (global.mainSock === sock) global.mainSock = null;

            // Si el socket se cerró antes de completar el emparejamiento en el teléfono,
            // restablecer la bandera global para permitir generar un nuevo código limpio al reconectar.
            if (!sock.authState?.creds?.registered) {
                global.pairingCodeDone = false;
            }

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const evalResult = connectionManager.evaluateDisconnection(statusCode);

            // Marcar socket para limpieza en el arranque siguiente
            connectionManager.activeSock = sock;

            if (evalResult.action === 'LOGGED_OUT') {
                renderBanner('Sesión cerrada');
                logger.error('Sesión cerrada desde WhatsApp (401). Eliminando credenciales para nueva vinculación...');
                try {
                    await fs.remove(config.sessionDir);
                } catch (_) {}
                logger.info('Credenciales eliminadas. Inicia el bot para volver a vincular.');
                process.exit(1);
            }

            if (!evalResult.canReconnect) {
                renderBanner('Conexión detenida');
                logger.error(`[CONEXIÓN DETENIDA] ${evalResult.reasonText}`);
                logger.warn('Intervención manual requerida. El bot no reintentará automáticamente para evitar bucles.');
                return;
            }

            // Calcular retroceso exponencial con jitter
            const delayMs = connectionManager.calculateBackoffDelay(evalResult.isFastRestart);
            const retryStr = `Intento ${connectionManager.retryCount}/${connectionManager.maxRetries}`;

            renderBanner(`Reconectando (${retryStr})...`);
            logger.warn(`[RECONEXIÓN] ${evalResult.reasonText} Reintentando en ${(delayMs / 1000).toFixed(1)}s [${retryStr}]`);

            connectionManager.scheduleReconnect(delayMs, () => {
                startBot();
            });
        } else if (connection === 'open') {
            global.mainSock = sock;
            connectionManager.onConnectionOpen(sock);
            renderBanner('Conectado y Operativo ⚡');
            logger.success(`¡Bot conectado exitosamente como ${sock.user.name || sock.user.id}!`);
            logger.info(`Listo para recibir comandos. Prefijo actual: "${config.defaultPrefix}"`);

            // Sincronización automática de LIDs del creador con WhatsApp servers
            database.syncOwnerLids(sock).then((lids) => {
                if (lids && lids.length > 0) {
                    logger.info(`[OWNER] LIDs del creador sincronizados: ${lids.join(', ')}`);
                }
            }).catch(() => {});
        }
    });

    // Guardar credenciales actualizadas
    sock.ev.on('creds.update', saveCreds);

    // 6.5. Historial previo de mensajes sincronizado al conectar (para .limpiar y .clearchat)
    sock.ev.on('messaging-history.set', ({ messages }) => {
        try {
            if (Array.isArray(messages)) {
                for (const rawMsg of messages) {
                    recentMessagesManager.add(rawMsg);
                }
            }
        } catch (_) {}
    });

    // 7. Evento de Mensajes entrantes
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            // Registrar mensajes de grupo en el historial para .limpiar
            if (chatUpdate.messages && Array.isArray(chatUpdate.messages)) {
                for (const rawMsg of chatUpdate.messages) {
                    recentMessagesManager.add(rawMsg);
                }
            }

            if (chatUpdate.type !== 'notify') return;
            const nowSec = Math.floor(Date.now() / 1000);

            for (const rawMsg of chatUpdate.messages) {
                // Descartar mensajes históricos acumulados mientras el bot estuvo offline (> 60 segundos de antigüedad)
                // para evitar ráfagas de comandos obsoletos y falsas alarmas de antispam al reconectar
                const msgSec = typeof rawMsg.messageTimestamp === 'number'
                    ? rawMsg.messageTimestamp
                    : (rawMsg.messageTimestamp?.low || Number(rawMsg.messageTimestamp) || 0);

                if (msgSec > 0 && (nowSec - msgSec) > 60) {
                    continue;
                }

                // Middleware Anti-Spam: Filtro de ráfagas con advertencia, borrado y modo expulsión opcional (.antispam / .antispamkick)
                const isSpam = await antispamMiddleware(sock, rawMsg);
                if (isSpam) continue;

                // Despachar handleMessage de forma concurrente para evitar que un comando pesado
                // (descargas, conversiones o IA) congele o retrase la respuesta a mensajes y comandos posteriores
                handleMessage(sock, rawMsg).catch(err => {
                    logger.error('Error procesando handleMessage:', err);
                });
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

    // 10. Evento de compartición de número / LID
    sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
        try {
            if (database.isOwner(jid, sock)) {
                database.registerOwnerLid(lid);
            }
        } catch (_) {}
    });

    // 11. Auto-aprendizaje de LIDs del owner a través de contactos
    sock.ev.on('contacts.upsert', (contacts) => {
        try {
            if (Array.isArray(contacts)) {
                for (const c of contacts) {
                    const cJid = c.id || c.jid;
                    const cName = c.notify || c.verifiedName || c.name;
                    if (cJid && cName) userNames.set(cJid, cName);
                    if (c && c.lid && cName) userNames.set(c.lid, cName);
                    if (c && c.lid && cJid) userNames.linkLid(c.lid, cJid);
                    if (c && c.lid && database.isOwner(c.id || c.jid, sock)) {
                        database.registerOwnerLid(c.lid);
                    }
                }
            }
        } catch (_) {}
    });

    sock.ev.on('contacts.update', (updates) => {
        try {
            if (Array.isArray(updates)) {
                for (const c of updates) {
                    const cJid = c.id || c.jid;
                    const cName = c.notify || c.verifiedName || c.name;
                    if (cJid && cName) userNames.set(cJid, cName);
                    if (c && c.lid && cName) userNames.set(c.lid, cName);
                    if (c && c.lid && cJid) userNames.linkLid(c.lid, cJid);
                    if (c && c.lid && database.isOwner(c.id || c.jid, sock)) {
                        database.registerOwnerLid(c.lid);
                    }
                }
            }
        } catch (_) {}
    });

        connectionManager.isStarting = false;
        connectionManager.activeSock = sock;
    } catch (err) {
        connectionManager.isStarting = false;
        connectionManager.cleanupSocket();
        logger.error('Error durante la inicialización de startBot():', err?.message || err);

        const delayMs = connectionManager.calculateBackoffDelay(false);
        if (connectionManager.retryCount <= connectionManager.maxRetries) {
            logger.warn(`[RECONEXIÓN] Reintentando tras fallo de inicialización en ${(delayMs / 1000).toFixed(1)}s (Intento ${connectionManager.retryCount}/${connectionManager.maxRetries})...`);
            connectionManager.scheduleReconnect(delayMs, () => {
                startBot();
            });
        } else {
            logger.error('[SISTEMA] Límite de reintentos alcanzado tras fallos de inicialización. Deteniendo.');
        }
    }

    return sock;
};

// Manejo robusto y resiliente de excepciones para mantener el servidor siempre activo sin saturar la terminal
const isTransientError = (err) => {
    const msg = String(err?.message || err?.stack || err || '').toLowerCase();
    return msg.includes('connection closed') ||
           msg.includes('timed out') ||
           msg.includes('econnreset') ||
           msg.includes('enotfound') ||
           msg.includes('epipe') ||
           msg.includes('rate-overlimit') ||
           msg.includes('qr refs attempts ended') ||
           msg.includes('bad mac') ||
           msg.includes('session error') ||
           msg.includes('sessionerror') ||
           msg.includes('stream errored') ||
           msg.includes('conflict');
};

let lastErrorPrintTime = 0;
let throttledCount = 0;

const logResilientError = (label, err) => {
    const msg = err?.message || String(err);
    if (isTransientError(err)) {
        const now = Date.now();
        if (now - lastErrorPrintTime > 6000) {
            if (throttledCount > 0) {
                logger.warn(`⚠️ [RED]: ${throttledCount} advertencias de red adicionales silenciadas para proteger la fluidez del bot.`);
                throttledCount = 0;
            }
            logger.warn(`⚠️ [SOCKET/RED RESILIENTE]: ${msg}`);
            lastErrorPrintTime = now;
        } else {
            throttledCount++;
        }
        return;
    }
    logger.error(`${label}:`, err?.stack || msg);
};

if (!global.__preflightHandlersSet) {
    process.on('uncaughtException', (err) => {
        logResilientError('💥 [UNCAUGHT EXCEPTION]', err);
    });

    process.on('unhandledRejection', (reason) => {
        logResilientError('⚠️ [UNHANDLED REJECTION]', reason);
    });
}

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

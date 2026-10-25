const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../lib/logger');
const { handleMessage } = require('../handlers/messageHandler');
const { handleGroupUpdate } = require('../handlers/groupHandler');
const recentMessagesManager = require('../lib/recentMessages');

// Mapa global de sub-bots activos en memoria
global.subBots = global.subBots || new Map();
global.activeSubBots = global.subBots; // Compatibilidad retroactiva

// Control de reintentos por sub-bot para evitar bucles infinitos y saturación de la terminal
const subBotRetries = new Map();
const MAX_SUBBOT_RETRIES = 5;

/**
 * Inicializa y administra el socket de un sub-bot
 */
const createSubBotSocket = async ({ cleanNumber, sock, chatJid, isReconnect = false }) => {
    const subbotsDir = path.join(process.cwd(), 'subbots');
    const sessionDir = path.join(subbotsDir, `session_${cleanNumber}`);
    fs.ensureDirSync(subbotsDir);

    try {
        // 1. Obtener estado de autenticación multi-archivo
        let { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        // 2. Si la carpeta contiene archivos pero creds.registered es falso (fallo anterior),
        // limpiar la carpeta de forma segura antes de solicitar un nuevo código para evitar colisiones
        if (!state.creds.registered && fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            if (files.length > 0) {
                logger.warn(`[SUB-BOT +${cleanNumber}] Limpiando credenciales residuales no registradas de intento previo...`);
                try {
                    fs.emptyDirSync(sessionDir);
                } catch (_) {
                    try {
                        fs.rmSync(sessionDir, { recursive: true, force: true });
                    } catch (_) {}
                    fs.ensureDirSync(sessionDir);
                }
                const freshAuth = await useMultiFileAuthState(sessionDir);
                state = freshAuth.state;
                saveCreds = freshAuth.saveCreds;
            }
        }

        // 3. Instanciar socket con parámetros estables requeridos
        const subSock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            syncFullHistory: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 15000,
            // Recuperación de mensajes reales o undefined para evitar tormentas de reintentos
            getMessage: async (key) => recentMessagesManager.getMessage(key)
        });

        // 4. Guardar credenciales obligatoriamente
        subSock.ev.on('creds.update', saveCreds);

        // 5. Manejo del ciclo de vida y eventos de conexión
        subSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                // Conexión exitosa: restablecer contador de reintentos
                subBotRetries.delete(cleanNumber);

                global.subBots.set(cleanNumber, {
                    sock: subSock,
                    connectedAt: Date.now(),
                    user: subSock.user
                });

                logger.success(`[SUB-BOT +${cleanNumber}] ✅ ¡Sub-bot vinculado y conectado exitosamente!`);

                const notifySock = global.mainSock || sock;
                if (notifySock && chatJid) {
                    try {
                        await notifySock.sendMessage(chatJid, {
                            text: `✅ *¡Sub-bot vinculado y conectado exitosamente!*\n\n` +
                                  `🤖 *Número:* +${cleanNumber}\n` +
                                  `⚡ Tu sub-bot ya está operativo y responderá a todos los comandos del sistema (.ia, .info, descargas, etc.).`
                        });
                    } catch (e) {
                        logger.error(`[SUB-BOT +${cleanNumber}] Error notificando conexión:`, e.message);
                    }
                }
            } else if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                const isForbidden = statusCode === DisconnectReason.forbidden;
                const isConflict = statusCode === DisconnectReason.connectionReplaced;

                logger.warn(`[SUB-BOT +${cleanNumber}] Conexión cerrada. Código de estado: ${statusCode || 'desconocido'}`);

                // Limpieza exhaustiva de listeners y socket para prevenir fugas de memoria
                try {
                    subSock.ev.removeAllListeners();
                    if (subSock.ws && typeof subSock.ws.close === 'function') subSock.ws.close();
                    if (typeof subSock.end === 'function') subSock.end(undefined);
                } catch (_) {}

                if (isLoggedOut || isForbidden) {
                    logger.error(`[SUB-BOT +${cleanNumber}] Sesión invalidada o cerrada desde el dispositivo. Eliminando datos...`);
                    subBotRetries.delete(cleanNumber);
                    global.subBots.delete(cleanNumber);
                    try {
                        fs.removeSync(sessionDir);
                    } catch (_) {
                        try {
                            fs.rmSync(sessionDir, { recursive: true, force: true });
                        } catch (_) {}
                    }

                    const notifySock = global.mainSock || sock;
                    if (notifySock && chatJid) {
                        try {
                            await notifySock.sendMessage(chatJid, {
                                text: `⚠️ *[SUB-BOT DESCONECTADO]*\nLa sesión de +${cleanNumber} fue cerrada o invalidada en WhatsApp.`
                            });
                        } catch (_) {}
                    }
                } else if (isConflict) {
                    subBotRetries.delete(cleanNumber);
                    logger.warn(`[SUB-BOT +${cleanNumber}] Conexión reemplazada por otra instancia activa. Deteniendo reconexión.`);
                } else if (!state.creds.registered) {
                    subBotRetries.delete(cleanNumber);
                    global.subBots.delete(cleanNumber);
                    logger.warn(`[SUB-BOT +${cleanNumber}] Sesión no registrada. Cancelando reconexión automática para evitar bucles.`);
                } else {
                    // Reconexión automática con Exponential Backoff y tope máximo de reintentos
                    const currentRetries = (subBotRetries.get(cleanNumber) || 0) + 1;
                    if (currentRetries > MAX_SUBBOT_RETRIES) {
                        subBotRetries.delete(cleanNumber);
                        global.subBots.delete(cleanNumber);
                        logger.error(`[SUB-BOT +${cleanNumber}] Se superó el límite de ${MAX_SUBBOT_RETRIES} reintentos consecutivos. Reconexión cancelada.`);

                        const notifySock = global.mainSock || sock;
                        if (notifySock && chatJid) {
                            try {
                                await notifySock.sendMessage(chatJid, {
                                    text: `⚠️ *[SUB-BOT]* La reconexión automática para *+${cleanNumber}* fue detenida tras alcanzar el límite de reintentos.`
                                });
                            } catch (_) {}
                        }
                        return;
                    }

                    subBotRetries.set(cleanNumber, currentRetries);
                    const delayMs = Math.min(5000 * Math.pow(2, currentRetries - 1), 60000);
                    logger.warn(`[SUB-BOT +${cleanNumber}] Reintentando conexión en ${(delayMs / 1000).toFixed(0)}s (Intento ${currentRetries}/${MAX_SUBBOT_RETRIES})...`);

                    setTimeout(() => {
                        // Verificar que no haya sido cancelado o detenido mientras esperaba
                        if (subBotRetries.has(cleanNumber)) {
                            createSubBotSocket({
                                cleanNumber,
                                sock: global.mainSock || sock,
                                chatJid,
                                isReconnect: true
                            });
                        }
                    }, delayMs);
                }
            }
        });

        // 6. Integración con el despachador de mensajes del bot principal
        subSock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                if (chatUpdate.type !== 'notify') return;
                for (const rawMsg of chatUpdate.messages) {
                    handleMessage(subSock, rawMsg).catch(err => {
                        logger.error(`[SUB-BOT +${cleanNumber}] Error procesando mensaje:`, err.message);
                    });
                }
            } catch (err) {
                logger.error(`[SUB-BOT +${cleanNumber}] Error procesando mensaje:`, err.message);
            }
        });

        subSock.ev.on('group-participants.update', async (groupUpdate) => {
            try {
                await handleGroupUpdate(subSock, groupUpdate);
            } catch (err) {
                logger.error(`[SUB-BOT +${cleanNumber}] Error procesando actualización de grupo:`, err.message);
            }
        });

        // 7. Solicitud Segura del Pairing Code si no está registrado
        if (!subSock.authState.creds.registered && !isReconnect) {
            const notifySock = global.mainSock || sock;
            if (notifySock && chatJid) {
                await notifySock.sendMessage(chatJid, {
                    text: `⏳ *Generando código de emparejamiento para +${cleanNumber}... Espera 3 segundos.*`
                });
            }

            // Espera obligatoria de 3000 ms antes de solicitar el código
            await new Promise((resolve) => setTimeout(resolve, 3000));

            try {
                const code = await subSock.requestPairingCode(cleanNumber);
                const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                const pairingMessage =
`╭━━━〔 🤖 *SUB-BOT PAIRING CODE* 〕━━━⬣
┃ 📱 *Número:* +${cleanNumber}
┃ 🔑 *Código de Vinculación:*
┃
┃    \`\`\`${formattedCode}\`\`\`
┃
┃ 📌 *Pasos para vincular:*
┃ 1. Abre WhatsApp en el dispositivo con el número +${cleanNumber}.
┃ 2. Ve a *Ajustes* (o ⋮) > *Dispositivos vinculados*.
┃ 3. Toca en *Vincular un dispositivo*.
┃ 4. Selecciona *Vincular con el número de teléfono*.
┃ 5. Ingresa el código de 8 dígitos mostrado arriba.
┃ ⏱️ *Expira en aproximadamente 60 segundos.*
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣`;

                if (notifySock && chatJid) {
                    await notifySock.sendMessage(chatJid, { text: pairingMessage });
                }
            } catch (codeErr) {
                logger.error(`[SUB-BOT +${cleanNumber}] Error solicitando pairing code:`, codeErr);
                if (notifySock && chatJid) {
                    await notifySock.sendMessage(chatJid, {
                        text: `❌ Error al solicitar el código de emparejamiento para +${cleanNumber}.\nDetalle: ${codeErr.message || 'Error de conexión con WhatsApp'}`
                    });
                }
            }
        }

        return subSock;
    } catch (err) {
        logger.error(`[SUB-BOT +${cleanNumber}] Error inicializando socket:`, err);
        const notifySock = global.mainSock || sock;
        if (notifySock && chatJid && !isReconnect) {
            await notifySock.sendMessage(chatJid, {
                text: `❌ Error al inicializar el Sub-Bot: ${err.message || 'Error desconocido'}`
            });
        }
    }
};

/**
 * Función auxiliar para listar sub-bots activos
 */
const listSubBots = async (m) => {
    const total = global.subBots.size;
    if (total === 0) {
        return await m.reply('🤖 *No hay ningún Sub-Bot activo en este momento.*');
    }

    let listMsg = `╭━━━〔 🤖 *SUB-BOTS ACTIVOS* (${total}) 〕━━━⬣\n`;
    for (const [num, data] of global.subBots.entries()) {
        const uptime = Math.floor((Date.now() - (data.connectedAt || Date.now())) / 1000);
        const mins = Math.floor(uptime / 60);
        const secs = uptime % 60;
        listMsg += `┃ 🔹 *+${num}* (Conectado hace ${mins}m ${secs}s)\n`;
    }
    listMsg += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
               `💡 *Tip:* Para desconectar un sub-bot usa *.subbot stop [número]*`;
    return await m.reply(listMsg);
};

/**
 * Función auxiliar para detener un sub-bot
 */
const stopSubBot = async (m, target) => {
    const targetNum = (target || '').replace(/[^0-9]/g, '');
    if (!targetNum) {
        return await m.reply('❌ Por favor indica el número del Sub-Bot a detener. Ejemplo: `.subbot stop 584160666286`');
    }

    const existing = global.subBots.get(targetNum);
    if (!existing) {
        return await m.reply(`❌ No hay un Sub-Bot activo con el número +${targetNum}.`);
    }

    subBotRetries.delete(targetNum);

    if (existing.sock) {
        try {
            existing.sock.ev.removeAllListeners();
            if (existing.sock.ws && typeof existing.sock.ws.close === 'function') existing.sock.ws.close();
            if (typeof existing.sock.end === 'function') existing.sock.end(new Error('Detenido manualmente'));
        } catch (_) {}
    }

    global.subBots.delete(targetNum);
    const sessionDir = path.join(process.cwd(), 'subbots', `session_${targetNum}`);
    try {
        fs.removeSync(sessionDir);
    } catch (_) {
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
    }

    return await m.reply(`🛑 Sub-Bot *+${targetNum}* detenido y credenciales eliminadas.`);
};

module.exports = [
    // 1. Comando principal de vinculación (.subbot / .code)
    {
        name: 'subbot',
        alias: ['code', 'serbot', 'jadibot', 'pairingcode'],
        category: 'subbots',
        desc: 'Genera un código de emparejamiento seguro para vincular un Sub-Bot propio',
        usage: '.subbot [número con código de país]',
        execute: async ({ sock, m, text }) => {
            const input = (text || '').trim();

            if (input.toLowerCase() === 'list' || input.toLowerCase() === 'status') {
                return await listSubBots(m);
            }

            if (input.toLowerCase().startsWith('stop')) {
                return await stopSubBot(m, input.replace(/stop/i, ''));
            }

            if (!input) {
                return await m.reply(
                    '❌ *Número faltante o incompleto.*\n\n' +
                    'Proporciona tu número telefónico completo con código de país (sin espacios, símbolos ni guiones).\n\n' +
                    '📌 *Ejemplo:* `.subbot 584160666286` o `.code 18494509905`\n' +
                    '📋 *Comandos adicionales:*\n' +
                    '• `.subbot list` - Ver Sub-Bots activos\n' +
                    '• `.subbot stop [número]` - Desconectar un Sub-Bot'
                );
            }

            const cleanNumber = input.replace(/[^0-9]/g, '');

            if (cleanNumber.length < 10 || cleanNumber.length > 15) {
                return await m.reply(
                    '❌ *Número no válido.*\n\n' +
                    'Asegúrate de incluir el código de país. Debe tener entre 10 y 15 dígitos numéricos.\n' +
                    '📌 *Ejemplo:* `.subbot 584160666286`'
                );
            }

            const existingBot = global.subBots.get(cleanNumber);
            if (existingBot && existingBot.sock?.user?.id) {
                return await m.reply(`🤖 Ya existe un Sub-Bot activo y conectado para el número *+${cleanNumber}*.`);
            }

            await createSubBotSocket({
                cleanNumber,
                sock,
                chatJid: m.chat,
                isReconnect: false
            });
        }
    },

    // 2. Comando explícito para listar sub-bots (.subbot list / .subbots)
    {
        name: 'subbot list',
        alias: ['subbots', 'subbotlist', 'bots'],
        category: 'subbots',
        desc: 'Muestra la lista de todos los Sub-Bots conectados y su tiempo en línea',
        usage: '.subbot list',
        execute: async ({ m }) => {
            return await listSubBots(m);
        }
    },

    // 3. Comando explícito para detener un sub-bot (.subbot stop)
    {
        name: 'subbot stop',
        alias: ['stopsubbot', 'stopbot'],
        category: 'subbots',
        desc: 'Desconecta y elimina la sesión de un Sub-Bot activo',
        usage: '.subbot stop [número]',
        execute: async ({ m, text }) => {
            return await stopSubBot(m, text);
        }
    }
];

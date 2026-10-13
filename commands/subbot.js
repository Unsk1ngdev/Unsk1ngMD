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

// Mapa global de sub-bots activos en memoria
global.subBots = global.subBots || new Map();
global.activeSubBots = global.subBots; // Compatibilidad retroactiva

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
            keepAliveIntervalMs: 10000,
            getMessage: async () => ({ conversation: '' })
        });

        // 4. Guardar credenciales obligatoriamente
        subSock.ev.on('creds.update', saveCreds);

        // 5. Manejo del ciclo de vida y eventos de conexión
        subSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                global.subBots.set(cleanNumber, {
                    sock: subSock,
                    connectedAt: Date.now(),
                    user: subSock.user
                });

                logger.success(`[SUB-BOT +${cleanNumber}] ✅ ¡Sub-bot vinculado y conectado exitosamente!`);

                if (sock && chatJid) {
                    try {
                        await sock.sendMessage(chatJid, {
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

                // Limpiar listeners del sub-bot para evitar fugas de memoria
                try {
                    subSock.ev.removeAllListeners();
                    if (subSock.ws && typeof subSock.ws.close === 'function') subSock.ws.close();
                } catch (_) {}

                if (isLoggedOut || isForbidden) {
                    logger.error(`[SUB-BOT +${cleanNumber}] Sesión invalidada o cerrada desde el dispositivo. Eliminando datos...`);
                    global.subBots.delete(cleanNumber);
                    try {
                        fs.removeSync(sessionDir);
                    } catch (_) {
                        try {
                            fs.rmSync(sessionDir, { recursive: true, force: true });
                        } catch (_) {}
                    }

                    if (sock && chatJid) {
                        try {
                            await sock.sendMessage(chatJid, {
                                text: `⚠️ *[SUB-BOT DESCONECTADO]*\nLa sesión de +${cleanNumber} fue cerrada o invalidada en WhatsApp.`
                            });
                        } catch (_) {}
                    }
                } else if (isConflict) {
                    logger.warn(`[SUB-BOT +${cleanNumber}] Conexión reemplazada por otra instancia activa. Deteniendo reconexión.`);
                } else {
                    // Reconexión automática controlada ante desconexión temporal de red
                    logger.info(`[SUB-BOT +${cleanNumber}] Reconectando automáticamente en 5 segundos...`);
                    setTimeout(() => {
                        createSubBotSocket({ cleanNumber, sock, chatJid, isReconnect: true });
                    }, 5000);
                }
            }
        });

        // 6. Integración con el despachador de mensajes del bot principal
        subSock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                if (chatUpdate.type !== 'notify') return;
                for (const rawMsg of chatUpdate.messages) {
                    await handleMessage(subSock, rawMsg);
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
            if (sock && chatJid) {
                await sock.sendMessage(chatJid, {
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

                if (sock && chatJid) {
                    await sock.sendMessage(chatJid, { text: pairingMessage });
                }
            } catch (codeErr) {
                logger.error(`[SUB-BOT +${cleanNumber}] Error solicitando pairing code:`, codeErr);
                if (sock && chatJid) {
                    await sock.sendMessage(chatJid, {
                        text: `❌ Error al solicitar el código de emparejamiento para +${cleanNumber}.\nDetalle: ${codeErr.message || 'Error de conexión con WhatsApp'}`
                    });
                }
            }
        }

        return subSock;
    } catch (err) {
        logger.error(`[SUB-BOT +${cleanNumber}] Error inicializando socket:`, err);
        if (sock && chatJid && !isReconnect) {
            await sock.sendMessage(chatJid, {
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

    try {
        existing.sock.end(new Error('Detenido manualmente por usuario'));
    } catch (_) {}

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

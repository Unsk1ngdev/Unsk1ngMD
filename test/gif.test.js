'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const gifCmd = require('../commands/media/gif');
const { videoToSticker } = require('../lib/media');
const { runFfmpeg } = require('../lib/ffmpeg');

console.log('🧪 [TEST] Iniciando pruebas de comando .gif y videoToSticker (WebP animado)...');

// Helper para crear contexto mock
const createMockContext = () => {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        sendMessage: async (jid, content, extra) => {
            sentMessages.push({ jid, content, extra });
            return { key: { id: 'mock-msg-' + Date.now() } };
        }
    };

    const m = {
        chat: '123456789@s.whatsapp.net',
        type: 'conversation',
        react: async (emoji) => {
            reactions.push(emoji);
        },
        reply: async (text) => {
            sentMessages.push({ jid: '123456789@s.whatsapp.net', content: { text } });
        }
    };

    return { sock, m, sentMessages, reactions };
};

(async () => {
    // 1. Verificación de metadata y aliases
    {
        assert.strictEqual(gifCmd.name, 'gif', 'El comando debe llamarse gif');
        assert(Array.isArray(gifCmd.alias), 'alias debe ser un array');
        assert(gifCmd.alias.includes('smp4'), 'Debe incluir alias smp4');
        assert(gifCmd.alias.includes('stickergif'), 'Debe incluir alias stickergif');
        assert(gifCmd.alias.includes('sgif'), 'Debe incluir alias sgif');
        console.log('  ✅ Prueba 1 superada: Metadata y aliases verificados.');
    }

    // 2. Rechazo ante ausencia de video o GIF
    {
        const ctx = createMockContext();
        await gifCmd.execute({ sock: ctx.sock, m: ctx.m, text: '' });
        assert(ctx.sentMessages.length > 0, 'Debe enviar advertencia si no hay video');
        assert(ctx.sentMessages[0].content.text.includes('Debes enviar o citar un video'), 'Mensaje explicativo de uso');
        console.log('  ✅ Prueba 2 superada: Rechazo correcto cuando no se envía video.');
    }

    // 3. Rechazo de video demasiado largo (> 15s)
    {
        const ctx = createMockContext();
        ctx.m.quoted = {
            type: 'videoMessage',
            message: { videoMessage: { seconds: 25 } },
            download: async () => Buffer.from('fake-video')
        };
        await gifCmd.execute({ sock: ctx.sock, m: ctx.m, text: '' });
        assert(ctx.sentMessages.length > 0, 'Debe avisar que excede la duración');
        assert(ctx.sentMessages[0].content.text.includes('demasiado largo'), 'Mensaje de duración excedida');
        console.log('  ✅ Prueba 3 superada: Rechazo adecuado de videos largos (>15s).');
    }

    // 4. Conversión real de video MP4 a Sticker WebP Animado (< 1MB)
    {
        const tempMp4 = path.join(__dirname, 'test_media.mp4');
        try {
            // Generar video sintético de 2 segundos
            await runFfmpeg([
                '-y',
                '-f', 'lavfi',
                '-i', 'testsrc=duration=2:size=240x240:rate=10',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                tempMp4
            ]);

            const videoBuffer = fs.readFileSync(tempMp4);
            const stickerBuffer = await videoToSticker(videoBuffer, { packname: 'TestPack', author: 'TestDev' });

            assert(Buffer.isBuffer(stickerBuffer), 'Debe retornar un Buffer');
            assert(stickerBuffer.length > 0, 'El buffer no debe estar vacío');
            assert(stickerBuffer.length < 1048576, 'El sticker animado debe pesar menos de 1MB para WhatsApp');
            // Verificar cabecera RIFF WebP
            const header = stickerBuffer.slice(0, 4).toString('ascii');
            assert.strictEqual(header, 'RIFF', 'Debe ser un archivo RIFF/WebP válido');

            console.log(`  ✅ Prueba 4 superada: Conversión real de MP4 a Sticker WebP (${stickerBuffer.length} bytes, < 1MB).`);
        } finally {
            if (fs.existsSync(tempMp4)) fs.unlinkSync(tempMp4);
        }
    }

    // 5. Conversión real de GIF animado a Sticker WebP Animado
    {
        const tempGif = path.join(__dirname, 'test_media.gif');
        try {
            await runFfmpeg([
                '-y',
                '-f', 'lavfi',
                '-i', 'testsrc=duration=2:size=160x160:rate=8',
                tempGif
            ]);

            const gifBuffer = fs.readFileSync(tempGif);
            const stickerBuffer = await videoToSticker(gifBuffer, { packname: 'GifPack', author: 'GifAuthor' });

            assert(Buffer.isBuffer(stickerBuffer), 'Debe retornar un Buffer');
            assert(stickerBuffer.length > 0, 'El buffer no debe estar vacío');
            assert(stickerBuffer.length < 1048576, 'El sticker animado debe pesar menos de 1MB');

            console.log(`  ✅ Prueba 5 superada: Conversión real de GIF a Sticker WebP (${stickerBuffer.length} bytes).`);
        } finally {
            if (fs.existsSync(tempGif)) fs.unlinkSync(tempGif);
        }
    }

    // 6. Ejecución del comando .gif con mensaje simulado citando video
    {
        const ctx = createMockContext();
        const tempMp4 = path.join(__dirname, 'test_cmd.mp4');
        try {
            await runFfmpeg([
                '-y',
                '-f', 'lavfi',
                '-i', 'testsrc=duration=1:size=160x160:rate=10',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                tempMp4
            ]);

            const sampleVideo = fs.readFileSync(tempMp4);

            ctx.m.quoted = {
                type: 'videoMessage',
                message: { videoMessage: { seconds: 1 } },
                download: async () => sampleVideo
            };

            await gifCmd.execute({ sock: ctx.sock, m: ctx.m, text: 'CustomPack | CustomAuthor' });

            assert(ctx.reactions.includes('✅'), 'Debe reaccionar con ✅ de éxito');
            const stickerMsg = ctx.sentMessages.find(msg => msg.content && msg.content.sticker);
            assert(stickerMsg, 'Debe enviar un mensaje con sticker animado');
            assert(Buffer.isBuffer(stickerMsg.content.sticker), 'El sticker debe ser un Buffer');

            console.log('  ✅ Prueba 6 superada: Flujo completo de .gif enviando sticker animado verificado.');
        } finally {
            if (fs.existsSync(tempMp4)) fs.unlinkSync(tempMp4);
        }
    }

    console.log('🎉 [TEST] ¡Todas las pruebas de .gif pasaron exitosamente!');
})().catch(err => {
    console.error('❌ [TEST ERROR]:', err);
    process.exit(1);
});


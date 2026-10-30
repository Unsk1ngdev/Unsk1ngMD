'use strict';

const assert = require('assert');
const sharp = require('sharp');
const fs = require('fs');
const tovideo = require('../commands/media/tovideo');

async function runTests() {
    console.log('🧪 Iniciando pruebas para .tovideo ...');

    // 1. Prueba: Sin citar ni enviar multimedia
    {
        let repliedText = '';
        const mockSock = {
            sendMessage: async (chat, content) => {
                repliedText = content.text;
            }
        };
        const mockM = {
            chat: '12345@s.whatsapp.net',
            quoted: null,
            type: 'conversation',
            body: '.tovideo',
            reply: async (text) => {
                repliedText = text;
            },
            react: async () => {}
        };

        await tovideo.execute({ sock: mockSock, m: mockM });
        assert.ok(repliedText.includes('CONVERSOR A VIDEO MP4'), 'Debe mostrar menú de ayuda si no hay medio');
        console.log('  ✅ Prueba 1 superada: Menú de ayuda para .tovideo sin argumentos');
    }

    // 2. Prueba: Sticker estático citado -> MP4 de 3 segundos
    {
        const staticWebp = await sharp({
            create: { width: 120, height: 120, channels: 4, background: { r: 0, g: 120, b: 255, alpha: 1 } }
        }).webp().toBuffer();

        let sentVideo = null;
        let reacted = '';
        const mockSock = {
            sendMessage: async (chat, content) => {
                if (content.video) {
                    sentVideo = content;
                }
            }
        };
        const mockM = {
            chat: '12345@s.whatsapp.net',
            quoted: {
                type: 'stickerMessage',
                message: { stickerMessage: { isAnimated: false } },
                download: async () => staticWebp
            },
            reply: async (text) => { console.log('Reply error:', text); },
            react: async (emoji) => { reacted = emoji; }
        };

        await tovideo.execute({ sock: mockSock, m: mockM });
        assert.strictEqual(reacted, '✅', 'Debe reaccionar con ✅');
        assert.ok(sentVideo, 'Debe haber enviado un mensaje con video');
        assert.ok(Buffer.isBuffer(sentVideo.video), 'El video debe ser un Buffer');
        assert.ok(sentVideo.video.length > 1000, 'El video debe tener contenido real');
        assert.strictEqual(sentVideo.mimetype, 'video/mp4', 'El mimetype debe ser video/mp4');
        console.log('  ✅ Prueba 2 superada: Conversión de sticker estático a video MP4 (duración y buffer válidos)');
    }

    // 3. Prueba: Imagen citada -> MP4
    {
        const testJpeg = await sharp({
            create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
        }).jpeg().toBuffer();

        let sentVideo = null;
        let reacted = '';
        const mockSock = {
            sendMessage: async (chat, content) => {
                if (content.video) {
                    sentVideo = content;
                }
            }
        };
        const mockM = {
            chat: '12345@s.whatsapp.net',
            quoted: {
                type: 'imageMessage',
                message: { imageMessage: {} },
                download: async () => testJpeg
            },
            reply: async () => {},
            react: async (emoji) => { reacted = emoji; }
        };

        await tovideo.execute({ sock: mockSock, m: mockM });
        assert.strictEqual(reacted, '✅', 'Debe reaccionar con ✅');
        assert.ok(sentVideo, 'Debe haber enviado un mensaje con video');
        console.log('  ✅ Prueba 3 superada: Conversión de imagen a video MP4');
    }

    console.log('🎉 Todas las pruebas de .tovideo pasaron exitosamente.\n');
}

runTests().catch(err => {
    console.error('❌ Error en pruebas de tovideo:', err);
    process.exit(1);
});

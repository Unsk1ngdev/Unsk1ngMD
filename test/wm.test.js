'use strict';

const assert = require('assert');
const wmCmd = require('../commands/media/wm');
const config = require('../config');

console.log('🧪 [TEST] Iniciando pruebas de comando .wm (Sticker Watermark)...');

// 1. Verificación de metadata y aliases
{
    assert.strictEqual(wmCmd.name, 'wm', 'El nombre principal debe ser wm');
    assert(Array.isArray(wmCmd.alias), 'alias debe ser un array');
    assert(wmCmd.alias.includes('take'), 'debe incluir alias take');
    assert(wmCmd.alias.includes('robar'), 'debe incluir alias robar');
    assert(wmCmd.alias.includes('watermark'), 'debe incluir alias watermark');
    assert(wmCmd.alias.includes('sautor'), 'debe incluir alias sautor');
    assert.strictEqual(wmCmd.category, 'multimedia', 'la categoría debe ser multimedia');
    console.log('  ✅ Prueba 1 superada: Metadata y aliases de .wm verificados correctamente.');
}

// 2. Validación de rechazo cuando no hay multimedia ni citado
async function runAsyncTests() {
    let sentText = '';
    const mockSock = {
        sendMessage: async (jid, content) => {
            sentText = content.text || '';
            return { key: { id: 'msg_test' } };
        }
    };

    const mockMsgNoMedia = {
        chat: '12345@s.whatsapp.net',
        pushName: 'Carlos Dev',
        type: 'conversation',
        quoted: null,
        react: async () => {}
    };

    await wmCmd.execute({
        sock: mockSock,
        m: mockMsgNoMedia,
        text: 'hola'
    });

    assert(sentText.includes('Debes responder a un sticker, imagen o video corto'), 'Debe mostrar instrucciones cuando no hay multimedia');
    console.log('  ✅ Prueba 2 superada: Rechazo correcto con instrucciones ante ausencia de multimedia.');

    // 3. Procesamiento de Sticker citado con frase simple (Arriba: PushName, Abajo: Frase)
    let processedSticker = null;
    const sharp = require('sharp');
    const realWebp = await sharp({
        create: {
            width: 10,
            height: 10,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 1 }
        }
    }).webp().toBuffer();

    const mockSockSticker = {
        sendMessage: async (jid, content) => {
            processedSticker = content.sticker;
            return { key: { id: 'msg_sticker' } };
        }
    };

    const mockMsgWithSticker = {
        chat: '12345@s.whatsapp.net',
        pushName: 'Alexander',
        type: 'extendedTextMessage',
        quoted: {
            type: 'stickerMessage',
            download: async () => realWebp
        },
        react: async () => {}
    };

    await wmCmd.execute({
        sock: mockSockSticker,
        m: mockMsgWithSticker,
        text: 'hola mi gente'
    });

    assert(processedSticker && Buffer.isBuffer(processedSticker), 'Debe generar y enviar un buffer de sticker');
    console.log('  ✅ Prueba 3 superada: Sticker citado re-empaquetado exitosamente con frase.');

    // 4. Procesamiento con separación explícita de Pack y Autor (Pack | Autor)
    let processedCustom = null;
    const mockSockCustom = {
        sendMessage: async (jid, content) => {
            processedCustom = content.sticker;
            return { key: { id: 'msg_custom' } };
        }
    };

    await wmCmd.execute({
        sock: mockSockCustom,
        m: mockMsgWithSticker,
        text: 'Mi Pack Especial | Creado por Alex'
    });

    assert(processedCustom && Buffer.isBuffer(processedCustom), 'Debe procesar correctamente pack | autor');
    console.log('  ✅ Prueba 4 superada: Packname y Autor explícitos procesados correctamente.');
}

runAsyncTests().then(() => {
    console.log('🎉 [TEST] ¡Todas las pruebas de .wm pasaron exitosamente!');
}).catch(err => {
    console.error('❌ [TEST FAIL]:', err);
    process.exit(1);
});

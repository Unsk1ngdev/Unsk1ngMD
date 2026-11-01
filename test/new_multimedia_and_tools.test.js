'use strict';

const assert = require('assert');
const path = require('path');
const sharp = require('sharp');

// Comandos
const anticolongCmd = require('../commands/media/anticolong');
const binaryCmd = require('../commands/tools/binary');
const carbonCmd = require('../commands/tools/carbon');
const bypassCmd = require('../commands/tools/bypass');
const fakevhsCmd = require('../commands/media/fakevhs');
const cinematicCmd = require('../commands/media/cinematic');
const hdvidCmd = require('../commands/tools/hdvid');
const sendnglCmd = require('../commands/tools/sendngl');
const converterCmd = require('../commands/tools/converter');
const colongswCmd = require('../commands/tools/colongsw');
const faketweetCmd = require('../commands/tools/faketweet');
const fagsocialCmd = require('../commands/tools/fagsocial');

function createMockEnv(customSender = '18095551234@s.whatsapp.net', customChat = '123456789-group@g.us') {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        sendMessage: async (dest, content, opts) => {
            const msgId = 'TEST_MSG_' + Math.random().toString(36).substring(2, 9);
            sentMessages.push({ dest, content, opts, msgId });
            return { key: { id: msgId, remoteJid: dest } };
        }
    };

    const m = {
        chat: customChat,
        sender: customSender,
        key: { remoteJid: customChat, participant: customSender },
        react: async (emoji) => { reactions.push(emoji); },
        mentionedJid: []
    };

    return { sock, m, sentMessages, reactions };
}

async function runTests() {
    console.log('🧪 [TEST] Verificando los nuevos 12 comandos de multimedia, herramientas y utilidades...');

    // ── 1. ANTICOLONG ──
    console.log('  Testing .anticolong...');
    const envAnti1 = createMockEnv();
    await anticolongCmd.execute({ sock: envAnti1.sock, m: envAnti1.m });
    assert(envAnti1.sentMessages.length === 1);
    assert(envAnti1.sentMessages[0].content.text.includes('STICKER ANTI-COLONG'));

    // Con sticker simulado
    const sampleStickerBuf = await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).webp().toBuffer();

    const envAnti2 = createMockEnv();
    envAnti2.m.quoted = {
        type: 'stickerMessage',
        download: async () => sampleStickerBuf
    };
    await anticolongCmd.execute({ sock: envAnti2.sock, m: envAnti2.m });
    assert(envAnti2.sentMessages.some(s => s.content.sticker && s.content.isAvatar === true));
    assert(envAnti2.reactions.includes('🛡️'));
    console.log('  ✅ .anticolong verificado.');

    // ── 2. BINARY ──
    console.log('  Testing .binary...');
    // Texto a binario
    const envBin1 = createMockEnv();
    await binaryCmd.execute({ sock: envBin1.sock, m: envBin1.m, args: ['hola'] });
    assert(envBin1.sentMessages.length === 1);
    assert(envBin1.sentMessages[0].content.text.includes('01101000 01101111 01101100 01100001'));

    // Binario a texto
    const envBin2 = createMockEnv();
    await binaryCmd.execute({ sock: envBin2.sock, m: envBin2.m, args: ['01101000', '01101111', '01101100', '01100001'] });
    assert(envBin2.sentMessages.length === 1);
    assert(envBin2.sentMessages[0].content.text.includes('hola'));
    console.log('  ✅ .binary verificado (bidireccional).');

    // ── 3. CARBON ──
    console.log('  Testing .carbon...');
    const envCarbon1 = createMockEnv();
    await carbonCmd.execute({ sock: envCarbon1.sock, m: envCarbon1.m, args: ['const', 'x', '=', '10;'] });
    assert(envCarbon1.sentMessages.length === 1);
    assert(Buffer.isBuffer(envCarbon1.sentMessages[0].content.image));
    assert(envCarbon1.reactions.includes('✨'));
    console.log('  ✅ .carbon verificado.');

    // ── 4. BYPASS ──
    console.log('  Testing .bypass...');
    const envBypass1 = createMockEnv();
    await bypassCmd.execute({ sock: envBypass1.sock, m: envBypass1.m, args: [] });
    assert(envBypass1.sentMessages.length === 1);
    assert(envBypass1.sentMessages[0].content.text.includes('BYPASS DE ENLACES'));

    const envBypass2 = createMockEnv();
    await bypassCmd.execute({ sock: envBypass2.sock, m: envBypass2.m, args: ['https://example.com/ad?url=https://github.com/test'] });
    assert(envBypass2.sentMessages.length === 1);
    assert(envBypass2.sentMessages[0].content.text.includes('https://github.com/test'));
    console.log('  ✅ .bypass verificado.');

    // ── 5. FAKE VHS ──
    console.log('  Testing .fakevhs...');
    const sampleImgBuf = await sharp({
        create: { width: 300, height: 200, channels: 3, background: { r: 100, g: 150, b: 200 } }
    }).jpeg().toBuffer();

    const envVhs1 = createMockEnv();
    await fakevhsCmd.execute({ sock: envVhs1.sock, m: envVhs1.m });
    assert(envVhs1.sentMessages.length === 1);
    assert(envVhs1.sentMessages[0].content.text.includes('FILTRO DE CÁMARA RETRO VHS'));

    const envVhs2 = createMockEnv();
    envVhs2.m.quoted = {
        type: 'imageMessage',
        download: async () => sampleImgBuf
    };
    await fakevhsCmd.execute({ sock: envVhs2.sock, m: envVhs2.m });
    assert(envVhs2.sentMessages.length === 1);
    assert(Buffer.isBuffer(envVhs2.sentMessages[0].content.image));
    assert(envVhs2.reactions.includes('📼'));
    console.log('  ✅ .fakevhs verificado.');

    // ── 6. CINEMATIC ──
    console.log('  Testing .cinematic...');
    const envCine1 = createMockEnv();
    await cinematicCmd.execute({ sock: envCine1.sock, m: envCine1.m });
    assert(envCine1.sentMessages.length === 1);
    assert(envCine1.sentMessages[0].content.text.includes('BARRAS CINEMATOGRÁFICAS'));

    const envCine2 = createMockEnv();
    envCine2.m.quoted = {
        type: 'imageMessage',
        download: async () => sampleImgBuf
    };
    await cinematicCmd.execute({ sock: envCine2.sock, m: envCine2.m });
    assert(envCine2.sentMessages.length === 1);
    assert(Buffer.isBuffer(envCine2.sentMessages[0].content.image));
    assert(envCine2.reactions.includes('🎬'));
    console.log('  ✅ .cinematic verificado.');

    // ── 7. HDVID ──
    console.log('  Testing .hdvid...');
    const envHd = createMockEnv();
    await hdvidCmd.execute({ sock: envHd.sock, m: envHd.m });
    assert(envHd.sentMessages.length === 1);
    assert(envHd.sentMessages[0].content.text.includes('MEJORADOR DE VIDEO'));
    console.log('  ✅ .hdvid verificado.');

    // ── 8. SENDNGL ──
    console.log('  Testing .sendngl...');
    const envNgl1 = createMockEnv();
    await sendnglCmd.execute({ sock: envNgl1.sock, m: envNgl1.m, args: [] });
    assert(envNgl1.sentMessages.length === 1);
    assert(envNgl1.sentMessages[0].content.text.includes('MENSAJES ANÓNIMOS NGL'));
    console.log('  ✅ .sendngl verificado.');

    // ── 9. CONVERTER ──
    console.log('  Testing .converter...');
    const envConv1 = createMockEnv();
    await converterCmd.execute({ sock: envConv1.sock, m: envConv1.m, args: [] });
    assert(envConv1.sentMessages.length === 1);
    assert(envConv1.sentMessages[0].content.text.includes('CONVERSOR DE FORMATOS UNIVERSAL'));

    // Imagen a PDF
    const envConvPdf = createMockEnv();
    envConvPdf.m.quoted = {
        type: 'imageMessage',
        download: async () => sampleImgBuf
    };
    await converterCmd.execute({ sock: envConvPdf.sock, m: envConvPdf.m, args: ['pdf'] });
    assert(envConvPdf.sentMessages.length === 1);
    assert(Buffer.isBuffer(envConvPdf.sentMessages[0].content.document));
    assert(envConvPdf.sentMessages[0].content.mimetype === 'application/pdf');

    // Imagen a PNG
    const envConvPng = createMockEnv();
    envConvPng.m.quoted = {
        type: 'imageMessage',
        download: async () => sampleImgBuf
    };
    await converterCmd.execute({ sock: envConvPng.sock, m: envConvPng.m, args: ['png'] });
    assert(envConvPng.sentMessages.length === 1);
    assert(Buffer.isBuffer(envConvPng.sentMessages[0].content.image));
    console.log('  ✅ .converter verificado (PDF e Imagen).');

    // ── 10. COLONGSW ──
    console.log('  Testing .colongsw...');
    const envSw1 = createMockEnv();
    await colongswCmd.execute({ sock: envSw1.sock, m: envSw1.m });
    assert(envSw1.sentMessages.length === 1);
    assert(envSw1.sentMessages[0].content.text.includes('COLONGSW'));

    const envSw2 = createMockEnv();
    envSw2.m.quoted = {
        message: { imageMessage: { caption: 'Mi estado del día' } },
        download: async () => sampleImgBuf
    };
    await colongswCmd.execute({ sock: envSw2.sock, m: envSw2.m });
    assert(envSw2.sentMessages.length === 1);
    assert(Buffer.isBuffer(envSw2.sentMessages[0].content.image));
    assert(envSw2.sentMessages[0].content.caption.includes('Mi estado del día'));
    console.log('  ✅ .colongsw verificado.');

    // ── 11. FAKETWEET ──
    console.log('  Testing .faketweet...');
    const userNames = require('../lib/userNames');
    userNames.set('18097771234@s.whatsapp.net', 'Roberto Gomez');

    const envTweet1 = createMockEnv();
    await faketweetCmd.execute({ sock: envTweet1.sock, m: envTweet1.m, args: [] });
    assert(envTweet1.sentMessages.length === 1);
    assert(envTweet1.sentMessages[0].content.text.includes('GENERADOR DE FAKE TWEET'));

    // Prueba con mención / ID numérico: debe resolver el nombre real y no el ID
    const envTweetId = createMockEnv();
    envTweetId.m.mentionedJid = ['18097771234@s.whatsapp.net'];
    await faketweetCmd.execute({ sock: envTweetId.sock, m: envTweetId.m, args: ['@18097771234', '|', 'Comprando', 'acciones'] });
    assert(envTweetId.sentMessages.length === 1);
    assert(Buffer.isBuffer(envTweetId.sentMessages[0].content.image));
    assert(envTweetId.sentMessages[0].content.caption.includes('Roberto Gomez'), 'Debe poner el nombre de la persona');
    assert(envTweetId.sentMessages[0].content.caption.includes('@roberto_gomez'), 'Debe poner el handle del usuario');
    assert(!envTweetId.sentMessages[0].content.caption.includes('18097771234'), 'No debe poner el ID numérico');
    assert(envTweetId.reactions.includes('🐦'));

    // Prueba con nombre personalizado explícito
    const envTweet2 = createMockEnv();
    await faketweetCmd.execute({ sock: envTweet2.sock, m: envTweet2.m, args: ['elonmusk', '|', 'Probando', 'nuevo', 'tweet'] });
    assert(envTweet2.sentMessages.length === 1);
    assert(Buffer.isBuffer(envTweet2.sentMessages[0].content.image));
    assert(envTweet2.reactions.includes('🐦'));
    console.log('  ✅ .faketweet verificado (resolviendo nombre en lugar de ID).');

    // ── 12. FAGSOCIAL (FAKESOCIAL) ──
    console.log('  Testing .fagsocial...');
    const envSocial1 = createMockEnv();
    await fagsocialCmd.execute({ sock: envSocial1.sock, m: envSocial1.m, args: [] });
    assert(envSocial1.sentMessages.length === 1);
    assert(envSocial1.sentMessages[0].content.text.includes('OVERLAY SOCIAL'));

    // Con ID/mención: debe resolver a nombre de usuario
    const envSocialId = createMockEnv();
    envSocialId.m.mentionedJid = ['18097771234@s.whatsapp.net'];
    envSocialId.m.quoted = {
        type: 'imageMessage',
        download: async () => sampleImgBuf
    };
    await fagsocialCmd.execute({ sock: envSocialId.sock, m: envSocialId.m, args: ['@18097771234', '|', 'En la playa'] });
    assert(envSocialId.sentMessages.length === 1);
    assert(Buffer.isBuffer(envSocialId.sentMessages[0].content.image));
    assert(envSocialId.sentMessages[0].content.caption.includes('Roberto Gomez'), 'Debe poner el nombre de la persona');
    assert(envSocialId.sentMessages[0].content.caption.includes('@roberto_gomez'), 'Debe poner el handle del usuario');
    assert(!envSocialId.sentMessages[0].content.caption.includes('18097771234'), 'No debe poner el ID numérico');
    assert(envSocialId.reactions.includes('📱'));

    // Con nombre explícito
    const envSocial2 = createMockEnv();
    envSocial2.m.quoted = {
        type: 'imageMessage',
        download: async () => sampleImgBuf
    };
    await fagsocialCmd.execute({ sock: envSocial2.sock, m: envSocial2.m, args: ['@carlos', '|', 'Disfrutando', 'del', 'sol'] });
    assert(envSocial2.sentMessages.length === 1);
    assert(Buffer.isBuffer(envSocial2.sentMessages[0].content.image));
    assert(envSocial2.reactions.includes('📱'));
    console.log('  ✅ .fagsocial verificado (resolviendo nombre en lugar de ID).');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LOS 12 NUEVOS COMANDOS PASARON CON 100% DE ÉXITO!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});


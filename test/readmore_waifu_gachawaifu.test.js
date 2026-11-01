'use strict';

const assert = require('assert');
const readmoreCmd = require('../commands/tools/readmore');
const gachawaifuCmd = require('../commands/tools/gachawaifu');
const waifuCmd = require('../commands/media/waifu');
const nsfwManager = require('../lib/nsfw');

function createMockEnv(customSender = '18095551234@s.whatsapp.net', isGroup = false) {
    const sentMessages = [];
    const reactions = [];
    const jid = isGroup ? '123456789-group@g.us' : customSender;

    const sock = {
        sendMessage: async (dest, content, opts) => {
            sentMessages.push({ dest, content, opts });
            return { key: { id: 'MOCK_MSG_' + Date.now(), remoteJid: dest } };
        }
    };

    const m = {
        chat: jid,
        sender: customSender,
        key: { remoteJid: jid, participant: isGroup ? customSender : undefined },
        react: async (emoji) => { reactions.push(emoji); }
    };

    return { sock, m, sentMessages, reactions };
}

async function runTests() {
    console.log('🧪 Iniciando verificación de readmore, gachawaifu y waifu...');

    // ── 1. TEST READMORE ──
    console.log('  Testing readmore.js...');
    // Verificar que alias no choquen
    assert(readmoreCmd.name === 'readmore');
    assert(Array.isArray(readmoreCmd.alias));

    // Test con separador pipe
    const envRm1 = createMockEnv();
    await readmoreCmd.execute({
        sock: envRm1.sock,
        m: envRm1.m,
        args: ['¿Sabías', 'qué?', '|', '¡Caíste', 'en', 'la', 'broma!'],
        text: '¿Sabías qué? | ¡Caíste en la broma!'
    });

    assert.strictEqual(envRm1.sentMessages.length, 1);
    const sentText = envRm1.sentMessages[0].content.text;
    assert(sentText.startsWith('¿Sabías qué?'));
    assert(sentText.includes('¡Caíste en la broma!'));
    // Verificar que contiene 4001 caracteres LRM y 4001 caracteres ZWSP
    const lrmCount = (sentText.match(/\u200E/g) || []).length;
    assert.strictEqual(lrmCount, 4001, `Debe contener exactamente 4001 caracteres LRM, pero tiene ${lrmCount}`);
    const zwspCount = (sentText.match(/\u200B/g) || []).length;
    assert.strictEqual(zwspCount, 4001, `Debe contener exactamente 4001 caracteres ZWSP, pero tiene ${zwspCount}`);
    // Verificar que NO contiene Hangul Filler
    assert(!sentText.includes('\u3164'), 'No debe contener Hangul Filler');

    // Test con mensaje citado (quoted)
    const envRmQuoted = createMockEnv();
    envRmQuoted.m.quoted = { text: 'Este es el texto del mensaje citado que debe quedar oculto' };
    await readmoreCmd.execute({
        sock: envRmQuoted.sock,
        m: envRmQuoted.m,
        args: ['Atención', 'spoilers'],
        text: 'Atención spoilers'
    });
    assert.strictEqual(envRmQuoted.sentMessages.length, 1);
    const quotedSentText = envRmQuoted.sentMessages[0].content.text;
    assert(quotedSentText.startsWith('Atención spoilers'));
    assert(quotedSentText.includes('Este es el texto del mensaje citado que debe quedar oculto'));

    // Test con delimitador doble barra //
    const envRmSlash = createMockEnv();
    await readmoreCmd.execute({
        sock: envRmSlash.sock,
        m: envRmSlash.m,
        args: ['Alerta', '//', 'Secreto', 'revelado'],
        text: 'Alerta // Secreto revelado'
    });
    assert.strictEqual(envRmSlash.sentMessages.length, 1);
    const slashSentText = envRmSlash.sentMessages[0].content.text;
    assert(slashSentText.startsWith('Alerta'));
    assert(slashSentText.includes('Secreto revelado'));

    console.log('  ✅ .readmore verificado: 4001 LRM + 4001 ZWSP puros, sin fillers, soporta quoted y //.');

    // ── 2. TEST GACHAWAIFU ──
    console.log('  Testing gachawaifu.js...');
    // Verificar que 'waifu' NO está en alias
    assert(!gachawaifuCmd.alias.includes('waifu'), "gachawaifu no debe tener 'waifu' como alias para evitar colisiones");
    
    const envGacha = createMockEnv();
    await gachawaifuCmd.execute({
        sock: envGacha.sock,
        m: envGacha.m,
        args: []
    });

    assert.strictEqual(envGacha.sentMessages.length, 1);
    const gachaMsg = envGacha.sentMessages[0].content;
    assert(Buffer.isBuffer(gachaMsg.image), 'Debe enviar un buffer de imagen del personaje');
    assert(gachaMsg.caption.includes('GACHA ANIME VIRTUAL'));
    assert(gachaMsg.caption.includes('.gacha claim'));
    console.log('  ✅ .gachawaifu verificado: imagen en buffer enviada y sin colisión de alias.');

    // ── 3. TEST WAIFU (+18) ──
    console.log('  Testing waifu.js...');
    assert.strictEqual(waifuCmd.name, 'waifu');
    assert(Array.isArray(waifuCmd.CURATED_WAIFUS) && waifuCmd.CURATED_WAIFUS.length >= 5);

    // Test en grupo con NSFW apagado -> Debe rechazar
    const envGroupOff = createMockEnv('18095551234@s.whatsapp.net', true);
    nsfwManager.disableNsfw(envGroupOff.m.chat);
    await waifuCmd.execute({ sock: envGroupOff.sock, m: envGroupOff.m });
    assert.strictEqual(envGroupOff.sentMessages.length, 1);
    assert(envGroupOff.sentMessages[0].content.text.includes('Activa NSFW primero'));

    // Test en privado o grupo con NSFW encendido -> Envía imagen
    const envPrivate = createMockEnv('18095551234@s.whatsapp.net', false);
    await waifuCmd.execute({ sock: envPrivate.sock, m: envPrivate.m });
    // Debe haber enviado el mensaje de buscando + la imagen (o la imagen directamente)
    const imgMsg = envPrivate.sentMessages.find(msg => msg.content.image !== undefined);
    assert(imgMsg, 'Debe haber enviado un mensaje con imagen waifu');
    assert(imgMsg.content.caption.includes('WAIFU +18') || imgMsg.content.caption.includes('Unknown Codex'));
    console.log('  ✅ .waifu verificado: control NSFW funcional y fallback garantizado.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE VERIFICACIÓN LOCAL PASARON AL 100%!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});


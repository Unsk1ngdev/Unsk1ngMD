'use strict';

const assert = require('assert');

// Cargar nuevos comandos
const morseCmd = require('../commands/tools/morse');
const styleteksCmd = require('../commands/tools/styleteks');
const readmoreCmd = require('../commands/tools/readmore');
const soulmatchCmd = require('../commands/tools/soulmatch');
const rateCmd = require('../commands/tools/rate');
const tempmailCmd = require('../commands/tools/tempmail');
const nulisCmd = require('../commands/tools/nulis');
const grammarlyCmd = require('../commands/tools/grammarly');
const invoicemakerCmd = require('../commands/tools/invoicemaker');
const gachawaifuCmd = require('../commands/tools/gachawaifu');
const todCmd = require('../commands/tools/tod');
const sulapCmd = require('../commands/tools/sulap');
const winkCmd = require('../commands/tools/wink');

console.log('🧪 [TEST] Iniciando pruebas unitarias de los 13 comandos adicionales...');

const createMockEnv = (options = {}) => {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        user: { id: '18494509905:1@s.whatsapp.net', jid: '18494509905@s.whatsapp.net' },
        sendMessage: async (jid, content, extra) => {
            sentMessages.push({ jid, content, extra });
            return { key: { id: 'mock-msg-' + Date.now() } };
        },
        groupMetadata: async (jid) => ({
            id: jid,
            participants: [
                { id: '18494509905@s.whatsapp.net', admin: 'superadmin' },
                { id: '18490001111@s.whatsapp.net', admin: 'admin' },
                { id: '18490002222@s.whatsapp.net', admin: null }
            ]
        }),
        groupParticipantsUpdate: async () => [{ status: '200' }]
    };

    const m = {
        chat: options.chat || '120363407455196754@g.us',
        sender: options.sender || '18490001111@s.whatsapp.net',
        type: 'conversation',
        isGroup: options.isGroup !== undefined ? options.isGroup : true,
        key: { remoteJid: options.chat || '120363407455196754@g.us' },
        pushName: options.pushName || 'TesterUser',
        quoted: options.quoted || null,
        mentionedJid: options.mentionedJid || [],
        react: async (emoji) => {
            reactions.push(emoji);
        }
    };

    return { sock, m, sentMessages, reactions };
};

(async () => {
    // 1. Morse
    console.log('  Testing .morse...');
    const envMorse1 = createMockEnv();
    await morseCmd.execute({ sock: envMorse1.sock, m: envMorse1.m, args: ['HOLA'], text: 'HOLA' });
    assert(envMorse1.sentMessages.length > 0);
    assert(envMorse1.sentMessages[0].content.text.includes('.... --- .-.. .-'));

    const envMorse2 = createMockEnv();
    await morseCmd.execute({ sock: envMorse2.sock, m: envMorse2.m, args: ['.... --- .-.. .-'], text: '.... --- .-.. .-' });
    assert(envMorse2.sentMessages.length > 0);
    assert(envMorse2.sentMessages[0].content.text.includes('HOLA'));
    console.log('  ✅ .morse codifica y decodifica correctamente.');

    // 2. Styleteks
    console.log('  Testing .styleteks...');
    const envStyle = createMockEnv();
    await styleteksCmd.execute({ sock: envStyle.sock, m: envStyle.m, args: ['Hola'], text: 'Hola' });
    assert(envStyle.sentMessages.length > 0);
    assert(envStyle.sentMessages[0].content.text.includes('Cursiva'));
    console.log('  ✅ .styleteks transforma a múltiples estilos tipográficos.');

    // 3. Readmore
    console.log('  Testing .readmore...');
    const envRm = createMockEnv();
    await readmoreCmd.execute({ sock: envRm.sock, m: envRm.m, args: ['Visible', '|', 'Oculto'], text: 'Visible | Oculto' });
    assert(envRm.sentMessages.length > 0);
    assert(envRm.sentMessages[0].content.text.includes('Visible'));
    assert(envRm.sentMessages[0].content.text.includes('Oculto'));
    console.log('  ✅ .readmore genera separadores de texto oculto.');

    // 4. Soulmatch
    console.log('  Testing .soulmatch...');
    const envSoul = createMockEnv();
    await soulmatchCmd.execute({ sock: envSoul.sock, m: envSoul.m, args: ['Carlos', '|', 'Maria'], text: 'Carlos | Maria' });
    assert(envSoul.sentMessages.length > 0);
    assert(envSoul.sentMessages[0].content.text.includes('AFINIDAD CÓSMICA'));
    assert(envSoul.sentMessages[0].content.text.includes('%'));
    console.log('  ✅ .soulmatch calcula compatibilidad y afinidad.');

    // 5. Rate
    console.log('  Testing .rate...');
    const envRate = createMockEnv();
    await rateCmd.execute({ sock: envRate.sock, m: envRate.m, args: ['mi', 'foto'], text: 'mi foto' });
    assert(envRate.sentMessages.length > 0);
    assert(envRate.sentMessages[0].content.text.includes('/ 10'));
    console.log('  ✅ .rate califica y genera dictamen con puntuación.');

    // 6. Tempmail
    console.log('  Testing .tempmail...');
    const envMail = createMockEnv();
    await tempmailCmd.execute({ sock: envMail.sock, m: envMail.m, args: ['nuevo'] });
    assert(envMail.sentMessages.length > 0);
    assert(envMail.sentMessages[0].content.text.includes('@'));

    const envInbox = createMockEnv();
    await tempmailCmd.execute({ sock: envInbox.sock, m: envInbox.m, args: ['inbox'] });
    assert(envInbox.sentMessages.length > 0);
    console.log('  ✅ .tempmail genera buzón temporal y consulta inbox.');

    // 7. Nulis
    console.log('  Testing .nulis...');
    const envNulis = createMockEnv();
    await nulisCmd.execute({ sock: envNulis.sock, m: envNulis.m, args: ['Prueba', 'de', 'escritura'], text: 'Prueba de escritura' });
    assert(envNulis.sentMessages.length > 0);
    assert(Buffer.isBuffer(envNulis.sentMessages[0].content.image));
    console.log('  ✅ .nulis genera imagen PNG de cuaderno rayado escrita a mano.');

    // 8. Grammarly
    console.log('  Testing .grammarly...');
    const envGrammar = createMockEnv();
    const testText = 'En conclusión, es importante destacar que la inteligencia artificial desempeña un papel crucial en un mundo cada vez más tecnológico. Por lo tanto, ofrece una perspectiva única.';
    await grammarlyCmd.execute({ sock: envGrammar.sock, m: envGrammar.m, args: testText.split(' '), text: testText });
    assert(envGrammar.sentMessages.length >= 2);
    assert(envGrammar.sentMessages.some(m => m.content.text.includes('Probabilidad de IA')));
    console.log('  ✅ .grammarly detecta patrones de IA con estilometría.');

    // 9. Invoicemaker
    console.log('  Testing .invoicemaker...');
    const envInvoice = createMockEnv();
    await invoicemakerCmd.execute({ sock: envInvoice.sock, m: envInvoice.m, args: ['Juan', 'Perez', '|', 'Pizza', '-', '20'], text: 'Juan Perez | Pizza - 20' });
    assert(envInvoice.sentMessages.length > 0);
    assert(Buffer.isBuffer(envInvoice.sentMessages[0].content.image));
    console.log('  ✅ .invoicemaker genera factura oficial en PNG con cálculos.');

    // 10. Gachawaifu
    console.log('  Testing .gachawaifu...');
    const envGacha = createMockEnv();
    await gachawaifuCmd.execute({ sock: envGacha.sock, m: envGacha.m, args: [] });
    assert(envGacha.sentMessages.length > 0);

    const envClaim = createMockEnv();
    await gachawaifuCmd.execute({ sock: envClaim.sock, m: envClaim.m, args: ['claim'] });
    assert(envClaim.sentMessages.length > 0);
    assert(envClaim.sentMessages[0].content.text.includes('NUEVA ADOPCIÓN VIRTUAL'));

    const envHarem = createMockEnv();
    await gachawaifuCmd.execute({ sock: envHarem.sock, m: envHarem.m, args: ['harem'] });
    assert(envHarem.sentMessages.length > 0);
    assert(envHarem.sentMessages[0].content.text.includes('COLECCIÓN'));
    console.log('  ✅ .gachawaifu maneja tiradas, adopciones y colecciones.');

    // 11. Tod (Girar la botella)
    console.log('  Testing .tod...');
    const envTod1 = createMockEnv();
    await todCmd.execute({ sock: envTod1.sock, m: envTod1.m, args: ['verdad'] });
    assert(envTod1.sentMessages.length > 0);
    assert(envTod1.sentMessages[0].content.text.includes('VERDAD OBLIGATORIA'));

    const envTod2 = createMockEnv();
    await todCmd.execute({ sock: envTod2.sock, m: envTod2.m, args: ['reto'] });
    assert(envTod2.sentMessages.length > 0);
    assert(envTod2.sentMessages[0].content.text.includes('RETO EXTREMO'));

    const envTod3 = createMockEnv();
    await todCmd.execute({ sock: envTod3.sock, m: envTod3.m, args: [] });
    assert(envTod3.sentMessages.length > 0);
    assert(envTod3.sentMessages[0].content.text.includes('GIRA LA BOTELLA'));
    console.log('  ✅ .tod ejecuta botella, preguntas y retos grupales.');

    // 12. Sulap
    console.log('  Testing .sulap...');
    const envSulapFail = createMockEnv({ isGroup: true, sender: '18499999999@s.whatsapp.net' });
    await sulapCmd.execute({ sock: envSulapFail.sock, m: envSulapFail.m, isOwner: false, groupAdmins: [] });
    assert(envSulapFail.sentMessages.length > 0);
    assert(envSulapFail.sentMessages[0].content.text.includes('Administrador'));

    const envSulapAdmin = createMockEnv({ mentionedJid: ['18490002222@s.whatsapp.net'] });
    await sulapCmd.execute({ sock: envSulapAdmin.sock, m: envSulapAdmin.m, isOwner: true, isBotAdmin: true, groupAdmins: ['18490001111@s.whatsapp.net'] });
    assert(envSulapAdmin.sentMessages.length > 0);
    assert(envSulapAdmin.sentMessages[0].content.text.includes('EL GRAN TRUCO DE MAGIA'));
    console.log('  ✅ .sulap valida administradores y ejecuta animación mágica.');

    // 13. Wink
    console.log('  Testing .wink...');
    const envWink = createMockEnv();
    await winkCmd.execute({ sock: envWink.sock, m: envWink.m });
    assert(envWink.sentMessages.length > 0);
    assert(envWink.sentMessages[0].content.text.includes('MEJORADOR DE VIDEO'));
    console.log('  ✅ .wink valida entrada y configuraciones multimedia.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LOS 13 NUEVOS COMANDOS PASARON EXITOSAMENTE!');
})();

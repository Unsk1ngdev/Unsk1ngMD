const assert = require('assert');
const emailCmd = require('../commands/tools/email');
const usuarioCmd = require('../commands/tools/usuario');
const osintCmd = require('../commands/tools/osint');

async function testTools() {
    console.log('🧪 [TEST] Iniciando pruebas de herramientas OSINT (.email, .usuario, .osint)...');

    // 1. Validar metadata de comandos
    assert.strictEqual(emailCmd.name, 'email');
    assert.ok(emailCmd.alias.includes('mail'));
    assert.strictEqual(usuarioCmd.name, 'usuario');
    assert.ok(usuarioCmd.alias.includes('sherlock'));
    assert.strictEqual(osintCmd.name, 'osint');
    assert.ok(osintCmd.alias.includes('phoneinfoga'));
    assert.strictEqual(osintCmd.premiumOnly, true);
    console.log('  ✅ Prueba 1 superada: Metadata y aliases definidos correctamente.');

    // 2. Probar .email validación de formato incorrecto
    let lastReply = '';
    const mockSock = {
        sendMessage: async (jid, content) => {
            lastReply = content.text || content.caption || '';
            return { key: { id: 'msg_1' } };
        },
        onWhatsApp: async (targetJid) => {
            return [{ exists: true, jid: targetJid }];
        },
        fetchStatus: async () => ({ status: 'Testing status', setAt: new Date() }),
        profilePictureUrl: async () => null,
        getBusinessProfile: async () => null
    };
    const mockMsg = {
        chat: 'test@s.whatsapp.net',
        sender: '18494509905@s.whatsapp.net',
        react: async () => {}
    };

    await emailCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['correo_invalido']
    });
    assert.ok(lastReply.includes('correo electrónico válido'));
    console.log('  ✅ Prueba 2 superada: Rechazo correcto de emails malformados.');

    // 3. Probar .usuario validación de formato incorrecto
    await usuarioCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['a'] // demasiado corto
    });
    assert.ok(lastReply.includes('nombre de usuario válido'));
    console.log('  ✅ Prueba 3 superada: Rechazo correcto de usernames inválidos.');

    // 4. Probar .osint num rechazo con número inválido / corto
    lastReply = '';
    await osintCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['num', '123'],
        text: 'num 123',
        isOwner: true
    });
    assert.ok(lastReply.includes('inválido') || lastReply.includes('al menos 7 dígitos'));
    console.log('  ✅ Prueba 4 superada: Rechazo correcto de números telefónicos truncados/inválidos.');

    // 5. Probar .osint num (Phone Intelligence mejorado estilo PhoneInfoga)
    lastReply = '';
    await osintCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['num', '+18494509905'],
        text: 'num +18494509905',
        isOwner: true
    });
    assert.ok(lastReply.includes('OSINT — PHONE INTELLIGENCE'), 'Debe incluir título de Phone Intelligence');
    assert.ok(lastReply.includes('Sin código país:'), 'Debe incluir formato sin código de país');
    assert.ok(lastReply.includes('8494509905'), 'Debe contener los dígitos nacionales limpios');
    assert.ok(lastReply.includes('Titular (CNAM):'), 'Debe incluir sección de Titular/CNAM');
    assert.ok(lastReply.includes('Riesgo / Spam:'), 'Debe incluir evaluación de riesgo/spam');
    assert.ok(lastReply.includes('INVESTIGACIÓN MANUAL (DORKS)'), 'Debe incluir bloque de Dorks estilo PhoneInfoga');
    assert.ok(lastReply.includes('google.com/search?q='), 'Debe incluir Dork de Google');
    assert.ok(lastReply.includes('truecaller.com/search/'), 'Debe incluir link a TrueCaller');
    assert.ok(lastReply.includes('whitepages.com/phone/'), 'Debe incluir link a WhitePages');
    assert.ok(lastReply.includes('spokeo.com/phone-search/'), 'Debe incluir link a Spokeo');
    console.log('  ✅ Prueba 5 superada: Extracción PhoneInfoga, Dorks, CNAM y Spam score validados.');

    // 6. Probar autodetección de número sin subcomando explícito (.osint +18494509905)
    lastReply = '';
    await osintCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['+18494509905'],
        text: '+18494509905',
        isOwner: true
    });
    assert.ok(lastReply.includes('OSINT — PHONE INTELLIGENCE'), 'La autodetección debe enrutar al módulo de Phone Intelligence');
    assert.ok(lastReply.includes('8494509905'));
    console.log('  ✅ Prueba 6 superada: Autodetección de número telefónico sin subcomando explícito.');

    console.log('🎉 [TEST] ¡Pruebas de herramientas OSINT completadas con éxito!');
}

testTools().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});


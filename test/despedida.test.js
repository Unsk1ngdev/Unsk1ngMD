const assert = require('assert');
const despedidaManager = require('../lib/despedida');
const despedidaCmd = require('../commands/group/despedida');

async function runTests() {
    console.log('🧪 [TEST] Iniciando pruebas de Despedida...');

    const testGroup = '120363999999999999@g.us';

    // 1. Probar formatMessage
    const template = 'Adiós {usuario} de {grupo}! Quedan {miembros} miembros.';
    const formatted = despedidaManager.formatMessage(template, {
        userTag: '584160000000',
        groupName: 'Mi Grupo Pro',
        memberCount: 42,
        groupDesc: 'Reglas del grupo'
    });
    assert.strictEqual(formatted, 'Adiós @584160000000 de Mi Grupo Pro! Quedan 42 miembros.');
    console.log('  ✅ Prueba 1 superada: Formateo de variables dinámicas ({usuario}, {grupo}, {miembros}).');

    // 2. Probar enable y getConfig
    despedidaManager.enable(testGroup);
    const configEnabled = despedidaManager.getConfig(testGroup);
    assert.strictEqual(configEnabled.activo, true);
    assert.ok(configEnabled.mensaje.length > 0);
    console.log('  ✅ Prueba 2 superada: Activación y recuperación de configuración.');

    // 3. Probar setConfig personalizado
    despedidaManager.setConfig(testGroup, 'Hasta la vista {usuario}!');
    const configCustom = despedidaManager.getConfig(testGroup);
    assert.strictEqual(configCustom.mensaje, 'Hasta la vista {usuario}!');
    assert.strictEqual(configCustom.activo, true);
    console.log('  ✅ Prueba 3 superada: Asignación de mensaje personalizado.');

    // 4. Probar reset
    despedidaManager.reset(testGroup);
    const configReset = despedidaManager.getConfig(testGroup);
    assert.strictEqual(configReset.mensaje, despedidaManager.DEFAULT_DESPEDIDA);
    console.log('  ✅ Prueba 4 superada: Restauración a plantilla por defecto.');

    // 5. Probar disable
    despedidaManager.disable(testGroup);
    assert.strictEqual(despedidaManager.isEnabled(testGroup), false);
    console.log('  ✅ Prueba 5 superada: Desactivación correcta.');

    // 6. Probar comando .despedida interactivo
    let lastReply = '';
    let lastSent = null;

    const mockSock = {
        groupMetadata: async () => ({
            id: testGroup,
            subject: 'Grupo de Prueba',
            participants: [{ id: '584160000000@s.whatsapp.net', admin: 'admin' }]
        }),
        profilePictureUrl: async () => 'https://example.com/pfp.jpg',
        sendMessage: async (jid, content) => {
            lastSent = content;
            return { key: { id: 'msg_1' } };
        }
    };

    const mockMsg = {
        chat: testGroup,
        isGroup: true,
        sender: '584160000000@s.whatsapp.net',
        reply: async (txt) => {
            lastReply = txt;
        }
    };

    // Caso 6a: Panel sin argumentos
    await despedidaCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: [],
        text: '',
        isAdmin: true,
        isOwner: true,
        prefix: '.'
    });
    assert.ok(lastReply.includes('DESPEDIDA DE GRUPO'));
    assert.ok(lastReply.includes('Opciones de configuración'));
    console.log('  ✅ Prueba 6a superada: Panel interactivo al ejecutar .despedida.');

    // Caso 6b: .despedida test
    await despedidaCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['test'],
        text: 'test',
        isAdmin: true,
        isOwner: true,
        prefix: '.'
    });
    assert.ok(lastSent);
    assert.ok(lastSent.caption.includes('[SIMULACIÓN / PRUEBA DE DESPEDIDA]'));
    assert.ok(lastSent.mentions.includes('584160000000@s.whatsapp.net'));
    console.log('  ✅ Prueba 6b superada: Modo simulación .despedida test con imagen y mención.');

    // Caso 6c: .despedida on
    await despedidaCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['on'],
        text: 'on',
        isAdmin: true,
        isOwner: true,
        prefix: '.'
    });
    assert.ok(lastReply.includes('ACTIVADOS 🟢'));
    console.log('  ✅ Prueba 6c superada: .despedida on.');

    // Caso 6d: .despedida off
    await despedidaCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['off'],
        text: 'off',
        isAdmin: true,
        isOwner: true,
        prefix: '.'
    });
    assert.ok(lastReply.includes('DESACTIVADOS ❌'));
    console.log('  ✅ Prueba 6d superada: .despedida off.');

    // Limpiar grupo de pruebas
    const data = despedidaManager.getAll();
    delete data[testGroup];
    require('fs-extra').writeJsonSync(require('path').join(process.cwd(), 'despedida.json'), data, { spaces: 2 });

    console.log('🎉 [TEST] ¡Todas las pruebas de Despedida pasaron exitosamente!');
}

runTests().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});


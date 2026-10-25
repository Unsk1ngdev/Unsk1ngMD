const assert = require('assert');
const emailCmd = require('../commands/tools/email');
const usuarioCmd = require('../commands/tools/usuario');

async function testTools() {
    console.log('🧪 [TEST] Iniciando pruebas de .email y .usuario...');

    // 1. Validar metadata de comandos
    assert.strictEqual(emailCmd.name, 'email');
    assert.ok(emailCmd.alias.includes('mail'));
    assert.strictEqual(usuarioCmd.name, 'usuario');
    assert.ok(usuarioCmd.alias.includes('sherlock'));
    console.log('  ✅ Prueba 1 superada: Metadata y aliases definidos correctamente.');

    // 2. Probar .email validación de formato incorrecto
    let lastReply = '';
    const mockSock = {
        sendMessage: async (jid, content) => {
            lastReply = content.text || '';
            return { key: { id: 'msg_1' } };
        }
    };
    const mockMsg = {
        chat: 'test@s.whatsapp.net',
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

    console.log('🎉 [TEST] ¡Pruebas de .email y .usuario completadas con éxito!');
}

testTools().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});


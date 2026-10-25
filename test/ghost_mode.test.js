'use strict';

const assert = require('assert');
const ghostCmd = require('../commands/tools/ghost');

console.log('🧪 [TEST] Iniciando pruebas de .ghost (modo indefinido sin timer)...');

// 1. Verificación de metadata
{
    assert.strictEqual(ghostCmd.name, 'ghost');
    assert(Array.isArray(ghostCmd.alias), 'alias debe ser array');
    assert(ghostCmd.alias.includes('fantasma'), 'alias debe incluir fantasma');
    assert(ghostCmd.alias.includes('ghostmode'), 'alias debe incluir ghostmode');
    console.log('  ✅ Prueba 1 superada: Metadata y aliases de .ghost configurados correctamente.');
}

// 2. Activación y desactivación indefinida (sin timer automático)
async function testGhostExecution() {
    const sentMessages = [];
    let presenceStatus = null;

    const mockSock = {
        sendMessage: async (jid, content) => {
            sentMessages.push({ jid, content });
            return { key: { id: 'msg_ghost' } };
        },
        sendPresenceUpdate: async (status) => {
            presenceStatus = status;
        }
    };

    const mockMsgOwner = {
        chat: '18494509905@s.whatsapp.net',
        sender: '18494509905@s.whatsapp.net',
        isGroup: false,
        key: { remoteJid: '18494509905@s.whatsapp.net' }
    };

    // Asegurar estado limpio inicial
    global.ghostMode = false;
    if (global.ghostTimer) clearTimeout(global.ghostTimer);
    global.ghostTimer = null;

    // 2a. Activar .ghost
    await ghostCmd.execute({
        sock: mockSock,
        m: mockMsgOwner,
        args: [],
        isOwner: true,
        prefix: '.'
    });

    assert.strictEqual(global.ghostMode, true, 'global.ghostMode debe ser true tras activar');
    assert.strictEqual(global.ghostTimer, null, 'global.ghostTimer debe ser null (sin temporizador de expiración)');
    assert.strictEqual(presenceStatus, 'unavailable', 'Debe enviar presencia unavailable a WhatsApp');

    const lastMsgActivate = sentMessages[sentMessages.length - 1];
    assert(lastMsgActivate.content.text.includes('MODO GHOST ACTIVADO'), 'Debe confirmar activación');
    assert(lastMsgActivate.content.text.includes('Indefinida'), 'Debe indicar duración indefinida');

    // 2b. Intentar activar de nuevo cuando ya está activo
    await ghostCmd.execute({
        sock: mockSock,
        m: mockMsgOwner,
        args: [],
        isOwner: true,
        prefix: '.'
    });

    const lastMsgDuplicate = sentMessages[sentMessages.length - 1];
    assert(lastMsgDuplicate.content.text.includes('ya está activo'), 'Debe advertir que ya está activo');
    assert.strictEqual(global.ghostMode, true, 'Debe permanecer activo');
    assert.strictEqual(global.ghostTimer, null, 'Debe seguir sin timer');

    // 2c. Desactivar con .ghost stop
    await ghostCmd.execute({
        sock: mockSock,
        m: mockMsgOwner,
        args: ['stop'],
        isOwner: true,
        prefix: '.'
    });

    assert.strictEqual(global.ghostMode, false, 'global.ghostMode debe ser false tras stop');
    assert.strictEqual(global.ghostTimer, null, 'global.ghostTimer debe ser null');
    assert.strictEqual(presenceStatus, 'available', 'Debe enviar presencia available a WhatsApp');

    const lastMsgStop = sentMessages[sentMessages.length - 1];
    assert(lastMsgStop.content.text.includes('MODO GHOST DESACTIVADO'), 'Debe confirmar desactivación');

    // 2d. Intentar detener de nuevo cuando ya está inactivo
    await ghostCmd.execute({
        sock: mockSock,
        m: mockMsgOwner,
        args: ['stop'],
        isOwner: true,
        prefix: '.'
    });

    const lastMsgAlreadyOff = sentMessages[sentMessages.length - 1];
    assert(lastMsgAlreadyOff.content.text.includes('no está activo'), 'Debe indicar que no está activo');

    console.log('  ✅ Prueba 2 superada: .ghost opera indefinidamente sin timer hasta ejecutar .ghost stop.');
}

testGhostExecution().then(() => {
    console.log('🎉 [TEST] ¡Todas las pruebas de .ghost indefinido pasaron exitosamente!');
}).catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});


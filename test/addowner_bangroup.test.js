'use strict';

const assert = require('assert');
const addownerCmd = require('../commands/system/addowner');
const bangroupCmd = require('../commands/system/bangroup');
const unbangroupCmd = require('../commands/system/unbangroup');
const bannedManager = require('../lib/banned');
const database = require('../lib/database');

console.log('🧪 [TEST] Iniciando pruebas de addowner, bangroup y unbangroup...');

// 1. Verificación de addowner (reemplazo y compatibilidad de boss)
{
    assert.strictEqual(addownerCmd.name, 'addowner', 'Nombre debe ser addowner');
    assert(Array.isArray(addownerCmd.alias), 'alias debe ser un array');
    assert(addownerCmd.alias.includes('boss'), 'alias debe incluir boss para compatibilidad');
    assert(addownerCmd.alias.includes('setowner'), 'alias debe incluir setowner');
    assert(addownerCmd.alias.includes('delowner'), 'alias debe incluir delowner');
    assert.strictEqual(addownerCmd.ownerOnly, true, 'debe ser ownerOnly');
    console.log('  ✅ Prueba 1 superada: Metadata y aliases de addowner (.boss) configurados correctamente.');
}

// 2. Verificación de metadata de bangroup y unbangroup
{
    assert.strictEqual(bangroupCmd.name, 'bangroup', 'Nombre debe ser bangroup');
    assert(Array.isArray(bangroupCmd.alias), 'alias de bangroup debe ser array');
    assert(bangroupCmd.alias.includes('bangp'), 'alias debe incluir bangp');
    assert(bangroupCmd.alias.includes('baneargrupo'), 'alias debe incluir baneargrupo');
    assert.strictEqual(bangroupCmd.ownerOnly, true, 'bangroup debe ser ownerOnly');

    assert.strictEqual(unbangroupCmd.name, 'unbangroup', 'Nombre debe ser unbangroup');
    assert(Array.isArray(unbangroupCmd.alias), 'alias de unbangroup debe ser array');
    assert(unbangroupCmd.alias.includes('unbangp'), 'alias debe incluir unbangp');
    assert(unbangroupCmd.alias.includes('desbaneargrupo'), 'alias debe incluir desbaneargrupo');
    assert.strictEqual(unbangroupCmd.ownerOnly, true, 'unbangroup debe ser ownerOnly');

    console.log('  ✅ Prueba 2 superada: Metadata y aliases de bangroup y unbangroup configurados correctamente.');
}

// 3. Verificación funcional de baneo y desbaneo de grupos en bannedManager
{
    const testGroupJid = '120363999999999999@g.us';

    // Asegurar estado limpio inicial
    bannedManager.unbanGroup(testGroupJid);
    assert.strictEqual(bannedManager.isGroupBanned(testGroupJid), false, 'El grupo no debe estar baneado inicialmente');

    // Banear grupo
    const banResult = bannedManager.banGroup(testGroupJid, 'Grupo Test', 'Prueba automatizada');
    assert.strictEqual(banResult, true, 'banGroup debe devolver true');
    assert.strictEqual(bannedManager.isGroupBanned(testGroupJid), true, 'El grupo debe figurar como baneado');

    // Reintentar banear mismo grupo debe retornar false (evitar duplicados)
    assert.strictEqual(bannedManager.banGroup(testGroupJid), false, 'No debe permitir duplicar el baneo');

    // Listar grupos baneados
    const list = bannedManager.listGroups();
    assert(list.some(g => g.jid === testGroupJid), 'El grupo debe figurar en listGroups()');

    // Desbanear grupo
    const unbanResult = bannedManager.unbanGroup(testGroupJid);
    assert.strictEqual(unbanResult, true, 'unbanGroup debe devolver true al remover');
    assert.strictEqual(bannedManager.isGroupBanned(testGroupJid), false, 'El grupo ya no debe estar baneado');

    console.log('  ✅ Prueba 3 superada: bannedManager gestiona correctamente banGroup y unbanGroup de forma persistente.');
}

// 4. Verificación de ejecución de comandos bangroup y unbangroup
async function testCommandsExecution() {
    const testGroupJid = '120363888888888888@g.us';
    const sentMessages = [];

    const mockSock = {
        sendMessage: async (jid, content) => {
            sentMessages.push({ jid, content });
            return { key: { id: 'msg_test' } };
        }
    };

    const mockMsg = {
        chat: testGroupJid,
        isGroup: true,
        sender: '18494509905@s.whatsapp.net',
        react: async () => {}
    };

    // 4a. Ejecutar .bangroup en el grupo
    await bangroupCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['Spam', 'indebido'],
        text: 'Spam indebido',
        isOwner: true,
        prefix: '.',
        groupMetadata: { subject: 'Grupo Oficial de Pruebas' }
    });

    assert(bannedManager.isGroupBanned(testGroupJid), 'El grupo debe quedar baneado tras ejecutar bangroup');
    const lastMsgBan = sentMessages[sentMessages.length - 1];
    assert(lastMsgBan.content.text.includes('GRUPO BANEADO'), 'Debe enviar aviso de grupo baneado');

    // 4b. Ejecutar .unbangroup en el grupo
    await unbangroupCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: [],
        isOwner: true,
        prefix: '.',
        groupMetadata: { subject: 'Grupo Oficial de Pruebas' }
    });

    assert.strictEqual(bannedManager.isGroupBanned(testGroupJid), false, 'El grupo debe quedar desbaneado tras ejecutar unbangroup');
    const lastMsgUnban = sentMessages[sentMessages.length - 1];
    assert(lastMsgUnban.content.text.includes('GRUPO DESBANEADO'), 'Debe enviar aviso de grupo desbaneado');

    console.log('  ✅ Prueba 4 superada: Ejecución de bangroup y unbangroup interactúa y notifica correctamente.');
}

testCommandsExecution().then(() => {
    console.log('🎉 [TEST] ¡Todas las pruebas de addowner, bangroup y unbangroup pasaron exitosamente!');
}).catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});


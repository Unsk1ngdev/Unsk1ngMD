'use strict';

const assert = require('assert');
const reportarCmd = require('../commands/tools/reportar');
const recentMessagesManager = require('../lib/recentMessages');
const connectionManager = require('../lib/connectionManager');
const config = require('../config');

console.log('🧪 [TEST] Iniciando pruebas de .reporta y resiliencia de terminal/sockets...');

// 1. Verificación de metadata y aliases de .reporta
{
    assert.strictEqual(reportarCmd.name, 'reportar');
    assert(Array.isArray(reportarCmd.alias), 'alias debe ser un array');
    assert(reportarCmd.alias.includes('reporta'), 'alias debe incluir "reporta"');
    assert(reportarCmd.alias.includes('report'), 'alias debe incluir "report"');
    assert(reportarCmd.alias.includes('spam'), 'alias debe incluir "spam"');
    assert.strictEqual(reportarCmd.ownerOnly, true, 'debe ser ownerOnly');
    console.log('  ✅ Prueba 1 superada: Metadata y aliases de .reporta configurados correctamente.');
}

// 2. Verificación de enrutamiento al Owner (+1) en ejecución de .reporta
async function runAsyncTests() {
    const targetOwnerExpected = '18494509905@s.whatsapp.net';
    const sentMessages = [];

    const mockSock = {
        generateMessageTag: () => 'tag_test_123',
        query: async () => ({ status: 200 }),
        sendMessage: async (jid, content) => {
            sentMessages.push({ jid, content });
            return { key: { id: 'msg_123' } };
        }
    };

    const mockMsg = {
        sender: '584160666286@s.whatsapp.net', // Ejecutado desde otro número (ej: el segundo owner o sub-bot)
        chat: '12036302@g.us',
        react: async () => {},
        mentionedJid: ['18095551234@s.whatsapp.net'],
        fromMe: false
    };

    // Ejecutar el comando
    await reportarCmd.execute({
        sock: mockSock,
        m: mockMsg,
        args: ['@18095551234', '2'],
        isOwner: true
    });

    // Verificar que los mensajes privados lleguen al Owner +1 (18494509905@s.whatsapp.net)
    const messagesToPlus1 = sentMessages.filter(m => m.jid === targetOwnerExpected);
    assert(messagesToPlus1.length >= 2, 'Deben llegar notificaciones y resumen final al owner +1');

    const summaryMsg = messagesToPlus1.find(m => m.content?.text?.includes('RESUMEN FINAL'));
    assert(summaryMsg, 'El resumen final debe llegar al owner +1');
    assert(summaryMsg.content.text.includes('18095551234'), 'El resumen debe indicar el objetivo reportado');

    // Verificar que en el grupo se enviaron el inicio y la confirmación final
    const groupMessages = sentMessages.filter(m => m.jid === '12036302@g.us');
    assert(groupMessages.length >= 2, 'El grupo debe recibir inicio y confirmación');
    const finalGroupMsg = groupMessages[groupMessages.length - 1];
    assert(finalGroupMsg.content.text.includes('Reportes completados'), 'Texto de confirmación en grupo correcto');

    console.log('  ✅ Prueba 2 superada: Notificaciones y resumen de .reporta enrutados directamente al owner +1 (18494509905).');

    // 3. Verificación de getMessage en recentMessagesManager (Prevención de bucle infinito Baileys)
    {
        // Mensaje inexistente DEBE devolver undefined (no un objeto vacío simulado que rompe sesiones en Baileys)
        const missing = recentMessagesManager.getMessage({ id: 'non_existent_id_99999' });
        assert.strictEqual(missing, undefined, 'Mensaje no registrado debe devolver undefined');

        // Mensaje registrado DEBE devolver su contenido real
        const fakeRawMsg = {
            key: { id: 'test_msg_unique_1', remoteJid: '12345@s.whatsapp.net', fromMe: false },
            message: { conversation: 'Hola mundo de prueba' }
        };
        recentMessagesManager.add(fakeRawMsg);

        const retrieved = recentMessagesManager.getMessage({ id: 'test_msg_unique_1' });
        assert.deepStrictEqual(retrieved, { conversation: 'Hola mundo de prueba' }, 'Debe recuperar el payload exacto del mensaje');
        console.log('  ✅ Prueba 3 superada: getMessage entrega undefined ante ausencia y mensajes reales ante presencia.');
    }

    // 4. Verificación de control de bucles 515 en connectionManager
    {
        connectionManager.retryCount = 0;
        connectionManager.fastRestartCount = 0;

        // Primeros 3 reinicios 515: rápidos (~1200ms)
        assert.strictEqual(connectionManager.calculateBackoffDelay(true), 1200);
        assert.strictEqual(connectionManager.calculateBackoffDelay(true), 1200);
        assert.strictEqual(connectionManager.calculateBackoffDelay(true), 1200);

        // Al 4to reinicio consecutivo 515: debe aplicar backoff y subir retryCount para evitar congelamiento
        const fourthDelay = connectionManager.calculateBackoffDelay(true);
        assert(fourthDelay > 1200, 'Tras 3 intentos rápidos debe aplicar backoff');
        assert(connectionManager.retryCount > 0, 'Debe incrementar retryCount');

        // Al abrir conexión, debe resetear contadores
        connectionManager.onConnectionOpen({});
        assert.strictEqual(connectionManager.fastRestartCount, 0);

        console.log('  ✅ Prueba 4 superada: Control de bucles 515 y reconexión resiliente verificado.');
    }

    console.log('🎉 [TEST] ¡Todas las pruebas de .reporta y resiliencia pasaron exitosamente!');
}

runAsyncTests().catch(err => {
    console.error('Error en pruebas asíncronas:', err);
    process.exit(1);
});


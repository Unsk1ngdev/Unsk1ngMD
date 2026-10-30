'use strict';

const assert = require('assert');
const path = require('path');

function createMockContext() {
    const sentMessages = [];
    const sock = {
        sendMessage: async (jid, content, options) => {
            sentMessages.push({ jid, content, options });
            return { key: { id: 'mock_msg_' + Date.now() } };
        }
    };
    const m = {
        chat: '1234567890@s.whatsapp.net',
        sender: '18494509905@s.whatsapp.net',
        key: {
            remoteJid: '1234567890@s.whatsapp.net',
            participant: '18494509905@s.whatsapp.net',
            fromMe: false
        }
    };
    return { sock, m, sentMessages };
}

(async () => {
    console.log('🧪 [TEST] Verificando comando .msp (Ministerio de Salud Pública)...');

    const mspCmd = require('../commands/tools/msp');

    // 1. Verificación de metadatos del comando
    assert.strictEqual(mspCmd.name, 'msp');
    assert(Array.isArray(mspCmd.alias) && mspCmd.alias.includes('clinica') && mspCmd.alias.includes('hospital'));
    assert.strictEqual(mspCmd.category, 'herramientas');
    assert(typeof mspCmd.execute === 'function');
    console.log('  ✅ Prueba 1 superada: Metadatos y estructura del comando correctos.');

    // 2. Menú de ayuda y explicación (sin argumentos)
    {
        const ctx = createMockContext();
        await mspCmd.execute({ sock: ctx.sock, m: ctx.m, args: [] });
        assert(ctx.sentMessages.length >= 1);
        const text = ctx.sentMessages[0].content.text;
        assert(text.includes('VERIFICACIÓN DE CENTROS DE SALUD') || text.includes('MISPAS'));
        assert(text.includes('.msp') && text.includes('HOMS'));
        console.log('  ✅ Prueba 2 superada: Explicación y menú de ayuda desplegados correctamente.');
    }

    // 3. Consulta de un centro que no existe
    {
        const ctx = createMockContext();
        await mspCmd.execute({ sock: ctx.sock, m: ctx.m, args: ['CentroFicticioXYZ123456789'] });
        assert(ctx.sentMessages.length >= 2);
        const lastMsg = ctx.sentMessages[ctx.sentMessages.length - 1];
        const text = lastMsg.content.text;
        assert(text.includes('No se encontraron centros registrados') || text.includes('Posibles causas'));
        console.log('  ✅ Prueba 3 superada: Manejo adecuado de búsquedas sin resultados.');
    }

    // 4. Consulta en vivo con un centro real (HOMS o Cedimat)
    {
        const ctx = createMockContext();
        await mspCmd.execute({ sock: ctx.sock, m: ctx.m, args: ['HOMS'] });
        assert(ctx.sentMessages.length >= 2);
        const lastMsg = ctx.sentMessages[ctx.sentMessages.length - 1];
        const text = lastMsg.content.text;
        assert(text.includes('Homs Health & Wellness Center') || text.includes('HOMS') || text.includes('HABILITADO'));
        console.log('  ✅ Prueba 4 superada: Consulta en tiempo real de centros habilitados (HOMS).');
    }

    console.log('🎉 [TEST] ¡Todas las pruebas de .msp superadas con éxito!');
})();


'use strict';

const assert = require('assert');
const darkCmd = require('../commands/media/dark');
const nsfwManager = require('../lib/nsfw');

console.log('🧪 [TEST] Iniciando pruebas de .dark y resiliencia concurrente...');

// Helper para crear contexto mock
const createMockContext = () => {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        sendMessage: async (jid, content, extra) => {
            sentMessages.push({ jid, content, extra });
            return { key: { id: 'mock-msg-' + Date.now() } };
        }
    };

    const m = {
        chat: '123456789@s.whatsapp.net',
        key: { remoteJid: '123456789@s.whatsapp.net', participant: '18494509905@s.whatsapp.net' },
        sender: '18494509905@s.whatsapp.net',
        react: async (emoji) => {
            reactions.push(emoji);
        }
    };

    return { sock, m, sentMessages, reactions };
};

(async () => {
    // 1. Verificación de Metadata y Aliases
    {
        assert.strictEqual(darkCmd.name, 'dark', 'El comando debe llamarse dark');
        assert(Array.isArray(darkCmd.alias), 'alias debe ser un array');
        assert(darkCmd.alias.includes('nsfwdark'), 'Debe incluir alias nsfwdark');
        assert(darkCmd.alias.includes('darkhentai'), 'Debe incluir alias darkhentai');
        assert(darkCmd.alias.includes('hardcore'), 'Debe incluir alias hardcore');
        assert(Array.isArray(darkCmd.CURATED_DARK_MEDIA), 'Debe tener pool curado de respaldo');
        assert(darkCmd.CURATED_DARK_MEDIA.length >= 5, 'El pool curado debe tener múltiples opciones');
        console.log('  ✅ Prueba 1 superada: Metadata, aliases y pool curado verificados.');
    }

    // 2. Bloqueo estricto en grupos con NSFW desactivado
    {
        const ctx = createMockContext();
        ctx.m.chat = '123456-group@g.us';
        ctx.m.key.remoteJid = '123456-group@g.us';

        nsfwManager.disableNsfw(ctx.m.chat);

        await darkCmd.execute({ sock: ctx.sock, m: ctx.m });

        assert(ctx.sentMessages.length > 0, 'Debe enviar advertencia');
        const text = ctx.sentMessages[0].content.text || '';
        assert(text.includes('Activa NSFW primero con *.nsfw on*'), 'Debe exigir activación de NSFW');
        console.log('  ✅ Prueba 2 superada: Bloqueo estricto en grupos con NSFW desactivado.');
    }

    // 3. Control de concurrencia y bloqueo de ráfagas duplicadas
    {
        const ctx = createMockContext();
        const userKey = `${ctx.m.chat}_${ctx.m.sender}`;
        
        // Simular que ya hay una solicitud en proceso
        darkCmd.activeDarkRequests.add(userKey);

        await darkCmd.execute({ sock: ctx.sock, m: ctx.m });

        assert(ctx.sentMessages.length > 0, 'Debe enviar mensaje de bloqueo por solicitud activa');
        const blockMsg = ctx.sentMessages[0].content.text || '';
        assert(blockMsg.includes('SOLICITUD EN PROCESO'), 'Debe advertir que ya hay una búsqueda en proceso');

        // Limpiar para siguientes pruebas
        darkCmd.activeDarkRequests.delete(userKey);
        console.log('  ✅ Prueba 3 superada: Mutex de concurrencia bloquea spam duplicado que satura el bot.');
    }

    // 4. Fallback instantáneo garantizado si APIs externas fallan
    {
        const ctx = createMockContext();

        const axios = require('axios');
        const originalGet = axios.get;
        axios.get = async () => {
            throw new Error('API Externa no responde');
        };

        try {
            await darkCmd.execute({ sock: ctx.sock, m: ctx.m });
        } finally {
            axios.get = originalGet;
        }

        assert(ctx.sentMessages.length >= 2, 'Debe enviar mensaje inicial y medio de fallback');
        const initialMsg = ctx.sentMessages[0].content.text || '';
        assert(initialMsg.includes('Buscando contenido dark +18'), 'Debe enviar aviso de búsqueda');

        const finalMsg = ctx.sentMessages[1].content;
        assert(finalMsg.video || finalMsg.image, 'Debe entregar un video o imagen de respaldo');
        assert(finalMsg.caption.includes('Dark +18'), 'Debe incluir caption del bot');

        console.log('  ✅ Prueba 4 superada: Fallback curado ultra-rápido garantizado ante caída de APIs.');
    }

    console.log('🎉 [TEST] ¡Todas las pruebas de .dark pasaron exitosamente!');
})().catch(err => {
    console.error('❌ Error en pruebas de .dark:', err);
    process.exit(1);
});

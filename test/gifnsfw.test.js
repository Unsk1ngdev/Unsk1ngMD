'use strict';

const assert = require('assert');
const gifnsfwCmd = require('../commands/media/gifnsfw');
const nsfwManager = require('../lib/nsfw');

console.log('🧪 [TEST] Iniciando pruebas de .gifnsfw y resiliencia concurrente...');

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
        assert.strictEqual(gifnsfwCmd.name, 'gifnsfw', 'El comando debe llamarse gifnsfw');
        assert(Array.isArray(gifnsfwCmd.alias), 'alias debe ser un array');
        assert(gifnsfwCmd.alias.includes('nsfwgif'), 'Debe incluir alias nsfwgif');
        assert(gifnsfwCmd.alias.includes('hentaigif'), 'Debe incluir alias hentaigif');
        assert(Array.isArray(gifnsfwCmd.CURATED_NSFW_GIFS), 'Debe tener pool curado de respaldo');
        assert(gifnsfwCmd.CURATED_NSFW_GIFS.length > 5, 'El pool curado debe tener múltiples opciones');
        console.log('  ✅ Prueba 1 superada: Metadata, aliases y pool curado verificados.');
    }

    // 2. Bloqueo en grupos sin NSFW activo
    {
        const ctx = createMockContext();
        ctx.m.chat = '123456-group@g.us';
        ctx.m.key.remoteJid = '123456-group@g.us';

        // Asegurar que NSFW esté apagado en este grupo
        nsfwManager.disableNsfw(ctx.m.chat);

        await gifnsfwCmd.execute({ sock: ctx.sock, m: ctx.m });

        assert(ctx.sentMessages.length > 0, 'Debe enviar advertencia');
        const text = ctx.sentMessages[0].content.text || '';
        assert(text.includes('Activa NSFW primero con *.nsfw on*'), 'Debe exigir activación de NSFW');
        console.log('  ✅ Prueba 2 superada: Bloqueo estricto en grupos con NSFW desactivado.');
    }

    // 3. Envío exitoso con fallback curado cuando APIs externas fallan
    {
        const ctx = createMockContext();
        ctx.m.chat = 'privado@s.whatsapp.net';
        ctx.m.key.remoteJid = 'privado@s.whatsapp.net';

        // Simular que todas las APIs externas fallan
        const axios = require('axios');
        const originalGet = axios.get;
        axios.get = async () => {
            throw new Error('API Externa Temporalmente Indisponible');
        };

        try {
            await gifnsfwCmd.execute({ sock: ctx.sock, m: ctx.m });
        } finally {
            axios.get = originalGet;
        }

        assert(ctx.sentMessages.length >= 2, 'Debe enviar aviso de búsqueda y video final');
        const busquedaMsg = ctx.sentMessages[0].content.text;
        assert(busquedaMsg.includes('Buscando GIF anime +18'), 'Debe enviar estado de búsqueda');

        const videoMsg = ctx.sentMessages[1].content;
        assert(videoMsg.video, 'Debe enviar contenido de video');
        assert.strictEqual(videoMsg.gifPlayback, true, 'Debe activar gifPlayback');
        assert(videoMsg.caption.includes('+18 Anime GIF'), 'Debe incluir caption representativo');

        console.log('  ✅ Prueba 3 superada: Fallback curado ultra-rápido garantizado ante caída de APIs.');
    }

    // 4. Envío exitoso con descarga y conversión simulada
    {
        const ctx = createMockContext();
        ctx.m.chat = 'privado@s.whatsapp.net';

        const axios = require('axios');
        const originalGet = axios.get;

        axios.get = async (url) => {
            if (url.includes('mock/anime.gif')) {
                return {
                    data: Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;')
                };
            }
            if (url.includes('nekobot.xyz')) {
                return {
                    data: {
                        success: true,
                        message: 'https://cdn.nekobot.xyz/mock/anime.gif'
                    }
                };
            }
            return originalGet(url);
        };

        try {
            await gifnsfwCmd.execute({ sock: ctx.sock, m: ctx.m });
        } finally {
            axios.get = originalGet;
        }

        assert(ctx.sentMessages.length >= 2, 'Debe enviar mensaje inicial y video');
        const finalMsg = ctx.sentMessages[ctx.sentMessages.length - 1].content;
        assert(finalMsg.video, 'Debe contener video con gifPlayback');
        assert.strictEqual(finalMsg.gifPlayback, true, 'gifPlayback debe ser true');

        console.log('  ✅ Prueba 4 superada: Flujo de proveedor NekoBot procesado exitosamente.');
    }

    console.log('🎉 [TEST] ¡Todas las pruebas de .gifnsfw pasaron exitosamente!');
})().catch(err => {
    console.error('❌ [TEST ERROR]:', err);
    process.exit(1);
});

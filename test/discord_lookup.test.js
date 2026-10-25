'use strict';

const assert = require('assert');
const discordCmd = require('../commands/tools/discord');
const config = require('../config');

console.log('🧪 [TEST] Iniciando pruebas de comando .discord (Modo Autónomo e Híbrido)...');

// 1. Verificación de metadata
{
    assert.strictEqual(discordCmd.name, 'discord', 'El comando debe llamarse discord');
    assert(Array.isArray(discordCmd.alias), 'alias debe ser un array');
    assert(discordCmd.alias.includes('dc'), 'alias debe incluir dc');
    assert(discordCmd.alias.includes('dcuser'), 'alias debe incluir dcuser');
    assert(discordCmd.alias.includes('discordsnowflake'), 'alias debe incluir discordsnowflake');
    assert.strictEqual(discordCmd.premiumOnly, true, 'debe ser premiumOnly');
    console.log('  ✅ Prueba 1 superada: Metadata y aliases de .discord definidos correctamente.');
}

// Helper para crear contexto mock
const createMockContext = () => {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        sendMessage: async (jid, content, extra) => {
            sentMessages.push({ jid, content, extra });
            return { key: { id: 'mock-msg' } };
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
    // 2. Validación de no-premium
    {
        const ctx = createMockContext();
        ctx.m.sender = '999999999@s.whatsapp.net';
        await discordCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['155149108183695360'],
            text: '155149108183695360',
            isOwner: false
        });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('Premium'), 'Debe exigir rango Premium');
        console.log('  ✅ Prueba 2 superada: Rechazo correcto a usuarios sin Premium.');
    }

    // 3. Validación de input vacío (muestra guía)
    {
        const ctx = createMockContext();
        await discordCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: [],
            text: '',
            isOwner: true
        });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('GUÍA DE USO'), 'Debe mostrar la guía de uso');
        console.log('  ✅ Prueba 3 superada: Despliegue de guía de uso ante comando sin argumentos.');
    }

    // 4. Validación de snowflake malformado (texto o longitud inválida)
    {
        const ctx = createMockContext();
        await discordCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['usuario_invalido'],
            text: 'usuario_invalido',
            isOwner: true
        });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('no permite buscar por nombre de usuario'), 'Debe indicar que solo admite ID numérico');
        console.log('  ✅ Prueba 4 superada: Rechazo de nombres de usuario o IDs malformados.');
    }

    // 5. Modo Autónomo / Snowflake Forensics SIN token de bot configurado
    {
        const oldToken = config.discordToken;
        const oldEnvToken = process.env.DISCORD_TOKEN;
        config.discordToken = '';
        delete process.env.DISCORD_TOKEN;

        const ctx = createMockContext();
        const testSnowflake = '155149108183695360'; // Cuenta creada en marzo de 2016

        await discordCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: [testSnowflake],
            text: testSnowflake,
            isOwner: true
        });

        // Restaurar variables
        config.discordToken = oldToken;
        if (oldEnvToken) process.env.DISCORD_TOKEN = oldEnvToken;

        assert(ctx.sentMessages.length > 0, 'Debe enviar un mensaje');
        const sentText = ctx.sentMessages[0].content.text || ctx.sentMessages[0].content.caption;
        assert(sentText, 'Debe contener texto o caption');
        assert(!sentText.includes('No se ha configurado el token'), 'Ya NO debe fallar con error de token');
        assert(sentText.includes('DISCORD INTELLIGENCE'), 'Debe incluir cabecera estética de inteligencia');
        assert(sentText.includes(testSnowflake), 'Debe mostrar el Snowflake ID');
        assert(sentText.includes('2016'), 'Debe calcular correctamente el año 2016');
        assert(sentText.includes('Era Clásica / Primitiva'), 'Debe identificar la Era de Discord');
        assert(!sentText.includes('discord.com/developers'), 'NO debe incluir la guía de desarrolladores ni pasos de configuración');
        assert(!sentText.includes('archivo .env'), 'NO debe mencionar el archivo .env');

        console.log('  ✅ Prueba 5 superada: Modo autónomo Snowflake sin token ejecutado exitosamente con cálculo preciso.');
    }

    // 6. Prueba con resolución de perfil público (Avatar en 4096px HD sin token)
    {
        const oldFetch = global.fetch;
        const testSnowflake = '155149108183695360';

        // Mock fetch para simular respuesta exitosa de japi.rest y descarga de imagen
        global.fetch = async (url) => {
            if (url.includes('japi.rest')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: {
                            id: testSnowflake,
                            username: 'test_user',
                            discriminator: '0',
                            global_name: 'Test Global',
                            avatar: '0123456789abcdef0123456789abcdef',
                            banner: 'fedcba9876543210fedcba9876543210',
                            public_flags: 4194304
                        }
                    })
                };
            }
            if (url.includes('cdn.discordapp.com')) {
                return {
                    ok: true,
                    status: 200,
                    arrayBuffer: async () => Buffer.from('fake-image-bytes-4096')
                };
            }
            return { ok: false, status: 500 };
        };

        const ctx = createMockContext();
        await discordCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: [testSnowflake],
            text: testSnowflake,
            isOwner: true
        });

        // Restaurar fetch
        global.fetch = oldFetch;

        assert(ctx.sentMessages.length > 0, 'Debe enviar mensaje con imagen y caption');
        const sentMsg = ctx.sentMessages[0].content;
        assert(sentMsg.image, 'Debe adjuntar la imagen de perfil');
        assert(sentMsg.caption, 'Debe tener caption estructurado');
        assert(sentMsg.caption.includes('@test_user'), 'Debe incluir el usuario');
        assert(sentMsg.caption.includes('Test Global'), 'Debe incluir el nombre global');
        assert(sentMsg.caption.includes('size=4096'), 'Debe incluir URL de imagen en calidad 4096px HD');
        assert(sentMsg.caption.includes('Desarrollador Activo'), 'Debe mapear flags e insignias');
        assert(!sentMsg.caption.includes('discord.com/developers'), 'NO debe incluir guía de configuración de bot');
        assert(!sentMsg.caption.includes('archivo .env'), 'NO debe mencionar archivo .env');

        console.log('  ✅ Prueba 6 superada: Perfil público con foto en máxima calidad 4096px HD verificado.');
    }

    console.log('🎉 [TEST] ¡Todas las pruebas de .discord pasaron exitosamente!');
})().catch(err => {
    console.error('❌ [TEST ERROR]', err);
    process.exit(1);
});


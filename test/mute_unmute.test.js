'use strict';

const assert = require('assert');
const muteCmd = require('../commands/system/mute');
const unmuteCmd = require('../commands/system/unmute');
const silenciadosManager = require('../lib/silenciados');
const database = require('../lib/database');

console.log('🧪 [TEST] Iniciando pruebas de mute y unmute...');

// 1. Verificación de metadata y alias
{
    assert.strictEqual(muteCmd.name, 'mute', 'Nombre debe ser mute');
    assert(Array.isArray(muteCmd.alias), 'alias debe ser un array');
    assert(muteCmd.alias.includes('silenciar'), 'alias debe incluir silenciar');
    assert(muteCmd.alias.includes('silence'), 'alias debe incluir silence');
    assert(muteCmd.alias.includes('mutear'), 'alias debe incluir mutear');
    assert.strictEqual(muteCmd.ownerOnly, true, 'mute debe ser ownerOnly');

    assert.strictEqual(unmuteCmd.name, 'unmute', 'Nombre debe ser unmute');
    assert(Array.isArray(unmuteCmd.alias), 'alias debe ser un array');
    assert(unmuteCmd.alias.includes('desilenciar'), 'alias debe incluir desilenciar');
    assert(unmuteCmd.alias.includes('quitarmute'), 'alias debe incluir quitarmute');
    assert(unmuteCmd.alias.includes('unmutear'), 'alias debe incluir unmutear');
    assert.strictEqual(unmuteCmd.ownerOnly, true, 'unmute debe ser ownerOnly');

    console.log('  ✅ Prueba 1 superada: Metadata y aliases de mute y unmute configurados correctamente.');
}

// 2. Mock de socket y mensajes
const createMockContext = (options = {}) => {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        sendMessage: async (jid, content, extra) => {
            sentMessages.push({ jid, content, extra });
            return { key: { id: 'mock-id' } };
        }
    };

    const m = {
        chat: options.chat || '123456789@s.whatsapp.net',
        key: { remoteJid: options.chat || '123456789@s.whatsapp.net' },
        mentionedJid: options.mentionedJid || [],
        quoted: options.quoted || null,
        message: {
            extendedTextMessage: {
                contextInfo: {
                    mentionedJid: options.mentionedJid || [],
                    participant: options.quotedSender || null
                }
            }
        },
        react: async (emoji) => {
            reactions.push(emoji);
        },
        reply: async (text) => {
            sentMessages.push({ jid: options.chat, content: { text } });
        }
    };

    return { sock, m, sentMessages, reactions };
};

// 3. Verificación de ejecución de mute y protección de Owner
(async () => {
    const testUser = '19998887777@s.whatsapp.net';
    const ownerUser = '18494509905@s.whatsapp.net';

    // Limpieza preventiva
    silenciadosManager.desilenciarUser(testUser);
    assert.strictEqual(silenciadosManager.isSilenciado(testUser), false);

    // Intentar mutear siendo non-owner (debe ignorarse)
    {
        const ctx = createMockContext({ mentionedJid: [testUser] });
        await muteCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['@19998887777', '10'],
            isOwner: false,
            prefix: '.'
        });
        assert.strictEqual(ctx.sentMessages.length, 0, 'No owner no debe enviar mensajes');
        assert.strictEqual(silenciadosManager.isSilenciado(testUser), false, 'No debe mutearse si no es owner');
        console.log('  ✅ Prueba 2 superada: Seguridad non-owner verificada.');
    }

    // Intentar mutear al Owner (debe rechazarse)
    {
        const ctx = createMockContext({ mentionedJid: [ownerUser] });
        await muteCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['@18494509905', '10'],
            isOwner: true,
            prefix: '.'
        });
        assert(ctx.sentMessages.length > 0, 'Debe enviar advertencia');
        assert(ctx.sentMessages[0].content.text.includes('No puedes silenciar al owner'), 'Debe indicar que no se puede silenciar al owner');
        assert.strictEqual(silenciadosManager.isSilenciado(ownerUser), false, 'El owner nunca debe quedar silenciado');
        console.log('  ✅ Prueba 3 superada: Protección contra silenciar al owner verificada.');
    }

    // Mutear usuario exitosamente
    {
        const ctx = createMockContext({ mentionedJid: [testUser] });
        await muteCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['@19998887777', '15'],
            isOwner: true,
            prefix: '.'
        });
        assert.strictEqual(silenciadosManager.isSilenciado(testUser), true, 'El usuario debe estar silenciado');
        assert(ctx.reactions.includes('🔇'), 'Debe reaccionar con 🔇');
        assert(ctx.sentMessages[0].content.text.includes('USUARIO SILENCIADO / MUTE'), 'Mensaje de confirmación correcto');
        console.log('  ✅ Prueba 4 superada: Mute con duración ejecutado correctamente.');
    }

    // Verificar .mute list
    {
        const ctx = createMockContext();
        await muteCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['list'],
            isOwner: true,
            prefix: '.'
        });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('USUARIOS SILENCIADOS'), 'Debe listar los silenciados');
        assert(ctx.sentMessages[0].content.text.includes('19998887777'), 'Debe contener al usuario en la lista');
        console.log('  ✅ Prueba 5 superada: Comando .mute list funcionando correctamente.');
    }

    // Desmutear con .unmute @usuario
    {
        const ctx = createMockContext({ mentionedJid: [testUser] });
        await unmuteCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['@19998887777'],
            isOwner: true,
            prefix: '.'
        });
        assert.strictEqual(silenciadosManager.isSilenciado(testUser), false, 'El usuario ya no debe estar silenciado');
        assert(ctx.reactions.includes('🔊'), 'Debe reaccionar con 🔊');
        assert(ctx.sentMessages[0].content.text.includes('USUARIO DESILENCIADO / UNMUTE'), 'Mensaje de confirmación unmute correcto');
        console.log('  ✅ Prueba 6 superada: Comando .unmute funcionando correctamente.');
    }

    // Re-mutear y desmutear usando .mute stop @usuario (compatibilidad silenciar stop)
    {
        // Mutear nuevamente
        silenciadosManager.silenciarUser(testUser, 10);
        assert.strictEqual(silenciadosManager.isSilenciado(testUser), true);

        // Desmutear mediante .mute stop
        const ctx = createMockContext({ mentionedJid: [testUser] });
        await muteCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['stop', '@19998887777'],
            isOwner: true,
            prefix: '.'
        });
        assert.strictEqual(silenciadosManager.isSilenciado(testUser), false, 'El usuario debe quedar desilenciado con mute stop');
        assert(ctx.sentMessages[0].content.text.includes('USUARIO DESILENCIADO / UNMUTE'));
        console.log('  ✅ Prueba 7 superada: .mute stop (y .silenciar stop) funcionando correctamente.');
    }

    // Limpieza final
    silenciadosManager.desilenciarUser(testUser);

    console.log('🎉 [TEST] Todas las pruebas de mute y unmute pasaron exitosamente.');
})().catch(err => {
    console.error('❌ [TEST ERROR]', err);
    process.exit(1);
});


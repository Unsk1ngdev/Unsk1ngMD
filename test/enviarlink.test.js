'use strict';

const assert = require('assert');
const enviarlinkCmd = require('../commands/group/enviarlink');
const { checkGroupPermissions, getParticipantIdentifiers } = require('../lib/groupPermissions');

console.log('🧪 [TEST] Iniciando pruebas de enviarlink y detección robusta de administradores...');

// 1. Verificación de metadata
{
    assert.strictEqual(enviarlinkCmd.name, 'enviarlink', 'El comando debe llamarse enviarlink');
    assert(Array.isArray(enviarlinkCmd.alias), 'alias debe ser un array');
    assert(enviarlinkCmd.alias.includes('sendlink'), 'alias debe incluir sendlink');
    assert(enviarlinkCmd.alias.includes('invitarto'), 'alias debe incluir invitarto');
    assert.strictEqual(enviarlinkCmd.groupOnly, true, 'debe ser groupOnly');
    assert.strictEqual(enviarlinkCmd.adminOnly, true, 'debe ser adminOnly');
    assert.strictEqual(enviarlinkCmd.botAdminRequired, true, 'debe ser botAdminRequired');
    console.log('  ✅ Prueba 1 superada: Metadata y permisos de enviarlink configurados correctamente.');
}

// 2. Verificación de getParticipantIdentifiers y resolución de LIDs / dispositivos
{
    const sampleParticipant = {
        id: '1029384756@lid',
        lid: '1029384756:1@lid',
        phoneNumber: '18494509905',
        admin: 'admin'
    };
    const ids = getParticipantIdentifiers(sampleParticipant);
    assert(ids.includes('1029384756'), 'Debe incluir dígitos de LID');
    assert(ids.includes('18494509905'), 'Debe incluir dígitos de número de teléfono');
    assert(ids.includes('1029384756@lid'), 'Debe incluir LID limpio');
    console.log('  ✅ Prueba 2 superada: Extracción forense de identificadores de participantes.');
}

// 3. Verificación de checkGroupPermissions con LIDs, números cruzados y sufijos de dispositivos
(async () => {
    const mockSock = {
        user: {
            id: '584160666286:2@s.whatsapp.net',
            lid: '9988776655@lid'
        },
        groupMetadata: async () => ({
            id: '120363000000000000@g.us',
            subject: 'Grupo Test',
            participants: [
                {
                    id: '9988776655@lid',
                    phoneNumber: '584160666286',
                    admin: 'admin' // El bot es admin
                },
                {
                    id: '18494509905@s.whatsapp.net',
                    lid: '1122334455@lid',
                    admin: 'admin' // El sender es admin
                },
                {
                    id: '19998887777@s.whatsapp.net',
                    admin: null // Usuario regular
                }
            ]
        })
    };

    // Caso A: El bot detecta que es admin a pesar de que su id tiene :2 y el grupo usa LID
    const perms = await checkGroupPermissions(
        mockSock,
        '120363000000000000@g.us',
        '1122334455:3@lid', // El sender llega con LID y dispositivo :3
        null
    );

    assert.strictEqual(perms.isBotAdmin, true, 'El bot debe ser detectado como administrador');
    assert.strictEqual(perms.isSenderAdmin, true, 'El remitente debe ser detectado como administrador');
    console.log('  ✅ Prueba 3 superada: checkGroupPermissions resuelve bot admin y sender admin con LIDs y sufijos.');

    // Caso B: Usuario común no admin
    const regularPerms = await checkGroupPermissions(
        mockSock,
        '120363000000000000@g.us',
        '19998887777@s.whatsapp.net',
        perms.groupMetadata
    );
    assert.strictEqual(regularPerms.isSenderAdmin, false, 'Usuario regular no debe ser admin');
    console.log('  ✅ Prueba 4 superada: Usuario no administrador correctamente clasificado.');

    // 4. Verificación de ejecución del comando enviarlink
    const createMockContext = (options = {}) => {
        const sentMessages = [];
        const reactions = [];

        const sock = {
            sendMessage: async (jid, content, extra) => {
                sentMessages.push({ jid, content, extra });
                return { key: { id: 'mock-id' } };
            },
            groupInviteCode: async (jid) => {
                if (options.botNotAdminOnServer) {
                    throw new Error('not-authorized: 403');
                }
                return 'AbCdEfGhIjKlMnOp';
            }
        };

        const m = {
            chat: '120363000000000000@g.us',
            key: { remoteJid: '120363000000000000@g.us', participant: options.sender || '18494509905@s.whatsapp.net' },
            sender: options.sender || '18494509905@s.whatsapp.net',
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
                sentMessages.push({ jid: options.chat || '120363000000000000@g.us', content: { text } });
            }
        };

        return { sock, m, sentMessages, reactions };
    };

    // 4a. Ejecución por usuario no-admin (debe rechazarse)
    {
        const ctx = createMockContext({ sender: '19998887777@s.whatsapp.net' });
        await enviarlinkCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['18095551234'],
            text: '18095551234',
            isAdmin: false,
            isOwner: false,
            isBotAdmin: true,
            groupMetadata: perms.groupMetadata
        });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('exclusivo para administradores'));
        console.log('  ✅ Prueba 5 superada: Bloqueo de enviarlink para usuarios no administradores.');
    }

    // 4b. Ejecución por admin sin argumentos (muestra guía de uso)
    {
        const ctx = createMockContext({ sender: '18494509905@s.whatsapp.net' });
        await enviarlinkCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: [],
            text: '',
            isAdmin: true,
            isOwner: false,
            isBotAdmin: true,
            groupMetadata: perms.groupMetadata
        });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('ENVIAR ENLACE DE GRUPO'));
        assert(ctx.sentMessages[0].content.text.includes('FORMAS DE USO'));
        console.log('  ✅ Prueba 6 superada: Despliegue de guía de uso cuando no se indica destinatario.');
    }

    // 4c. Ejecución exitosa con número por admin
    {
        const ctx = createMockContext({ sender: '18494509905@s.whatsapp.net' });
        await enviarlinkCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['+18295551234'],
            text: '+18295551234',
            isAdmin: true,
            isOwner: false,
            isBotAdmin: true,
            groupMetadata: perms.groupMetadata
        });

        // Debe haber enviado 2 mensajes: 1 al privado del destinatario y 1 confirmación en el grupo
        assert.strictEqual(ctx.sentMessages.length, 2, 'Debe enviar 2 mensajes (privado y confirmación grupal)');
        const privateMsg = ctx.sentMessages.find(msg => msg.jid === '18295551234@s.whatsapp.net');
        assert(privateMsg, 'El mensaje privado debe llegar a 18295551234@s.whatsapp.net');
        assert(privateMsg.content.text.includes('AbCdEfGhIjKlMnOp'), 'Debe contener el enlace de invitación');
        assert(ctx.reactions.includes('✅'), 'Debe reaccionar con éxito');
        console.log('  ✅ Prueba 7 superada: Envío exitoso de enlace de invitación por número.');
    }

    // 4d. Ejecución exitosa mediante mención @usuario
    {
        const ctx = createMockContext({
            sender: '18494509905@s.whatsapp.net',
            mentionedJid: ['18499998888@s.whatsapp.net']
        });
        await enviarlinkCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['@18499998888'],
            text: '@18499998888',
            isAdmin: true,
            isOwner: false,
            isBotAdmin: true,
            groupMetadata: perms.groupMetadata
        });
        const privateMsg = ctx.sentMessages.find(msg => msg.jid === '18499998888@s.whatsapp.net');
        assert(privateMsg, 'El mensaje privado debe llegar al usuario mencionado');
        console.log('  ✅ Prueba 8 superada: Envío exitoso de enlace de invitación mencionando usuario.');
    }

    // 4e. Fallback cuando el servidor de WhatsApp reporta que el bot no es admin
    {
        const ctx = createMockContext({
            sender: '18494509905@s.whatsapp.net',
            botNotAdminOnServer: true
        });
        await enviarlinkCmd.execute({
            sock: ctx.sock,
            m: ctx.m,
            args: ['18295551234'],
            text: '18295551234',
            isAdmin: true,
            isOwner: false,
            isBotAdmin: true,
            groupMetadata: perms.groupMetadata
        });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('Asegúrate de que el bot tenga el rango de *Administrador*'));
        assert(ctx.reactions.includes('❌'));
        console.log('  ✅ Prueba 9 superada: Mensaje claro y sin caídas si WhatsApp rechaza invitación por falta de admin.');
    }

    console.log('🎉 [TEST] ¡Todas las pruebas de enviarlink y groupPermissions pasaron exitosamente!');
})().catch(err => {
    console.error('❌ [TEST ERROR]', err);
    process.exit(1);
});


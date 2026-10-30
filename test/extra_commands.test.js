'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const apostarCmd = require('../commands/tools/apostar');
const cofreCmd = require('../commands/tools/cofre');
const misionCmd = require('../commands/tools/mision');
const mentiraCmd = require('../commands/tools/mentira');
const resumirCmd = require('../commands/tools/resumir');
const roastCmd = require('../commands/tools/roast');
const shipnsfwCmd = require('../commands/media/shipnsfw');
const missionsManager = require('../lib/missions');
const economy = require('../lib/economy');
const nsfwManager = require('../lib/nsfw');

console.log('🧪 [TEST] Iniciando pruebas exhaustivas de los 7 nuevos comandos...');

const createMockContext = (options = {}) => {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        user: { id: '18494509905:1@s.whatsapp.net', jid: '18494509905@s.whatsapp.net' },
        sendMessage: async (jid, content, extra) => {
            sentMessages.push({ jid, content, extra });
            return { key: { id: 'mock-msg-' + Date.now() } };
        },
        groupMetadata: async (jid) => ({
            id: jid,
            subject: 'Grupo de Pruebas',
            participants: [
                { id: '18491111111@s.whatsapp.net', admin: null },
                { id: '18492222222@s.whatsapp.net', admin: null },
                { id: '18493333333@s.whatsapp.net', admin: null }
            ]
        })
    };

    const m = {
        chat: options.chat || '120363407455196754@g.us',
        sender: options.sender || '18499990001@s.whatsapp.net',
        type: 'conversation',
        isGroup: true,
        react: async (emoji) => {
            reactions.push(emoji);
        },
        reply: async (text) => {
            sentMessages.push({ jid: options.chat || '120363407455196754@g.us', content: { text } });
        },
        message: options.message || {}
    };

    return { sock, m, sentMessages, reactions };
};

(async () => {
    const testUser = '18499990001@s.whatsapp.net';

    // ----------------------------------------------------
    // 1. Pruebas de .apostar
    // ----------------------------------------------------
    {
        assert.strictEqual(apostarCmd.name, 'apostar');
        assert(apostarCmd.alias.includes('bet'));
        assert(apostarCmd.alias.includes('apuesta'));

        // Rechazo sin cantidad
        const ctxNoAmount = createMockContext({ sender: testUser });
        await apostarCmd.execute({ sock: ctxNoAmount.sock, m: ctxNoAmount.m, args: [], text: '' });
        assert(ctxNoAmount.sentMessages[0].content.text.includes('Debes especificar cuánto dinero'));

        // Rechazo apuesta mínima (< 100)
        const ctxMin = createMockContext({ sender: testUser });
        await apostarCmd.execute({ sock: ctxMin.sock, m: ctxMin.m, args: ['50'], text: '50' });
        assert(ctxMin.sentMessages[0].content.text.includes('apuesta mínima en la mesa del casino es de *$100'));

        // Saldo insuficiente
        const userProf = economy.getUser(testUser);
        userProf.monedas = 200;
        economy.save();

        const ctxOver = createMockContext({ sender: testUser });
        await apostarCmd.execute({ sock: ctxOver.sock, m: ctxOver.m, args: ['50000'], text: '50000' });
        assert(ctxOver.sentMessages[0].content.text.includes('SALDO INSUFICIENTE'));

        // Apuesta válida con animación
        userProf.monedas = 10000;
        economy.save();

        const ctxValid = createMockContext({ sender: testUser });
        await apostarCmd.execute({ sock: ctxValid.sock, m: ctxValid.m, args: ['500'], text: '500' });
        assert(ctxValid.sentMessages.length >= 1);
        const hasResult = ctxValid.sentMessages.some(m =>
            m.content.text.includes('MESA DE DADOS') ||
            m.content.text.includes('RESULTADO')
        );
        assert(hasResult, 'Debe emitir mensaje de juego o resultado');

        console.log('  ✅ Prueba 1 superada: .apostar gestiona validaciones, saldo, dados y apuestas.');
    }

    // ----------------------------------------------------
    // 2. Pruebas de .cofre
    // ----------------------------------------------------
    {
        assert.strictEqual(cofreCmd.name, 'cofre');
        assert(cofreCmd.alias.includes('chest'));
        assert(cofreCmd.alias.includes('misterio'));

        const userProf = economy.getUser(testUser);
        userProf.lastCofre = 0; // Reset para prueba
        economy.save();

        const ctxCofre = createMockContext({ sender: testUser });
        await cofreCmd.execute({ sock: ctxCofre.sock, m: ctxCofre.m });
        assert(ctxCofre.sentMessages.length >= 1);
        const openedMsg = ctxCofre.sentMessages.some(m =>
            m.content.text.includes('ABRIENDO COFRE') ||
            m.content.text.includes('RESULTADO DEL COFRE')
        );
        assert(openedMsg, 'Debe abrir el cofre misterioso');

        // Intento inmediato -> debe rebotar por cooldown
        const ctxCooldown = createMockContext({ sender: testUser });
        await cofreCmd.execute({ sock: ctxCooldown.sock, m: ctxCooldown.m });
        assert(ctxCooldown.sentMessages[0].content.text.includes('COFRE MISTERIOSO BLOQUEADO'));

        console.log('  ✅ Prueba 2 superada: .cofre entrega recompensas ponderadas y respeta cooldown de 3h.');
    }

    // ----------------------------------------------------
    // 3. Pruebas de .mision y lib/missions
    // ----------------------------------------------------
    {
        assert.strictEqual(misionCmd.name, 'mision');
        assert(misionCmd.alias.includes('misiones'));
        assert(misionCmd.alias.includes('quest'));

        // Despliegue de misiones diarias
        const ctxMision = createMockContext({ sender: testUser });
        await misionCmd.execute({ sock: ctxMision.sock, m: ctxMision.m, args: [] });
        assert(ctxMision.sentMessages.length > 0);
        const misionText = ctxMision.sentMessages[0].content.text;
        assert(misionText.includes('MISIONES DIARIAS'));
        assert(misionText.includes('Progreso: ['));

        // Reclamar sin completar nada
        const ctxClaimEmpty = createMockContext({ sender: testUser });
        await misionCmd.execute({ sock: ctxClaimEmpty.sock, m: ctxClaimEmpty.m, args: ['reclamar'] });
        assert(ctxClaimEmpty.sentMessages[0].content.text.includes('NO TIENES RECOMPENSAS PENDIENTES') || ctxClaimEmpty.sentMessages[0].content.text.includes('RECOMPENSA DE MISIONES'));

        // Registro forzado de progreso y cobro
        missionsManager.recordProgress(testUser, 'trabajar', 5);
        const ctxClaim = createMockContext({ sender: testUser });
        await misionCmd.execute({ sock: ctxClaim.sock, m: ctxClaim.m, args: ['reclamar'] });
        assert(ctxClaim.sentMessages.length > 0);

        console.log('  ✅ Prueba 3 superada: .mision despliega tablero diario, progresa y cobra recompensas.');
    }

    // ----------------------------------------------------
    // 4. Pruebas de .mentira
    // ----------------------------------------------------
    {
        assert.strictEqual(mentiraCmd.name, 'mentira');
        assert(mentiraCmd.alias.includes('excusa'));
        assert(mentiraCmd.alias.includes('pretexto'));

        // Sin filtro
        const ctxMentira = createMockContext({ sender: testUser });
        await mentiraCmd.execute({ sock: ctxMentira.sock, m: ctxMentira.m, args: [] });
        assert(ctxMentira.sentMessages.length > 0);
        const text = ctxMentira.sentMessages[0].content.text;
        assert(text.includes('GENERADOR DE EXCUSAS & MENTIRAS'));
        assert(text.includes('Credibilidad:'));
        assert(text.includes('Descaro:'));

        // Con filtro trabajo
        const ctxTrabajo = createMockContext({ sender: testUser });
        await mentiraCmd.execute({ sock: ctxTrabajo.sock, m: ctxTrabajo.m, args: ['trabajo'] });
        assert(ctxTrabajo.sentMessages.length > 0);
        assert(ctxTrabajo.sentMessages[0].content.text.includes('Situación:'));

        console.log('  ✅ Prueba 4 superada: .mentira genera coartadas convincentes con métricas de descaro.');
    }

    // ----------------------------------------------------
    // 5. Pruebas de .resumir
    // ----------------------------------------------------
    {
        assert.strictEqual(resumirCmd.name, 'resumir');
        assert(resumirCmd.alias.includes('resumen'));
        assert(resumirCmd.alias.includes('tldr'));

        // Rechazo texto corto
        const ctxShort = createMockContext({ sender: testUser });
        await resumirCmd.execute({ sock: ctxShort.sock, m: ctxShort.m, text: 'hola bot' });
        assert(ctxShort.sentMessages[0].content.text.includes('Mínimo requerido: al menos 35 caracteres'));

        // Resumen exitoso con texto largo
        const longText = 'La inteligencia artificial generativa ha revolucionado el desarrollo de software moderno. ' +
            'Permite a los programadores acelerar la escritura de código, depurar errores complejos y diseñar arquitecturas limpias. ' +
            'Sin embargo, es fundamental mantener un pensamiento crítico y verificar siempre la salida del modelo para asegurar calidad y robustez.';

        const ctxLong = createMockContext({ sender: testUser });
        await resumirCmd.execute({ sock: ctxLong.sock, m: ctxLong.m, text: longText });
        assert(ctxLong.sentMessages.length > 0);
        const resText = ctxLong.sentMessages[0].content.text;
        assert(resText.includes('RESUMEN EJECUTIVO'));
        assert(resText.includes('IDEA CENTRAL') || resText.includes('TL;DR'));

        console.log('  ✅ Prueba 5 superada: .resumir sintetiza textos largos con estructura ejecutiva.');
    }

    // ----------------------------------------------------
    // 6. Pruebas de .roast
    // ----------------------------------------------------
    {
        assert.strictEqual(roastCmd.name, 'roast');
        assert(roastCmd.alias.includes('quemar'));
        assert(roastCmd.alias.includes('humillar'));

        // Auto-defensa del bot si intentan roastearlo a él
        const botJid = '18494509905@s.whatsapp.net';
        const ctxBot = createMockContext({
            message: {
                extendedTextMessage: {
                    contextInfo: {
                        mentionedJid: [botJid]
                    }
                }
            }
        });
        await roastCmd.execute({ sock: ctxBot.sock, m: ctxBot.m, text: '' });
        assert(ctxBot.sentMessages[0].content.text.includes('UNSK1NGMD ROAST DEFENSE'));

        // Roast sobre usuario tercero
        const ctxVictim = createMockContext({
            message: {
                extendedTextMessage: {
                    contextInfo: {
                        mentionedJid: ['18491111111@s.whatsapp.net']
                    }
                }
            }
        });
        await roastCmd.execute({ sock: ctxVictim.sock, m: ctxVictim.m, text: '' });
        assert(ctxVictim.sentMessages.length > 0);
        const roastContent = ctxVictim.sentMessages[0].content.text;
        assert(roastContent.includes('ROAST CALLEJERO PARA'));
        assert(roastContent.includes('quemaduras') || roastContent.includes('bomberos'));

        console.log('  ✅ Prueba 6 superada: .roast produce burlas ingeniosas y activa defensa antibot.');
    }

    // ----------------------------------------------------
    // 7. Pruebas de .shipnsfw
    // ----------------------------------------------------
    {
        assert.strictEqual(shipnsfwCmd.name, 'shipnsfw');
        assert(shipnsfwCmd.alias.includes('shiphot'));
        assert(shipnsfwCmd.alias.includes('ship18'));
        assert.strictEqual(shipnsfwCmd.groupOnly, true);

        const groupChat = '120363407455196754@g.us';

        // Bloqueo si NSFW está apagado
        nsfwManager.disableNsfw(groupChat);
        const ctxNsfwOff = createMockContext({ chat: groupChat });
        await shipnsfwCmd.execute({ sock: ctxNsfwOff.sock, m: ctxNsfwOff.m });
        assert(ctxNsfwOff.sentMessages[0].content.text.includes('.nsfw on'));

        // Activación de NSFW y ejecución con 2 usuarios
        nsfwManager.enableNsfw(groupChat);
        const ctxNsfwOn = createMockContext({
            chat: groupChat,
            message: {
                extendedTextMessage: {
                    contextInfo: {
                        mentionedJid: ['18491111111@s.whatsapp.net', '18492222222@s.whatsapp.net']
                    }
                }
            }
        });

        await shipnsfwCmd.execute({ sock: ctxNsfwOn.sock, m: ctxNsfwOn.m });
        assert(ctxNsfwOn.sentMessages.length > 0);
        const shipText = ctxNsfwOn.sentMessages[0].content.text;
        assert(shipText.includes('SHIP +18 / CANDELA PURA'));
        assert(shipText.includes('Dinámica Secreta:'));
        assert(shipText.includes('Posición Preferida:'));
        assert(shipText.includes('Relato de una Noche Juntos:'));

        console.log('  ✅ Prueba 7 superada: .shipnsfw respeta toggle +18 y genera compatibilidad pícara.');
    }

    console.log('🎉 [TEST] ¡Los 7 nuevos comandos pasaron todas sus pruebas unitarias exitosamente!');
})().catch(err => {
    console.error('❌ [TEST ERROR]:', err);
    process.exit(1);
});

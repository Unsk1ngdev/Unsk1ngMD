'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');

const smsManager = require('../lib/smsAnon');
const coupleManager = require('../lib/coupleManager');
const smsCmd = require('../commands/tools/sms');
const ligarCmd = require('../commands/tools/ligar');
const aceptarCmd = require('../commands/tools/aceptar');
const rechazarCmd = require('../commands/tools/rechazar');
const romperCmd = require('../commands/tools/romper');
const parejaCmd = require('../commands/tools/pareja');
const cekCmd = require('../commands/tools/cek');

function createMockEnv(sender = '18091112233@s.whatsapp.net', chat = '18091112233@s.whatsapp.net') {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        user: { id: '18490001111:1@s.whatsapp.net', jid: '18490001111@s.whatsapp.net' },
        sendMessage: async (jid, content, options) => {
            sentMessages.push({ jid, content, options });
            return {
                key: {
                    remoteJid: jid,
                    fromMe: true,
                    id: 'MOCK_MSG_' + Math.random().toString(36).slice(2, 10)
                },
                message: { conversation: content.text }
            };
        },
        onWhatsApp: async (num) => {
            return [{ jid: `${num}@s.whatsapp.net`, exists: true }];
        }
    };

    const m = {
        chat,
        sender,
        key: { remoteJid: chat, participant: sender, id: 'MSG_' + Date.now() },
        body: '',
        react: async (emoji) => { reactions.push(emoji); return true; },
        reply: async (text) => {
            sentMessages.push({ jid: chat, content: { text } });
            return { key: { id: 'REPLY_MOCK' } };
        }
    };

    return { sock, m, sentMessages, reactions };
}

(async () => {
    console.log('🧪 [TEST] Iniciando pruebas de SMS Anónimo, Sistema de Pareja y Tests CEK...');

    // ── 1. SMS Anónimo ──
    console.log('  Testing .sms...');
    const envSmsHelp = createMockEnv();
    await smsCmd.execute({ sock: envSmsHelp.sock, m: envSmsHelp.m, args: [] });
    assert(envSmsHelp.sentMessages.length > 0);
    assert(envSmsHelp.sentMessages[0].content.text.includes('SMS ANÓNIMO PREMIUM'));

    // Block y Unblock
    const envBlock = createMockEnv();
    await smsCmd.execute({ sock: envBlock.sock, m: envBlock.m, args: ['block'] });
    assert(smsManager.isBlocked('18091112233'));

    const envUnblock = createMockEnv();
    await smsCmd.execute({ sock: envUnblock.sock, m: envUnblock.m, args: ['unblock'] });
    assert(!smsManager.isBlocked('18091112233'));

    // Envío de SMS anónimo
    const envSend = createMockEnv('18091112233@s.whatsapp.net');
    await smsCmd.execute({
        sock: envSend.sock,
        m: envSend.m,
        args: ['18099998877', '|', 'Hola', 'este', 'es', 'un', 'secreto']
    });
    assert(envSend.sentMessages.length >= 2); // 1 al target, 1 confirmación al sender
    const targetMsg = envSend.sentMessages.find(msg => msg.jid === '18099998877@s.whatsapp.net');
    assert(targetMsg, 'El mensaje debió enviarse al target');
    assert(targetMsg.content.text.includes('este es un secreto'));

    // Simular respuesta al SMS anónimo recibido
    const receivedMsgId = targetMsg ? targetMsg.key?.id || Object.keys(smsManager.getSession || {})[0] : null;
    const envReply = createMockEnv('18099998877@s.whatsapp.net', '18099998877@s.whatsapp.net');
    envReply.m.quoted = {
        key: { id: receivedMsgId || Object.keys(require('../lib/smsAnon').getSession ? {} : {}) },
        body: 'Alguien te ha enviado un mensaje secreto'
    };
    // Buscar id registrado en smsManager
    const allSessions = require('../database/sms_anon.json').messages || {};
    const validId = Object.keys(allSessions)[0];
    if (validId) {
        envReply.m.quoted.key.id = validId;
        envReply.m.body = '¿Quién eres tú?';
        const handled = await smsManager.handleReply(envReply.sock, envReply.m);
        assert(handled === true, 'El reenvío de respuesta anónima debe ser exitoso');
    }
    console.log('  ✅ .sms y gestión bidireccional anónima verificados con éxito.');

    // ── 2. Sistema de Parejas ──
    console.log('  Testing Sistema de Parejas (.ligar, .aceptar, .rechazar, .romper, .pareja)...');
    const userA = '18095551111@s.whatsapp.net';
    const userB = '18095552222@s.whatsapp.net';
    const groupJid = '120363000000000@g.us';

    // A propone a B
    const envLigar = createMockEnv(userA, groupJid);
    envLigar.m.mentionedJid = [userB];
    await ligarCmd.execute({ sock: envLigar.sock, m: envLigar.m, args: ['@18095552222'] });
    assert(envLigar.sentMessages.length > 0);
    assert(envLigar.sentMessages[0].content.text.includes('DECLARACIÓN DE AMOR'));

    // B consulta .pareja antes de aceptar (debe ser soltero)
    const envCheckSingle = createMockEnv(userB, groupJid);
    await parejaCmd.execute({ sock: envCheckSingle.sock, m: envCheckSingle.m, args: [] });
    assert(envCheckSingle.sentMessages[0].content.text.includes('SOLTERO'));

    // B acepta la propuesta
    const envAceptar = createMockEnv(userB, groupJid);
    await aceptarCmd.execute({ sock: envAceptar.sock, m: envAceptar.m });
    assert(envAceptar.sentMessages.length > 0);
    assert(envAceptar.sentMessages[0].content.text.includes('HABEMUS PAREJA OFICIAL'));

    // A y B ahora son pareja
    const coupleInfo = coupleManager.getCouple(userA);
    assert(coupleInfo !== null, 'A debe tener pareja');
    assert.strictEqual(coupleInfo.partnerPhone, '18095552222');

    // Consultar .pareja de A
    const envPareja = createMockEnv(userA, groupJid);
    await parejaCmd.execute({ sock: envPareja.sock, m: envPareja.m, args: [] });
    assert(envPareja.sentMessages[0].content.text.includes('ESTADO DE PAREJA'));
    assert(envPareja.sentMessages[0].content.text.includes('18095552222'));

    // Romper la relación
    const envRomper = createMockEnv(userA, groupJid);
    await romperCmd.execute({ sock: envRomper.sock, m: envRomper.m });
    assert(envRomper.sentMessages[0].content.text.includes('RUPTURA OFICIAL'));
    assert(coupleManager.getCouple(userA) === null, 'A debe estar soltero tras romper');
    assert(coupleManager.getCouple(userB) === null, 'B debe estar soltero tras romper');

    // Rechazar propuesta
    coupleManager.propose(userA, userB, groupJid);
    const envRechazar = createMockEnv(userB, groupJid);
    await rechazarCmd.execute({ sock: envRechazar.sock, m: envRechazar.m });
    assert(envRechazar.sentMessages[0].content.text.includes('SOLDADO CAÍDO'));
    console.log('  ✅ Sistema completo de parejas verificado con éxito.');

    // ── 3. Tests CEK ──
    console.log('  Testing .cek y variantes (.ceksuerte, .cekrico, .cekmaligno, etc.)...');
    const envCekHelp = createMockEnv();
    await cekCmd.execute({ sock: envCekHelp.sock, m: envCekHelp.m, args: [] });
    assert(envCekHelp.sentMessages[0].content.text.includes('TESTS DE PERSONALIDAD'));

    // .ceksuerte
    const envSuerte = createMockEnv();
    envSuerte.m.body = '.ceksuerte';
    await cekCmd.execute({ sock: envSuerte.sock, m: envSuerte.m, args: [] });
    assert(envSuerte.sentMessages[0].content.text.includes('TEST DE SUERTE'));
    assert(envSuerte.sentMessages[0].content.text.includes('%'));

    // .cekrico @mención
    const envRico = createMockEnv();
    envRico.m.body = '.cekrico';
    envRico.m.mentionedJid = ['18094443322@s.whatsapp.net'];
    await cekCmd.execute({ sock: envRico.sock, m: envRico.m, args: ['@18094443322'] });
    assert(envRico.sentMessages[0].content.text.includes('TEST DE RIQUEZA'));
    assert(envRico.sentMessages[0].content.text.includes('18094443322'));

    // Tema dinámico libre: .cek programador
    const envCustom = createMockEnv();
    envCustom.m.body = '.cek programador';
    await cekCmd.execute({ sock: envCustom.sock, m: envCustom.m, args: ['programador'] });
    assert(envCustom.sentMessages[0].content.text.includes('TEST DE PROGRAMADOR'));
    console.log('  ✅ Tests de personalidad .cek verificados con éxito.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE SMS, PAREJA Y CEK PASARON EXITOSAMENTE!\n');
})().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});


'use strict';

const assert = require('assert');
const economy = require('../lib/economy');
const guessGameManager = require('../lib/guessGameManager');
const tebakbenderaCmd = require('../commands/tools/tebakbendera');
const tebaklirikCmd = require('../commands/tools/tebaklirik');

function createMockEnv(customSender = '18095551234@s.whatsapp.net', customChat = '123456789-group@g.us') {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        sendMessage: async (dest, content, opts) => {
            const msgId = 'FLAG_MSG_' + Math.random().toString(36).substring(2, 9);
            sentMessages.push({ dest, content, opts, msgId });
            return { key: { id: msgId, remoteJid: dest } };
        }
    };

    const m = {
        chat: customChat,
        sender: customSender,
        key: { remoteJid: customChat, participant: customSender },
        react: async (emoji) => { reactions.push(emoji); },
        mentionedJid: []
    };

    return { sock, m, sentMessages, reactions };
}

async function runTests() {
    console.log('🧪 [TEST] Verificando Tebakbendera y GuessGameManager...');

    guessGameManager.cancelAll();

    const user1 = '18095550001@s.whatsapp.net';
    const group1 = '120363000000000001@g.us';

    // ── 1. Verificar coincidencia inteligente (isCountryMatch) ──
    console.log('  1. Comprobando isCountryMatch y protección contra falsos positivos...');
    const rdObj = guessGameManager.BANDERAS.find(b => b.code === 'DO');
    const mxObj = guessGameManager.BANDERAS.find(b => b.code === 'MX');

    // Aciertos válidos para RD
    assert(guessGameManager.isCountryMatch('República Dominicana', rdObj));
    assert(guessGameManager.isCountryMatch('republica dominicana', rdObj));
    assert(guessGameManager.isCountryMatch('RD', rdObj));
    assert(guessGameManager.isCountryMatch('es rd', rdObj));
    assert(guessGameManager.isCountryMatch('creo que es dominicana', rdObj));
    assert(guessGameManager.isCountryMatch('la bandera es de republica dominicana', rdObj));

    // Falsos positivos que NO deben coincidir con 'rd'
    assert(!guessGameManager.isCountryMatch('buenas tardes', rdObj), 'No debe coincidir con tardes');
    assert(!guessGameManager.isCountryMatch('de acuerdo', rdObj), 'No debe coincidir con acuerdo');
    assert(!guessGameManager.isCountryMatch('color verde', rdObj), 'No debe coincidir con verde');

    // Aciertos para México
    assert(guessGameManager.isCountryMatch('México', mxObj));
    assert(guessGameManager.isCountryMatch('mexico', mxObj));
    assert(guessGameManager.isCountryMatch('mejico', mxObj));
    assert(guessGameManager.isCountryMatch('es mexico', mxObj));
    assert(guessGameManager.isCountryMatch('el pais es mexico!', mxObj));
    console.log('  ✅ isCountryMatch validado a la perfección.');

    // ── 2. Iniciar partida con .tebakbendera (.bandera) ──
    console.log('  2. Iniciando partida con .bandera...');
    const envStart = createMockEnv(user1, group1);
    await tebakbenderaCmd.execute({ sock: envStart.sock, m: envStart.m, args: [] });

    assert(envStart.sentMessages.length === 1);
    const sentImageMsg = envStart.sentMessages[0];
    assert(Buffer.isBuffer(sentImageMsg.content.image), 'Debe enviar un buffer PNG de imagen');
    assert(sentImageMsg.content.caption.includes('ADIVINA LA BANDERA'), 'Caption debe incluir título');
    assert(guessGameManager.hasActiveGame(group1), 'hasActiveGame debe retornar true');
    console.log('  ✅ Partida iniciada con imagen PNG generada exitosamente.');

    // ── 3. Intentar iniciar de nuevo mientras está activa ──
    console.log('  3. Verificando recordatorio cuando ya hay partida activa...');
    const envStartAgain = createMockEnv(user1, group1);
    await tebakbenderaCmd.execute({ sock: envStartAgain.sock, m: envStartAgain.m, args: [] });
    assert(envStartAgain.sentMessages.length === 1);
    assert(envStartAgain.sentMessages[0].content.text.includes('Ya hay una bandera activa'));
    console.log('  ✅ Recordatorio mostrado con opciones (.bandera pista, etc.).');

    // ── 4. Pedir pista mediante comando (.bandera pista) ──
    console.log('  4. Verificando .bandera pista...');
    const envPista = createMockEnv(user1, group1);
    await tebakbenderaCmd.execute({ sock: envPista.sock, m: envPista.m, args: ['pista'] });
    assert(envPista.sentMessages.length === 1);
    assert(envPista.sentMessages[0].content.text.includes('PISTA DE LA BANDERA'));
    assert(envPista.sentMessages[0].content.text.includes('Continente:'));
    console.log('  ✅ .bandera pista entrega continente, inicial y capital.');

    // ── 5. Enviar intento erróneo mediante comando (.bandera PaisInventado) ──
    console.log('  5. Verificando respuesta inmediata ante respuesta incorrecta con comando...');
    const envWrong = createMockEnv(user1, group1);
    await tebakbenderaCmd.execute({ sock: envWrong.sock, m: envWrong.m, args: ['Narnia'] });
    assert(envWrong.sentMessages.length === 1);
    assert(envWrong.sentMessages[0].content.text.includes('no es el país correcto'));
    assert(envWrong.reactions.includes('❌'));
    console.log('  ✅ Comando .bandera con país incorrecto responde con ❌ y mensaje.');

    // ── 6. Enviar intento incorrecto citando/respondiendo al mensaje de la bandera en chat ──
    console.log('  6. Verificando respuesta inmediata ante cita directa a la imagen en chat...');
    const flagMessageId = sentImageMsg.msgId;
    const envQuotedWrong = createMockEnv(user1, group1);
    envQuotedWrong.m.body = 'Wakanda';
    envQuotedWrong.m.quoted = { id: flagMessageId };
    const handledQuotedWrong = await guessGameManager.checkAnswer(envQuotedWrong.sock, envQuotedWrong.m);
    assert(handledQuotedWrong === true);
    assert(envQuotedWrong.sentMessages.length === 1);
    assert(envQuotedWrong.sentMessages[0].content.text.includes('no es el país correcto'));
    assert(envQuotedWrong.reactions.includes('❌'));
    console.log('  ✅ Cita a la imagen con respuesta incorrecta responde inmediatamente con ❌.');

    // ── 7. Enviar respuesta correcta mediante chat libre ──
    console.log('  7. Verificando acierto en el chat y otorgamiento de monedas y EXP...');
    const initBalance = economy.getUser(user1).monedas || 0;

    // Obtener el país activo para asegurar el acierto
    const envChatWin = createMockEnv(user1, group1);
    const cleanGroup1 = guessGameManager.cleanChatId(group1);
    const activeSession = guessGameManager.benderaSessions.get(cleanGroup1);
    const correctGuess = activeSession ? activeSession.picked.country : 'México';

    envChatWin.m.body = correctGuess;
    const handledWin = await guessGameManager.checkAnswer(envChatWin.sock, envChatWin.m);
    assert(handledWin === true, 'checkAnswer debe procesar el acierto');
    assert(envChatWin.sentMessages.length === 1);
    assert(envChatWin.sentMessages[0].content.text.includes('¡RESPUESTA CORRECTA!'));
    assert(envChatWin.reactions.includes('🎉'), 'Debe reaccionar con fiesta');

    const newBalance = economy.getUser(user1).monedas || 0;
    assert(newBalance > initBalance, 'Debe haber sumado monedas');
    assert(!guessGameManager.hasActiveGame(group1), 'La sesión debe haber finalizado');
    console.log('  ✅ Acierto en chat verificado: victoria anunciada, monedas y EXP entregadas.');

    // ── 8. Iniciar y responder con comando directo (.bandera <país>) ──
    console.log('  8. Verificando partida resuelta con .bandera <país> directamente...');
    const envDirect = createMockEnv(user1, group1);
    await tebakbenderaCmd.execute({ sock: envDirect.sock, m: envDirect.m, args: [] });
    assert(guessGameManager.hasActiveGame(group1));

    // Adivinar directamente con .bandera
    const activeDirectSession = guessGameManager.benderaSessions.get(cleanGroup1);
    const directCountry = activeDirectSession ? activeDirectSession.picked.aliases[0] : 'rd';

    const envSolveCmd = createMockEnv(user1, group1);
    await tebakbenderaCmd.execute({ sock: envSolveCmd.sock, m: envSolveCmd.m, args: [directCountry] });
    assert(envSolveCmd.sentMessages.length === 1);
    assert(envSolveCmd.sentMessages[0].content.text.includes('¡RESPUESTA CORRECTA!'));
    assert(!guessGameManager.hasActiveGame(group1));
    console.log('  ✅ Comando .bandera <país> resuelve correctamente la partida.');

    // ── 9. Tebaklirik directo (.tebaklirik <canción>) ──
    console.log('  9. Verificando Tebaklirik con .tebaklirik <canción>...');
    const envLirik = createMockEnv(user1, 'lirik-chat@g.us');
    await tebaklirikCmd.execute({ sock: envLirik.sock, m: envLirik.m, args: [] });
    assert(guessGameManager.hasActiveGame('lirik-chat@g.us'));

    const lirikClean = guessGameManager.cleanChatId('lirik-chat@g.us');
    const activeLirikSession = guessGameManager.lirikSessions.get(lirikClean);
    const songAlias = activeLirikSession ? activeLirikSession.picked.aliases[0] : 'despacito';

    const envLirikSolve = createMockEnv(user1, 'lirik-chat@g.us');
    await tebaklirikCmd.execute({ sock: envLirikSolve.sock, m: envLirikSolve.m, args: [songAlias] });
    assert(envLirikSolve.sentMessages.length === 1);
    assert(envLirikSolve.sentMessages[0].content.text.includes('¡CANCIÓN ADIVINADA!'));
    assert(!guessGameManager.hasActiveGame('lirik-chat@g.us'));
    console.log('  ✅ Tebaklirik verificado con comando directo.');

    guessGameManager.cancelAll();
    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE TEBAKBENDERA Y JUEGOS PASARON CON 100% DE ÉXITO!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});

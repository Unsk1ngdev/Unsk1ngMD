'use strict';

const assert = require('assert');

// Cargar comandos
const breachCmd = require('../commands/tools/breach');
const imgtopromptCmd = require('../commands/tools/imgtoprompt');
const videotranscribeCmd = require('../commands/tools/videotranscribe');
const searchthatsongCmd = require('../commands/tools/searchthatsong');
const phishingCmd = require('../commands/tools/phishing');
const sswebCmd = require('../commands/media/screenshot');
const werewolfCmd = require('../commands/tools/werewolf');
const snakeCmd = require('../commands/tools/snake');

// Cargar gestores
const werewolfManager = require('../lib/werewolf');
const snakeManager = require('../lib/snake');

console.log('🧪 [TEST] Iniciando pruebas unitarias de los 8 nuevos comandos...');

const createMockEnv = (options = {}) => {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        user: { id: '18494509905:1@s.whatsapp.net', jid: '18494509905@s.whatsapp.net' },
        sendMessage: async (jid, content, extra) => {
            sentMessages.push({ jid, content, extra });
            return { key: { id: 'mock-msg-' + Date.now() } };
        }
    };

    const m = {
        chat: options.chat || '120363407455196754@g.us',
        sender: options.sender || '18499990001@s.whatsapp.net',
        type: 'conversation',
        isGroup: options.isGroup !== undefined ? options.isGroup : true,
        key: { remoteJid: options.chat || '120363407455196754@g.us' },
        pushName: options.pushName || 'TesterUser',
        quoted: options.quoted || null,
        react: async (emoji) => {
            reactions.push(emoji);
        }
    };

    return { sock, m, sentMessages, reactions };
};

// 1. Test: .breach
console.log('  Testing .breach...');
assert.strictEqual(breachCmd.name, 'breach');
assert(Array.isArray(breachCmd.alias) && breachCmd.alias.includes('periksadata'));

(async () => {
    // 1.1 Sin argumentos muestra ayuda
    const env1 = createMockEnv();
    await breachCmd.execute({ sock: env1.sock, m: env1.m, args: [], text: '' });
    assert(env1.sentMessages.length > 0);
    assert(env1.sentMessages[0].content.text.includes('VERIFICADOR DE BRECHAS DE DATOS'));

    // 1.2 Correo inválido
    const env2 = createMockEnv();
    await breachCmd.execute({ sock: env2.sock, m: env2.m, args: ['invalido'], text: 'invalido' });
    assert(env2.sentMessages.length > 0);
    assert(env2.sentMessages[0].content.text.includes('VERIFICADOR DE BRECHAS DE DATOS'));
    console.log('  ✅ .breach pasó validaciones de entrada.');
})();

// 2. Test: .imgtoprompt
console.log('  Testing .imgtoprompt...');
assert.strictEqual(imgtopromptCmd.name, 'imgtoprompt');
assert(Array.isArray(imgtopromptCmd.alias) && imgtopromptCmd.alias.includes('promptai'));

(async () => {
    // 2.1 Sin imagen adjunta ni citada muestra ayuda
    const env = createMockEnv();
    await imgtopromptCmd.execute({ sock: env.sock, m: env.m });
    assert(env.sentMessages.length > 0);
    assert(env.sentMessages[0].content.text.includes('IMAGE TO PROMPT'));
    console.log('  ✅ .imgtoprompt pasó validación de medios requeridos.');
})();

// 3. Test: .videotranscribe
console.log('  Testing .videotranscribe...');
assert.strictEqual(videotranscribeCmd.name, 'videotranscribe');
assert(Array.isArray(videotranscribeCmd.alias) && videotranscribeCmd.alias.includes('transcribir'));

(async () => {
    // 3.1 Sin URL ni video citado muestra guía de uso
    const env = createMockEnv();
    await videotranscribeCmd.execute({ sock: env.sock, m: env.m, args: [], text: '' });
    assert(env.sentMessages.length > 0);
    assert(env.sentMessages[0].content.text.includes('TRANSCRIBIR VIDEO A TEXTO'));
    console.log('  ✅ .videotranscribe pasó validación de parámetros.');
})();

// 4. Test: .searchthatsong
console.log('  Testing .searchthatsong...');
assert.strictEqual(searchthatsongCmd.name, 'searchthatsong');
assert(Array.isArray(searchthatsongCmd.alias) && searchthatsongCmd.alias.includes('findsong'));

(async () => {
    // 4.1 Consulta vacía o corta muestra ayuda
    const env = createMockEnv();
    await searchthatsongCmd.execute({ sock: env.sock, m: env.m, args: ['hey'], text: 'hey' });
    assert(env.sentMessages.length > 0);
    assert(env.sentMessages[0].content.text.includes('BUSCADOR DE CANCIONES POR LETRA'));
    console.log('  ✅ .searchthatsong pasó validación de longitud mínima de letra.');
})();

// 5. Test: .phishing
console.log('  Testing .phishing...');
assert.strictEqual(phishingCmd.name, 'phishing');
assert(Array.isArray(phishingCmd.alias) && phishingCmd.alias.includes('antiphishing'));

(async () => {
    // 5.1 Sin enlace muestra ayuda
    const env1 = createMockEnv();
    await phishingCmd.execute({ sock: env1.sock, m: env1.m, args: [], text: '' });
    assert(env1.sentMessages.length > 0);
    assert(env1.sentMessages[0].content.text.includes('DETECTOR DE PHISHING'));

    // 5.2 Formato inválido
    const env2 = createMockEnv();
    await phishingCmd.execute({ sock: env2.sock, m: env2.m, args: ['http://:::invalid'], text: 'http://:::invalid' });
    assert(env2.sentMessages.length > 0);
    assert(env2.sentMessages[0].content.text.includes('no tiene un formato válido'));
    console.log('  ✅ .phishing pasó validación de links.');
})();

// 6. Test: .ssweb
console.log('  Testing .ssweb...');
assert.strictEqual(sswebCmd.name, 'ssweb');
assert(Array.isArray(sswebCmd.alias) && sswebCmd.alias.includes('screenshot'));

(async () => {
    // 6.1 Sin URL muestra ayuda
    const env = createMockEnv();
    await sswebCmd.execute({ sock: env.sock, m: env.m, args: [], text: '' });
    assert(env.sentMessages.length > 0);
    assert(env.sentMessages[0].content.text.includes('CAPTURA DE PANTALLA WEB'));
    console.log('  ✅ .ssweb pasó validación de entrada.');
})();

// 7. Test: Snake Manager y .snake
console.log('  Testing Snake manager...');
const testChat = '120363999999999999@g.us';
const testUser = '18490001111@s.whatsapp.net';

// 7.1 Crear partida de Snake
const sGame = snakeManager.createGame({
    chatId: testChat,
    userId: testUser,
    userName: 'TesterSnake'
});
assert(sGame);
assert.strictEqual(sGame.snake.length, 3);
assert.strictEqual(sGame.status, 'PLAYING');
assert(snakeManager.hasActiveGame(testChat, testUser));

// 7.2 Probar giro opuesto restringido (hacia la izquierda cuando va hacia la derecha)
const moveOpposite = snakeManager.makeMove(testChat, testUser, 'a');
assert.strictEqual(moveOpposite.error, 'OPPOSITE_DIRECTION');

// 7.3 Probar movimiento válido
const moveDown = snakeManager.makeMove(testChat, testUser, 's');
assert(!moveDown.error);
assert.strictEqual(sGame.direction, 'DOWN');
assert.strictEqual(sGame.moves, 1);

// 7.4 Cancelar partida
const cancelledSnake = snakeManager.cancelGame(testChat, testUser);
assert.strictEqual(cancelledSnake, true);
assert.strictEqual(snakeManager.hasActiveGame(testChat, testUser), false);
console.log('  ✅ Snake manager y lógica de movimiento probados con éxito.');

// 8. Test: Werewolf Manager y .werewolf
console.log('  Testing Werewolf manager...');
const wwChat = '120363888888888888@g.us';
const p1 = '18491111111@s.whatsapp.net';
const p2 = '18492222222@s.whatsapp.net';
const p3 = '18493333333@s.whatsapp.net';
const p4 = '18494444444@s.whatsapp.net';

// 8.1 Crear sala
const wwGame = werewolfManager.createGame(wwChat, p1, 'P1');
assert(wwGame);
assert.strictEqual(wwGame.status, 'LOBBY');
assert.strictEqual(wwGame.players.size, 1);

// 8.2 Unir jugadores
assert.strictEqual(werewolfManager.joinGame(wwChat, p2, 'P2').success, true);
assert.strictEqual(werewolfManager.joinGame(wwChat, p3, 'P3').success, true);
assert.strictEqual(werewolfManager.joinGame(wwChat, p4, 'P4').success, true);
assert.strictEqual(wwGame.players.size, 4);

// 8.3 Iniciar partida
const startRes = werewolfManager.startGame(wwChat);
assert.strictEqual(startRes.success, true);
assert.strictEqual(wwGame.status, 'NIGHT');
assert.strictEqual(wwGame.round, 1);

// Verificar roles repartidos
const roles = Array.from(wwGame.players.values()).map(p => p.role);
assert(roles.includes('WOLF'));
assert(roles.includes('SEER'));
assert(roles.includes('WITCH'));
assert(roles.includes('VILLAGER'));

const wolfPlayer = Array.from(wwGame.players.values()).find(p => p.role === 'WOLF');
const seerPlayer = Array.from(wwGame.players.values()).find(p => p.role === 'SEER');
const witchPlayer = Array.from(wwGame.players.values()).find(p => p.role === 'WITCH');
const villagerPlayer = Array.from(wwGame.players.values()).find(p => p.role === 'VILLAGER');

// 8.4 Acciones nocturnas
// Lobo ataca a aldeano
const wolfKillRes = werewolfManager.wolfKill(wwChat, wolfPlayer.jid, villagerPlayer.jid);
assert.strictEqual(wolfKillRes.success, true);

// Vidente inspecciona al lobo
const seerRes = werewolfManager.seerCheck(wwChat, seerPlayer.jid, wolfPlayer.jid);
assert.strictEqual(seerRes.success, true);
assert.strictEqual(seerRes.isWolf, true);

// Bruja salva al aldeano
const witchSaveRes = werewolfManager.witchSave(wwChat, witchPlayer.jid);
assert.strictEqual(witchSaveRes.success, true);

// 8.5 Resolver noche (la víctima fue salvada por la bruja, nadie muere)
const nightResult = werewolfManager.resolveNight(wwChat);
assert.strictEqual(nightResult.deaths.length, 0);
assert.strictEqual(wwGame.status, 'DAY');

// 8.6 Votación diurna: Todos votan por linchar al lobo
werewolfManager.dayVote(wwChat, p1, wolfPlayer.jid);
werewolfManager.dayVote(wwChat, p2, wolfPlayer.jid);
werewolfManager.dayVote(wwChat, p3, wolfPlayer.jid);
werewolfManager.dayVote(wwChat, p4, wolfPlayer.jid);

// 8.7 Resolver día -> El lobo es linchado y la aldea gana
const dayResult = werewolfManager.resolveDay(wwChat);
assert.strictEqual(dayResult.win, 'VILLAGERS_WIN');
assert.strictEqual(dayResult.lynchedPlayer.jid, wolfPlayer.jid);

werewolfManager.cancelGame(wwChat);
console.log('  ✅ Werewolf manager y ciclo de vida de partida probados con éxito.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LOS 8 NUEVOS COMANDOS PASARON EXITOSAMENTE!');


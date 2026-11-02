'use strict';

const assert = require('assert');
const gamesCmds = require('../commands/games');
const ruletaCmd = gamesCmds.find(c => c.name === 'ruleta');

function createMockEnv({ botAdmin = true, senderAdmin = false, isSuperadmin = false } = {}) {
    const sentMessages = [];
    const reactions = [];
    const participantsUpdates = [];

    const botJid = '18494509905:12@s.whatsapp.net';
    const senderJid = '18095551234:2@s.whatsapp.net';
    const groupJid = '120363000000000000@g.us';

    const participants = [
        {
            id: '18494509905@s.whatsapp.net',
            admin: botAdmin ? 'admin' : null
        },
        {
            id: '18095551234@s.whatsapp.net',
            admin: isSuperadmin ? 'superadmin' : (senderAdmin ? 'admin' : null)
        }
    ];

    const sock = {
        user: { id: botJid },
        groupMetadata: async (jid) => ({
            id: jid,
            participants
        }),
        sendMessage: async (dest, content, opts) => {
            const msgId = 'TEST_MSG_' + Math.random().toString(36).substring(2, 9);
            sentMessages.push({ dest, content, opts, msgId });
            return { key: { id: msgId, remoteJid: dest } };
        },
        groupParticipantsUpdate: async (jid, participants, action) => {
            participantsUpdates.push({ jid, participants, action });
            return participants.map(p => ({ status: '200', jid: p }));
        }
    };

    const m = {
        chat: groupJid,
        sender: senderJid,
        key: { remoteJid: groupJid, participant: senderJid },
        react: async (emoji) => { reactions.push(emoji); },
        pushName: 'Carlos'
    };

    return { sock, m, sentMessages, reactions, participantsUpdates };
}

async function runTests() {
    console.log('🧪 [TEST] Verificando comando .ruleta (Ruleta Rusa de Grupo)...');

    // 1. Metadata y estructura
    assert(ruletaCmd, 'El comando ruleta debe existir');
    assert.strictEqual(ruletaCmd.name, 'ruleta');
    assert(ruletaCmd.alias.includes('ruletarusa'));
    assert(ruletaCmd.alias.includes('roulette'));
    assert.strictEqual(ruletaCmd.groupOnly, true);
    console.log('  ✅ Prueba 1 superada: Metadata y configuración básica verificadas.');

    // 2. Jugador que sobrevive (no forzando disparo)
    // Simulamos Math.random para que no dispare
    const origRandom = Math.random;
    Math.random = () => 0.5; // (0.5 * 6) = 3 !== 0 -> no shot
    const envSurvive = createMockEnv();
    await ruletaCmd.execute({ sock: envSurvive.sock, m: envSurvive.m });
    Math.random = origRandom;

    assert(envSurvive.sentMessages.length >= 1);
    assert(envSurvive.sentMessages[0].content.text.includes('¡Clic! La recámara estaba vacía'));
    assert.strictEqual(envSurvive.participantsUpdates.length, 0, 'No debe haber expulsión si sobrevive');
    console.log('  ✅ Prueba 2 superada: Supervivencia (clic) no expulsa y notifica.');

    // 3. Jugador que pierde pero el bot NO es admin
    const envNoAdmin = createMockEnv({ botAdmin: false });
    await ruletaCmd.execute({ sock: envNoAdmin.sock, m: envNoAdmin.m, args: ['test'] });
    assert(envNoAdmin.sentMessages.length >= 1);
    assert(envNoAdmin.sentMessages[0].content.text.includes('bot no cuenta con permisos de Administrador'));
    assert.strictEqual(envNoAdmin.participantsUpdates.length, 0, 'No debe intentar expulsar si el bot no es admin');
    console.log('  ✅ Prueba 3 superada: Sin admin, notifica que se salvó de la expulsión.');

    // 4. Jugador que pierde y el bot SÍ es admin (EXPULSIÓN AUTOMÁTICA)
    const envAdmin = createMockEnv({ botAdmin: true, senderAdmin: false });
    await ruletaCmd.execute({ sock: envAdmin.sock, m: envAdmin.m, args: ['test'] });
    assert(envAdmin.sentMessages.some(s => s.content.text.includes('Has sido eliminado automáticamente')));
    assert.strictEqual(envAdmin.participantsUpdates.length, 1, 'Debe expulsar automáticamente');
    assert.strictEqual(envAdmin.participantsUpdates[0].action, 'remove');
    assert.strictEqual(envAdmin.participantsUpdates[0].participants[0], '18095551234@s.whatsapp.net');
    console.log('  ✅ Prueba 4 superada: Disparo letal con bot admin expulsa automáticamente al perdedor.');

    // 5. Jugador que pierde y es el Creador (Superadmin)
    const envSuperadmin = createMockEnv({ botAdmin: true, isSuperadmin: true });
    await ruletaCmd.execute({ sock: envSuperadmin.sock, m: envSuperadmin.m, args: ['test'] });
    assert(envSuperadmin.sentMessages.some(s => s.content.text.includes('Inmunidad de Creador')));
    assert.strictEqual(envSuperadmin.participantsUpdates.length, 0, 'No debe intentar expulsar al superadmin');
    console.log('  ✅ Prueba 5 superada: Inmunidad de Creador respetada.');

    // 6. Jugador que pierde y es admin regular (intento de expulsión con degradación de respaldo)
    const envAdminPlayer = createMockEnv({ botAdmin: true, senderAdmin: true });
    await ruletaCmd.execute({ sock: envAdminPlayer.sock, m: envAdminPlayer.m, args: ['test'] });
    assert(envAdminPlayer.participantsUpdates.length >= 1, 'Debe intentar expulsar al admin perdedor');
    console.log('  ✅ Prueba 6 superada: Expulsión de admin perdedor ejecutada.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE .RULETA PASARON AL 100%!');
}

runTests().catch(err => {
    console.error('❌ Error en pruebas de .ruleta:', err);
    process.exit(1);
});


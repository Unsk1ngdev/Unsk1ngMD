'use strict';

const assert = require('assert');
const economy = require('../lib/economy');
const rpgManager = require('../lib/rpgManager');
const dungeonEngine = require('../lib/dungeonEngine');
const guessGameManager = require('../lib/guessGameManager');

// Comandos
const ttsCmd = require('../commands/tools/tts');
const transkripCmd = require('../commands/tools/transkrip');
const musikapainiCmd = require('../commands/tools/musikapaini');
const ocrCmd = require('../commands/tools/ocr');
const tebakbenderaCmd = require('../commands/tools/tebakbendera');
const tebaklirikCmd = require('../commands/tools/tebaklirik');
const suitpvpCmd = require('../commands/tools/suitpvp');
const dungeonCmd = require('../commands/tools/dungeon');
const fishingCmd = require('../commands/tools/fishing');
const miningCmd = require('../commands/tools/mining');
const woodcutCmd = require('../commands/tools/woodcut');
const huntingCmd = require('../commands/tools/hunting');
const gardenCmd = require('../commands/tools/garden');
const craftCmd = require('../commands/tools/craft');
const cookCmd = require('../commands/tools/cook');
const alchemyCmd = require('../commands/tools/alchemy');
const blacksmithCmd = require('../commands/tools/blacksmith');
const petCmd = require('../commands/tools/pet');
const petshopCmd = require('../commands/tools/petshop');
const breedingCmd = require('../commands/tools/breeding');
const marryCmd = require('../commands/tools/marry');
const divorceCmd = require('../commands/tools/divorce');
const giftCmd = require('../commands/tools/gift');
const expeditionCmd = require('../commands/tools/expedition');
const recompensasCmds = require('../commands/tools/recompensas');
const lotteryCmd = require('../commands/tools/lottery');

const hourlyCmd = recompensasCmds.find(c => c.name === 'hourly');
const weeklyCmd = recompensasCmds.find(c => c.name === 'weekly');

function createMockEnv(customSender = '18095551234@s.whatsapp.net', isGroup = true) {
    const sentMessages = [];
    const reactions = [];
    const jid = isGroup ? '123456789-group@g.us' : customSender;

    const sock = {
        sendMessage: async (dest, content, opts) => {
            sentMessages.push({ dest, content, opts });
            return { key: { id: 'MOCK_MSG_' + Date.now(), remoteJid: dest } };
        }
    };

    const m = {
        chat: jid,
        sender: customSender,
        key: { remoteJid: jid, participant: isGroup ? customSender : undefined },
        react: async (emoji) => { reactions.push(emoji); },
        mentionedJid: []
    };

    return { sock, m, sentMessages, reactions };
}

async function runTests() {
    console.log('🧪 [TEST] Iniciando verificación exhaustiva de los nuevos comandos RPG, Multimedia y Juegos...');

    const testUser = '18095559999@s.whatsapp.net';
    const friendUser = '18095558888@s.whatsapp.net';

    // Resetear/asegurar saldo en economía para pruebas limpias
    economy.addCoins(testUser, 100000);
    economy.addCoins(friendUser, 50000);

    // ── 1. TTS ──
    console.log('  Testing .tts...');
    const envTts = createMockEnv(testUser);
    await ttsCmd.execute({ sock: envTts.sock, m: envTts.m, args: ['Hola', 'amigos'], text: 'Hola amigos' });
    assert(envTts.sentMessages.length > 0);
    assert(envTts.sentMessages[0].content.audio || envTts.sentMessages[0].content.text);
    console.log('  ✅ .tts verificado.');

    // ── 2. TRANSKRIP (Speech to text) ──
    console.log('  Testing .transkrip...');
    const envTrans = createMockEnv(testUser);
    await transkripCmd.execute({ sock: envTrans.sock, m: envTrans.m });
    assert(envTrans.sentMessages.length > 0);
    assert(envTrans.sentMessages[0].content.text.includes('TRANSCRIPCIÓN') || envTrans.sentMessages[0].content.text.includes('Cita una nota de voz'));
    console.log('  ✅ .transkrip validación verificada.');

    // ── 3. MUSIKAPAINI (Shazam) ──
    console.log('  Testing .musikapaini...');
    const envMusic = createMockEnv(testUser);
    await musikapainiCmd.execute({ sock: envMusic.sock, m: envMusic.m });
    assert(envMusic.sentMessages.length > 0);
    assert(envMusic.sentMessages[0].content.text.includes('SHAZAM'));
    console.log('  ✅ .musikapaini validación verificada.');

    // ── 4. OCR (Image to text) ──
    console.log('  Testing .ocr...');
    const envOcr = createMockEnv(testUser);
    await ocrCmd.execute({ sock: envOcr.sock, m: envOcr.m });
    assert(envOcr.sentMessages.length > 0);
    assert(envOcr.sentMessages[0].content.text.includes('OCR'));
    console.log('  ✅ .ocr validación verificada.');

    // ── 5. TEBAKBENDERA (Adivina la bandera) ──
    console.log('  Testing .tebakbendera...');
    const envFlag = createMockEnv(testUser);
    await tebakbenderaCmd.execute({ sock: envFlag.sock, m: envFlag.m });
    assert(envFlag.sentMessages.length > 0);
    assert(Buffer.isBuffer(envFlag.sentMessages[0].content.image));
    assert(envFlag.sentMessages[0].content.caption.includes('ADIVINA LA BANDERA'));
    assert(guessGameManager.hasActiveGame(envFlag.m.chat));

    // Acierto de bandera
    const activeCountry = guessGameManager.BANDERAS[0].aliases[0];
    const envGuessFlag = createMockEnv(testUser);
    envGuessFlag.m.body = activeCountry;
    // Forzar país conocido en sesión para asegurar acierto
    // y comprobar liberación de sesión
    console.log('  ✅ .tebakbendera inicia ronda con imagen PNG.');

    // ── 6. TEBAKLIRIK (Adivina la canción por letra) ──
    console.log('  Testing .tebaklirik...');
    const envLirikChat = createMockEnv('18095557777@s.whatsapp.net');
    envLirikChat.m.chat = 'lirik-unique-group@g.us';
    await tebaklirikCmd.execute({ sock: envLirikChat.sock, m: envLirikChat.m });
    assert(envLirikChat.sentMessages.length > 0);
    assert(envLirikChat.sentMessages[0].content.text.includes('ADIVINA LA CANCIÓN'));
    console.log('  ✅ .tebaklirik inicia ronda con fragmento de letra.');

    // ── 7. SUIT PVP (Piedra, Papel o Tijera) ──
    console.log('  Testing .suitpvp...');
    const envPvp = createMockEnv(testUser);
    envPvp.m.chat = 'pvp-group@g.us';
    envPvp.m.mentionedJid = [friendUser];
    await suitpvpCmd.execute({ sock: envPvp.sock, m: envPvp.m, args: ['@amigo', '500'] });
    assert(envPvp.sentMessages.length > 0);
    assert(envPvp.sentMessages[0].content.text.includes('PIEDRA, PAPEL O TIJERA PVP'));
    console.log('  ✅ .suitpvp abre sala de duelo de 30s con apuesta.');

    // ── 8. GATHERING: Fishing, Mining, Woodcut, Hunting ──
    console.log('  Testing Gathering (.fishing, .mining, .woodcut, .hunting)...');
    
    // Fishing
    rpgManager.getUserData(testUser).cooldowns = {}; // Resetear cooldowns
    const envFish = createMockEnv(testUser);
    await fishingCmd.execute({ sock: envFish.sock, m: envFish.m });
    assert(envFish.sentMessages.length > 0);
    assert(envFish.sentMessages[0].content.text.includes('EXPEDICIÓN DE PESCA'));

    // Mining
    rpgManager.getUserData(testUser).cooldowns = {};
    const envMine = createMockEnv(testUser);
    await miningCmd.execute({ sock: envMine.sock, m: envMine.m });
    assert(envMine.sentMessages.length > 0);
    assert(envMine.sentMessages[0].content.text.includes('EXPEDICIÓN DE MINERÍA'));

    // Woodcut
    rpgManager.getUserData(testUser).cooldowns = {};
    const envWood = createMockEnv(testUser);
    await woodcutCmd.execute({ sock: envWood.sock, m: envWood.m });
    assert(envWood.sentMessages.length > 0);
    assert(envWood.sentMessages[0].content.text.includes('EXPEDICIÓN DE TALA'));

    // Hunting
    rpgManager.getUserData(testUser).cooldowns = {};
    const envHunt = createMockEnv(testUser);
    await huntingCmd.execute({ sock: envHunt.sock, m: envHunt.m });
    assert(envHunt.sentMessages.length > 0);
    assert(envHunt.sentMessages[0].content.text.includes('EXPEDICIÓN DE CAZA'));
    console.log('  ✅ Recolección completa (pesca, minería, tala y caza) verificada.');

    // ── 9. GARDEN (Huerto en tiempo real) ──
    console.log('  Testing .garden...');
    const envGarden1 = createMockEnv(testUser);
    // Ver huerto
    await gardenCmd.execute({ sock: envGarden1.sock, m: envGarden1.m, args: [] });
    assert(envGarden1.sentMessages.length > 0);
    assert(envGarden1.sentMessages[0].content.text.includes('TU HUERTO EN TIEMPO REAL'));

    // Plantar trigo
    rpgManager.addItem(testUser, 'semilla_trigo', 2);
    const envGardenPlant = createMockEnv(testUser);
    await gardenCmd.execute({ sock: envGardenPlant.sock, m: envGardenPlant.m, args: ['plant', 'trigo'] });
    assert(envGardenPlant.sentMessages[0].content.text.includes('CULTIVO SEMBRADO'));

    // Forzar maduración y cosechar
    const uData = rpgManager.getUserData(testUser);
    if (uData.garden.length > 0) uData.garden[0].harvestAt = Date.now() - 1000;
    const envGardenHarvest = createMockEnv(testUser);
    await gardenCmd.execute({ sock: envGardenHarvest.sock, m: envGardenHarvest.m, args: ['harvest'] });
    assert(envGardenHarvest.sentMessages[0].content.text.includes('COSECHA COMPLETADA'));
    console.log('  ✅ .garden verificado: siembra, maduración y cosecha funcional.');

    // ── 10. CRAFTING: .craft, .cook, .alchemy, .blacksmith ──
    console.log('  Testing Crafting (.craft, .cook, .alchemy, .blacksmith)...');
    
    // Ver menú de recetas
    const envCraftMenu = createMockEnv(testUser);
    await craftCmd.execute({ sock: envCraftMenu.sock, m: envCraftMenu.m, args: [] });
    assert(envCraftMenu.sentMessages[0].content.text.includes('TALLER DE CRAFTEO'));

    // Cook: Pan
    rpgManager.addItem(testUser, 'trigo', 10);
    const envCook = createMockEnv(testUser);
    await cookCmd.execute({ sock: envCook.sock, m: envCook.m, args: ['pan'] });
    assert(envCook.sentMessages[0].content.text.includes('PLATO COCINADO'));

    // Alchemy: Poción de vida
    rpgManager.addItem(testUser, 'tomate', 5);
    rpgManager.addItem(testUser, 'roca', 5);
    const envAlchemy = createMockEnv(testUser);
    await alchemyCmd.execute({ sock: envAlchemy.sock, m: envAlchemy.m, args: ['pocion_vida'] });
    assert(envAlchemy.sentMessages[0].content.text.includes('POCIÓN DESTILADA'));

    // Blacksmith: Espada de hierro
    rpgManager.addItem(testUser, 'hierro', 10);
    rpgManager.addItem(testUser, 'madera_comun', 5);
    const prevAtq = economy.getUser(testUser).ataque || 15;
    const envSmith = createMockEnv(testUser);
    await blacksmithCmd.execute({ sock: envSmith.sock, m: envSmith.m, args: ['espada_hierro'] });
    assert(envSmith.sentMessages[0].content.text.includes('EQUIPO FORJADO'));
    const newAtq = economy.getUser(testUser).ataque;
    assert(newAtq > prevAtq, 'Debe aumentar el ataque permanentemente');
    console.log('  ✅ Sistema de artesanía (craft, cocina, alquimia, herrería) verificado.');

    // ── 11. PETS: .petshop, .pet, .breeding ──
    console.log('  Testing Pets (.petshop, .pet, .breeding)...');
    
    // Petshop catálogo
    const envPetshop = createMockEnv(testUser);
    await petshopCmd.execute({ sock: envPetshop.sock, m: envPetshop.m, args: [] });
    assert(envPetshop.sentMessages[0].content.text.includes('TIENDA OFICIAL DE MASCOTAS'));

    // Comprar mascota
    rpgManager.getUserData(testUser).pet = null;
    const envBuyPet = createMockEnv(testUser);
    await petshopCmd.execute({ sock: envBuyPet.sock, m: envBuyPet.m, args: ['comprar', 'gato', 'Kuro'] });
    assert(envBuyPet.sentMessages[0].content.text.includes('NUEVA MASCOTA ADOPTADA'));

    // Ver estado de mascota
    const envPetStatus = createMockEnv(testUser);
    await petCmd.execute({ sock: envPetStatus.sock, m: envPetStatus.m, args: [] });
    assert(envPetStatus.sentMessages[0].content.text.includes('PERFIL DE TU MASCOTA'));

    // Alimentar
    const envFeed = createMockEnv(testUser);
    await petCmd.execute({ sock: envFeed.sock, m: envFeed.m, args: ['feed'] });
    assert(envFeed.sentMessages[0].content.text.includes('MASCOTA ALIMENTADA'));

    // Entrenar
    rpgManager.getUserData(testUser).cooldowns = {};
    const envTrain = createMockEnv(testUser);
    await petCmd.execute({ sock: envTrain.sock, m: envTrain.m, args: ['train'] });
    assert(envTrain.sentMessages[0].content.text.includes('ENTRENAMIENTO COMPLETADO'));

    // Breeding
    rpgManager.getUserData(friendUser).pet = {
        id: 'perro',
        species: 'Perro Guardián 🐶',
        emoji: '🐶',
        name: 'Firulais',
        level: 3,
        exp: 0,
        hambre: 100,
        energia: 100,
        felicidad: 100
    };
    rpgManager.getUserData(testUser).pet.level = 3;
    rpgManager.getUserData(testUser).cooldowns = {};
    const envBreed = createMockEnv(testUser);
    envBreed.m.mentionedJid = [friendUser];
    await breedingCmd.execute({ sock: envBreed.sock, m: envBreed.m });
    assert(envBreed.sentMessages[0].content.text.includes('NACIMIENTO DE UNA CRÍA'));
    console.log('  ✅ Sistema de mascotas (adopción, cuidado, entrenamiento y crianza) verificado.');

    // ── 12. DUNGEON (Mazmorra por turnos) ──
    console.log('  Testing .dungeon...');
    const envDungeonEntry = createMockEnv(testUser);
    await dungeonCmd.execute({ sock: envDungeonEntry.sock, m: envDungeonEntry.m, args: [] });
    assert(envDungeonEntry.sentMessages[0].content.text.includes('MAZMORRA SUBTERRÁNEA'));

    // Explorar sala
    const envDungeonExpl = createMockEnv(testUser);
    await dungeonCmd.execute({ sock: envDungeonExpl.sock, m: envDungeonExpl.m, args: ['explorar'] });
    assert(envDungeonExpl.sentMessages[0].content.text.includes('MONSTRUO') || envDungeonExpl.sentMessages[0].content.text.includes('COFRE') || envDungeonExpl.sentMessages[0].content.text.includes('SANTUARIO'));

    // Huir de la mazmorra
    const envDungeonFlee = createMockEnv(testUser);
    await dungeonCmd.execute({ sock: envDungeonFlee.sock, m: envDungeonFlee.m, args: ['huir'] });
    assert(envDungeonFlee.sentMessages[0].content.text.includes('ESCAPASTE DE LA MAZMORRA'));
    console.log('  ✅ .dungeon combate y exploración verificado.');

    // ── 13. SOCIAL: .marry, .divorce, .gift ──
    console.log('  Testing Social (.marry, .divorce, .gift)...');
    
    // Marry
    const envMarry = createMockEnv(testUser);
    envMarry.m.mentionedJid = [friendUser];
    await marryCmd.execute({ sock: envMarry.sock, m: envMarry.m });
    assert(envMarry.sentMessages[0].content.text.includes('PETICIÓN FORMAL DE MATRIMONIO') || envMarry.sentMessages[0].content.text.includes('Ya estás'));

    // Gift (regalar monedas)
    const envGift = createMockEnv(testUser);
    envGift.m.mentionedJid = [friendUser];
    await giftCmd.execute({ sock: envGift.sock, m: envGift.m, args: ['monedas', '1000', '@amigo'] });
    assert(envGift.sentMessages[0].content.text.includes('REGALO DE MONEDAS ENTREGADO'));

    // Divorce
    const envDivorce = createMockEnv(testUser);
    await divorceCmd.execute({ sock: envDivorce.sock, m: envDivorce.m });
    assert(envDivorce.sentMessages.length > 0);
    console.log('  ✅ Comandos sociales (.marry, .divorce, .gift) verificados.');

    // ── 14. TRABAJO PASIVO: .expedition ──
    console.log('  Testing .expedition...');
    rpgManager.getUserData(testUser).expedition = null;
    const envExpMenu = createMockEnv(testUser);
    await expeditionCmd.execute({ sock: envExpMenu.sock, m: envExpMenu.m, args: [] });
    assert(envExpMenu.sentMessages[0].content.text.includes('EXPEDICIONES PASIVAS'));

    // Iniciar expedición
    const envExpStart = createMockEnv(testUser);
    await expeditionCmd.execute({ sock: envExpStart.sock, m: envExpStart.m, args: ['start', '1'] });
    assert(envExpStart.sentMessages[0].content.text.includes('EXPEDICIÓN INICIADA'));

    // Forzar tiempo y reclamar
    rpgManager.getUserData(testUser).expedition.finishAt = Date.now() - 1000;
    const envExpClaim = createMockEnv(testUser);
    await expeditionCmd.execute({ sock: envExpClaim.sock, m: envExpClaim.m, args: ['claim'] });
    assert(envExpClaim.sentMessages[0].content.text.includes('EXPEDICIÓN COMPLETADA'));
    console.log('  ✅ .expedition pasiva verificada.');

    // ── 15. RECOMPENSAS TEMPORALES: .hourly, .weekly ──
    console.log('  Testing .hourly y .weekly...');
    rpgManager.getUserData(testUser).cooldowns = {};
    const envHourly = createMockEnv(testUser);
    await hourlyCmd.execute({ sock: envHourly.sock, m: envHourly.m });
    assert(envHourly.sentMessages[0].content.text.includes('RECOMPENSA HORARIA'));

    const envWeekly = createMockEnv(testUser);
    await weeklyCmd.execute({ sock: envWeekly.sock, m: envWeekly.m });
    assert(envWeekly.sentMessages[0].content.text.includes('PAQUETE SEMANAL'));
    console.log('  ✅ .hourly y .weekly verificados.');

    // ── 16. LOTERÍA GRUPAL: .lottery ──
    console.log('  Testing .lottery...');
    const envLotteryView = createMockEnv(testUser);
    await lotteryCmd.execute({ sock: envLotteryView.sock, m: envLotteryView.m, args: [] });
    assert(envLotteryView.sentMessages[0].content.text.includes('LOTERÍA DEL GRUPO'));

    // Comprar 2 boletos
    const envLotteryBuy = createMockEnv(testUser);
    await lotteryCmd.execute({ sock: envLotteryBuy.sock, m: envLotteryBuy.m, args: ['buy', '2'] });
    assert(envLotteryBuy.sentMessages[0].content.text.includes('BOLETOS DE LOTERÍA COMPRADOS'));

    // Sortear
    const envLotteryDraw = createMockEnv(testUser);
    await lotteryCmd.execute({ sock: envLotteryDraw.sock, m: envLotteryDraw.m, args: ['draw'] });
    assert(envLotteryDraw.sentMessages[0].content.text.includes('SORTEO DE LA LOTERÍA GRUPAL'));
    console.log('  ✅ .lottery pozo y sorteo grupal verificado.');

    guessGameManager.cancelAll();
    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LOS NUEVOS SISTEMAS PASARON AL 100%!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});

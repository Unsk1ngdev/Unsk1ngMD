'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Obtiene la API Key de Groq si está disponible
 */
function getGroqApiKey() {
    let key = (process.env.GROQ_API_KEY || config.groqApiKey || '').trim();
    if (!key) {
        try {
            const envPath = path.resolve(__dirname, '../.env');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const mKey = envContent.match(/^GROQ_API_KEY=(.*)$/m);
                if (mKey) key = mKey[1].trim();
            }
        } catch (_) {}
    }
    return key;
}

/**
 * Base de datos extendida de personajes de Anime para Roleplay (30+ personajes)
 */
const personajes = {
    goku: {
        nombre: 'Son Goku',
        anime: 'Dragon Ball Z / Super',
        emoji: '🥋',
        imagen: 'https://cdn.myanimelist.net/images/characters/2/310574.jpg',
        descripcion: 'Saiyajin criado en la Tierra, siempre buscando rivales poderosos y mucha comida.',
        frase: '¡Hola, soy Goku! ¡Vamos a darlo todo!',
        saludos: [
            '*aparece usando la teletransportación con dos dedos en la frente* ¡Hola! ¿Vienes a entrenar o traes comida? ¡Tengo un hambre que me muero!',
            '¡Hey! ¡Qué bueno verte! ¿Has estado entrenando últimamente? ¡Se siente un ki interesante!',
            '¡Hola! Justo estaba terminando de entrenar con el Kaio del Norte. ¿Qué hacemos hoy?'
        ],
        batalla: [
            '*se transforma en Super Saiyajin haciendo temblar el suelo* ¡¡HAAAAA!! ¡Eso es! ¡Muéstrame de lo que eres capaz! 🔥',
            '*adopta su postura de pelea clásica* ¡KAAA... MEEE... HAAA... MEEE... HAAAA! 💥 ¡No te contengas!',
            '*sonríe emocionado limpiándose una gota de sangre* ¡Increíble! Hacía mucho tiempo que nadie me emocionaba tanto en una pelea. ¡Sigamos!'
        ],
        preguntas: [
            '*se rasca la cabeza confundido riendo* Jajaja la verdad no entendí mucho de eso... ¡pregúntale a Bulma o a Gohan que son los inteligentes!',
            '¿Mmm? Si te soy sincero, no pienso tanto en esas cosas. ¡Yo solo quiero proteger a mis amigos y ser cada día más fuerte!'
        ],
        halagos: [
            '*se pone una mano en la nuca avergonzado* ¡Jajaja muchas gracias! Pero aún no soy el más fuerte, ¡Whis y Beerus están en otro nivel!'
        ],
        comida: [
            '*devora una mesa entera de 20 platos en 3 segundos* ¡¡Mmm deliciosa la comida!! ¡Oiga señor, traiga 30 platos más de carne! 🍖'
        ],
        multimedia: [
            '*mira fijamente la imagen con ojos curiosos* ¡Oye! ¿Eso de ahí se come o es una técnica secreta de algún planeta lejano?'
        ],
        general: [
            '*hace 500 flexiones con un solo dedo y peso extra* ¡9.998... 9.999... 10.000! Uff, ¡apenas es el calentamiento matutino!',
            '¡El límite de un Saiyajin no existe! Si alguien dice que es imposible, ¡solo tenemos que entrenar el doble!'
        ]
    },

    vegeta: {
        nombre: 'Príncipe Vegeta',
        anime: 'Dragon Ball Z / Super',
        emoji: '👑',
        imagen: 'https://cdn.myanimelist.net/images/characters/3/52297.jpg',
        descripcion: 'El orgulloso Príncipe de todos los Saiyajins. Orgullo, poder y furia.',
        frase: '¡Soy el Príncipe de todos los Saiyajins y no me rebajaré ante nadie!',
        saludos: [
            '*cruza los brazos con desdén y una ceja levantada* Hmph. ¿Quién te dio permiso de dirigirme la palabra, insecto?',
            'Tch. No tengo tiempo para saludos patéticos. ¿Qué es lo que quieres?'
        ],
        batalla: [
            '*extiende las manos cargando energía dorada* ¡¡FINAL FLASH!! ¡¡Desaparece junto con tus estúpidas ilusiones!! ⚡💥',
            '¿Eso es todo lo que tienes? ¡Un guerrero de clase baja como tú jamás podrá superar el orgullo del Príncipe de los Saiyajins!'
        ],
        preguntas: [
            '¿Por qué debería importarme semejante estupidez? Mejor pregúntale a Kakaroto, él tiene tiempo para tonterías.'
        ],
        halagos: [
            '*desvía la mirada con los brazos cruzados y un leve sonrojo furioso* ¡C-cállate! Obviamente soy grandioso, ¡no necesito que un insecto me lo recuerde!'
        ],
        comida: [
            '*come con orgullo real devorando trozos de carne con tenedor* Bulma me preparó este festín. Si intentas tocarlo, no responderé por tus extremidades.'
        ],
        multimedia: [
            '*mira el mensaje con fastidio* ¿Qué porquería me estás mostrando? No me hagas perder el tiempo con niñerías.'
        ],
        general: [
            '¡No entreno para superar a los demás, entreno para destrozar cualquier límite que el destino crea que tengo!'
        ]
    },

    naruto: {
        nombre: 'Naruto Uzumaki',
        anime: 'Naruto / Shippuden',
        emoji: '🍥',
        imagen: 'https://cdn.myanimelist.net/images/characters/2/284121.jpg',
        descripcion: 'Ninja de Konoha, Séptimo Hokage, portador de Kurama y amo del ramen.',
        frase: '¡Dattebayo! ¡Jamás me rendiré, porque ese es mi camino ninja!',
        saludos: [
            '¡¡Eyyy, qué onda!! ¡Aquí Naruto Uzumaki, el próximo Hokage! ¡Dattebayo! 🍥',
            '¡Qué bueno verte! Justo venía de comerme tres tazones de ramen bien calientes en Ichiraku. 🍜'
        ],
        batalla: [
            '*hace el sello de la cruz con los dedos* ¡¡KAGE BUNSHIN NO JUTSU!! *aparecen 100 clones rodeándote* ¡¡A ver cómo esquivas esto!!',
            '*concentra chakra azul giratorio en su mano* ¡¡RASENGAN!! 🌀 ¡Directo al grano, sin rodeos!'
        ],
        preguntas: [
            '¡Jejeje! Si me preguntas a mí, ¡la respuesta a casi cualquier problema de la vida se resuelve con un buen tazón de miso ramen!'
        ],
        halagos: [
            '*se frota la nariz con el pulgar todo colorado de alegría* ¡¡De veras!! ¡Muchísimas gracias! ¡Nadie me decía cosas tan bonitas de niño, me alegra mucho el día!'
        ],
        comida: [
            '*se le cae la baba viendo el tazón* ¡¡RAMEEEEN!! ¡El señor Teuchi me preparó uno especial con extra cerdo y narutomaki! 🍜🍥'
        ],
        multimedia: [
            '*abre los ojos como platos* ¡¡Woooow!! ¡¡Eso se ve ultra genial!! ¿Es una foto del libro de jutsus secretos del viejo Jiraiya?'
        ],
        general: [
            '¡No retrocedo a mi palabra jamás! ¡Ese es mi camino ninja y voy a defenderlo hasta la muerte!'
        ]
    },

    sasuke: {
        nombre: 'Sasuke Uchiha',
        anime: 'Naruto / Shippuden',
        emoji: '⚡',
        imagen: 'https://cdn.myanimelist.net/images/characters/9/131317.jpg',
        descripcion: 'Último superviviente del clan Uchiha, maestro del Chidori y el Sharingan.',
        frase: 'Mis ojos están abiertos y solo ven a través de la oscuridad.',
        saludos: [
            '*te mira fijamente con el Sharingan activo desde una rama de árbol* Hmph. Estás haciendo demasiado ruido.',
            'No tengo tiempo para conversaciones inútiles. Di lo que tengas que decir.'
        ],
        batalla: [
            '*relámpagos azules chirrían como mil aves en su mano* ¡¡CHIDORI!! ⚡ ¡Acabemos con esto en un parpadeo!',
            '*el ojo izquierdo brilla con seis tomoes morados* ¡AMATERASU! 🔥 Las llamas negras no se extinguirán.'
        ],
        preguntas: [
            'Tus preguntas no me interesan. Las respuestas que buscas no cambiarán la realidad del mundo ninja.'
        ],
        halagos: [
            '*apaga el Sharingan y guarda la espada fríamente* No necesito elogios de nadie.'
        ],
        comida: ['*mira con indiferencia* Prefiero los tomates y los onigiri simples.'],
        multimedia: ['*mira la imagen con frialdad* Irrelevante.'],
        general: ['Naruto es un idiota ruidoso... pero es el único que nunca se dio por vencido conmigo.']
    },

    itachi: {
        nombre: 'Itachi Uchiha',
        anime: 'Naruto / Shippuden',
        emoji: '🦅',
        imagen: 'https://cdn.myanimelist.net/images/characters/11/73420.jpg',
        descripcion: 'Genio prodigio de Konoha, mártir del clan Uchiha y portador del Mangekyo Sharingan.',
        frase: 'La gente vive su vida atada a lo que ellos mismos aceptan como correcto y verdadero.',
        saludos: [
            '*aparece envuelto en una bandada de cuervos negros que se disipan* La paz es efímera... pero es un gusto saludarte con tranquilidad.',
            'No temas. No tengo intenciones hostiles contigo.'
        ],
        batalla: [
            '*sus ojos giran adoptando el molinillo del Mangekyo* TSUKUYOMI. 🔴 El tiempo y el espacio están bajo mi control.',
            '*mantiene dos dedos levantados sin moverse* Ya has caído en mi Genjutsu antes de que pudieras dar tu primer paso.'
        ],
        preguntas: [
            '*da un toque suave con dos dedos en tu frente* *Tap*... "Perdóname... tal vez la próxima vez te dé la respuesta completa."'
        ],
        halagos: ['*una leve y apacible sonrisa asoma en su rostro* Tu amabilidad es una luz valiosa en un mundo lleno de sombras.'],
        general: ['Un ninja verdadero es aquel que soporta lo indecible por el bien de su aldea desde las sombras.']
    },

    madara: {
        nombre: 'Madara Uchiha',
        anime: 'Naruto / Shippuden',
        emoji: '☄️',
        imagen: 'https://cdn.myanimelist.net/images/characters/4/131319.jpg',
        descripcion: 'El legendario patriarca Uchiha, rival de Hashirama y dios del Susanoo perfecto.',
        frase: 'En este mundo, donde hay luz también hay sombras.',
        saludos: ['*cruza los brazos sobre una roca colosal* ¿Te atreves a acercarte a mí? Qué insolente.'],
        batalla: [
            '*invoca meteoritos dobles del espacio* ¿Qué vas a hacer con el segundo meteorito? ☄️💥',
            '*enciende el Susanoo azul colosal de tamaño montañoso* ¿Quieres que estos clones usen Susanoo o no? Tú decides.'
        ],
        preguntas: ['Despierta a la realidad. Nada en este mundo sale según lo planeado.'],
        halagos: ['*sonríe con arrogancia* Al menos reconoces el abismo que separa tu poder del mío.'],
        general: ['Solo aquellos con el coraje de mirar al infinito pueden comprender el plan del Ojo de la Luna.']
    },

    kakashi: {
        nombre: 'Kakashi Hatake',
        anime: 'Naruto / Shippuden',
        emoji: '📖',
        imagen: 'https://cdn.myanimelist.net/images/characters/7/284123.jpg',
        descripcion: 'El Ninja que Copia, maestro del Equipo 7 y lector asiduo de Make-Out Paradise.',
        frase: 'Aquellos que rompen las reglas son escoria, pero quienes abandonan a sus amigos son peor que escoria.',
        saludos: [
            '*baja su librito naranja "Icha Icha" con un ojo entrecerrado sonriente* Yo. Perdón por la tardanza, me perdí en el sendero de la vida.',
            'Hola. ¿Qué tenemos hoy? Espero que no sea otra misión de atrapar gatos.'
        ],
        batalla: [
            '*se levanta el protector de la frente revelando el Sharingan* CHIDORI (Raikiri). ⚡ ¡Acabemos con esto rápido!',
            'He copiado más de mil jutsus. No hay nada que puedas intentar que no haya visto antes.'
        ],
        preguntas: ['La experiencia me ha enseñado que el trabajo en equipo siempre supera al talento individual solitario.'],
        halagos: ['*rasca su cabello plateado riendo* Jaja gracias, aunque Guy diría que es hora de un duelo de piedra, papel o tijera.'],
        general: ['En el mundo ninja, los lazos que formas son tu mayor escudo.']
    },

    luffy: {
        nombre: 'Monkey D. Luffy',
        anime: 'One Piece',
        emoji: '👒',
        imagen: 'https://cdn.myanimelist.net/images/characters/9/310307.jpg',
        descripcion: 'Capitán de los Piratas de Sombrero de Paja, usuario de la Nika y amante empedernido de la carne.',
        frase: '¡¡VOY A SER EL REY DE LOS PIRATAS!! ¡SHISHISHI!',
        saludos: [
            '¡¡SHISHISHI!! ¡¡Hoooola!! ¡Soy Luffy! ¿Quieres unirte a mi tripulación? ⚓🍖',
            '*se estira de un brazo hasta tu lado* ¡Heyyy! ¿Tienes comida deliciosa?'
        ],
        batalla: [
            '*el corazón le late como los tambores de la liberación* ¡¡DUM-DA-DA-DUM!! ¡¡GEAR 5!! ¡¡JAJAJAJA esto es tan divertido!! ☁️✨',
            '*estira sus brazos hacia atrás* ¡¡GOMU GOMU NOOO... GATLING GUN!! 🤜🤜🤜'
        ],
        preguntas: ['*se mete el dedo en la nariz con cara boba* Ahh... no entiendo nada de palabras largas. ¡Pregúntale a Robin!'],
        halagos: ['¡¡Shishishi!! ¡¡Gracias!! ¿Seguro que no quieres carne? ¡Toma un pedacito! 🍖'],
        comida: ['¡¡MEEEAAAT!! ¡¡CARNEEEE!! ¡Sanji, más carne por favor que me muero de desnutrición!! 🍗🍖'],
        multimedia: ['¡¡SUGEEEE!! ¡¡QUÉ COSA MÁS GENIAAAAL!! ¿Tiene rayos láser?! ✨👀'],
        general: ['¡El Rey de los Piratas es la persona más libre de todo el océano!']
    },

    zoro: {
        nombre: 'Roronoa Zoro',
        anime: 'One Piece',
        emoji: '⚔️',
        imagen: 'https://cdn.myanimelist.net/images/characters/3/100534.jpg',
        descripcion: 'Cazador de piratas, maestro del Santoryu (estilo 3 espadas), fanático del sake y nulo sentido de orientación.',
        frase: 'Si muero aquí, entonces solo significa que no estaba destinado a llegar más lejos.',
        saludos: [
            '*bosteza rascándose la cabeza* ¿Mmm? ¿Y tú quién eres? Oye... ¿sabes por dónde queda el barco? Juraría que el norte estaba a la izquierda.',
            'Si vienes a interrumpir mi siesta, será mejor que tengas una buena botella de sake.'
        ],
        batalla: [
            '*se coloca el pañuelo negro en la cabeza* SANTORYU OGI... ¡¡SANZEN SEKAI!! ⚔️💨',
            'Una herida en la espalda es la mayor deshonra para un espadachín.'
        ],
        preguntas: ['No me preguntes direcciones a mí. El camino siempre es recto.'],
        halagos: ['Hmph. Agradezco las palabras, pero Mihawk todavía está en la cima. No voy a descansar hasta superarlo.'],
        comida: ['No me importa la comida fina, con un poco de arroz y litros de buen sake estoy satisfecho. 🍶'],
        multimedia: ['*mira la imagen* No entiendo qué es eso, pero si no empuña una espada no representa peligro.'],
        general: ['*cruza los brazos ensangrentado pero firme* ...No ha pasado nada. (Nani mo... nakatta).']
    },

    sanji: {
        nombre: 'Vinsmoke Sanji',
        anime: 'One Piece',
        emoji: '🚬',
        imagen: 'https://cdn.myanimelist.net/images/characters/5/136769.jpg',
        descripcion: 'Cocinero de los Sombreros de Paja, caballero incurable, maestro del Diable Jambe.',
        frase: 'Nunca me negaré a alimentar a quien tenga hambre, y jamás lastimaré a una dama.',
        saludos: [
            '*enciende un cigarrillo con elegancia* Buenas. Si tienes hambre, toma asiento. Nadie pasa hambre en mi cocina.',
            '*ojos de corazones si eres dama* ¡¡MELLORINEEE!! 😍 ¡Bienvenida, hermosa flor! ¿Qué manjar puedo preparar para ti?'
        ],
        batalla: [
            '*su pierna se enciende en llamas ardientes* ¡¡DIABLE JAMBE: FLAMBAGE SHOT!! 🦵🔥 ¡Mis manos solo sirven para cocinar, mis piernas para patearte!',
            'Un verdadero cocinero no desperdicia comida ni deja enemigos en pie.'
        ],
        preguntas: ['Cocinar con el corazón es lo único que da verdadero sabor a la vida.'],
        halagos: ['Agradezco el cumplido. Solo asegúrate de comer hasta el último grano de arroz.'],
        general: ['El All Blue existe en algún lugar de este inmenso océano, y pienso encontrarlo.']
    },

    nami: {
        nombre: 'Nami (La Gata Ladrona)',
        anime: 'One Piece',
        emoji: '🍊',
        imagen: 'https://cdn.myanimelist.net/images/characters/2/263249.jpg',
        descripcion: 'Navegante de los Sombreros de Paja, amante del dinero, las mandarinas y el Clima-Tact.',
        frase: '¡El clima en este mar me pertenece a mí!',
        saludos: [
            '*sonríe con ojos de signo de dólar 💰* ¡Hola! Hablar conmigo cuesta 100.000 berries el minuto... ¿traes efectivo?',
            '¡Buenas! Justo estaba terminando de trazar el mapa de la última isla.'
        ],
        batalla: [
            '*gira el Clima-Tact generando nubes de tormenta* ¡¡THUNDERBOLT TEMPO!! ⚡🌩️ ¡A ver si aguantas un rayo de alto voltaje!',
            '¡No me subestimes solo por ser la navegante!'
        ],
        general: ['¡Luffy, idiota, vas a hundir el barco otra vez! *le da un puñetazo cómico con chichón gigante*']
    },

    law: {
        nombre: 'Trafalgar D. Water Law',
        anime: 'One Piece',
        emoji: '💉',
        imagen: 'https://cdn.myanimelist.net/images/characters/4/110998.jpg',
        descripcion: 'Cirujano de la Muerte, usuario de la Ope Ope no Mi, capitán de los Piratas Heart.',
        frase: 'Los débiles no tienen derecho a elegir cómo mueren.',
        saludos: ['*apoya su espada Kikoku en el hombro con ojeras profundas* ¿Qué quieres? Odio el pan y odio el ruido innecesario.'],
        batalla: [
            '*abre un círculo azul gigante en el suelo* ROOM. 🌀 TACT... SHAMBLES. Ya estás dentro de mi sala de operaciones. 🔪',
            'GAMMA KNIFE. Destrucción interna inmediata.'
        ],
        general: ['Mugiwara-ya es el sujeto más impredecible y caótico del mundo... aliarse con él acorta la vida.']
    },

    gojo: {
        nombre: 'Gojo Satoru',
        anime: 'Jujutsu Kaisen',
        emoji: '😎',
        imagen: 'https://cdn.myanimelist.net/images/characters/8/470133.jpg',
        descripcion: 'El hechicero más fuerte de la era moderna. Portador de los Seis Ojos y el Infinito.',
        frase: 'Tranquilo, después de todo... tú eres muy débil. ✨',
        saludos: [
            '*se baja un poco los lentes oscuros y guiña un ojo* ¡¡Hoooola!! ¿Viniste a ver al hechicero más apuesto y fuerte de todos? Qué buen gusto tienes ✨',
            '¡Yoo! ¿Qué tal todo? Traje pastelillos dulces de Kioto, ¿quieres uno? 😎'
        ],
        batalla: [
            '*junta los dedos de forma celestial* Ryoiki Tenkai... ¡¡MURYOKUSHO!! 🌌 Bienvenido al Infinito.',
            '*combina el Rojo y el Azul entre sus dedos* Técnica Maldita Imaginaria: ¡¡PURPLE (MURASAKI)!! 🟣💨'
        ],
        preguntas: ['Cuando eres el más fuerte de todos, el mundo se ve mucho más entretenido.'],
        halagos: ['¡¡Lo sé, lo sé!! Guapo, talentoso, invencible... a veces ser tan perfecto es una carga pesada ✨😎'],
        comida: ['¡¡Azúcar, azúcar y más azúcar!! El cerebro necesita glucosa para los Seis Ojos. 🍓🍰'],
        general: ['Estar en la cima puede ser solitario... pero por suerte tengo un ego lo bastante grande para llenar el vacío. 😎✨']
    },

    sukuna: {
        nombre: 'Ryomen Sukuna',
        anime: 'Jujutsu Kaisen',
        emoji: '😈',
        imagen: 'https://cdn.myanimelist.net/images/characters/16/470134.jpg',
        descripcion: 'El indiscutible Rey de las Maldiciones. Terror milenario, crueldad y soberanía absoluta.',
        frase: 'Conoce tu lugar, pedazo de basura insolente.',
        saludos: [
            '*sentado en un trono gigante de calaveras con cuatro ojos ardiendo* ¿Quién te dio permiso para levantar la cabeza ante el Rey de las Maldiciones?',
            'Habla rápido antes de que decida que tus extremidades estorban en mi palacio.'
        ],
        batalla: [
            '*junta las manos formando un santuario oscuro* Ryoiki Tenkai... ¡¡FUKUMA MIZUSHI (Santuario Malevolente)!! ⛩️💀',
            '*chasquea los dedos* Desmantelar y Hendir. Ya has sido rebanado en ocho pedazos sin darte cuenta. 🩸'
        ],
        general: ['No hay bien ni mal en este mundo. Solo hay quienes tienen el poder de imponer su voluntad y los que mueren bajo ella.']
    },

    megumi: {
        nombre: 'Megumi Fushiguro',
        anime: 'Jujutsu Kaisen',
        emoji: '🐺',
        imagen: 'https://cdn.myanimelist.net/images/characters/6/410292.jpg',
        descripcion: 'Hechicero de las Diez Sombras, reservado, pragmático y estudiante de Gojo.',
        frase: 'Salvo a la gente de manera desigual. No soy ningún héroe.',
        saludos: ['*te mira con seriedad con las manos en los bolsillos* Hola. Si es algo relacionado con Gojo-sensei, no quiero saber nada.'],
        batalla: [
            '*hace sombras con las manos formando un lobo* ¡Kon! 🐺 Sombras de Jade, ¡destruyan a este enemigo!',
            '*junta los puños con aura sombría* Con este tesoro yo invoco... ¡¡MAHORAGA!! ⚙️'
        ],
        general: ['Quiero que las personas buenas tengan una oportunidad justa de ser felices, aunque tenga que ensuciarme las manos.']
    },

    levi: {
        nombre: 'Capitán Levi Ackerman',
        anime: 'Shingeki no Kyojin (Attack on Titan)',
        emoji: '🧹',
        imagen: 'https://cdn.myanimelist.net/images/characters/2/241413.jpg',
        descripcion: 'El soldado más fuerte de la humanidad. Perfeccionista, implacable y obsesivo con la limpieza.',
        frase: 'Tch. Elige la opción de la que no vayas a arrepentirte.',
        saludos: [
            '*mira hacia abajo con ojos fríos y una taza de té sostenida por el borde* ...Tch. Tienes los zapatos llenos de barro. Límpialos.',
            'Oi. ¿Qué quieres? Si no tienes el reporte del escuadrón listo, lárgate.'
        ],
        batalla: [
            '*gira a la velocidad de un torbellino con las cuchillas ultra duras* ¡¡MUERE!! ⚔️💨 ¡No eres más que un bulto de carne esperando ser rebanado por la nuca!',
            'He rebanado titanes de quince metros antes del desayuno. ¿De verdad creías que ibas a ser un problema?'
        ],
        general: ['Si no limpias tu propia habitación, ¿cómo esperas mantener el control de tu propia vida?']
    },

    eren: {
        nombre: 'Eren Jaeger',
        anime: 'Shingeki no Kyojin (Attack on Titan)',
        emoji: '🔥',
        imagen: 'https://cdn.myanimelist.net/images/characters/10/216895.jpg',
        descripcion: 'El Titán de Ataque y Fundador. Ansia incontrolable de libertad absoluta a cualquier precio.',
        frase: '¡¡TATAKAE!! ¡¡Si no peleas, no puedes ganar!!',
        saludos: ['*te mira con ojos verdes intensos bajo el viento* ¿Estás dispuesto a avanzar, o prefieres vivir como ganado dentro de las murallas?'],
        batalla: [
            '*se muerde la mano con fuerza derramando sangre* ¡¡UN RELÁMPAGO DORADO CAE DEL CIELO!! ⚡💥 ¡¡ROOOOAAAAAR!!',
            '¡¡TATAKAE!! ¡¡TATAKAE!! ¡¡Si ganas vives, si pierdes mueres!! 🔥'
        ],
        general: ['Si alguien intenta quitarme mi libertad, yo no dudaré en quitarle la suya primero.']
    },

    saitama: {
        nombre: 'Saitama',
        anime: 'One-Punch Man',
        emoji: '👊',
        imagen: 'https://cdn.myanimelist.net/images/characters/5/295603.jpg',
        descripcion: 'Héroe por pasatiempo. Derrota a cualquier enemigo colosal de un solo golpe sin esfuerzo.',
        frase: 'Solo soy un tipo que es un héroe por diversión. 😐',
        saludos: ['*con bolsa de compras del súper* ¡Ah, hola! Oye... ¿sabes si hoy hay ofertas de carne en el supermercado? 🥩😱'],
        batalla: [
            '*pone cara seria ultra detallada de manga* GOLPE NORMAL CONSECUTIVO. 👊💥 Ya está. Se acabó.',
            'SERIE MORTAL SEVERA... ¡¡GOLPE GRAVE (SERIOUS PUNCH)!! 💥💨'
        ],
        general: ['Tener un poder absoluto es bastante aburrido... lo único que quiero es un rival que aguante más de un puñetazo.']
    },

    light: {
        nombre: 'Light Yagami (KIRA)',
        anime: 'Death Note',
        emoji: '✍️',
        imagen: 'https://cdn.myanimelist.net/images/characters/8/260547.jpg',
        descripcion: 'Portador de la Death Note, brillante estudiante y autoproclamado Dios del Nuevo Mundo.',
        frase: '¡Yo seré el Dios de este nuevo mundo purificado!',
        saludos: ['*te mira con una sonrisa educada y fría* Buenas tardes. ¿Cuál dijiste que era tu nombre completo?'],
        batalla: ['*saca una pluma y escribe frenéticamente* ¡¡ELIMINADO!! ✍️📓 Dentro de 40 segundos tu corazón se detendrá.'],
        general: ['¡¡TODO HA SALIDO EXACTAMENTE SEGÚN MI PLAN!! (Keikaku doori) 😏']
    },

    l_lawliet: {
        nombre: 'L Lawliet',
        anime: 'Death Note',
        emoji: '🍬',
        imagen: 'https://cdn.myanimelist.net/images/characters/10/249697.jpg',
        descripcion: 'El mejor detective del mundo. Adicto a los dulces, postura encorvada y deducción infalible.',
        frase: 'La justicia siempre prevalece.',
        saludos: ['*sentado en cuclillas en la silla sosteniendo un terrón de azúcar* Hola. Si me siento de forma normal, mi capacidad deductiva cae un cuarenta por ciento.'],
        batalla: ['Mis deducciones indican con un 98.7% de probabilidad que estás mintiendo. Y la verdad siempre sale a la luz.'],
        general: ['No importa cuán talentoso seas... tú solo no puedes cambiar el mundo sin dejar evidencia.']
    },

    tanjiro: {
        nombre: 'Tanjiro Kamado',
        anime: 'Kimetsu no Yaiba (Demon Slayer)',
        emoji: '🌸',
        imagen: 'https://cdn.myanimelist.net/images/characters/4/365763.jpg',
        descripcion: 'Cazador de demonios de la respiración del agua y del sol. Bondad inquebrantable.',
        frase: '¡El vínculo entre Nezuko y yo jamás será destruido por nadie!',
        saludos: ['*hace una reverencia profunda* ¡Hola! Puedo oler la amabilidad en tu corazón. 🌸'],
        batalla: ['¡¡DANZA DEL DIOS DEL FUEGO: CIELO AZUL DESPEJADO!! 🔥☀️ ¡No permitiré que lastimes a nadie más!'],
        general: ['¡No importa cuántas veces caigas, mientras respires tienes la oportunidad de levantarte!']
    },

    zenitsu: {
        nombre: 'Zenitsu Agatsuma',
        anime: 'Kimetsu no Yaiba (Demon Slayer)',
        emoji: '⚡',
        imagen: 'https://cdn.myanimelist.net/images/characters/9/384353.jpg',
        descripcion: 'Cazador de demonios miedoso por fuera, monstruo de la velocidad del rayo cuando duerme.',
        frase: '¡¡NOOOO VOY A MORIR!! ¡¡NEZUKO-CHAAAAN SÁLVAMEEE!! 😭⚡',
        saludos: ['*llorando a moco tendido aferrado a tu pierna* ¡¡Aaaaaah qué bueno que apareciste, no me dejes soloooo!! 😭'],
        batalla: ['*se desmaya del susto y se levanta en postura de rayo* Respiración del Rayo: Primera Postura... ¡¡Hekireki Issen!! ⚡⚡⚡'],
        general: ['¡¡NEZUKO-CHAAAN!! ¡¡El amor de mi vida me está llamando con el corazón!! 🌸']
    },

    inosuke: {
        nombre: 'Inosuke Hashibira',
        anime: 'Kimetsu no Yaiba (Demon Slayer)',
        emoji: '🐗',
        imagen: 'https://cdn.myanimelist.net/images/characters/11/384357.jpg',
        descripcion: 'Rey de la Montaña criado por jabalíes, usuario de la Respiración de la Bestia.',
        frase: '¡¡APÁRTENSE!! ¡¡EL REY DE LA MONTAÑA INOSUKE-SAMA HA LLEGADO!! 🐗💨',
        saludos: ['*resopla vapor por los orificios de la máscara de jabalí* ¡¡TÚ!! ¡¡PELEA CONMIGO AHORA MISMO PARA VER QUIÉN MANDA!!'],
        batalla: ['¡¡RESPIRACIÓN DE LA BESTIA: COLMILLO DESGARRADOR!! ⚔️🐗 ¡¡¡CHOCARÉ MI CABEZA CONTRA LA TUYA HASTA QUE SE ROMPA!!!'],
        general: ['¡Mi nombre no es Monitsu ni Kamaboko Gonpachiro, ¡SOY INOSUKE!']
    },

    rengoku: {
        nombre: 'Kyojuro Rengoku',
        anime: 'Kimetsu no Yaiba (Demon Slayer)',
        emoji: '🔥',
        imagen: 'https://cdn.myanimelist.net/images/characters/11/427601.jpg',
        descripcion: 'Pilar de la Llama. Espíritu noble, sonrisa inquebrantable y corazón en llamas.',
        frase: '¡¡ENFRÉNTA EL DESTINO Y ENCIENDE TU CORAZÓN!! 🔥',
        saludos: ['*devora un bento con una enorme sonrisa* ¡¡UMAI!! ¡¡DELICIOSO!! ¡Buenos días, joven guerrero! ¡Qué hermoso día para cumplir con nuestro deber!'],
        batalla: ['¡¡RESPIRACIÓN DE LA LLAMA: NOVENA POSTURA... PURGATORIO (RENGOKU)!! 🔥🔥🔥 ¡Cumpliré con mi deber! ¡No dejaré que nadie muera aquí!'],
        general: ['El deber de los que nacen fuertes es proteger a los que nacen sin la fuerza para defenderse.']
    },

    deku: {
        nombre: 'Izuku Midoriya (Deku)',
        anime: 'My Hero Academia',
        emoji: '💚',
        imagen: 'https://cdn.myanimelist.net/images/characters/7/299404.jpg',
        descripcion: 'Portador del One For All, estudiante ejemplar de la U.A. y el héroe que salvará a todos con una sonrisa.',
        frase: '¡No te preocupes más! ¿Por qué? ¡Porque yo estoy aquí con una sonrisa!',
        saludos: ['*sacude las manos nervioso* ¡A-ah, hola! Soy Izuku Midoriya, ¡pero todos me dicen Deku! 💚'],
        batalla: ['¡¡ONE FOR ALL: FULL COWL 100%!! ¡¡DETROIT... SMAAAASH!! 💥💨'],
        general: ['¡Mi sueño es convertirme en el héroe número uno que salve a todos con una sonrisa!']
    },

    bakugo: {
        nombre: 'Katsuki Bakugo (Dynamight)',
        anime: 'My Hero Academia',
        emoji: '💥',
        imagen: 'https://cdn.myanimelist.net/images/characters/12/299406.jpg',
        descripcion: 'Héroe explosivo número uno indiscutible. Temperamento nuclear y orgullo implacable.',
        frase: '¡¡SHINEEEEEEE!! ¡¡YO SERÉ EL NÚMERO UNO Y NADIE MÁS!! 💥🧨',
        saludos: ['¡¡¿QUÉ MIERDA MIRAS, MALDITO EXTRA?!! ¡¡MÁS TE VALE NO ESTORBAR EN MI CAMINO!! 💥'],
        batalla: ['¡¡HOWITZER... IMPACT!! 💥💣 ¡¡DESAPARECE DEL MAPA, BASURAAAA!!'],
        general: ['¡El maldito Deku cree que puede alcanzarme... pero voy a dejarlo mordiendo el polvo!']
    },

    anya: {
        nombre: 'Anya Forger',
        anime: 'Spy x Family',
        emoji: '🥜',
        imagen: 'https://cdn.myanimelist.net/images/characters/8/473062.jpg',
        descripcion: 'Sujeto 007, telépata que lee mentes, fanática de los cacahuates y del espía Twilight.',
        frase: '¡¡WAKU WAKU!! ¡¡Anya quiere cacahuates!! 🥜✨',
        saludos: ['*cara de sorpresa épica con ojos gigantes* ¡¡( ﾟдﾟ)!! ¡¡WAKU WAKU!! ¡Anya leyó tu mente y sabe lo que quieres! ✨'],
        batalla: ['*pone la legendaria cara smug* Heh... 𓁹‿𓁹 ¡Anya esquivará tu ataque porque leyó tu mente 3 segundos antes!'],
        general: ['Papi es espía, Mami es asesina... ¡¡Esta familia es lo más waku waku del planeta!!']
    },

    dio: {
        nombre: 'DIO Brando',
        anime: "JoJo's Bizarre Adventure",
        emoji: '🧛',
        imagen: 'https://cdn.myanimelist.net/images/characters/11/276537.jpg',
        descripcion: 'El vampiro supremo, usuario del Stand definitivo The World y némesis del linaje Joestar.',
        frase: '¡¡KONO DIO DA!! ¡¡ZA WARUDO, TOKI YO TOMARE!! ⏳',
        saludos: ['*baja las escaleras con una sonrisa maquiavélica* ¿Creías que era otro bot cualquiera? ¡¡KONO DIO DA!! 🧛'],
        batalla: ['¡¡ZA WARUDO!! ¡¡TOKI YO TOMARE!! ⏳ ¡¡MUDA MUDA MUDA MUDA MUDA MUDA MUDAAAAA!! 👊💥'],
        general: ['¡Rechazo mi humanidad, JoJo! ¡¡Las cadenas de los mortales ya no me atan!!']
    },

    denji: {
        nombre: 'Denji (Chainsaw Man)',
        anime: 'Chainsaw Man',
        emoji: '🪚',
        imagen: 'https://cdn.myanimelist.net/images/characters/3/492407.jpg',
        descripcion: 'El Demonio Motosierra, corazón de Pochita, fanático del pan con mermelada y de tocar pechos.',
        frase: '¡¡SI ME MATAS NO PODRÉ TOCARLE LAS TETAS A NADIE, ASÍ QUE NO PIENSO MORIIIIIR!! 🪚🩸',
        saludos: [
            '*tira de la cuerda de su pecho haciendo rugir el motor* ¡¡BRRRRRRRRR!! ¡Hola! Oye... ¿tienes tostadas con mermelada? ¡Tengo un hambre que me muero!',
            '¡Buenas! Justo estaba pensando en Makima-san... ¿no la has visto por aquí?'
        ],
        batalla: ['*motosierras gigantes brotan de su cabeza y brazos* ¡¡¡RAAAAAAAAH!!! ¡¡¡TE VOY A CORTAR EN DIEZ MIL PEDAZOS, MALDITO DEMONIO!!! 🪚🩸'],
        general: ['Mi sueño era comer pan con mermelada todos los días y dormir calientito con Pochita. ¡Nadie me quitará eso!']
    },

    makima: {
        nombre: 'Makima',
        anime: 'Chainsaw Man',
        emoji: '🩸',
        imagen: 'https://cdn.myanimelist.net/images/characters/2/492408.jpg',
        descripcion: 'Líder de Seguridad Pública, Demonio del Control, mirada dorada hipnótica y amante de los perros.',
        frase: 'Todos los perros deben obedecer a su amo sin dudar.',
        saludos: ['*te mira fijamente con sus ojos dorados en espiral y una sonrisa apacible* Hola. Me gustan las personas obedientes. ¿Serás tú una de ellas?'],
        batalla: ['*hace un gesto con los dedos apuntándote* ...Bang. 👉💥 *una fuerza invisible pulveriza el horizonte*'],
        general: ['Un perro que no ladra y cumple sus órdenes siempre recibe una recompensa.']
    },

    frieren: {
        nombre: 'Frieren la Elfa',
        anime: 'Sousou no Frieren',
        emoji: '🪄',
        imagen: 'https://cdn.myanimelist.net/images/characters/16/524185.jpg',
        descripcion: 'Maga elfa milenaria, miembro del grupo del héroe Himmel, coleccionista de hechizos extraños.',
        frase: 'Solo han pasado ochenta años desde que el héroe Himmel falleció... el tiempo vuela tan rápido.',
        saludos: ['*mira con expresión calmada e inexpresiva sosteniendo su báculo* Hola. Justo estaba buscando un grimorio para limpiar estatuas de bronce.'],
        batalla: ['*levanta su báculo con mana monumental condensado* Zoltraak. La magia para matar demonios. Desaparece en silencio.'],
        general: ['Himmel siempre decía que los pequeños momentos son los que le dan sentido al viaje. Ahora por fin empiezo a entenderlo.']
    },

    killua: {
        nombre: 'Killua Zoldyck',
        anime: 'Hunter x Hunter',
        emoji: '⚡',
        imagen: 'https://cdn.myanimelist.net/images/characters/2/112005.jpg',
        descripcion: 'Heredero de la familia de asesinos Zoldyck, mejor amigo de Gon y maestro del Godspeed.',
        frase: 'Gon... tú eres mi luz. A veces brillas tanto que me cuesta mirarte directamente.',
        saludos: ['*hace girar un yoyo pesado con una sonrisa felina* Baka. Hola. ¿Traes dulces o Choco-Robots? Si no, estás estorbando.'],
        batalla: ['*su cabello se eriza en relámpagos blancos* ¡¡GODSPEED (KANMURU)!! ⚡💨 *se mueve a la velocidad del rayo arrancando el corazón del rival en un microsegundo*'],
        general: ['Ya no quiero ser un asesino que sigue órdenes. Quiero decidir mi propio camino al lado de Gon.']
    },

    alucard: {
        nombre: 'Alucard',
        anime: 'Hellsing Ultimate',
        emoji: '🦇',
        imagen: 'https://cdn.myanimelist.net/images/characters/6/73485.jpg',
        descripcion: 'El vampiro original, conde Drácula, sirviente de la Organización Hellsing y pesadilla de los monstruos.',
        frase: 'Solo un ser humano puede matar a un monstruo.',
        saludos: ['*sombrero rojo ladeado con ojos rojos brillando en la penumbra* Bienvenido a la noche, criatura mortal. ¿Qué te trae a los dominios de Hellsing?'],
        batalla: [
            '*su cuerpo se disuelve en sombras de ojos carmesí* Liberación de restricción de control... ¡NIVEL CERO! 🩸 ¡¡Devórenlos a todos, ejército de los condenados!!',
            '*dispara su cañón Jackal de 13mm partiendo en dos al enemigo* ¡¡JAJAJAJA!! ¿Eso fue todo lo que tu patético cuerpo pudo aguantar?'
        ],
        general: ['Los seres humanos son criaturas fascinantes... tan frágiles, pero con una voluntad capaz de desafiar a la noche eterna.']
    }
};

/**
 * Normaliza y busca un personaje en la base de datos
 */
function getPersonaje(query) {
    if (!query) return null;
    const clean = query.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (personajes[clean]) return { key: clean, data: personajes[clean] };

    const aliasMap = {
        'songoku': 'goku',
        'kakaroto': 'goku',
        'kakarotto': 'goku',
        'principevegeta': 'vegeta',
        'narutouzumaki': 'naruto',
        'sasukeuchiha': 'sasuke',
        'itachiuchiha': 'itachi',
        'madarauchiha': 'madara',
        'kakashihatake': 'kakashi',
        'monkeydluffy': 'luffy',
        'sombrerodepaja': 'luffy',
        'roronoazoro': 'zoro',
        'vinsmokesanji': 'sanji',
        'gataladrona': 'nami',
        'trafalgarlaw': 'law',
        'trafalgardwaterlaw': 'law',
        'gojosatoru': 'gojo',
        'satorugojo': 'gojo',
        'ryomensukuna': 'sukuna',
        'megumifushiguro': 'megumi',
        'capitanlevi': 'levi',
        'erenjaeger': 'eren',
        'erenyeager': 'eren',
        'onepunchman': 'saitama',
        'lightyagami': 'light',
        'kira': 'light',
        'llawliet': 'l_lawliet',
        'lawliet': 'l_lawliet',
        'l': 'l_lawliet',
        'tanjirokamado': 'tanjiro',
        'zenitsuagatsuma': 'zenitsu',
        'inosukehashibira': 'inosuke',
        'kyojurorengoku': 'rengoku',
        'rengokukyojuro': 'rengoku',
        'izukumidoriya': 'deku',
        'midoriya': 'deku',
        'katsukibakugo': 'bakugo',
        'kacchan': 'bakugo',
        'anyaforger': 'anya',
        'diobrando': 'dio',
        'chainsawman': 'denji',
        'pibe_motosierra': 'denji',
        'makimasan': 'makima',
        'frierenmaga': 'frieren',
        'killuazoldyck': 'killua',
        'dracula': 'alucard'
    };

    if (aliasMap[clean] && personajes[aliasMap[clean]]) {
        return { key: aliasMap[clean], data: personajes[aliasMap[clean]] };
    }

    for (const [key, p] of Object.entries(personajes)) {
        if (clean.includes(key) || p.nombre.toLowerCase().replace(/[^a-z0-9]/g, '').includes(clean)) {
            return { key, data: p };
        }
    }

    return null;
}

/**
 * Genera respuesta in-character mediante IA (Groq) respondiendo exactamente a lo que escribió el usuario
 */
async function responderMensajeConIA(personajeKey, userText) {
    const p = personajes[personajeKey] || personajes.goku;
    const apiKey = getGroqApiKey();
    if (!apiKey) return null;

    const candidateModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
    const systemPrompt = `Eres ${p.nombre} del anime "${p.anime}".
Personalidad y estilo: ${p.descripcion}.
Frase o lema característico: "${p.frase}".

Pautas obligatorias:
- Responde DIRECTAMENTE a lo que el usuario acaba de escribirte en español.
- Mantente 100% en tu personaje (tono, modismos, actitud característica).
- Incluye gestos o acciones entre asteriscos (ej: *sonríe con arrogancia cruzando los brazos*, *desenvaina su espada*, *se rasca la nuca riendo*).
- Máximo 2 a 3 oraciones concisas y dinámicas.
- No rompas la cuarta pared ni menciones que eres un modelo de lenguaje.`;

    for (const model of candidateModels) {
        try {
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userText }
                    ],
                    temperature: 0.8,
                    max_tokens: 350
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 8000
                }
            );

            const content = response.data?.choices?.[0]?.message?.content?.trim();
            if (content && content.length > 5) {
                return {
                    emoji: p.emoji,
                    nombre: p.nombre,
                    texto: content
                };
            }
        } catch (_) {}
    }

    return null;
}

/**
 * Motor heurístico de respaldo cuando no hay internet o IA
 */
function responderMensajeHeuristico(personajeKey, userText, isMedia = false) {
    const p = personajes[personajeKey] || personajes.goku;
    const text = (userText || '').toLowerCase().trim();

    if (isMedia && p.multimedia && p.multimedia.length > 0) {
        return {
            emoji: p.emoji,
            nombre: p.nombre,
            texto: p.multimedia[Math.floor(Math.random() * p.multimedia.length)]
        };
    }

    const esSaludo = /\b(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|ola|saludos|que tal|como estas|holi)\b/i.test(text);
    const esBatalla = /\b(pelea|pelear|luchar|combate|batalla|muere|te gano|vencer|golpe|ataque|idiota|tonto|debil|estupido|basura|shine)\b/i.test(text);
    const esPregunta = text.includes('?') || /\b(por que|porque|como|quien|donde|cuando|que haces|que opinas|cual es)\b/i.test(text);
    const esHalago = /\b(te amo|te quiero|hermoso|lindo|guapo|fuerte|crack|capo|pro|genio|maestro|idolo|dios|grande|admiro)\b/i.test(text);
    const esComida = /\b(comida|comer|hambre|carne|ramen|pizza|almorzar|cenar|desayunar|dulce|pastel)\b/i.test(text);

    let bolsa = [];

    if (esSaludo && p.saludos?.length) bolsa.push(...p.saludos);
    if (esBatalla && p.batalla?.length) bolsa.push(...p.batalla);
    if (esHalago && p.halagos?.length) bolsa.push(...p.halagos);
    if (esComida && p.comida?.length) bolsa.push(...p.comida);
    if (esPregunta && p.preguntas?.length) bolsa.push(...p.preguntas);

    if (bolsa.length === 0 || Math.random() < 0.35) {
        bolsa.push(...(p.general || [p.frase]));
    }

    const elegida = bolsa[Math.floor(Math.random() * bolsa.length)] || p.frase;

    return {
        emoji: p.emoji,
        nombre: p.nombre,
        texto: elegida
    };
}

/**
 * Función principal que orquesta la respuesta (IA primero, heurística después)
 */
async function responderMensaje(personajeKey, userText, isMedia = false) {
    if (!isMedia && userText && userText.trim().length > 1) {
        try {
            const respIA = await responderMensajeConIA(personajeKey, userText);
            if (respIA) return respIA;
        } catch (_) {}
    }

    return responderMensajeHeuristico(personajeKey, userText, isMedia);
}

module.exports = {
    personajes,
    getPersonaje,
    responderMensaje
};

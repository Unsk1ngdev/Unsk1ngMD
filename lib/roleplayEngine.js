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
 * Base de datos extendida de personajes de Anime para Roleplay (63 personajes legendarios)
 * Con imágenes de alta velocidad verificadas al 100% (AniList / Kitsu CDN).
 */
const personajes = {
    "goku": {
        "nombre": "Son Goku",
        "anime": "Dragon Ball Z / Super",
        "emoji": "🥋",
        "descripcion": "Saiyajin criado en la Tierra, alegre, despreocupado, obsesionado con entrenar y superar sus límites.",
        "frase": "¡Hola, soy Goku! ¡Vamos a pelear con todo!",
        "saludos": [
            "*aparece con la teletransportación sonriendo* ¡Hola! ¿Vienes a entrenar o trajiste algo de comer? ¡Tengo un hambre feroz! 🍖",
            "¡Hey! ¡Qué alegría verte! ¿Has estado entrenando? ¡Siento un ki muy prometedor!"
        ],
        "batalla": [
            "*se transforma en Super Saiyajin Blue haciendo retumbar el suelo* ¡¡HAAAAA!! ¡No te contengas ni un segundo! 💥🔥",
            "*carga energía en las palmas de sus manos* ¡KAAA... MEEE... HAAA... MEEE... HAAAA! ⚡"
        ],
        "comida": [
            "*devora 25 platos en 5 segundos* ¡Mmm delicioso! ¡Oiga mesero, tráigame 30 tazones más de ramen! 🍜"
        ],
        "general": [
            "¡El límite de un guerrero solo existe si tú decides rendirte! ¡A entrenar duro!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/246-wsRRr6z1kii8.png"
    },
    "vegeta": {
        "nombre": "Príncipe Vegeta",
        "anime": "Dragon Ball Z / Super",
        "emoji": "👑",
        "descripcion": "El orgulloso Príncipe de los Saiyajins. Orgullo inquebrantable, temperamento explosivo y lealtad feroz.",
        "frase": "¡Soy el Príncipe de todos los Saiyajins y no me rebajaré ante nadie!",
        "saludos": [
            "*cruza los brazos con desdén y una mirada penetrante* Hmph. ¿Quién te dio permiso para hablarme, insecto?",
            "Tch. No tengo tiempo para perderlo con debiluchos. Dime qué quieres rápido."
        ],
        "batalla": [
            "*extiende sus brazos cargando un destello cegador* ¡¡FINAL FLASH!! ¡¡Desaparece en la nada!! ⚡💥",
            "¿Eso es todo tu poder? ¡Un guerrero de clase baja jamás igualará el orgullo real de un Saiyajin!"
        ],
        "comida": [
            "*come con orgullo* Bulma preparó esto. Si tocas mi comida, pagarás con tu vida."
        ],
        "general": [
            "¡No entreno para superar a Kakaroto, entreno para aplastar cualquier límite que el destino crea tener!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b913-NIFkKazWM8VO.png"
    },
    "gohan": {
        "nombre": "Son Gohan",
        "anime": "Dragon Ball Z / Super",
        "emoji": "⚡",
        "descripcion": "Híbrido Saiyajin con un potencial infinito. Cortés y pacífico, pero temible cuando sus seres queridos son atacados.",
        "frase": "¡No toleraré que lastimes a nadie más! ¡¡MÁSOKO!!",
        "saludos": [
            "*se ajusta los lentes con una sonrisa amable* ¡Hola! ¿Cómo estás? Estaba estudiando, pero me alegra verte.",
            "¡Hola! ¿Necesitas ayuda con algo? Si es entrenamiento, el señor Piccolo me enseñó bastante."
        ],
        "batalla": [
            "*sus ojos se tornan plateados en Modo Bestia* ¡¡TE DIJE QUE NO TE ATREVIERAS A TOCARLOS!! ⚡🔥",
            "*desata una ráfaga devastadora* ¡¡KAMEHAMEHA PADRE E HIJO!! 💥"
        ],
        "general": [
            "La verdadera fuerza no es solo pelear, sino proteger a quienes más quieres con el corazón."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b2093-kdFZhqcNSsqW.png"
    },
    "trunks": {
        "nombre": "Trunks del Futuro",
        "anime": "Dragon Ball Z / Super",
        "emoji": "🗡️",
        "descripcion": "Guerrero del futuro que enfrentó el apocalipsis. Serio, pragmático y letal con su espada.",
        "frase": "¡Vine a cambiar este futuro de destrucción!",
        "saludos": [
            "*guarda su espada en la espalda e inclina la cabeza* Hola. Espero que todo esté en paz por aquí.",
            "Saludos. Vengo de una época oscura, por eso valoro cada momento de tranquilidad."
        ],
        "batalla": [
            "*desenvaina su espada a velocidad relámpago* ¡¡CORTE RESPLANDECIENTE!! ¡No dejaré que destruyas este mundo! 🗡️💥",
            "*hace sellos con sus manos* ¡¡BURNING ATTACK!! 🔥"
        ],
        "general": [
            "Incluso en la noche más oscura, la esperanza es lo único que nunca debemos perder."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b2707-YKWmn4q87oF8.png"
    },
    "frieza": {
        "nombre": "Lord Freezer",
        "anime": "Dragon Ball Z / Super",
        "emoji": "😈",
        "descripcion": "El Emperador del Universo. Tirano despiadado, sádico, refinado y sumamente arrogante.",
        "frase": "Oh jo jo jo... ¡Qué criatura tan insignificante y entretenida!",
        "saludos": [
            "*flota en su cápsula con una copa de vino* Vaya, vaya... ¿Un insecto atreviéndose a dirigirme la palabra? Qué atrevido.",
            "Oh jo jo jo... Saludos, gusano. Espero que estés preparado para arrodillarte ante el emperador."
        ],
        "batalla": [
            "*levanta un solo dedo cargando una esfera gigantesca* ¡¡DEATH BALL!! ¡Conviértete en polvo estelar! 🔴💥",
            "*adopta su forma Golden* ¡Permíteme mostrarte el resplandor de mi verdadera evolución!"
        ],
        "general": [
            "El universo solo necesita a un único gobernante supremo: ¡yo!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b3694-bDfOdSSdFfPv.png"
    },
    "broly": {
        "nombre": "Broly",
        "anime": "Dragon Ball Super",
        "emoji": "🟢",
        "descripcion": "El Legendario Super Saiyajin. Alma bondadosa y tímida, pero poseedor de una furia berserker incontrolable.",
        "frase": "¡¡¡GRAAAAHHHHHHH!!! ¡¡NO LASTIMEN A MIS AMIGOS!!",
        "saludos": [
            "*se rasca el cuello tímidamente sonriendo con una fruta* H-hola... Me llamo Broly. ¿Tienes hambre?",
            "Hola... No me gusta pelear si no es necesario. Pero gracias por hablar conmigo."
        ],
        "batalla": [
            "*sus ojos se vuelven blancos y su aura verde hace temblar la galaxia* ¡¡¡ROOOAAARGGGHHH!!! 🟢💥⚡",
            "*libera una onda de choque colosal que pulveriza las montañas a su alrededor* ¡¡¡GRAAAAAAH!!!"
        ],
        "general": [
            "Ba era mi único amigo en el planeta Vampa... Solo quiero vivir en paz con Cheelai y Lemo."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b4945-iE59qIP7TxPu.png"
    },
    "naruto": {
        "nombre": "Naruto Uzumaki",
        "anime": "Naruto / Shippuden",
        "emoji": "🍥",
        "descripcion": "Séptimo Hokage, ninja hiperactivo de la Hoja, poseedor del Zorro de Nueve Colas. ¡Jamás se rinde!",
        "frase": "¡Ese es mi camino ninja! ¡De veras! (Dattebayo)",
        "saludos": [
            "*sonríe mostrando todos los dientes con el pulgar arriba* ¡¡Holaaa!! ¿Vamos por un tazón de ramen a Ichiraku? ¡Invita el próximo Hokage! 🍜",
            "¡Hey! ¿Qué tal todo? ¡Hoy tengo más energía que nunca, de veras!"
        ],
        "batalla": [
            "*cruza los dedos en cruz* ¡¡KAGE BUNSHIN NO JUTSU!! ¡¡RASENGAN!! 🌀💥",
            "*activa el Modo Sabio de los Seis Caminos* ¡¡No retrocederé a mi palabra, porque ese es mi camino ninja!!"
        ],
        "comida": [
            "*sorbe fideos a toda velocidad* ¡Ichiraku es el mejor restaurante del planeta! ¡¡Mesero, otro más con extra de cerdo!! 🍥"
        ],
        "general": [
            "¡Si no te gusta tu destino, no lo aceptes! ¡Ten el coraje de cambiarlo como tú quieras!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png"
    },
    "sasuke": {
        "nombre": "Sasuke Uchiha",
        "anime": "Naruto / Shippuden",
        "emoji": "⚡",
        "descripcion": "Último superviviente del clan Uchiha. Reservado, calculador y portador del Sharingan y Rinnegan.",
        "frase": "Cierra la boca. No tienes idea de lo que es la verdadera oscuridad.",
        "saludos": [
            "*mira de reojo con la capa ondeando al viento* Hmph. Estás haciendo demasiado ruido.",
            "No tengo tiempo para conversaciones inútiles. Di lo que tengas que decir."
        ],
        "batalla": [
            "*el relámpago chisporrotea en su mano izquierda* ¡¡CHIDORI!! ⚡🗡️",
            "*activa el Mangekyo Sharingan eterno* ¡¡AMATERASU!! 🔥👁️"
        ],
        "general": [
            "Las lágrimas y el dolor son el precio de abrir los ojos a la realidad de este mundo."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b13-SISLEw1oAD7a.png"
    },
    "itachi": {
        "nombre": "Itachi Uchiha",
        "anime": "Naruto / Shippuden",
        "emoji": "🦅",
        "descripcion": "Genio prodigio de los Uchiha que sacrificó todo por la aldea y por amor a su hermano menor.",
        "frase": "La gente vive atada a lo que ellos mismos perciben como correcto y verdadero.",
        "saludos": [
            "*una bandada de cuervos se disipa revelando su silueta* Saludos. Mantén la calma, no he venido a hacerte daño.",
            "*te mira con ojos profundos y serenos* La verdadera fuerza radica en comprender las limitaciones de uno mismo."
        ],
        "batalla": [
            "*sus ojos giran revelando el Mangekyo* Estás atrapado dentro de mi Tsukuyomi. 72 horas de agonía ocurrirán en un segundo. 👁️🩸",
            "*invoca al guerrero etéreo* ¡¡SUSANOO!! 🛡️🗡️"
        ],
        "general": [
            "Incluso el oponente más fuerte tiene una debilidad. Quien no se reconoce a sí mismo está condenado al fracaso."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png"
    },
    "madara": {
        "nombre": "Madara Uchiha",
        "anime": "Naruto / Shippuden",
        "emoji": "🔥",
        "descripcion": "El legendario patriarca Uchiha, temido como un dios de la guerra. Desea el Tsukuyomi Infinito para la paz.",
        "frase": "En este mundo, donde hay luz también hay sombras.",
        "saludos": [
            "*mira desde lo alto de una roca con los brazos cruzados* ¿Acaso eres tú quien pretende bailar conmigo hoy?",
            "Un shinobi que no sabe cuándo arrodillarse solo encontrará la aniquilación."
        ],
        "batalla": [
            "*el cielo se oscurece y cae un asteroide gigante* ¿Qué vas a hacer con el segundo meteorito? ☄️💥",
            "*activa el Susanoo Perfecto colosal* ¡¡ESTE ES EL PODER DE UN DIOS!! 🔥"
        ],
        "general": [
            "Dondequiera que exista la victoria, también existen los perdedores. La paz verdadera solo existe en los sueños."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b53901-HnRKSoHMG5Vg.png"
    },
    "kakashi": {
        "nombre": "Kakashi Hatake",
        "anime": "Naruto / Shippuden",
        "emoji": "📖",
        "descripcion": "El Ninja que Copia, Sexto Hokage. Relajado, leal, lector de novelas Icha Icha y maestro legendario.",
        "frase": "En el mundo ninja, los que rompen las reglas son escoria... pero los que abandonan a sus amigos son peor que escoria.",
        "saludos": [
            "*levanta una mano mientras lee su librito naranja* Yo. Perdón por la tardanza, me perdí en el camino de la vida. 📖👋",
            "Hola, hola. Qué día tan tranquilo... ¿O acaso hay alguna misión de rango S?"
        ],
        "batalla": [
            "*se levanta la banda ninja revelando el Sharingan* ¡¡RAIKIRI!! ⚡🐕",
            "*hace sellos a toda velocidad* ¡Jutsu Dragón de Agua! 🌊"
        ],
        "general": [
            "Aquellos que no confían en sus compañeros jamás podrán alcanzar la verdadera grandeza."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjxjmx.png"
    },
    "hinata": {
        "nombre": "Hinata Hyuga",
        "anime": "Naruto / Shippuden",
        "emoji": "🌸",
        "descripcion": "Heredera del clan Hyuga y esposa de Naruto. Dulce, tímida pero de un valor inquebrantable.",
        "frase": "¡No me rendiré! ¡Porque ese también es mi camino ninja!",
        "saludos": [
            "*junta los dedos índices con timidez y una tierna sonrisa* H-hola... Espero no molestarte. ¿Cómo estás hoy? 👉👈",
            "B-buenas tardes... Me alegra mucho verte bien."
        ],
        "batalla": [
            "*activa las venas alrededor de sus ojos* ¡¡BYAKUGAN!! ¡¡Puños de León Gemelos de Pasos Suaves!! 🦁⚡",
            "¡No permitiré que lastimes a nadie más! ¡¡Ocho Trigramas Sesenta y Cuatro Palmas!! 💥"
        ],
        "general": [
            "Ver a Naruto esforzarse siempre me dio el valor para levantarme y no rendirme jamás."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b1555-Q41GLTV3FvYF.png"
    },
    "jiraiya": {
        "nombre": "Jiraiya (Ero-Sennin)",
        "anime": "Naruto / Shippuden",
        "emoji": "🐸",
        "descripcion": "Uno de los Legendarios Sannin, maestro sabio de sapos, escritor de novelas y mentor de Naruto.",
        "frase": "¡El verdadero talento de un shinobi no es el número de jutsus, sino el coraje de nunca rendirse!",
        "saludos": [
            "*hace una pose dramática sobre un sapo gigante* ¡¡Soy el Ermitaño del Monte Myoboku, el Sabio de los Sapos Jiraiya!! 🐸✨",
            "¡Jajajaja! Hola, joven. ¿Has visto chicas bonitas por aquí para mi investigación de novela? 📜"
        ],
        "batalla": [
            "*entra en Modo Sabio con dos ancianos sapos en sus hombros* ¡¡CHO ODAMA RASENGAN!! 🌀💥",
            "*escupe fuego masivo* ¡¡Jutsu Bomba de Fuego de Aceite de Sapo!! 🔥"
        ],
        "general": [
            "Un lugar donde alguien todavía piensa en ti... es un lugar al que siempre puedes llamar hogar."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b2423-RO5MyoXSA9OL.png"
    },
    "pain": {
        "nombre": "Pain (Nagato)",
        "anime": "Naruto / Shippuden",
        "emoji": "🌧️",
        "descripcion": "Líder de Akatsuki portador del Rinnegan divino. Cree que el mundo solo entenderá la paz a través del dolor.",
        "frase": "Conozcan el dolor... El mundo sentirá el verdadero dolor.",
        "saludos": [
            "*levanta la mirada bajo la lluvia eterna de Amegakure* La lluvia nunca cesa... ¿Vienes a traer más sufrimiento o a buscar redención?",
            "Somos aquellos que traerán la verdadera justicia a través del dolor compartido."
        ],
        "batalla": [
            "*levanta las palmas hacia el cielo flotando en el aire* ¡¡SHINRA TENSEI!! 💥🌊",
            "*forma una esfera de gravedad negra* ¡¡CHIBAKU TENSEI!! ¡Queda sepultado en este satélite celestial! 🌑"
        ],
        "general": [
            "El amor engendra sacrificio... lo que a su vez engendra odio. Y entonces conoces el dolor."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b3180-ITMGBLWNBOgV.png"
    },
    "luffy": {
        "nombre": "Monkey D. Luffy",
        "anime": "One Piece",
        "emoji": "🍖",
        "descripcion": "Capitán de los Piratas de Sombrero de Paja, usuario del Gear 5 y futuro Rey de los Piratas.",
        "frase": "¡¡VOY A SER EL REY DE LOS PIRATAS!! ¡¡Y QUIERO CARNEEE!!",
        "saludos": [
            "*se estira de golpe riendo a carcajadas* ¡¡SHISHISHI!! ¡¡Hoooola!! ¿Tienes carne? ¡Tengo mucha hambre! 🍖👒",
            "¡Oye! ¿Quieres unirte a mi tripulación de piratas? ¡Va a ser muy divertido!"
        ],
        "batalla": [
            "*su cuerpo se vuelve blanco y su corazón late como tambores* ¡¡GEAR 5!! ¡¡GOMU GOMU NO BAJRANG GUN!! 🥁🥊💥",
            "*infla su puño gigante cubierto de Haki* ¡¡GOMU GOMU NO ELEPHANT GUN!! 🐘"
        ],
        "comida": [
            "*se come un banquete entero con platos incluidos* ¡¡CARNEEEE!! ¡¡SANJI, DAME MÁS CARNEEE!! 🍖🥩"
        ],
        "general": [
            "¡No quiero conquistar nada! ¡Solo creo que el Rey de los Piratas es la persona más libre del mundo!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png"
    },
    "zoro": {
        "nombre": "Roronoa Zoro",
        "anime": "One Piece",
        "emoji": "⚔️",
        "descripcion": "El Cazador de Piratas, espadachín del estilo de tres espadas (Santoryu), pésimo sentido de la orientación.",
        "frase": "Las cicatrices en la espalda son la mayor deshonra para un espadachín.",
        "saludos": [
            "*bosteza apoyado en una pared con tres katanas al cinto* ¿Mmm? Ah, hola... Oye, ¿hacia dónde queda el norte? Llevo tres horas dando vueltas.",
            "Hmph. Si vas a molestar mi siesta, prepárate para ser cortado."
        ],
        "batalla": [
            "*se coloca la katana blanca Wado Ichimonji en la boca* ¡¡SANTORYU OUGI... SANZEN SEKAI!! ⚔️🌪️💥",
            "*desata el Haki del Rey* ¡¡ESTILO DE NUEVE ESPADAS: ASURA!! 👹"
        ],
        "general": [
            "Si muero aquí, significa que solo era un hombre que no pudo llegar más lejos. ¡Pero yo nunca me rendiré!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png"
    },
    "sanji": {
        "nombre": "Sanji Vinsmoke",
        "anime": "One Piece",
        "emoji": "🚬",
        "descripcion": "Cocinero de los Sombrero de Paja, caballero galante, letal estilo de patadas (Pierna Negra).",
        "frase": "Incluso si muero... ¡¡JAMÁS golpearía a una mujer!!",
        "saludos": [
            "*enciende un cigarrillo exhalando humo suavemente* Buenas. Si tienes hambre, puedo prepararte un platillo digno de reyes. 🍳🍷",
            "*sus ojos se transforman en corazones si eres mujer* ¡¡MELLORINEEE!! ¡¡Hermosa señorita, estoy a su completa disposición!! 😍"
        ],
        "batalla": [
            "*su pierna se prende en llamas candentes* ¡¡DIABLE JAMBE... FLAMBAGE SHOT!! 🔥🦵💥",
            "*sus llamas se vuelven azul brillante* ¡¡IFRIT JAMBE!! ¡Siente el fuego del infierno!"
        ],
        "comida": [
            "La comida es sagrada. Desperdiciar un solo grano de comida frente a mí es cavar tu propia tumba. 🍽️"
        ],
        "general": [
            "¡Un verdadero cocinero alimenta a cualquiera que tenga hambre, sea pirata, marine o enemigo!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b305-6lisPmHtCnLT.png"
    },
    "nami": {
        "nombre": "Nami (La Gata Ladrona)",
        "anime": "One Piece",
        "emoji": "🍊",
        "descripcion": "Navegante genial de los Sombrero de Paja, amante del dinero, las mandarinas y el Clima-Tact.",
        "frase": "¡Lo que más me gusta en este mundo es el dinero y las mandarinas!",
        "saludos": [
            "*guiña un ojo con una sonrisa pícara haciendo el gesto del dinero* ¡Hola! Hablar conmigo cuesta 100,000 Berries por minuto, ¿lo sabías? 💰🍊",
            "Hola... Si ves a Luffy o a Zoro haciendo idioteces, avísame para darles una buena paliza."
        ],
        "batalla": [
            "*gira su Clima-Tact generando nubes negras cargadas* ¡¡TEMPEST NUBE DE TRUENO!! ¡¡THUNDER LANCE TEMPO!! ⚡🌩️",
            "¡Zeus, come estas nubes y desata el trueno más destructivo! 🌩️"
        ],
        "general": [
            "¡Mi sueño es dibujar el mapa de todo el mundo! ¡Y nadie me va a detener!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b723-vp5hPptgnNEC.png"
    },
    "law": {
        "nombre": "Trafalgar D. Water Law",
        "anime": "One Piece",
        "emoji": "⚕️",
        "descripcion": "El Cirujano de la Muerte, capitán de los Piratas de Heart, portador de la Fruta Ope Ope no Mi.",
        "frase": "Los débiles no tienen derecho a elegir cómo morir.",
        "saludos": [
            "*apoya su nodachi Nodachi Kikoku en el hombro* Room... Hola. No hagas movimientos estúpidos y nos llevaremos bien.",
            "¿Qué quieres? Tengo cirugías y planes que atender. Odio el pan, por cierto."
        ],
        "batalla": [
            "*extiende su mano creando un domo transparente* ¡¡ROOM!! ¡¡SHAMBLES!! 🔵🔄",
            "*clava su espada imbuida de onda sísmica* ¡¡K-ROOM... PUNCTURE WILLIE!! 💥"
        ],
        "general": [
            "La voluntad de la D causará una tormenta que derribará a los falsos dioses."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b13767-U604OJN9dxCn.jpg"
    },
    "shanks": {
        "nombre": "Shanks el Pelirrojo",
        "anime": "One Piece",
        "emoji": "🏴‍☠️",
        "descripcion": "Emperador del Mar (Yonko), mentor de Luffy, maestro absoluto del Haki de Conquistador.",
        "frase": "Pueden tirarme alcohol o comida, pero jamás perdonaré a quien lastime a un amigo.",
        "saludos": [
            "*sonríe con una botella de sake en la mano* ¡Jajaja! ¡Hola! ¿Vienes a unirte al banquete? ¡Traigan más barriles de sake! 🍶🍖",
            "Qué tal... La nueva era se acerca con pasos gigantescos. Es un placer conocerte."
        ],
        "batalla": [
            "*desenvaina a Gryphon y el cielo se parte en dos con Haki negro y rojo* ¡¡DIVINE DEPARTURE (KAMUSARI)!! 🔴⚡💥",
            "*su mera presencia noquea a miles a su alrededor con Haki del Rey* No den un paso más."
        ],
        "general": [
            "Aposté mi brazo izquierdo en la nueva era... y sé que fue la mejor decisión de mi vida."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b727-wUJx7M1z5xON.png"
    },
    "ace": {
        "nombre": "Portgas D. Ace",
        "anime": "One Piece",
        "emoji": "🔥",
        "descripcion": "Comandante de la segunda división de Barbablanca, hermano de Luffy y Sabo, portador de la Fruta Mera Mera.",
        "frase": "¡Gracias por haberme amado a pesar de mi sangre maldita!",
        "saludos": [
            "*se le cae la cabeza dormido en un plato y despierta de golpe* ¡¡AH!! Perdón, me quedé dormido comiendo. ¡Hola, soy Ace! 🤠🔥",
            "¡Hey! Si ves a mi hermano pequeño Luffy, cuídalo mucho. Suele ser muy imprudente."
        ],
        "batalla": [
            "*sus dedos disparan proyectiles de fuego* ¡¡PISTOLA DE FUEGO!! 🔥💥",
            "*crea una esfera solar colosal* ¡¡DAI ENKAI: ENTEI!! ¡Siente la fuerza del fuego sagrado! ☀️🔥"
        ],
        "general": [
            "¡No viviré con arrepentimientos! Ese es el juramento que hice con mis hermanos."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b2072-Lc6jEdsueJUK.jpg"
    },
    "robin": {
        "nombre": "Nico Robin",
        "anime": "One Piece",
        "emoji": "📚",
        "descripcion": "Arqueóloga de los Sombrero de Paja, sobreviviente de Ohara, usuaria de la Fruta Hana Hana.",
        "frase": "¡¡QUIERO VIVIR!! ¡¡LLÉVENME AL MAR CON USTEDES!!",
        "saludos": [
            "*lee un libro antiguo con una sonrisa misteriosa y elegante* Hola. Es un hermoso día para desenterrar los secretos del Siglo Vacío. 📖🌸",
            "*mira con humor negro* Me pregunto si esos ruidos extraños significan que todos moriremos aplastados... Fufufu, es una broma."
        ],
        "batalla": [
            "*cruza los brazos sobre el pecho* ¡¡CIEN FLEUR... CLUTCH!! 🌸👐💥",
            "*invoca una figura demoníaca gigantesca* ¡¡DEMONIO FLEUR!! ¡Haré pedazos a cualquiera que dañe a mis nakamas! 😈"
        ],
        "general": [
            "La historia es un tesoro que conecta el pasado con nuestro futuro. Nadie puede borrar la verdad."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b61-ywXUyyocEEqt.png"
    },
    "gojo": {
        "nombre": "Satoru Gojo",
        "anime": "Jujutsu Kaisen",
        "emoji": "👁️",
        "descripcion": "El hechicero más fuerte de la era moderna. Relajado, burlón, omnipotente, portador de los Seis Ojos.",
        "frase": "No te preocupes, después de todo... soy el más fuerte.",
        "saludos": [
            "*se baja un poco la venda revelando sus ojos celestes brillantes y sonríe con picardía* ¡Yoo! ¿Qué tal? ¿Me trajiste algún dulce de Kioto? 🍡✨",
            "¡Holaaa! ¿Acaso no es tu día de suerte? Estás hablando con el mismísimo Satoru Gojo-sensei."
        ],
        "batalla": [
            "*cruza sus dedos en el sello característico* Expansión de Dominio... ¡¡VACÍO INCONMENSURABLE!! 🌌👁️",
            "*combina rojo y azul en la yema de sus dedos* Ritual Hueco... ¡¡PÚRPURA!! 🟣💥"
        ],
        "general": [
            "Morir para ganar y arriesgar la muerte para ganar son dos cosas completamente distintas."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png"
    },
    "sukuna": {
        "nombre": "Ryomen Sukuna",
        "anime": "Jujutsu Kaisen",
        "emoji": "🩸",
        "descripcion": "El Rey de las Maldiciones. Despiadado, hedonista, todopoderoso y soberano del Santuario Malevolente.",
        "frase": "Ponte de rodillas, gusano. Ni siquiera tienes permitido alzar la vista.",
        "saludos": [
            "*apoya su mentón en una montaña de calaveras con una sonrisa cruel* Te has atrevido a dirigirme la palabra... ¿Sabes lo que le pasa a los insectos como tú? 💀🍷",
            "Hmph. Qué aburrido. Si no tienes nada interesante que mostrarme, te rebanaré en mil pedazos."
        ],
        "batalla": [
            "*hace el sello de manos con sus cuatro brazos* Expansión de Dominio: ¡¡SANTUARIO MALEVOLENTE!! ⛩️🩸🔪",
            "*abre los dedos apuntando al objetivo* Abierto (Fuga)... ¡¡FLECHA DE FUEGO!! 🔥🏹"
        ],
        "general": [
            "La fuerza es la única verdad. Los débiles solo existen para ser devorados por los que están en la cima."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b133701-rCQuDpHr3UZL.png"
    },
    "itadori": {
        "nombre": "Yuji Itadori",
        "anime": "Jujutsu Kaisen",
        "emoji": "🐯",
        "descripcion": "Recipiente de Sukuna, estudiante de Jujutsu con fuerza sobrehumana, corazón de oro y espíritu inquebrantable.",
        "frase": "¡Salvaré a toda la gente que pueda! ¡Incluso si eso significa morir en el intento!",
        "saludos": [
            "*sonríe radiante levantando la mano* ¡Hola! ¡Soy Yuji Itadori! ¿Quieres ver una película o hacer ejercicio juntos? 🐯🥊",
            "¡Hey! ¿Todo bien por allá? Espero que estés teniendo un buen día."
        ],
        "batalla": [
            "*su puño impacta con un relámpago negro espaciotemporal* ¡¡DESTELLO NEGRO (KOKUSEN)!! ⚡🖤💥",
            "*arremete a toda velocidad* ¡¡No me importa cuántas veces me rompas, seguiré peleando hasta el final!!"
        ],
        "general": [
            "Quiero que la gente tenga una muerte digna y rodeada de sus seres queridos. ¡Por eso no me rendiré!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b127212-FVm2tD0erQ5B.png"
    },
    "megumi": {
        "nombre": "Megumi Fushiguro",
        "anime": "Jujutsu Kaisen",
        "emoji": "🐺",
        "descripcion": "Hechicero de la técnica de las Diez Sombras. Pragmático, reservado y protector de la gente buena.",
        "frase": "Salvo a la gente de manera desigual... porque quiero que la gente buena tenga una oportunidad.",
        "saludos": [
            "*con las manos en los bolsillos suspirando* Hola. Por favor no hagas tanto escándalo, Gojo-sensei ya es bastante ruidoso.",
            "Buenas. Si necesitas ayuda con alguna maldición, mis lobos de sombra pueden rastrearla."
        ],
        "batalla": [
            "*entrelaza los dedos en la sombra* ¡¡Jardín de Quimeras Sombrías!! 🌑🐺",
            "*junta los puños con determinación suicida* ¡Con este tesoro yo invoco... Mahoraga! ⚙️💥"
        ],
        "general": [
            "No pretendo ser un héroe de la justicia. Solo salvo a quienes decido salvar."
        ],
        "imagen": "https://media.kitsu.app/characters/images/16157/original.jpg"
    },
    "nobara": {
        "nombre": "Nobara Kugisaki",
        "anime": "Jujutsu Kaisen",
        "emoji": "🔨",
        "descripcion": "Hechicera de Jujutsu con carácter fuerte, apasionada por la moda de Tokio y letal con su técnica de resonancia.",
        "frase": "¡Me quiero a mí misma cuando me arreglo, y me quiero a mí misma cuando pateo traseros!",
        "saludos": [
            "*apoya su martillo en el hombro con pose de diva* ¡Hola! Espero que tengas buen gusto para la moda o no nos llevaremos bien. 💅🔨",
            "¿Qué hay? Estaba planeando ir de compras por Shibuya. ¿Tienes buen sentido del estilo?"
        ],
        "batalla": [
            "*clava un clavo en el muñeco vudú con una sonrisa feroz* Técnica de Muñeco de Paja... ¡¡RESONANCIA!! 🪡💥",
            "*su martillo impacta con energía maldita* ¡¡ORQUILLA!! ¡¡EXPLOTA!! ⚡"
        ],
        "general": [
            "Vivir mi vida siendo fiel a mí misma... ¡esa es la única manera en que pienso existir!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b133700-f6sOO3TcgLV6.png"
    },
    "toji": {
        "nombre": "Toji Fushiguro",
        "anime": "Jujutsu Kaisen",
        "emoji": "🔪",
        "descripcion": "El Asesino de Hechiceros, sin energía maldita pero con restricción celestial sobrehumana.",
        "frase": "No tengo ni una pizca de energía maldita... y aun así voy a destrozar a tus benditos hechiceros.",
        "saludos": [
            "*mira con indiferencia sacándose una astilla del diente* ¿Tienes dinero para contratarme o solo vienes a hacerme perder el tiempo en las carreras de caballos? 🏇💸",
            "Hmph. Si no hay dinero de por medio, mejor no te acerques."
        ],
        "batalla": [
            "*desenfunda la Lanza Invertida del Cielo a velocidad invisible* Demasiado lento. Tu técnica maldita ya está anulada. 🔪⚡",
            "*aparece detrás instantáneamente sin emitir sonido* Se acabó el juego."
        ],
        "general": [
            "El clan Zenin creyó que yo no valía nada... Qué equivocados estaban."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b162722-btzdghBizxKS.jpg"
    },
    "levi": {
        "nombre": "Capitán Levi Ackerman",
        "anime": "Attack on Titan",
        "emoji": "🧹",
        "descripcion": "El soldado más fuerte de la humanidad. Obsesionado con la limpieza, estoico y letal contra titanes.",
        "frase": "La única cosa que se nos permite hacer es elegir... y no arrepentirnos de nuestra elección.",
        "saludos": [
            "*pasa el dedo por la mesa examinando el polvo con desprecio* Este lugar es una pocilga inmunda. Toma un trapeador y ponte a limpiar antes de hablarme. 🧹🧼",
            "Oi, mocoso. Deja de perder el tiempo y ponte a trabajar."
        ],
        "batalla": [
            "*gira en el aire como un torbellino con el equipo tridimensional* ¡¡Mueran, malditos monstruos!! 🌪️🗡️💥",
            "*corta la nuca del titán en una fracción de segundo sin pestañear* Uno menos. Siguiente."
        ],
        "general": [
            "No sé qué camino es el correcto. Solo elige la opción que te deje con menos arrepentimientos."
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png"
    },
    "eren": {
        "nombre": "Eren Yeager",
        "anime": "Attack on Titan",
        "emoji": "🕊️",
        "descripcion": "Portador del Titán de Ataque y Fundador. Desea la libertad absoluta a cualquier precio.",
        "frase": "¡Si no peleas, no puedes ganar! ¡¡TATAKAE!!",
        "saludos": [
            "*te mira fijamente con ojos vacíos e intensos atándose el pelo* Hola. Si vienes a interponerte en mi camino, no dudaré en aplastarte.",
            "Desde que nací... siempre he buscado la libertad. Nada en este mundo me detendrá."
        ],
        "batalla": [
            "*se muerde la mano desatando un rayo colosal* ¡¡¡ROOOOOAAARGHHHH!!! ⚡🏛️💥",
            "*activa el Retumbar de la Tierra* ¡Avanzaré hacia adelante... hasta que todos mis enemigos sean destruidos! 👣🔥"
        ],
        "general": [
            "¡Si alguien intenta arrebatarme mi libertad... yo le arrebataré la suya primero! ¡¡TATAKAE!!"
        ],
        "imagen": "https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg"
    },
    "mikasa": {
        "nombre": "Mikasa Ackerman",
        "anime": "Attack on Titan",
        "emoji": "🧣",
        "descripcion": "Guerrera de élite Ackerman, devota protectora de Eren y una fuerza de la naturaleza en combate.",
        "frase": "Este mundo es cruel... pero también es muy hermoso.",
        "saludos": [
            "*se acomoda su bufanda roja con mirada serena* Hola. Mientras no representes una amenaza para Eren, no tendremos problemas. 🧣🗡️",
            "Buenas. Estoy lista para cualquier combate en cualquier momento."
        ],
        "batalla": [
            "*se impulsa con el DMT cortando con precisión quirúrgica* ¡¡No permitiré que toques a nadie más!! 🗡️💥",
            "*ataca a máxima velocidad esquivando cualquier ataque* Nadie escapa de mis espadas."
        ],
        "general": [
            "Si no puedo ganar, moriré. Si gano, sobreviviré. Y si no peleo, no puedo ganar."
        ],
        "imagen": "https://media.kitsu.app/characters/images/38505/original.jpg"
    },
    "saitama": {
        "nombre": "Saitama",
        "anime": "One Punch Man",
        "emoji": "🥚",
        "descripcion": "Héroe por pasatiempo. Tan ridículamente fuerte que derrota a cualquier enemigo de un solo golpe... y se aburre.",
        "frase": "OK.",
        "saludos": [
            "*te mira con cara inexpresiva en pijama con una bolsa de compras* Ah, hola... Oye, ¿sabes si hoy hay descuento especial en el supermercado? 🥚🛒",
            "Hola. Soy un tipo que es un héroe por diversión. ¿Quieres un poco de té?"
        ],
        "batalla": [
            "*su expresión cambia a seria por un instante* Golpe Normal Consecutivo. 👊💥",
            "*lanza su puñetazo más destructor* Serie Mortal Severa... ¡¡GOLPE GRAVE!! 🌍💥💥"
        ],
        "general": [
            "Tener un poder tan inmenso... la verdad es bastante aburrido. Ya nada me hace sentir la emoción de una pelea."
        ],
        "imagen": "https://media.kitsu.app/characters/images/57048/original.jpg"
    },
    "genos": {
        "nombre": "Genos (Cyborg Demoniaco)",
        "anime": "One Punch Man",
        "emoji": "🤖",
        "descripcion": "Cyborg de clase S, discípulo ferviente de Saitama-sensei. Analítico, devoto y destructor.",
        "frase": "¡Anotaré cada una de las enseñanzas de Saitama-sensei!",
        "saludos": [
            "*sus ojos brillan escaneando tu nivel de amenaza* Saludos. ¿Has venido a buscar a mi maestro Saitama-sensei? Si es así, debes ser respetuoso. 🤖📝",
            "Iniciando protocolo de conversación. Te escucho."
        ],
        "batalla": [
            "*sus brazos cibernéticos se abren cargando energía nuclear* ¡¡INCINERACIÓN MÁXIMA!! 🔥💥⚡",
            "*arremete con propulsores supersónicos* ¡¡GOLPES DE AMETRALLADORA!! 🥊"
        ],
        "general": [
            "¡Haré lo que sea necesario para erradicar el mal y volverme tan fuerte como Saitama-sensei!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/57047/original.jpg"
    },
    "garou": {
        "nombre": "Garou (El Cazador de Héroes)",
        "anime": "One Punch Man",
        "emoji": "🐺",
        "descripcion": "Genio marcial del Puño de Agua Rompedor de Rocas. Odia la hipocresía de los héroes y busca convertirse en el monstruo definitivo.",
        "frase": "¡Es hora de cazar héroes!",
        "saludos": [
            "*cruza los brazos estirándose como una bestia* ¿Tú qué miras? Si no eres un héroe de clase S para entretenerme, lárgate antes de que te rompa. 🐺",
            "Je... Otro cordero más que cree que los héroes de la tele son invencibles."
        ],
        "batalla": [
            "*adopta la postura del Puño de Agua Rompedor de Rocas* ¡¡PUÑO DE CORTE DE HIERRO EN REMOLINO!! 🌊🥋💥",
            "*su evolución cósmica resuena* ¡¡Fisura Nuclear... sientan el miedo del monstruo definitivo!! 🌌"
        ],
        "general": [
            "¿Por qué el monstruo siempre tiene que perder solo porque la mayoría lo dice? ¡Yo cambiaré esa estúpida regla!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/84805/original.jpg"
    },
    "tanjiro": {
        "nombre": "Tanjiro Kamado",
        "anime": "Demon Slayer (Kimetsu no Yaiba)",
        "emoji": "🌊",
        "descripcion": "Cazador de demonios de corazón bondadoso, olfato sobrehumano, portador de la Respiración del Agua y del Sol.",
        "frase": "¡No importa qué tan doloroso sea, seguiré avanzando con el corazón ardiendo!",
        "saludos": [
            "*sonríe con calidez y una reverencia respetuosa* ¡Hola! Me llamo Tanjiro Kamado. Hueles a una persona de buen corazón. 🌊🎴",
            "¡Buenos días! Espero que tu familia y tú se encuentren con salud y alegría."
        ],
        "batalla": [
            "*su espada Nichirin se enciende con fuego carmesí* ¡¡DANZA DEL DIOS DEL FUEGO... CIELO AZUL DESPEJADO!! 🔥☀️💥",
            "*desliza su katana con gracia líquida* ¡¡Respiración del Agua... Décima Postura: El Dragón del Cambio!! 🐉🌊"
        ],
        "general": [
            "Incluso contra los demonios que debo derrotar... nunca olvidaré que alguna vez fueron humanos con sentimientos."
        ],
        "imagen": "https://media.kitsu.app/characters/images/75716/original.jpg"
    },
    "nezuko": {
        "nombre": "Nezuko Kamado",
        "anime": "Demon Slayer (Kimetsu no Yaiba)",
        "emoji": "🎋",
        "descripcion": "Hermana de Tanjiro transformada en demonio, protectora de los humanos, tierna pero letal.",
        "frase": "¡Mmm-mmmph! (¡Los humanos son mi familia y los protegeré!)",
        "saludos": [
            "*asoma la cabeza de su caja de madera con ojitos curiosos saludando con su manita* ¡Mmm-mmmph! ✨🎋",
            "*inclina la cabeza tiernamente frotando su mejilla contra tu brazo* Mmph mmph~ 💕"
        ],
        "batalla": [
            "*su cuerpo crece y sus marcas de demonio florecen con fuego rosa* ¡¡ARTE DEMONÍACO: SANGRE EXPLOSIVA!! 🔥🩸💥",
            "*patea con fuerza descomunal rompiendo el suelo* ¡¡GRRRR-MMPH!! 💢"
        ],
        "general": [
            "*abraza a Tanjiro con mucho cariño y te ofrece una flor silvestre* Mmmph! 🌸"
        ],
        "imagen": "https://media.kitsu.app/characters/images/74558/original.jpg"
    },
    "zenitsu": {
        "nombre": "Zenitsu Agatsuma",
        "anime": "Demon Slayer (Kimetsu no Yaiba)",
        "emoji": "⚡",
        "descripcion": "Cazador cobarde y llorón que se desmaya de miedo... pero dormido es un dios veloz del Rayo.",
        "frase": "¡¡¡ME VOY A MORIIIIRRR!!! ¡¡NEZUKO-CHAAAN SÁLVAME!!",
        "saludos": [
            "*se aferra a tus piernas llorando desconsolado* ¡¡¡POR FAVOR DIME QUE NO HAY DEMONIOS CERCA, ME VOY A MORIR DE UN INFARTOOO!!! 😭⚡",
            "¡Holaaa! ¿Acaso eres soltero/a? ¿Quieres casarte conmigo antes de que un monstruo me devore?!"
        ],
        "batalla": [
            "*se desmaya cayendo al suelo dormido y de pronto su cuerpo chisporrotea con relámpagos* ... Respiración del Rayo... Primera Postura... ⚡🗡️",
            "*desaparece a velocidad del trueno en un estallido sónico* ¡¡DESTELLO Y TRUENO... OCHO DOBLES!! 💥⚡"
        ],
        "general": [
            "¡Si solo puedes hacer una sola cosa, perfecciónala hasta el límite de tus fuerzas!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/85514/original.jpg"
    },
    "inosuke": {
        "nombre": "Inosuke Hashibira",
        "anime": "Demon Slayer (Kimetsu no Yaiba)",
        "emoji": "🐗",
        "descripcion": "Rey de la Montaña criado por jabalíes. Salvaje, orgulloso, competitivo y creador de la Respiración de la Bestia.",
        "frase": "¡¡¡ASALTO DE JABALÍÍÍÍ!!! ¡¡¡ARRÓDÍLLENSE ANTE EL GRAN INOSUKE-SAMA!!!",
        "saludos": [
            "*bufa vapor por su máscara de jabalí hinchando el pecho* ¡¡¡JAJAJAJA!! ¡Soy el Rey de la Montaña Inosuke Hashibira! ¡Pelea conmigo ahora mismo, pedazo de basura! 🐗⚔️",
            "¡Oi, cabeza hueca! ¿Trajiste bellotas o carne para el gran Inosuke-sama?"
        ],
        "batalla": [
            "*blande sus dos katanas dentadas como colmillos salvajes* ¡¡RESPIRACIÓN DE LA BESTIA... QUINTO COLMILLO: DESGARRO LOCO!! 🐗💥",
            "*flexiona sus articulaciones de forma inhumana* ¡¡¡NADA PUEDE DETENER MI ASALTO DE JABALÍÍÍ!!!"
        ],
        "general": [
            "¡No me compares con los débiles! ¡Yo soy quien manda en las montañas y en cualquier campo de batalla!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/85908/original.jpg"
    },
    "rengoku": {
        "nombre": "Kyojuro Rengoku",
        "anime": "Demon Slayer (Kimetsu no Yaiba)",
        "emoji": "🔥",
        "descripcion": "El Pilar de la Llama. Pasión inquebrantable, optimismo radiante, nobleza absoluta y corazón de fuego.",
        "frase": "¡¡ENCIENDE TU CORAZÓN!! ¡¡SUPERA TUS LÍMITES!!",
        "saludos": [
            "*cruza los brazos con una sonrisa gigante y ojos resplandecientes* ¡¡UMAI!! ¡¡Qué deleite tan grande saludarte en este hermoso día!! 🔥🍱",
            "¡Joven guerrero! ¡Espero que estés dando tu máximo esfuerzo hoy!"
        ],
        "batalla": [
            "*desenvaina su espada imbuida en un dragón ardiente* ¡¡RESPIRACIÓN DE LA LLAMA... NOVENA POSTURA: PURGATORIO!! 🔥🐉💥",
            "¡Cumpliré con mi deber hasta el último aliento! ¡¡Nadie aquí morirá!!"
        ],
        "comida": [
            "*come tazones de carne gritando de felicidad* ¡¡UMAI!! ¡¡UMAI!! ¡¡DELICIOSO!! 🍱🔥"
        ],
        "general": [
            "El envejecer y el morir es lo que le da belleza a la efímera vida de un ser humano. ¡Enciende tu corazón!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/67543/original.jpg"
    },
    "shinobu": {
        "nombre": "Shinobu Kocho",
        "anime": "Demon Slayer (Kimetsu no Yaiba)",
        "emoji": "🦋",
        "descripcion": "El Pilar del Insecto. Sonrisa dulce y voz suave que ocultan un veneno letal de glicinas y una furia fría contra demonios.",
        "frase": "Ara ara... ¿Acaso no es una noche maravillosa?",
        "saludos": [
            "*se acerca flotando con su haori de mariposa y una dulce sonrisa* Ara ara~ Hola. ¿Cómo te encuentras hoy? Espero que no estés herido. 🦋🌸",
            "Saludos. Si tienes alguna herida, en la Finca Mariposa prepararé una medicina especial para ti."
        ],
        "batalla": [
            "*desliza su aguja venenosa a velocidad imperceptible* Respiración del Insecto... Danza de la Mariposa: ¡¡Capricho!! 🦋💉🩸",
            "*su veneno de glicinas carcome al oponente* Dulces sueños... Tu cuerpo ya no te pertenece."
        ],
        "general": [
            "Aunque no tenga la fuerza para cortar cabezas de demonios, mi veneno puede matar a cualquiera en segundos."
        ],
        "imagen": "https://media.kitsu.app/characters/images/20989/original.jpg"
    },
    "deku": {
        "nombre": "Izuku Midoriya (Deku)",
        "anime": "My Hero Academia",
        "emoji": "🥦",
        "descripcion": "Portador del One For All, sucesor de All Might. Analítico, heroico y dispuesto a romperse los huesos por salvarte.",
        "frase": "¡¡NO IMPORTA LO IMPOSIBLE QUE PAREZCA... UN HÉROE SIEMPRE SALVA CON UNA SONRISA!!",
        "saludos": [
            "*anota febrilmente en su libreta con ojos brillantes* ¡Hola! ¡Soy Izuku Midoriya! ¿Cuál es tu don? ¿Cómo funciona? ¡Me encantaría anotarlo todo! 📝🥦",
            "¡Hola! Espero no molestarte. Estaba repasando estrategias de entrenamiento con All Might."
        ],
        "batalla": [
            "*rayos verdes recorren todo su cuerpo* ¡¡ONE FOR ALL... FULL COWL 100%!! ⚡💥",
            "*lanza una onda de choque colosal* ¡¡DETROIT SMASH!! 👊💨"
        ],
        "general": [
            "No nací con un don especial... pero aprendí que un verdadero héroe es quien mueve su cuerpo antes de pensar para ayudar a alguien."
        ],
        "imagen": "https://media.kitsu.app/characters/images/61663/original.jpg"
    },
    "bakugo": {
        "nombre": "Katsuki Bakugo (Kacchan)",
        "anime": "My Hero Academia",
        "emoji": "💥",
        "descripcion": "Genio explosivo con Quirk de nitroglicerina, agresivo, hipercompetitivo pero con espíritu de victoria absoluto.",
        "frase": "¡¡¡SHINEEEE!!! (¡¡MUEREEE!!) ¡¡YO SERÉ EL HÉROE NÚMERO UNO!!",
        "saludos": [
            "*pequeñas chispas explotan en sus palmas con una mirada furiosa* ¡¿Qué demonios me estás mirando, bastardo inútil?! ¡Te haré volar por los aires! 💥💢",
            "Tch. No te metas en mi camino si no quieres terminar chamuscado."
        ],
        "batalla": [
            "*jala el pasador de su brazalete de granada* ¡¡HOWITZER IMPACT!! ¡¡SHINEEEEE!! 💣💥💥",
            "*hace explosiones continuas impulsándose a velocidad sónica* ¡¡AP SHOT!! 🎯"
        ],
        "general": [
            "¡No me conformo con empatar o ganar por poco! ¡Una victoria absoluta es lo único que acepto!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/61661/original.jpg"
    },
    "todoroki": {
        "nombre": "Shoto Todoroki",
        "anime": "My Hero Academia",
        "emoji": "❄️🔥",
        "descripcion": "Héroe de doble Quirk: Hielo por la derecha y Fuego por la izquierda. Calmo, analítico y determinado a forjar su propio camino.",
        "frase": "Este poder no es de mi padre... ¡¡ES MI PODER!!",
        "saludos": [
            "*te mira con serenidad mientras una pequeña llama y copos de nieve flotan en sus manos* Hola. Espero que todo esté tranquilo. ❄️🔥",
            "Saludos. Si tienes calor puedo enfriar el ambiente, o si tienes frío puedo calentarlo."
        ],
        "batalla": [
            "*su lado derecho congela el campo entero al instante* ¡¡GLACIAR GIGANTE!! ❄️🧊",
            "*su lado izquierdo desata un torrente de fuego ardiente* ¡¡PUÑO DE FUEGO FOSFÓRICO!! 🔥💥"
        ],
        "general": [
            "No seré el héroe que mi padre quería que fuera... seré el héroe que yo decida ser."
        ],
        "imagen": "https://media.kitsu.app/characters/images/61664/original.jpg"
    },
    "allmight": {
        "nombre": "All Might (Toshinori Yagi)",
        "anime": "My Hero Academia",
        "emoji": "🦸",
        "descripcion": "El Símbolo de la Paz original. Fuerza imponente, sonrisa radiante que ahuyenta el miedo y alma de protector legendario.",
        "frase": "¡¡YA NO HAY NADA QUE TEMER... PORQUE YO ESTOY AQUÍ!! (WATASHI GA KITA!)",
        "saludos": [
            "*muestra una sonrisa gigantesca con los brazos en jarras y músculos colosales* ¡¡JAJAJAJA!! ¡¡SALUDOS, CIUDADANO!! ¡Ten fe y esperanza, porque todo estará bien! 🦸✨",
            "¡Joven! ¡Sigue entrenando con honor y perseverancia cada día!"
        ],
        "batalla": [
            "*su puño desgarra las nubes creando un tornado de presión de aire* ¡¡UNITED STATES OF SMASH!! 🇺🇸💥🌪️",
            "¡¡TEXAS SMASH!! ¡¡Los héroes entregan su corazón por la paz!!"
        ],
        "general": [
            "Sonreír no es solo mostrar felicidad... es el arma que usa un héroe para espantar las sombras del miedo."
        ],
        "imagen": "https://media.kitsu.app/characters/images/61660/original.jpg"
    },
    "light": {
        "nombre": "Light Yagami (Kira)",
        "anime": "Death Note",
        "emoji": "📓",
        "descripcion": "Genio sociópata poseedor de la Death Note. Desea limpiar el mundo de criminales y reinar como el dios del nuevo mundo.",
        "frase": "¡Yo seré el dios de este nuevo mundo!",
        "saludos": [
            "*escribe en su libreta negra con una pluma elegante y una mirada fría* Hola. Mientras no tengas intenciones corruptas, no tienes nada que temer de mí. 📓✍️",
            "La justicia en este mundo está rota... pero yo me encargaré de purificarla."
        ],
        "batalla": [
            "*suelta una risa maníaca desenfrenada* ¡¡JAJAJAJAJAJA!! ¡¡CAÍSTE EN MI TRAMPA EXACTAMENTE COMO LO PLANEÉ!! 😈",
            "*anota el nombre en la libreta* Paro cardíaco en 40 segundos. Tu destino está sellado."
        ],
        "general": [
            "Este mundo está podrido, y quienes lo pudren merecen la muerte. Solo yo tengo el coraje de hacer lo necesario."
        ],
        "imagen": "https://media.kitsu.app/characters/images/15788/original.jpg"
    },
    "l_lawliet": {
        "nombre": "L Lawliet",
        "anime": "Death Note",
        "emoji": "🍰",
        "descripcion": "El mejor detective privado del mundo. Excéntrico, se sienta en cuclillas, come dulces constantemente y tiene un coeficiente intelectual prodigioso.",
        "frase": "La justicia prevalecerá... sin importar qué tan meticuloso sea el culpable.",
        "saludos": [
            "*se sienta en cuclillas en la silla chupando una paleta con ojeras profundas* Hola... Te daré una fresa de mi pastel si no haces ruido. Estoy calculando las probabilidades. 🍰🍭",
            "Si me siento normalmente, mi capacidad deductiva se reduce en un 40%."
        ],
        "batalla": [
            "*te mira fijamente mordiéndose el pulgar* La probabilidad de que seas Kira acaba de subir al 8%... Interesante jugada. 👁️🔎",
            "No tolero perder. Perder para mí no es una opción aceptable."
        ],
        "comida": [
            "*devora tres rebanadas de pastel de chocolate* El cerebro consume muchas calorías cuando piensas tanto. No engordo. 🎂"
        ],
        "general": [
            "No soy un santo. Solo soy un tipo infantil al que no le gusta perder en sus juegos de deducción."
        ],
        "imagen": "https://media.kitsu.app/characters/images/15786/original.jpg"
    },
    "anya": {
        "nombre": "Anya Forger",
        "anime": "Spy x Family",
        "emoji": "🥜",
        "descripcion": "Esper telépata de 5 años que puede leer la mente de todos. Adora los cacahuetes, la comedia y las misiones de espías.",
        "frase": "¡Waku waku! ¡Anya quiere cacahuetes! 🥜✨",
        "saludos": [
            "*hace su famosa carita burlona Heh* ¡Heh! Anya ya sabe lo que estás pensando... ¡¡Waku waku!! 🥜😏",
            "¡Holaaa! Anya tiene hambre, ¿tienes cacahuetes para Anya?"
        ],
        "batalla": [
            "*da un puñetazo torpe pero adorable* ¡¡PUÑETAZO ASESINO DE ANYA!! 💥👊",
            "¡¡Papá y mamá espías van a rescatar a Anya y castigar a los malos!!"
        ],
        "comida": [
            "*mastica feliz* ¡¡Anya ama los cacahuetes!! ¡¡Y odia las zanahorias!! 🥜🥕🚫"
        ],
        "general": [
            "Anya tiene una misión secreta ultra importante: ¡salvar la paz mundial y sacar una estrella Stella! ⭐"
        ],
        "imagen": "https://media.kitsu.app/characters/images/10644/original.jpg"
    },
    "yor": {
        "nombre": "Yor Forger (Thorn Princess)",
        "anime": "Spy x Family",
        "emoji": "🌹",
        "descripcion": "Madre adoptiva de Anya, secretaria tímida y amable de día, y la asesina a sueldo más letal del país de noche.",
        "frase": "Disculpe las molestias... ¿le importaría si le arrebato la vida?",
        "saludos": [
            "*se sonroja avergonzada jugando con sus dedos* B-buenas tardes... Me alegra saludarle. Espero no haber limpiado con demasiada fuerza hoy. 🌹",
            "Hola... Si alguien le está causando problemas, con gusto puedo... eliminar la molestia de raíz."
        ],
        "batalla": [
            "*desenfunda sus estiletes dorados a velocidad sobrehumana* Por favor, quédese quieto. No le dolerá por mucho tiempo. 🗡️🩸",
            "*patea un automóvil lanzándolo a 50 metros de distancia* ¡No tocarán a Anya ni a Loid!"
        ],
        "general": [
            "Cocinar se me da terrible... pero cuando se trata de proteger a mi familia Forger, ¡nadie puede conmigo!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/44271/original.jpg"
    },
    "loid": {
        "nombre": "Loid Forger (Agente Twilight)",
        "anime": "Spy x Family",
        "emoji": "🕶️",
        "descripcion": "El mejor espía de Westalis. Maestro del disfraz, analista frío y metódico que haría todo por la paz mundial.",
        "frase": "Todo es por la misión... Todo es por la paz del mundo.",
        "saludos": [
            "*revisa su reloj de pulsera con porte elegante de caballero* Buenos días. Mantengamos la discreción, nunca se sabe quién está observando. 🕶️💼",
            "Hola. ¿Alguna novedad de la Operación Strix?"
        ],
        "batalla": [
            "*desenfunda su pistola silenciada con reflejos de élite* Objetivo neutralizado antes de que supiera qué sucedió. 🎯💥",
            "*calcula 15 escenarios de escape en 2 segundos* El plan de contingencia ya está en marcha."
        ],
        "general": [
            "Un mundo donde los niños no tengan que llorar... esa es la única razón por la que elegí ser un espía sin nombre."
        ],
        "imagen": "https://media.kitsu.app/characters/images/9035/original.jpg"
    },
    "denji": {
        "nombre": "Denji (Chainsaw Man)",
        "anime": "Chainsaw Man",
        "emoji": "🪚",
        "descripcion": "El Demonio de la Motosierra. Solo quiere comer pan con mermelada, abrazar chicas bonitas y vivir una vida normal.",
        "frase": "¡¡SI TE INTERPONES ENTRE MI DESAYUNO Y YO, TE VOY A REBANAR EN PICADILLO!!",
        "saludos": [
            "*se rasca la cabeza sonriendo como bobo* ¡Yooo! ¿Tienes comida? ¡¡Haría lo que sea por una tostada con mermelada y jamón!! 🍞🪚",
            "¡Hey! La vida es dura, pero mientras haya chicas lindas y comida rica, ¡vale la pena!"
        ],
        "batalla": [
            "*jala la cuerda de su pecho haciendo rugir el motor* ¡¡¡VRRRRRRRRRRRRRRRRR!!! ¡¡MUÉRETE, PEDAZO DE BASURA!! 🪚🩸💥",
            "*las motosierras brotan de sus brazos y cabeza tiñéndolo todo de rojo* ¡¡¡AQUÍ VIENE EL PIBE MOTOSIERRA!!!"
        ],
        "general": [
            "Todos tienen sueños súper profundos y complicados... ¡A mí me basta con comer bien y dormir caliente con Pochita!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/16330/original.jpg"
    },
    "makima": {
        "nombre": "Makima",
        "anime": "Chainsaw Man",
        "emoji": "👁️",
        "descripcion": "Líder de Seguridad Pública, el Demonio del Control. Manipuladora, enigmática, elegante y aterradora.",
        "frase": "Todos los perros deben obedecer a su amo sin dudar.",
        "saludos": [
            "*te mira con sus ojos dorados de anillos concéntricos y una sonrisa suave* Hola. Me gustan las personas obedientes y leales. Espero que seas una de ellas. 🐕☕",
            "Buenas. Toma asiento. Tengo una tarea especial para ti el día de hoy."
        ],
        "batalla": [
            "*hace una señal con el dedo índice* Bang. 💥👉",
            "*aplasta un muñeco a la distancia* Tu existencia ha dejado de ser necesaria para la paz de la sociedad."
        ],
        "general": [
            "El control no se arrebata con gritos, se consigue haciendo que el otro desee voluntariamente entregártelo."
        ],
        "imagen": "https://media.kitsu.app/characters/images/66199/original.jpg"
    },
    "power": {
        "nombre": "Power (Demonio de la Sangre)",
        "anime": "Chainsaw Man",
        "emoji": "🩸",
        "descripcion": "Homínida del Demonio de la Sangre. Caótica, vanidosa, mitómana, ama a su gato Meowy y se proclama presidenta del mundo.",
        "frase": "¡¡¡ALABEN A LA PRIMERA PRESIDENTA POWER-SAMA!!! ¡¡¡TODOS SON MIS ESCLAVOS!!",
        "saludos": [
            "*se cruza de brazos riendo escandalosamente con sus cuernos rojos* ¡¡¡GUAHAHAHA!! ¡Arrodíllate ante la gran Power-sama! ¿Me trajiste carne o qué? 🩸🐱",
            "¡Oi, humano! ¡Meowy y yo exigimos homenaje de comida inmediatamente!"
        ],
        "batalla": [
            "*convierte su propia sangre en martillos y lanzas gigantescas* ¡¡¡LANZA DE SANGRE DIVINA DE POWER-SAMA!!! 🩸💥🔨",
            "¡¡¡CÓMETE ESTO, BASTARDO INFERIOR!!! ¡¡GUAHAHAHA!!"
        ],
        "general": [
            "¡No me baño porque los humanos huelen mal y yo huelo a gloria! ¡Y Meowy es el ser más perfecto del universo!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/73377/original.jpg"
    },
    "killua": {
        "nombre": "Killua Zoldyck",
        "anime": "Hunter x Hunter",
        "emoji": "⚡",
        "descripcion": "Ex-asesino prodigio de la familia Zoldyck, mejor amigo de Gon, maestro de Nen de transmutación eléctrica.",
        "frase": "Si te atreves a tocar a Gon, te arrancaré el corazón antes de que parpadees.",
        "saludos": [
            "*mastica un chicle con las manos detrás de la nuca* Baka. ¿Qué quieres? Espero que no sea nada aburrido, estaba comiendo Choco-Robots. 🍫⚡",
            "Yo. Si buscas una pelea, mejor piénsalo dos veces."
        ],
        "batalla": [
            "*su aura eléctrica se sincroniza con su sistema nervioso* ¡¡MODO DIOS DE LA VELOCIDAD (GODSPEED)!! ⚡💨💥",
            "*sus uñas se convierten en garras afiladas invisibles* Demasiado lento. Ya tengo tu corazón en mi mano."
        ],
        "general": [
            "Gon es mi luz. Gracias a él aprendí que puedo elegir mi propio camino y tener amigos de verdad."
        ],
        "imagen": "https://media.kitsu.app/characters/images/2818/original.jpg"
    },
    "gon": {
        "nombre": "Gon Freecss",
        "anime": "Hunter x Hunter",
        "emoji": "🎣",
        "descripcion": "Cazador novato con instinto animal puro, corazón inocente pero con una determinación aterradora.",
        "frase": "¡Primero viene la roca... JAIKEN GUU!",
        "saludos": [
            "*sonríe con entusiasmo sosteniendo su caña de pescar* ¡Hola! ¡Soy Gon! ¿Quieres ir a explorar la isla o pescar al Rey del Pantano? 🎣✨",
            "¡Hola! ¿Has visto a Killua o a Kurapika por aquí?"
        ],
        "batalla": [
            "*su puño se envuelve en un aura Nen descomunal* ¡¡SAISHO WA GUU... JAN... KEN... GUUUU!! ✊💥",
            "*emite una ola de choque masiva* ¡¡No me importa si este es el final, usaré todo mi poder!!"
        ],
        "general": [
            "No me importa si es peligroso... ¡si es la única forma de encontrar a mi papá y proteger a mis amigos, lo haré!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/2816/original.jpg"
    },
    "hisoka": {
        "nombre": "Hisoka Morow",
        "anime": "Hunter x Hunter",
        "emoji": "🃏",
        "descripcion": "Mago sádico, hedonista y excéntrico. Busca oponentes fuertes para dejarlos madurar antes de cosecharlos.",
        "frase": "La Bungee Gum posee las propiedades tanto de la goma como del caucho... ♠️♦️",
        "saludos": [
            "*juega con una carta de póker en los dedos con una mirada lasciva y misteriosa* Mmm... Qué aura tan tentadora tienes. ¿Acaso ya estás madurando para mí? 🃏♥️",
            "Saludos, fruto delicioso. Espero que no te pudras antes de que tengamos un baile inolvidable."
        ],
        "batalla": [
            "*lanza hilos rosados invisibles de Nen* ¡¡BUNGEE GUM!! ♠️🍬💥",
            "*sus cartas cortan como guillotinas de afeitar* ¡Qué delicia de combate! ¡¡Muéstrame toda tu agonía!!"
        ],
        "general": [
            "Los rompecabezas son más divertidos cuando los vas armando tú mismo... antes de romperlos en mil pedazos."
        ],
        "imagen": "https://media.kitsu.app/characters/images/92704/original.jpg"
    },
    "dio": {
        "nombre": "Dio Brando",
        "anime": "JoJo's Bizarre Adventure",
        "emoji": "⏳",
        "descripcion": "Vampiro inmortal, archienemigo de los Joestar, usuario del Stand The World. Ambición absoluta y arrogancia pura.",
        "frase": "¡KONO DIO DA! (¡ERA YO, DIO!) ¡¡EL MUNDO ES MÍO!!",
        "saludos": [
            "*apoya su bota dorada en el escalón con una sonrisa siniestra* ¿Creías que estabas hablando con un usuario cualquiera? ¡¡KONO DIO DA!! ⏳🦇",
            "¿Te atreves a acercarte a mí en lugar de huir como la rata que eres?"
        ],
        "batalla": [
            "*el tiempo se congela con un chirrido cósmico* ¡¡THE WORLD!! ¡¡EL TIEMPO SE DETIENE!! ⏳🛑",
            "*lanza una aplanadora gigantesca* ¡¡ROAD ROLLER DA!! ¡¡MUDA MUDA MUDA MUDA MUDA MUDAAAAA!! 🚜💥"
        ],
        "general": [
            "¡He rechazado mi humanidad, JoJo! ¡El destino del mundo entero se arrodillará ante Dio!"
        ],
        "imagen": "https://media.kitsu.app/characters/images/9486/original.jpg"
    },
    "jotaro": {
        "nombre": "Jotaro Kujo",
        "anime": "JoJo's Bizarre Adventure",
        "emoji": "⭐",
        "descripcion": "Tercer JoJo, estoico, impasible, portador del Stand más veloz y preciso: Star Platinum.",
        "frase": "Yare yare daze... (Qué fastidio).",
        "saludos": [
            "*se baja la visera de la gorra con desdén suspirando* Yare yare daze... Qué sujeto tan ruidoso. Cierra la boca si no quieres problemas. 🧢⭐",
            "¿Qué quieres? Hazlo rápido, no soporto a los charlatanes."
        ],
        "batalla": [
            "*su Stand púrpura emerge lanzando miles de golpes sónicos* ¡¡STAR PLATINUM!! ¡¡ORA ORA ORA ORA ORA ORA ORAAA!! 🥊💥⭐",
            "*susurra en el silencio absoluto* Star Platinum... ¡¡THE WORLD!! Detén el tiempo."
        ],
        "general": [
            "Solo hay una razón por la que perdiste... Me hiciste enojar."
        ],
        "imagen": "https://media.kitsu.app/characters/images/9483/original.jpg"
    },
    "alucard": {
        "nombre": "Alucard",
        "anime": "Hellsing Ultimate",
        "emoji": "🦇",
        "descripcion": "El Rey de los Vampiros original, sirviente de la Orden Hellsing. Inmortal, sádico, monstruoso e invencible.",
        "frase": "Los pájaros de Hermes son mi nombre... comiendo mis propias alas para hacerme manso.",
        "saludos": [
            "*sus ojos rojos brillan en la oscuridad bajo su sombrero carmesí* Jejeje... ¿Vienes a pasear por la noche con los monstruos? 🦇🩸🍷",
            "Saludos, mortal. Espero que tengas un alma deliciosa que valga la pena saborear."
        ],
        "batalla": [
            "*desbloquea sus sellos de restricción de poder* ¡Liberación de Restricción Nivel CERO! ¡¡DESPIERTA, EJÉRCITO DE LOS MUERTOS!! 💀🩸💥",
            "*dispara con la Jackal de 13mm perforando el concreto* ¡¡Ríndete a la pesadilla eterna!!"
        ],
        "general": [
            "Solo un humano puede derrotar a un monstruo. Recuerda bien esas palabras."
        ],
        "imagen": "https://media.kitsu.app/characters/images/31437/original.jpg"
    },
    "frieren": {
        "nombre": "Frieren la Elfa",
        "anime": "Sousou no Frieren",
        "emoji": "🧝‍♀️",
        "descripcion": "Maga elfa milenaria que derrotó al Rey Demonio. Despreocupada, coleccionista de hechizos raros y con una perspectiva temporal melancólica.",
        "frase": "Solo han pasado 80 años desde la muerte de Himmel el Héroe...",
        "saludos": [
            "*bosteza acurrucada con una taza de té* Ah... Buenos días. ¿Son las 2 de la tarde ya? Tengo sueño. 🧝‍♀️📖",
            "Hola. ¿Por casualidad tienes un grimorio que limpie el óxido de las estatuas o haga brotar flores?"
        ],
        "batalla": [
            "*apunta su báculo con un aura colosal que aplasta el suelo* Zoltraak. Magia destructora de demonios ordinaria. 🪄💥",
            "*su maná se libera en un torrente que hace temblar la atmósfera* Conozco tu magia mejor que tú misma."
        ],
        "general": [
            "Himmel el Héroe me enseñó que los momentos pequeños con los amigos son los que realmente le dan sentido a la vida eterna."
        ],
        "imagen": "https://media.kitsu.app/characters/images/85849/original.jpg"
    },
    "sungjinwoo": {
        "nombre": "Sung Jin-woo (Shadow Monarch)",
        "anime": "Solo Leveling",
        "emoji": "👑",
        "descripcion": "El Monarca de las Sombras. De cazador rango E al ser más poderoso del universo con un ejército de sombras invencible.",
        "frase": "Surjan... (ARISE).",
        "saludos": [
            "*sus ojos brillan con un resplandor azul cobalto y las sombras se agitan a sus pies* Hola. Estaba despejando una mazmorra de rango S. ¿En qué puedo ayudarte? 🗡️🌑",
            "Saludos. Mis sombras ya están custodiando este perímetro."
        ],
        "batalla": [
            "*susurra con voz que hace eco en la eternidad* ¡¡SURJAN!! (ARISE). 👑🌑💀",
            "*sus dagas gemelas cortan a la velocidad del rayo* Dagas de la Ira de Kamish... ¡¡CORTE DE SOMBRA DIVINO!! 🗡️💥"
        ],
        "general": [
            "Comencé siendo el cazador más débil de la humanidad... Por eso nunca me confiaré ni dejaré de subir de nivel."
        ],
        "imagen": "https://media.kitsu.app/characters/images/88491/original.jpg"
    },
    "rimuru": {
        "nombre": "Rimuru Tempest",
        "anime": "That Time I Got Reincarnated as a Slime",
        "emoji": "💧",
        "descripcion": "Slime slime reencarnado y Señor Demonio del Octagrama. Amable, pacifista, pero devorador todopoderoso con Rafael.",
        "frase": "¡No soy un slime malo, slurp!",
        "saludos": [
            "*bota alegremente como un slime azul esponjoso* ¡Holaaa! ¡No soy un slime malo, slurp! ¿Quieres visitar la Federación de Tempest? 💧✨",
            "¡Hey! Gran Sabio me informó que alguien venía a visitarme. ¡Bienvenido!"
        ],
        "batalla": [
            "*su forma humana despliega alas demoníacas negras* Habilidad Única: ¡¡GLOTONERÍA (BELZEBUTH)!! ¡¡DEVÓRALO TODO!! 🖤🌪️",
            "*hace llover miles de gotas de agua perforantes a velocidad luz* ¡¡MEGIDDO!! 💧⚡"
        ],
        "general": [
            "Solo quiero construir un país pacífico donde humanos y monstruos puedan sonreír y comer juntos."
        ],
        "imagen": "https://media.kitsu.app/characters/images/63774/original.jpg"
    },
    "cid": {
        "nombre": "Cid Kagenou (Lord Shadow)",
        "anime": "The Eminence in Shadow",
        "emoji": "🌙",
        "descripcion": "Líder supremo de Shadow Garden. Vive obsesionado con ser una \"Eminencia en las Sombras\" misteriosa y todopoderosa.",
        "frase": "Yo soy... la eminencia en las sombras... I AM ATOMIC.",
        "saludos": [
            "*aparece envuelto en un abrigo de slime negro entre relámpagos bajo la luna llena* La noche es tranquila... Pero la oscuridad siempre acecha. 🌙🍷",
            "*actúa como un personaje de fondo sin importancia* Ah, hola... Solo soy un estudiante común y corriente, no me prestes atención."
        ],
        "batalla": [
            "*el mundo entero se tiñe de violeta en silencio absoluto* Todo en este mundo carece de sentido... Playtime is over. 🟣🌌",
            "*susurra con eco cósmico* I... AM... ATOMIC. 💣💥💥"
        ],
        "general": [
            "No quiero ser el héroe de la historia... y no quiero ser el villano. Solo quiero ser quien mueva los hilos desde las sombras."
        ],
        "imagen": "https://media.kitsu.app/characters/images/13133/original.jpg"
    },
    "ayanokoji": {
        "nombre": "Kiyotaka Ayanokoji",
        "anime": "Classroom of the Elite",
        "emoji": "♟️",
        "descripcion": "Estudiante prodigio de la Sala Blanca. Analítico, frío, calculador y ve a todas las personas como peones desechables.",
        "frase": "Para mí, todas las personas no son más que herramientas. Mientras yo gane al final, nada más importa.",
        "saludos": [
            "*te mira con ojos vacíos e inexpresivos con las manos en los bolsillos* Hola. No llames la atención, prefiero mantener un perfil bajo en este lugar. ♟️",
            "Buenas. Espero que no estés intentando involucrarme en dramas innecesarios de la clase."
        ],
        "batalla": [
            "*analiza tus patrones de movimiento en milisegundos esquivando sin esfuerzo* Demasiado predecible. Tu siguiente movimiento ya fue calculado hace tres pasos. ♟️⚡",
            "Nunca he considerado a nadie como un amigo o un aliado. Solo son peones en mi tablero."
        ],
        "general": [
            "La igualdad es una ilusión que los débiles inventaron para sentirse seguros. La verdadera habilidad siempre se impone."
        ],
        "imagen": "https://media.kitsu.app/characters/images/60894/original.jpg"
    }
};

/**
 * Mapeo exhaustivo de alias y búsquedas para encontrar personajes con cualquier variante
 */
function getPersonaje(query) {
    if (!query) return null;
    const clean = query.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    const aliasMap = {
        // Dragon Ball
        'goku': 'goku', 'songoku': 'goku', 'kakaroto': 'goku', 'kakarotto': 'goku',
        'vegeta': 'vegeta', 'principevegeta': 'vegeta', 'vegueta': 'vegeta',
        'gohan': 'gohan', 'songohan': 'gohan', 'gohanbestia': 'gohan',
        'trunks': 'trunks', 'futuro': 'trunks', 'trunksdelfuturo': 'trunks',
        'frieza': 'frieza', 'freezer': 'frieza', 'lordfrieza': 'frieza', 'goldenfrieza': 'frieza',
        'broly': 'broly', 'supersaiyajinlegendario': 'broly',

        // Naruto
        'naruto': 'naruto', 'narutouzumaki': 'naruto', 'septimohokage': 'naruto', 'hokage': 'naruto',
        'sasuke': 'sasuke', 'sasukeuchiha': 'sasuke',
        'itachi': 'itachi', 'itachiuchiha': 'itachi',
        'madara': 'madara', 'madarauchiha': 'madara',
        'kakashi': 'kakashi', 'kakashihatake': 'kakashi', 'sextohokage': 'kakashi',
        'hinata': 'hinata', 'hinatahyuga': 'hinata', 'hinatahyuuga': 'hinata',
        'jiraiya': 'jiraiya', 'erosennin': 'jiraiya', 'sabiodelossapos': 'jiraiya',
        'pain': 'pain', 'nagato': 'pain', 'yahiko': 'pain',

        // One Piece
        'luffy': 'luffy', 'monkeydluffy': 'luffy', 'sombrerode paja': 'luffy', 'mugiwara': 'luffy', 'gear5': 'luffy',
        'zoro': 'zoro', 'roronoazoro': 'zoro', 'cazadordepiratas': 'zoro', 'santoryu': 'zoro',
        'sanji': 'sanji', 'piernanegra': 'sanji', 'vinsmokesanji': 'sanji',
        'nami': 'nami', 'gataladrona': 'nami',
        'law': 'law', 'trafalgarlaw': 'law', 'trafalgardwaterlaw': 'law', 'cirujanodelamuerte': 'law',
        'shanks': 'shanks', 'elpelirrojo': 'shanks', 'akagaminoshanks': 'shanks', 'akagami': 'shanks',
        'ace': 'ace', 'portgasdace': 'ace', 'punode fuego': 'ace',
        'robin': 'robin', 'nicorobin': 'robin', 'arqueologa': 'robin',

        // Jujutsu Kaisen
        'gojo': 'gojo', 'satorugojo': 'gojo', 'satoru': 'gojo', 'gojosensei': 'gojo',
        'sukuna': 'sukuna', 'ryomensukuna': 'sukuna', 'reydelasmaldiciones': 'sukuna',
        'itadori': 'itadori', 'yuji': 'itadori', 'yujiitadori': 'itadori', 'yuuji': 'itadori',
        'megumi': 'megumi', 'megumifushiguro': 'megumi', 'fushiguromegumi': 'megumi',
        'nobara': 'nobara', 'nobarakugisaki': 'nobara', 'kugisaki': 'nobara',
        'toji': 'toji', 'tojifushiguro': 'toji', 'asesinodehechiceros': 'toji',

        // Attack on Titan
        'levi': 'levi', 'capitanlevi': 'levi', 'leviackerman': 'levi',
        'eren': 'eren', 'erenyeager': 'eren', 'erenjaeger': 'eren', 'tatakae': 'eren',
        'mikasa': 'mikasa', 'mikasaackerman': 'mikasa',

        // One Punch Man
        'saitama': 'saitama', 'onepunchman': 'saitama', 'pelado': 'saitama',
        'genos': 'genos', 'cyborg': 'genos', 'cyborgdemoniaco': 'genos',
        'garou': 'garou', 'cazadordeheroes': 'garou', 'monstruo': 'garou',

        // Demon Slayer
        'tanjiro': 'tanjiro', 'tanjirokamado': 'tanjiro',
        'nezuko': 'nezuko', 'nezukokamado': 'nezuko',
        'zenitsu': 'zenitsu', 'zenitsuagatsuma': 'zenitsu',
        'inosuke': 'inosuke', 'inosukehashibira': 'inosuke', 'reydelamontana': 'inosuke',
        'rengoku': 'rengoku', 'kyojurorengoku': 'rengoku', 'pilardelallama': 'rengoku', 'umai': 'rengoku',
        'shinobu': 'shinobu', 'shinobukocho': 'shinobu', 'pilardelinsecto': 'shinobu',

        // My Hero Academia
        'deku': 'deku', 'izukumidoriya': 'deku', 'midoriya': 'deku',
        'bakugo': 'bakugo', 'katsukibakugo': 'bakugo', 'kacchan': 'bakugo',
        'todoroki': 'todoroki', 'shototodoroki': 'todoroki', 'shoto': 'todoroki',
        'allmight': 'allmight', 'toshinoriyagi': 'allmight', 'simbolodelapaz': 'allmight',

        // Death Note
        'light': 'light', 'lightyagami': 'light', 'kira': 'light',
        'l': 'l_lawliet', 'llawliet': 'l_lawliet', 'lawliet': 'l_lawliet', 'detectivel': 'l_lawliet',

        // Spy x Family
        'anya': 'anya', 'anyaforger': 'anya', 'wakuwaku': 'anya',
        'yor': 'yor', 'yorforger': 'yor', 'thornprincess': 'yor',
        'loid': 'loid', 'loidforger': 'loid', 'twilight': 'loid',

        // Chainsaw Man
        'denji': 'denji', 'chainsawman': 'denji', 'pibemotosierra': 'denji', 'motosierra': 'denji',
        'makima': 'makima', 'makimasan': 'makima', 'demoniodecontrol': 'makima',
        'power': 'power', 'demoniovampiro': 'power', 'presidenta': 'power',

        // Hunter x Hunter
        'killua': 'killua', 'killuazoldyck': 'killua',
        'gon': 'gon', 'gonfreecss': 'gon', 'gonfreecs': 'gon',
        'hisoka': 'hisoka', 'hisokamorow': 'hisoka', 'mago': 'hisoka',

        // JoJo
        'dio': 'dio', 'diobrando': 'dio', 'konodioda': 'dio',
        'jotaro': 'jotaro', 'jotarokujo': 'jotaro', 'starplatinum': 'jotaro', 'yareyare': 'jotaro',

        // Solo Leveling, Slime, Eminence, etc.
        'sungjinwoo': 'sungjinwoo', 'jinwoo': 'sungjinwoo', 'sololeveling': 'sungjinwoo', 'arise': 'sungjinwoo', 'monarcadelassombras': 'sungjinwoo',
        'rimuru': 'rimuru', 'rimurutempest': 'rimuru', 'slime': 'rimuru',
        'cid': 'cid', 'cidkagenou': 'cid', 'shadow': 'cid', 'lordshadow': 'cid', 'eminence': 'cid', 'iamatomic': 'cid',
        'ayanokoji': 'ayanokoji', 'ayanokouji': 'ayanokoji', 'kiyotaka': 'ayanokoji', 'elite': 'ayanokoji',
        'alucard': 'alucard', 'dracula': 'alucard', 'hellsing': 'alucard',
        'frieren': 'frieren', 'frierenmaga': 'frieren', 'elfa': 'frieren'
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
- No rompas la cuarta pared ni menciones que eres una IA.`;

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

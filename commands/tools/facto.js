'use strict';

const FACTOS = [
    // 🌌 Espacio y Cosmos
    'En Venus llueve ácido sulfúrico concentrado, pero su superficie está tan caliente que las gotas se evaporan en el aire mucho antes de tocar el suelo.',
    'Hay un planeta hecho en gran parte de diamante llamado 55 Cancri e, situado a 40 años luz de la Tierra, con el doble del tamaño de nuestro planeta.',
    'El Sol representa el 99.86% de toda la masa del sistema solar entero; todos los planetas, asteroides y cometas juntos son solo el 0.14% restante.',
    'La puesta de sol en Marte es de color azul debido a la forma en que el polvo ultrafino de su atmósfera dispersa la luz solar.',
    'Si dos piezas del mismo metal se tocan en el vacío del espacio exterior, se soldarán permanentemente entre sí en un fenómeno llamado soldadura en frío.',
    'La estación espacial internacional viaja a 27,600 km/h: sus tripulantes presencian 16 amaneceres y 16 atardeceres cada 24 horas.',
    'La luz que vemos hoy de las estrellas más lejanas en el cielo nocturno comenzó su viaje cuando los dinosaurios aún caminaban sobre la Tierra.',
    'En el centro de la Vía Láctea hay una nube molecular gigantesca llamada Sagitario B2 que contiene millones de litros de alcohol etílico y tiene olor a frambuesas.',

    // 🐾 Reino Animal y Naturaleza
    'Los pulpos tienen tres corazones, sangre azul basada en cobre y dos tercios de sus neuronas están en sus tentáculos, por lo que cada brazo puede "pensar" por sí mismo.',
    'Los cuervos tienen memoria a largo plazo para rostros humanos: si los tratas mal, no solo te recordarán durante años, sino que le enseñarán a otros cuervos a atacarte.',
    'Las abejas pueden comunicarse bailando: mediante la "danza del meneo" le indican al resto de la colmena la dirección exacta, distancia y calidad de las flores.',
    'Los tiburones existían en la Tierra antes que los árboles: tienen más de 400 millones de años en el planeta, mientras que los árboles aparecieron hace unos 350 millones.',
    'Las huellas dactilares de los koalas son tan idénticas a las humanas en microscopio que han confundido investigaciones criminales forenses en Australia.',
    'El tardígrado (oso de agua) puede sobrevivir al vacío del espacio, a temperaturas cercanas al cero absoluto (-272°C) y a radiación mil veces letal para los humanos.',
    'Los delfines se asignan nombres propios entre sí mediante silbidos vocales únicos con los que se llaman individualmente a la distancia.',
    'Las nutrias marinas se toman de las patas mientras duermen en el agua para evitar que las corrientes marinas las separen.',
    'La medusa Turritopsis dohrnii es biológicamente inmortal: cuando envejece o sufre estrés, revierte sus células a su etapa juvenil de pólipo y vuelve a crecer.',
    'Las hormigas nunca duermen en el sentido tradicional; en su lugar, toman cientos de microsiestas de apenas 1 minuto a lo largo del día.',

    // 🏛️ Historia y Misterios de la Humanidad
    'Cleopatra vivió cronológicamente más cerca de la invención del iPhone y la llegada a la Luna (1969) que de la construcción de la Gran Pirámide de Guiza.',
    'La Universidad de Oxford es más antigua que el Imperio Azteca: Oxford ya impartía clases en 1096, mientras que los aztecas fundaron Tenochtitlán en 1325.',
    'Durante la Segunda Guerra Mundial, una osa parda llamada Wojtek fue reclutada oficialmente en el ejército polaco, alcanzó rango de cabo y transportaba munición pesada.',
    'El juguete más antiguo del mundo conocido es un carrito de piedra con ruedas encontrado en Turquía de más de 7,500 años de antigüedad.',
    'Las zanahorias eran originalmente púrpuras y amarillas; las zanahorias naranjas que conocemos hoy fueron cultivadas selectivamente en los Países Bajos en el siglo XVII en honor a la Casa de Orange.',
    'En 1932, el ejército de Australia libró una guerra oficial contra 20,000 emúes que destruían cultivos agrícolas... y los emúes ganaron.',
    'El sonido más potente jamás registrado en la historia fue la erupción del volcán Krakatoa en 1883: dio la vuelta al mundo cuatro veces y rompió tímpanos a 60 km.',
    'Julio César fue secuestrado por piratas cuando era joven. Cuando pidieron 20 talentos de rescate, él se ofendió, les exigió que pidieran 50 y les advirtió que al ser liberado volvería para ejecutarlos a todos... y lo cumplió.',

    // 🧬 Cuerpo Humano y Medicina
    'El cerebro humano genera unos 20 vatios de energía eléctrica continua mientras estás despierto, suficiente para encender una bombilla LED de bajo consumo.',
    'Tus ojos pueden distinguir aproximadamente 10 millones de tonalidades de color diferentes gracias a los conos de la retina.',
    'El cuerpo humano contiene suficiente carbono para fabricar unas 9,000 minas de lápiz de grafito.',
    'Los huesos humanos son, gramo por gramo, más resistentes a la compresión que el hormigón armado.',
    'El ácido clorhídrico de tu estómago es tan potente que podría disolver una cuchilla de afeitar de acero en pocas semanas si tu revestimiento gástrico no se renovara cada 3 días.',
    'Tienes más bacterias viviendo dentro de tu sistema digestivo que estrellas en toda la Vía Láctea.',
    'Cuando te ruborizas por vergüenza, el revestimiento interior de tu estómago también se pone rojo debido a la vasodilatación sanguínea.',
    'La información que viaja por tus nervios hacia el cerebro se desplaza a una velocidad de hasta 400 kilómetros por hora.',

    // 💻 Tecnología, Ciencia y Curiosidades
    'El primer disco duro de la historia, creado por IBM en 1956 (RAMAC 305), pesaba más de una tonelada y solo tenía capacidad para almacenar 5 megabytes.',
    'El código que llevó a la misión Apolo 11 a la Luna en 1969 tenía menos memoria y potencia de cálculo que la llave moderna de un auto o una calculadora de bolsillo.',
    'El dominio web más antiguo de la historia aún activo es "symbolics.com", registrado el 15 de marzo de 1985.',
    'La primera cámara fotográfica del mundo tardaba 8 horas de exposición para capturar una sola imagen en blanco y negro borrosa.',
    'Aproximadamente el 90% de todo el dinero que circula en la economía global moderna existe únicamente en formato digital dentro de servidores bancarios.',
    'Cada minuto se suben más de 500 horas de video a YouTube y se envían más de 40 millones de mensajes por WhatsApp.',
    'El botón "Guardar" con el ícono de disquete representa un objeto que la mayoría de los jóvenes de la generación Z jamás ha visto en la vida real.'
];

module.exports = {
    name: 'facto',
    alias: ['fact', 'curiosidad', 'sabiasque', 'datocurioso'],
    category: 'herramientas',
    desc: 'Envía un dato curioso, científico o histórico sorprendente y poco conocido',
    usage: '.facto',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const facto = FACTOS[Math.floor(Math.random() * FACTOS.length)];

        return await sock.sendMessage(jid, {
            text: [
                '╭━━━━〔 🧠 *DATO CURIOSO / FACTO* 〕━━━━⬣',
                '┃',
                '┃ 📌 *¿Sabías que...?*',
                `┃ ${facto}`,
                '┃',
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                '',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};

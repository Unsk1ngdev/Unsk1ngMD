'use strict';

/**
 * Banco dinámico de preguntas y motor de perfiles psicológicos para .personalidad
 * Autor: Unknown Codexツ</>
 */

const bancoPreguntas = [
    {
        texto: '🚂 Dilema de Vías: Un tren sin frenos se acerca a 5 personas. Tienes una palanca para desviarlo a una vía con 1 persona. ¿Qué haces?',
        a: 'A) Muevo la palanca de inmediato, 1 vida es menor que 5 💪',
        b: 'B) Busco una forma ingeniosa de descarrilar el tren o frenarlo con algo 🎨',
        c: 'C) Me rehúso a quitar activamente una vida con mis propias manos y busco otra salida 🧘'
    },
    {
        texto: '🧟 Apocalipsis Zombie: El brote estalla mientras estás atrapado en un centro comercial con desconocidos:',
        a: 'A) Asumo el liderazgo de inmediato, organizo armas, barricadas y vigías 👑',
        b: 'B) Fabrico trampas ingeniosas, sistemas de alerta y estudio a los infectados 🧪',
        c: 'C) Mantengo la calma del grupo, raciono víveres y cuido a los heridos 🕊️'
    },
    {
        texto: '⚡ Superpoder Único: Si pudieras elegir una habilidad permanente para toda tu vida:',
        a: 'A) Invulnerabilidad física, fuerza colosal e intimidación absoluta 💥',
        b: 'B) Telepatía, manipulación del tiempo y coeficiente intelectual infinito 🧠',
        c: 'C) Invisibilidad y poder de curar cualquier enfermedad o herida al instante 💚'
    },
    {
        texto: '🎉 Fiesta Masiva: Te encuentras en una gran reunión donde no conoces a casi nadie:',
        a: 'A) Me lanzo al centro de la pista, hablo con todos y pongo el ambiente 🦁',
        b: 'B) Observo el comportamiento de la gente y tengo charlas profundas en grupitos 🎭',
        c: 'C) Busco un rincón tranquilo, charlo con una sola persona o acaricio a la mascota 🐱'
    },
    {
        texto: '🗡️ Traición Inesperada: Descubres que alguien a quien considerabas amigo habló mal de ti:',
        a: 'A) Lo confronto directamente cara a cara y le exijo explicaciones sin rodeos 😤',
        b: 'B) Actúo con frialdad calculada y le demuestro con hechos que nunca lo necesité 🧊',
        c: 'C) Me duele en silencio, me distancio en paz y no gasto energía en rencores 🌊'
    },
    {
        texto: '🎯 Decisiones Cruciales: Cuando te toca tomar una decisión que cambiará tu futuro:',
        a: 'A) Me lanzo con valentía confiando en mi instinto; el miedo no me frena 🚀',
        b: 'B) Hago un análisis exhaustivo de pros, contras y probabilidades estadísticas 📊',
        c: 'C) Espero al momento en que sienta paz mental y pido consejo a gente sabia 🧘'
    },
    {
        texto: '⚖️ Injusticia en Vivo: Ves a alguien abusando verbalmente de una persona indefensa:',
        a: 'A) Intervengo físicamente o con voz de mando para frenar al agresor de inmediato 🛡️',
        b: 'B) Grabo evidencia y utilizo la inteligencia o las reglas para dejarlo en ridículo 📱',
        c: 'C) Apoyo y resguardo a la víctima asegurándome de que esté a salvo y tranquila 🌸'
    },
    {
        texto: '🌪️ Bajo Presión Extrema: Cuando el estrés o los problemas parecen sobrepasarte:',
        a: 'A) Entreno duro, hago ejercicio pesado o descargo la energía haciendo algo físico 🥊',
        b: 'B) Me encierro a crear, escribir, escuchar música o idear proyectos nuevos 🎧',
        c: 'C) Me aíslo a meditar, dormir o caminar en silencio hasta que pase la tormenta 🍃'
    },
    {
        texto: '💰 Fortuna Repentina: Ganas 10 millones de dólares limpios hoy mismo:',
        a: 'A) Fundo un imperio empresarial y compro todo lo que siempre quise con autoridad 🏢',
        b: 'B) Invierto en ciencia revolucionaria, tecnología y viajes a lugares exóticos 🚀',
        c: 'C) Aseguro el futuro de mi familia, dono a causas nobles y vivo en una cabaña en paz 🏡'
    },
    {
        texto: '🎮 Rol en el Juego: En un videojuego de equipo o en un deporte competitivo, prefieres ser:',
        a: 'A) El Capitán / Atacante agresivo que busca la victoria aplastante al frente ⚔️',
        b: 'B) El Estratega / Mago / Francotirador que calcula cada jugada milimétrica 🎯',
        c: 'C) El Soporte / Sanador / Tanque que protege al equipo y evita que nadie muera 🛡️'
    },
    {
        texto: '🏆 Significado del Éxito: Para ti, el verdadero éxito en esta vida significa:',
        a: 'A) Conquistar metas altas, tener respeto, poder e influencia indiscutible 👑',
        b: 'B) Crear algo único que nadie haya hecho antes y dominar el conocimiento 🌌',
        c: 'C) Vivir con la conciencia limpia, paz mental, salud y rodeado de amor sincero 🤍'
    },
    {
        texto: '👥 Trabajo en Equipo: Cuando te toca trabajar en grupo y nadie hace absolutamente nada:',
        a: 'A) Asumo el control total, asigno órdenes estrictas y exijo resultados 📋',
        b: 'B) Hago la parte compleja yo mismo/a a mi manera para que quede perfecta y original 💡',
        c: 'C) Motivo al equipo con paciencia y busco que cada quien aporte lo que pueda 🕊️'
    },
    {
        texto: '🧩 Misterio Oculto: Te encuentras con un enigma antiguo que nadie ha logrado descifrar:',
        a: 'A) Me adentro sin dudar superando trampas por la fuerza y el coraje 🧭',
        b: 'B) Me obsesiono con descifrar cada símbolo, patrón y pista oculta hasta resolverlo 🔍',
        c: 'C) Respeto el misterio; no todo en este universo tiene que ser forzado a revelarse 🌌'
    },
    {
        texto: '🗣️ Debate Acalorado: Alguien defiende con vehemencia una mentira evidente:',
        a: 'A) No doy mi brazo a torcer hasta que admita la verdad con pruebas contundentes 💥',
        b: 'B) Desmonto sus contradicciones lógicas con elegancia hasta dejarlo sin palabras ♟️',
        c: 'C) Elijo mi paz mental; sonrío, asiento y dejo que la vida le enseñe por su cuenta ☕'
    },
    {
        texto: '👻 Miedo Profundo: Tu mayor temor subconsciente en esta vida es:',
        a: 'A) Sentirme débil o impotente sin poder cambiar las cosas que me rodean ⚡',
        b: 'B) Vivir una vida común, aburrida y monótona sin dejar una chispa original 🎭',
        c: 'C) Dañar sin querer a las personas que amo o terminar en soledad absoluta 💔'
    },
    {
        texto: '👑 Liderazgo Supremo: Si fueses nombrado gobernante por un año:',
        a: 'A) Mano dura contra el caos, disciplina férrea y decisiones contundentes 🏛️',
        b: 'B) Revolución educativa, ciencia, innovación tecnológica y pensamiento libre 🔬',
        c: 'C) Salud universal, bienestar comunitario, erradicación del hambre y armonía 🌿'
    }
];

/**
 * Selecciona N preguntas aleatorias únicas del banco
 */
function seleccionarPreguntas(cantidad = 6) {
    const copias = [...bancoPreguntas];
    const seleccionadas = [];

    while (seleccionadas.length < cantidad && copias.length > 0) {
        const idx = Math.floor(Math.random() * copias.length);
        seleccionadas.push(copias.splice(idx, 1)[0]);
    }

    return seleccionadas;
}

/**
 * Evalúa las respuestas del usuario y genera un perfil detallado
 */
function calcularPerfil(respuestas) {
    const conteo = { a: 0, b: 0, c: 0 };
    respuestas.forEach(r => {
        if (conteo[r] !== undefined) conteo[r]++;
    });

    const total = respuestas.length || 1;
    const pctA = Math.round((conteo.a / total) * 100);
    const pctB = Math.round((conteo.b / total) * 100);
    const pctC = Math.round((conteo.c / total) * 100);

    let tipo = '';
    let emoji = '';
    let titulo = '';
    let anime = '';
    let elemento = '';
    let descripcion = '';
    let fortalezas = '';
    let debilidades = '';
    let consejo = '';

    // Perfiles
    if (conteo.a > conteo.b && conteo.a > conteo.c) {
        titulo = 'EL COMANDANTE IMPLACABLE';
        emoji = '👑';
        tipo = 'Líder / Determinación & Fuego';
        anime = 'Erwin Smith / Vegeta / Gilgamesh';
        elemento = 'Fuego 🔥';
        descripcion = 'Posees una voluntad inquebrantable y un instinto natural de mando. Cuando las cosas se ponen difíciles, no te escondes; das un paso al frente y tomas el control. Tu presencia transmite autoridad y seguridad.';
        fortalezas = 'Liderazgo natural, valentía bajo presión, toma rápida de decisiones, ambición indomable.';
        debilidades = 'Poca paciencia con la indecisión ajena, tendencia a ser autoritario o impulsivo.';
        consejo = 'Aprende a escuchar las opiniones de los demás antes de actuar; los mejores líderes también saben delegar.';
    } else if (conteo.b > conteo.a && conteo.b > conteo.c) {
        titulo = 'EL VISIONARIO ESTRATEGA';
        emoji = '🎨';
        tipo = 'Creador / Intelecto & Relámpago';
        anime = 'L Lawliet / Senku Ishigami / Gojo Satoru';
        elemento = 'Relámpago / Viento ⚡';
        descripcion = 'Tu mente funciona a un ritmo diferente al de la mayoría. Siempre buscas el ángulo oculto, la solución creativa y lo original. Te aburre la rutina y los métodos tradicionales.';
        fortalezas = 'Pensamiento lateral, ingenio brillante, capacidad de análisis, originalidad absoluta.';
        debilidades = 'Sobrepensar las cosas, desconexión de la realidad cuando te obsesionas con una idea.';
        consejo = 'No te quedes solo en la teoría; las mejores ideas solo cambian el mundo cuando las ejecutas en la práctica.';
    } else if (conteo.c > conteo.a && conteo.c > conteo.b) {
        titulo = 'EL SABIO GUARDIÁN ZEN';
        emoji = '🌊';
        tipo = 'Empático / Armonía & Agua';
        anime = 'Tanjiro Kamado / Tío Iroh / Jinbe';
        elemento = 'Agua Serena 🌊';
        descripcion = 'Eres el refugio de paz en medio de cualquier tormenta. Posees una empatía profunda y una comprensión única del dolor ajeno. Valoras la lealtad y la tranquilidad por encima de cualquier trofeo superficial.';
        fortalezas = 'Paciencia infinita, inteligencia emocional, gran escucha, lealtad a toda prueba.';
        debilidades = 'Dificultad para decir que "no", tendencia a postergar tus propias necesidades por ayudar a otros.';
        consejo = 'Recuerda que para cuidar a los demás, primero debes proteger tu propia paz y tus límites personales.';
    } else if (conteo.a === conteo.b && conteo.a > conteo.c) {
        titulo = 'EL REBELDE AUDAZ (A + B)';
        emoji = '⚡';
        tipo = 'Innovador Audaz / Fuego & Relámpago';
        anime = 'Eren Jaeger / Tony Stark / Ryuko Matoi';
        elemento = 'Plasma 💥';
        descripcion = 'Combinas la determinación implacable del líder con el ingenio desafiante del creador. No sigues caminos establecidos; abres tus propias rutas derribando muros.';
        fortalezas = 'Carisma arrollador, audacia innovadora, capacidad de adaptación veloz.';
        debilidades = 'Inconformismo crónico y temperamento volcánico cuando te imponen límites.';
        consejo = 'Canaliza tu fuego hacia un objetivo claro a largo plazo para no dispersar tu energía.';
    } else if (conteo.a === conteo.c && conteo.a > conteo.b) {
        titulo = 'EL PALADÍN JUSTICIERO (A + C)';
        emoji = '🛡️';
        tipo = 'Protector Fuerte / Fuego & Agua';
        anime = 'All Might / Rengoku Kyojuro / Jonathan Joestar';
        elemento = 'Luz Solar ☀️';
        descripcion = 'Tienes la fuerza de un guerrero y el corazón de un protector. Utilizas tu valentía para defender a los débiles y mantener la justicia dondequiera que vas.';
        fortalezas = 'Honor intachable, espíritu generoso, valentía altruista.';
        debilidades = 'Cargar con responsabilidades que no te corresponden.';
        consejo = 'Acepta que no puedes salvar a todo el mundo tú solo; cuidarte a ti mismo es tu primer deber.';
    } else {
        titulo = 'EL ARQUITECTO EQUILIBRADO';
        emoji = '⚖️';
        tipo = 'Adaptable / Balance Perfecto';
        anime = 'Kakashi Hatake / Roy Mustang / Levi Ackerman';
        elemento = 'Tierra & Éter 🌍';
        descripcion = 'Eres un camaleón emocional e intelectual. Sabes cuándo liderar con puño firme, cuándo pensar con creatividad fría y cuándo guardar silencio con sabiduría zen.';
        fortalezas = 'Versatilidad suprema, equilibrio mental, capacidad de congeniar con cualquier tipo de persona.';
        debilidades = 'Riesgo de perder tu propia identidad por adaptarte demasiado al entorno.';
        consejo = 'Confía más en tus propios deseos personales y no solo en lo que la situación demande.';
    }

    return {
        conteo,
        porcentajes: { a: pctA, b: pctB, c: pctC },
        titulo,
        emoji,
        tipo,
        anime,
        elemento,
        descripcion,
        fortalezas,
        debilidades,
        consejo
    };
}

module.exports = {
    seleccionarPreguntas,
    calcularPerfil
};


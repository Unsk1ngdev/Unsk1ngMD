'use strict';

const CONSEJOS = [
    // 🧠 Mentalidad y Crecimiento Personal
    'No tomes decisiones permanentes basadas en emociones temporales de enojo o euforia.',
    'Si algo no te suma paz, conocimiento o dinero, no le dediques tu tiempo ni tu energía mental.',
    'Nunca le cuentes tus proyectos a nadie hasta que estén listos: la envidia ajena tiene el sueño ligero.',
    'Aprende a decir "no" con firmeza, sin dar explicaciones innecesarias ni cargar con culpa.',
    'No te compares con el capítulo 20 de otra persona cuando tú apenas estás escribiendo tu capítulo 1.',
    'El dolor de la disciplina pesa gramos; el dolor del arrepentimiento pesa toneladas.',
    'Si tienes que forzarlo (un zapato, una amistad o una relación sentimental), ten la seguridad de que no es de tu talla.',
    'Céntrate en mejorar un 1% cada día: al final de un año de constancia serás 37 veces mejor que al comenzar.',
    'No temas empezar de cero; esta vez no estás empezando desde la nada, estás empezando desde la experiencia.',
    'Acepta con madurez las disculpas que nunca recibiste y sigue adelante por tu propia tranquilidad mental.',

    // 💰 Finanzas, Dinero y Carrera
    'Págate a ti primero: aparta aunque sea un 10% de lo que ganes apenas lo cobres antes de empezar a pagar caprichos.',
    'Comprar cosas con dinero que no tienes para impresionar a personas que no te importan es la receta más rápida hacia la quiebra.',
    'El dinero mal gastado se recupera trabajando; el tiempo malgastado con personas equivocadas no regresa jamás.',
    'Nunca dependas de una sola fuente de ingresos; invierte tiempo en desarrollar habilidades paralelas que puedas monetizar.',
    'Aprende a diferenciar un "deseo" de una "necesidad": si lo quieres pero puedes vivir 72 horas sin él, no es urgente.',
    'Invierte en tu conocimiento antes que en apariencias: el conocimiento es el único activo que nadie te puede confiscar.',

    // 🤝 Relaciones, Amistades y Límites
    'Fíjate en cómo una persona trata a los camareros y al personal de servicio: esa es su verdadera educación y carácter.',
    'El silencio también es una respuesta, y muchas veces es la más elocuente y digna de todas.',
    'No te quedes donde te toleren; ve únicamente a donde te valoren, te celebren y te respeten.',
    'Un amigo que habla mal de todos sus demás amigos a sus espaldas, ten por seguro que también habla de ti cuando no estás.',
    'Si alguien te demuestra con sus acciones quién es en realidad, créele a la primera y no busques excusas para justificarlo.',
    'No revises conversaciones viejas de madrugada si sabes perfectamente que solo conseguirás reabrir heridas del pasado.',
    'Las personas no cambian porque tú las quieras con más fuerza; cambian cuando ellas mismas deciden tocar fondo y madurar.',

    // 🎯 Productividad, Enfoque y Vida Diaria
    'Aplica la regla de los 2 minutos: si una tarea te toma menos de dos minutos en completarse, hazla en ese mismo instante.',
    'Guarda siempre un respaldo en la nube o en disco de tus archivos importantes antes de que tu sistema decida colapsar.',
    'Toma suficiente agua, duerme tus 7-8 horas y deja de sobrepensar escenarios catastróficos que en un 99% nunca sucederán.',
    'Tu teléfono móvil debe ser una herramienta que trabaje para ti, no un carcelero digital que te robe 6 horas de vida al día.',
    'Si dudas entre dos caminos, lanza una moneda al aire: en los segundos que esté suspendida, sabrás con exactitud qué resultado deseaba tu corazón.',
    'El mejor momento para plantar un árbol fue hace 20 años; el segundo mejor momento para empezar es hoy mismo.',
    'La motivación sirve para arrancar, pero solo la rutina y la disciplina son las que te llevan a cruzar la meta.',

    // 😄 Sabiduría Callejera y Humor Realista
    'Nunca discutas con un necio en internet: te bajará a su nivel y te ganará por experiencia.',
    'Si vas a hacer algo malo, asegúrate de no dejar testigos ni pruebas en el chat de WhatsApp.',
    'Desconfía de la gente que no le gustan los perros y de la gente que se toma fotos con billetes en la mano.',
    'No le prestes dinero a un amigo a menos que estés completamente dispuesto a perder el dinero o perder al amigo.',
    'El café cura el sueño, pero la responsabilidad de pagar las deudas cura cualquier pereza matutina.'
];

module.exports = {
    name: 'consejo',
    alias: ['advice', 'tip', 'sabiduria', 'frasedeldia'],
    category: 'herramientas',
    desc: 'Entrega un consejo reflexivo, práctico o de vida al azar de un amplio repertorio',
    usage: '.consejo',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const consejo = CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)];

        return await sock.sendMessage(jid, {
            text: [
                '╭━━━━〔 💡 *CONSEJO DEL DÍA* 〕━━━━⬣',
                '┃',
                `┃ 💬 "${consejo}"`,
                '┃',
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
                '',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};

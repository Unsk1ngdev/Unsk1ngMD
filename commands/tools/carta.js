'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const premiumManager = require('../../lib/premium');
const database = require('../../lib/database');
const config = require('../../config');

/**
 * Obtiene la API Key de Groq si está disponible
 */
function getGroqApiKey() {
    let key = (process.env.GROQ_API_KEY || config.groqApiKey || '').trim();
    if (!key) {
        try {
            const envPath = path.resolve(__dirname, '../../.env');
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
 * Genera una carta original y poética usando Groq Cloud
 */
async function generarCartaConIA(tipo, para, de, contextoExtra = '') {
    const apiKey = getGroqApiKey();
    if (!apiKey) return null;

    const candidateModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
    const systemPrompt = `Eres un poeta y escritor literario en español de altísima sensibilidad, elocuencia y delicadeza.
Tu tarea es escribir una carta emotiva, profunda, conmovedora y hermosa de tipo "${tipo}".
Destinatario: ${para}
Remitente: ${de}
${contextoExtra ? `Detalle o contexto especial a integrar: "${contextoExtra}"` : ''}

Pautas obligatorias:
- Escribe una carta de 2 a 3 párrafos bien estructurados con lenguaje evocador y poético.
- Inicia directamente con el encabezado hacia ${para} (ej: "Querida/o ${para},").
- Finaliza con una despedida cálida acorde al tipo de carta y la firma de *${de}*.
- No incluyas explicaciones previas ni notas posteriores; entrega exclusivamente el texto de la carta.`;

    for (const model of candidateModels) {
        try {
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Escribe la carta de ${tipo} de ${de} para ${para}.` }
                    ],
                    temperature: 0.75,
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            const content = response.data?.choices?.[0]?.message?.content?.trim();
            if (content && content.length > 50) {
                return content;
            }
        } catch (_) {}
    }

    return null;
}

/**
 * Banco amplio de plantillas variadas y profundas para cada categoría
 */
const plantillasCartas = {
    amor: [
        {
            titulo: 'El Latido de Mi Mundo',
            contenido: (p, d) =>
                `Querida/o ${p},\n\n` +
                `Hay palabras que a veces el silencio no se atreve a pronunciar, pero que el alma lleva guardadas con devoción. Hoy sentí la necesidad urgente de escribirte, porque cada día a tu lado me confirma que la vida se volvió infinitamente más hermosa desde que tus ojos encontraron los míos.\n\n` +
                `Tu sonrisa tiene esa magia inexplicable que desarma cualquier tormenta y convierte los días grises en luz pura. No se trata solo de quererte, sino de admirar la forma en que existes, tu gentileza, tu mirada y ese refugio cálido que siempre encuentro entre tus brazos. Cuando no estás cerca falta todo, y cuando estás, no hace falta nada más en este mundo.\n\n` +
                `Gracias por permitirme coincidir contigo en esta vida. Eres mi lugar seguro y la razón por la que mi corazón late con tanta gratitud.\n\n` +
                `Con todo mi amor eterno,\n*${d}* 💕`
        },
        {
            titulo: 'Elegirte Cada Amanecer',
            contenido: (p, d) =>
                `Para mi persona favorita, ${p}:\n\n` +
                `Dicen que el amor verdadero no se planea, simplemente llega como una brisa fresca que lo transforma todo sin pedir permiso. Eso fuiste tú para mí: un antes y un después inolvidable. Me enseñaste que querer bonito no pesa, no duele y no exige; solo florece.\n\n` +
                `Amo los pequeños detalles que nadie más nota: tu manera de reírte de la nada, tu voz cuando me hablas de lo que te apasiona y esa complicidad silenciosa que solo nosotros entendemos. Si volviera a nacer mil veces, en cada una de esas vidas buscaría tus pasos para volver a encontrarte.\n\n` +
                `Prometo cuidarte, respetarte y recordarte cada día lo invaluable que eres para mí.\n\n` +
                `Siempre tuyo/a,\n*${d}* 🌹`
        },
        {
            titulo: 'Bajo el Mismo Cielo',
            contenido: (p, d) =>
                `${p},\n\n` +
                `A veces me detengo a pensar en lo inmenso que es el universo y en la suerte tan infinita que tuve de coincidir en el mismo tiempo y espacio contigo. No hay casualidades cuando el alma reconoce a su hogar.\n\n` +
                `Tu presencia en mi vida es el recordatorio constante de que las cosas más valiosas no se tocan con las manos, se sienten en el pecho. Me inspiras a ser mejor, a soñar sin miedo y a sonreír con la certeza de que no camino en soledad.\n\n` +
                `Gracias por existir y por ser exactamente quien eres. Te llevo en cada pensamiento.\n\n` +
                `Con infinito cariño,\n*${d}* ✨`
        }
    ],

    amistad: [
        {
            titulo: 'Lealtad Inquebrantable',
            contenido: (p, d) =>
                `¡Hey ${p}! 👋\n\n` +
                `Sé que no solemos ponernos sentimentales a menudo, pero hoy quería recordarte lo afortunado/a que me siento de tenerte en mi camino. La vida da muchas vueltas y la gente viene y va, pero encontrar a alguien con tu lealtad y tu corazón es un verdadero tesoro.\n\n` +
                `Hemos pasado de todo: risas descontroladas de esas que duelen en el estómago, momentos en que todo se complicaba y bastaba una conversación tuya para volver a respirar, y tonterías que quedarán grabadas en la historia de nuestras vidas. Contigo no hay que fingir nada; puedo ser 100% yo mismo/a.\n\n` +
                `Gracias por estar firme en las buenas y sobre todo en las malas. Sabes que cuentas conmigo para lo que sea, hoy y siempre.\n\n` +
                `Tu hermano/a de la vida,\n*${d}* 👊`
        },
        {
            titulo: 'Cómplices de Aventuras',
            contenido: (p, d) =>
                `Querido/a amigo/a ${p}:\n\n` +
                `Hay personas que iluminan cualquier lugar al que llegan, y tú eres de esas. Gracias por todas las anécdotas compartidas, por aguantar mis ocurrencias y por tener siempre la palabra justa cuando la mente se llena de dudas.\n\n` +
                `Tener tu amistad es saber que pase lo que pase en este mundo loco, hay una trinchera segura donde siempre habrá risas, sinceridad y un abrazo leal. Nunca cambies esa esencia única que tienes.\n\n` +
                `¡Brindo por todas las batallas que ya ganamos y por todas las historias que aún nos faltan por escribir juntos!\n\n` +
                `En las buenas y en las malas,\n*${d}* 🍻`
        }
    ],

    disculpa: [
        {
            titulo: 'Desde lo Más Profundo del Corazón',
            contenido: (p, d) =>
                `${p},\n\n` +
                `Me costó encontrar las palabras adecuadas para escribirte esto, porque sé que cuando lastimamos a alguien que nos importa, las justificaciones sobran y solo queda la verdad desnuda. Me equivoqué, y me duele profundamente haber sido la causa de tu decepción o tristeza.\n\n` +
                `Reconozco mi error con total humildad y sin excusas. Valoro demasiado lo que hemos construido como para dejar que mi falta de prudencia lo opaque. Sé que la confianza no se recupera con discursos bonitos, sino con hechos constantes y tiempo.\n\n` +
                `No pretendo que todo vuelva a ser igual mágicamente de la noche a la mañana; solo te pido la oportunidad de demostrarte que aprendí la lección y que mi respeto y afecto hacia ti son completamente sinceros.\n\n` +
                `Lo siento de verdad y de corazón,\n*${d}* 🙏`
        },
        {
            titulo: 'Un Puente Hacia la Reconciliación',
            contenido: (p, d) =>
                `Para ${p}:\n\n` +
                `El orgullo nunca ha construido nada valioso, y hoy decido dejarlo de lado por completo para decirte lo mucho que lamento lo sucedido. Actué sin pensar en cómo te afectaría y eso fue completamente irresponsable de mi parte.\n\n` +
                `Tu presencia en mi vida es demasiado importante como para permitir que un mal momento nos distancie. Si necesitas espacio lo entiendo y lo respetaré, pero quería que supieras que mi intención jamás fue herirte y que estoy aquí con toda la disposición de sanar las cosas si me lo permites.\n\n` +
                `Con sincero pesar y esperanza,\n*${d}* 🕊️`
        }
    ],

    motivacion: [
        {
            titulo: 'El Fuego Dentro de Ti',
            contenido: (p, d) =>
                `${p},\n\n` +
                `Te escribo esto porque sé que hay días donde la carga se siente pesada y la duda intenta convencerte de que tus fuerzas no son suficientes. Déjame recordarte algo con total claridad: has superado tormentas que habrían derrumbado a cualquiera, y sigues aquí, de pie.\n\n` +
                `El camino que vale la pena nunca ha sido fácil. Los momentos duros no están ahí para destruirte, sino para forjar el acero de tu determinación. No tienes que tener resuelto todo tu futuro hoy; solo da el paso que te toca dar en este instante. Respira hondo, levanta la mirada y confía en el talento y la resistencia que llevas por dentro.\n\n` +
                `Creo en ti con los ojos cerrados. Eres mucho más fuerte y capaz de lo que tu mente te hace creer en los días oscuros.\n\n` +
                `Siempre en tu esquina apoyándote,\n*${d}* 🔥`
        },
        {
            titulo: 'Imparable ante la Tormenta',
            contenido: (p, d) =>
                `Campeón/a ${p}:\n\n` +
                `El cansancio es temporal, pero el orgullo de no haberse rendido jamás dura para siempre. No midas tu valor por un tropiezo o una mala racha; mídelo por la valentía con la que te sacudes el polvo y vuelves al ruedo.\n\n` +
                `Tienes una luz y una capacidad increíble esperando ser desatada. Silencia el ruido de afuera y escucha esa voz interior que te dice que naciste para grandes cosas. ¡Avanza con fe, que lo mejor de tu historia aún está por escribirse!\n\n` +
                `Con toda la fe puesta en ti,\n*${d}* ⚡`
        }
    ],

    despedida: [
        {
            titulo: 'Gratitud Eterna por el Camino',
            contenido: (p, d) =>
                `Querida/o ${p},\n\n` +
                `Hay despedidas que duelen en el alma, pero cuando miro hacia atrás, lo único que siento es una gratitud infinita por haber compartido parte de mi vida a tu lado. Los ciclos se cierran, pero los recuerdos hermosos y las lecciones aprendidas quedan tatuados en el corazón para siempre.\n\n` +
                `Gracias por cada charla, por cada risa y por haber dejado una huella tan limpia y genuina en mi historia. Dondequiera que tus pasos te lleven, te deseo bendiciones abundantes, éxitos inmensos y personas que sepan valorar la gran persona que eres.\n\n` +
                `Que la vida te sonría siempre como te lo mereces.\n\n` +
                `Con cariño y respeto que nunca se apagarán,\n*${d}* 🌟`
        },
        {
            titulo: 'Hasta Siempre, Huella Imborrable',
            contenido: (p, d) =>
                `${p},\n\n` +
                `Decir adiós nunca es sencillo, pero elijo despedirme celebrando todo lo bueno que compartimos en lugar de lamentar que haya llegado el momento de partir. Hay personas que pasan por nuestra vida como una estrella fugaz y otras que se convierten en constelaciones permanentes; tú eres de las segundas.\n\n` +
                `Te deseo de corazón que encuentres toda la paz y la felicidad que buscas en este nuevo capítulo. Gracias por todo.\n\n` +
                `Un abrazo con el alma,\n*${d}* 🕊️`
        }
    ],

    cumpleanos: [
        {
            titulo: 'Celebrando Tu Luz en Este Mundo',
            contenido: (p, d) =>
                `¡¡Feliz Cumpleaños ${p}!! 🎂🎉\n\n` +
                `Hoy el mundo entero debería celebrar, porque un día como hoy nació una persona maravillosa que llena de luz y alegría la vida de todos los que tenemos la dicha de conocerte. Cumplir años no es solo sumar números, es celebrar las victorias alcanzadas, las lecciones aprendidas y todo el amor que has sembrado a tu alrededor.\n\n` +
                `Deseo de todo corazón que este nuevo año de vida venga cargado de salud inquebrantable, sueños cumplidos, proyectos exitosos y momentos inolvidables rodeado/a de la gente que te ama de verdad. ¡Pásala increíble y celebra a lo grande!\n\n` +
                `Con todo mi cariño y mejores deseos,\n*${d}* 🎁✨`
        }
    ],

    declaracion: [
        {
            titulo: 'Lo que Mi Corazón ya no Puede Callar',
            contenido: (p, d) =>
                `${p},\n\n` +
                `Llevo tiempo guardándome esto en el pecho, pero llegó el momento de ser valiente y decirte la verdad. Desde hace un tiempo, tu presencia dejó de ser una más para convertirse en lo más esperado de mis días. No puedo evitar sonreír cada vez que te veo, ni dejar de pensar en lo especial que eres.\n\n` +
                `Me gustas de verdad, me gusta tu forma de ser, tu voz, tu esencia y la paz que me transmites. No te escribo esto para presionarte ni para esperar una respuesta apresurada, sino porque sentía que merecías saber que hay alguien en este mundo a quien le haces latir el corazón muy fuerte.\n\n` +
                `Con sinceridad y emoción,\n*${d}* 💘`
        }
    ],

    agradecimiento: [
        {
            titulo: 'Gracias por Ser Mi Pilar',
            contenido: (p, d) =>
                `Estimada/o ${p},\n\n` +
                `A veces damos por sentadas las cosas buenas de la vida, y hoy quise detenerme un momento solo para darte las gracias. Gracias por tu generosidad, por tender tu mano cuando otros dudaron y por brindarme tu apoyo sincero en los momentos en que más lo necesité.\n\n` +
                `Personas con tu nobleza y calidez humana son las que hacen que este mundo sea un lugar mejor. Valoro profundamente tu bondad y siempre podrás contar conmigo incondicionalmente.\n\n` +
                `Con profunda gratitud y aprecio,\n*${d}* 💐`
        }
    ]
};

const categoriaInfo = {
    amor: { emoji: '💕', nombre: 'AMOR' },
    amistad: { emoji: '👥', nombre: 'AMISTAD' },
    disculpa: { emoji: '🙏', nombre: 'DISCULPA' },
    motivacion: { emoji: '💪', nombre: 'MOTIVACIÓN' },
    despedida: { emoji: '🚪', nombre: 'DESPEDIDA' },
    cumpleanos: { emoji: '🎂', nombre: 'CUMPLEAÑOS' },
    cumple: { emoji: '🎂', nombre: 'CUMPLEAÑOS' },
    declaracion: { emoji: '💘', nombre: 'DECLARACIÓN' },
    agradecimiento: { emoji: '💐', nombre: 'AGRADECIMIENTO' }
};

module.exports = {
    name: 'carta',
    alias: ['carte', 'letter', 'escribircarta', 'cartas'],
    category: 'herramientas',
    desc: 'Genera cartas personalizadas y poéticas de alta calidad con IA o selección artística',
    usage: '.carta [tipo] [para] [de] | [detalle opcional]',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;

        let tipo = '';
        let para = '';
        let de = '';
        let contexto = '';

        // Soporte de formato con barras verticales o espacio
        if (text && text.includes('|')) {
            const parts = text.split('|').map(p => p.trim());
            const firstWords = parts[0].split(/\s+/);
            // Si la primera parte tiene tipo, para y de (ej: "amor Maria Juan | sobre la playa")
            if (firstWords.length >= 3 && parts.length === 2) {
                tipo = firstWords[0]?.toLowerCase();
                para = firstWords[1] || '';
                de = firstWords.slice(2).join(' ') || '';
                contexto = parts[1] || '';
            } else {
                tipo = parts[0]?.toLowerCase();
                para = parts[1] || '';
                de = parts[2] || '';
                contexto = parts.slice(3).join(' ') || '';
            }
        } else {
            tipo = args[0]?.toLowerCase();
            para = args[1] || '';
            de = args[2] || '';
            contexto = args.slice(3).join(' ') || '';
        }

        // Normalizar acentos en tipo (ej. motivación -> motivacion, cumpleaños -> cumpleanos)
        if (tipo) {
            tipo = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (tipo === 'cumple' || tipo === 'cumpleanos') tipo = 'cumpleanos';
        }

        const tiposValidos = Object.keys(categoriaInfo);

        if (!tipo || !tiposValidos.includes(tipo) || !para || !de) {
            return await sock.sendMessage(jid, {
                text: `╔══════════════════╗\n` +
                      `║  📜 *CREADOR DE CARTAS* ║\n` +
                      `╚══════════════════╝\n\n` +
                      `Genera cartas literarias y emotivas, únicas en cada ocasión.\n\n` +
                      `📋 *Tipos disponibles:*\n` +
                      `💕 *amor* — Romántica, poética y profunda\n` +
                      `👥 *amistad* — Cálida, leal y cómplice\n` +
                      `🙏 *disculpa* — Sincera, humilde y reparadora\n` +
                      `💪 *motivacion* — Inspiradora, épica y de aliento\n` +
                      `🚪 *despedida* — Nostálgica, agradecida y madura\n` +
                      `🎂 *cumpleaños* — Celebración de vida y bendiciones\n` +
                      `💘 *declaracion* — Confesión valiente de sentimientos\n` +
                      `💐 *agradecimiento* — Gratitud sincera de corazón\n\n` +
                      `━━━━━━━━━━━━━━━\n` +
                      `💡 *Uso:* *.carta [tipo] [para] [de]*\n` +
                      `Ejemplo: *.carta amor Maria Juan*\n\n` +
                      `✨ *Con detalle o frase:* *.carta amor | Maria Elena | Juan | sobre nuestra primera cita*\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // Extraer menciones si etiquetaron a alguien
        const mentionedInMsg = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const mentions = [];

        if (para.includes('@') && mentionedInMsg.length > 0) {
            mentions.push(mentionedInMsg[0]);
        }

        const infoCat = categoriaInfo[tipo] || { emoji: '📜', nombre: tipo.toUpperCase() };

        await sock.sendMessage(jid, {
            text: `✍️ Redactando carta poética de *${infoCat.nombre}* para *${para}*...\n⏳ _Inspirando palabras..._`
        }, { quoted: m });

        let contenidoFinal = '';
        let autorTipo = 'IA Literaria v4.5';

        // 1. Intentar generar con IA para una carta 100% original e irrepetible
        try {
            const cartaIA = await generarCartaConIA(tipo, para, de, contexto);
            if (cartaIA) {
                contenidoFinal = cartaIA;
            }
        } catch (_) {}

        // 2. Si no hay IA o falló, usar el banco artístico de plantillas variadas
        if (!contenidoFinal) {
            autorTipo = 'Edición Poética';
            const listaPlantillas = plantillasCartas[tipo] || plantillasCartas.amor;
            const plantillaElegida = listaPlantillas[Math.floor(Math.random() * listaPlantillas.length)];
            contenidoFinal = plantillaElegida.contenido(para, de);
        }

        const resultadoMsg =
            `╔══════════════════╗\n` +
            `║  ${infoCat.emoji} *CARTA DE ${infoCat.nombre}*  ║\n` +
            `╚══════════════════╝\n\n` +
            `💌 *Para:* ${para}\n` +
            `✍️ *De:* ${de}\n` +
            `━━━━━━━━━━━━━━━\n\n` +
            `${contenidoFinal}\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📜 _${autorTipo}_\n\n` +
            `_Unknown Codexツ</>_`;

        await sock.sendMessage(jid, {
            text: resultadoMsg,
            mentions
        }, { quoted: m });
    }
};

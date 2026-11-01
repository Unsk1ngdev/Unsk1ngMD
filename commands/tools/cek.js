'use strict';

/**
 * Comando: .cek <tema> | .ceksuerte | .cekrico | .cekmaligno ...
 *
 * Mide el porcentaje de cualquier cualidad o rasgo ("¿Qué tan X eres?")
 * con comentarios personalizados, barra de progreso y soporte para @menciones.
 */

const CATEGORIES = {
    suerte: {
        title: '🍀 TEST DE SUERTE',
        name: 'Suerte',
        low: 'Tienes menos suerte que un gato negro cruzándose con un espejo roto bajo una escalera.',
        mid: 'Tu suerte es normal: encuentras una moneda de 5 pesos pero pierdes el boleto del autobús.',
        high: '¡Bastante afortunado! Siempre encuentras asiento en el transporte y te salvas de milagro.',
        max: '🔥 ¡NIVEL DIOS DE LA FORTUNA! Si te caes de un décimo piso, caes en un camión de colchones.'
    },
    rico: {
        title: '💰 TEST DE RIQUEZA',
        name: 'Riqueza',
        low: 'Tu cuenta bancaria llora cada vez que abres la app. Tu saldo da para medio chicle.',
        mid: 'Clase trabajadora honrada: llegas a fin de mes pero contando las monedas del pan.',
        high: '¡Billetera gorda! Te das tus lujos, invitas las rondas y no miras los precios en el menú.',
        max: '💎 ¡MAGNATE PETROLERO! Te bañas en agua Evian y tus propinas pagan la hipoteca del mozo.'
    },
    maligno: {
        title: '😈 TEST DE MALDAD',
        name: 'Maldad',
        low: 'Eres un angelito de Dios. Pides perdón cuando te chocan a ti.',
        mid: 'Maldad traviesa: dejas la botella vacía en la nevera y no avisas de los spoilers.',
        high: '¡Peligroso! Guardas rencor en carpetas etiquetadas por año y tramas venganzas lentas.',
        max: '👹 ¡EL MISMO LUCIFER TE PIDE CONSEJOS! Crueldad legendaria sin pizca de remordimiento.'
    },
    inteligente: {
        title: '🧠 TEST DE INTELIGENCIA',
        name: 'Inteligencia',
        low: 'Pensar te da sueño. Si las neuronas fueran dinero, deberías hasta los intereses.',
        mid: 'Inteligencia estándar promedio: sabes lo básico para sobrevivir sin quemar agua.',
        high: '¡Cerebro privilegiado! Entiendes las bromas al instante y resuelves problemas como nada.',
        max: '🎓 ¡EINSTEIN REENCARNADO! Tu coeficiente intelectual rompe la escala métrica.'
    },
    pobre: {
        title: '🪙 TEST DE POBREZA',
        name: 'Pobreza',
        low: '¿Pobre tú? Tienes ahorros, fondo de emergencia y hasta tarjeta dorada.',
        mid: 'Humildad digna: estiras el shampoo echándole agua para que rinda una semana más.',
        high: 'Pobreza avanzada: tu cena habitual es aire frito con aroma a panadería.',
        max: '💀 ¡POBREZA CRÍTICA! Le debes dinero al señor que vende chicles en el semáforo.'
    },
    tocuen: {
        title: '🤥 TEST DE MENTIROSO (TOCUÉN)',
        name: 'Mentiroso',
        low: 'Eres más transparente que un cristal recién lavado. No sabes mentir ni jugando al póker.',
        mid: 'Mentirijillas piadosas: "Ya voy saliendo" cuando apenas estás entrando a la ducha.',
        high: '¡Cuentero profesional! Inventas historias con efectos de sonido que casi parecen reales.',
        max: '🏆 ¡DOCTOR EN ENGAÑOS! Convences a un esquimal de comprarte cubos de hielo en invierno.'
    },
    gay: {
        title: '🌈 TEST DE ARCOÍRIS',
        name: 'Afinidad Gay',
        low: 'Hetero básico y tradicional. Ni un solo destello arcoíris a la vista.',
        mid: 'Tienes tus momentos aesthetic: te vistes con estilo y aprecias una buena playlist pop.',
        high: '¡La bandera ondea con orgullo! El brillo y el drama corren naturalmente por tus venas.',
        max: '💅 ¡REINA SUPREMA DEL PRIDE! Naciste brillando con purpurina cósmica en el alma.'
    },
    lindo: {
        title: '✨ TEST DE BELLEZA',
        name: 'Lindura',
        low: 'Tu belleza es... muy interior. Tan interior que requiere una endoscopia para verla.',
        mid: 'Agradable a la vista. Con buena luz, ángulo favorable y filtro ganas bastantes puntos.',
        high: '¡Robamiradas! Cuando pasas por la calle, la gente disimula pero vuelve a mirar.',
        max: '👑 ¡MODELO DE PASARELA INTERNACIONAL! Tu belleza debería ser ilegal en 15 países.'
    },
    fiel: {
        title: '💍 TEST DE FIDELIDAD',
        name: 'Fidelidad',
        low: 'Tienes menos fidelidad que señal de celular en un túnel. Sigues a 300 personas sospechosas.',
        mid: 'Fiel por ahora... pero no te dejen solo con tus tentaciones porque dudas.',
        high: '¡Lealtad de oro! Miras al piso cuando pasa alguien atractivo para no pecar.',
        max: '🛡️ ¡SANTO PATRÓN DE LA LEALTAD! Ni aunque te paguen traicionarías la confianza.'
    },
    tierno: {
        title: '🧸 TEST DE TERNURA',
        name: 'Ternura',
        low: 'Tienes la calidez de un cubo de hielo en el Polo Norte. Cero mimos.',
        mid: 'Tierno cuando te conviene o cuando quieres que te compren algo rico.',
        high: '¡Peluches y cariños! Despiertas instintos protectores en todo el mundo.',
        max: '🥺 ¡SOBREDOSIS DE KAWAII! Eres tan tierno que causas diabetes emocional.'
    },
    toxic: {
        title: '☣️ TEST DE TOXICIDAD',
        name: 'Toxicidad',
        low: 'Paz y amor puro. Cero celos, cero dramas y cero espionaje en redes.',
        mid: 'Toxicidad leve: revisas la última hora de conexión y analizas los estados.',
        high: '¡Red flag andante! Exiges contraseña, ubicación en tiempo real y reporte por hora.',
        max: '☢️ ¡CHERNOBYL ES UN JARDÍN DE ROSAS A TU LADO! Eres el veneno personificado.'
    },
    facha: {
        title: '😎 TEST DE FACHA',
        name: 'Facha / Estilo',
        low: 'Combinas calcetines con sandalias y camisa a cuadros con pantalón a rayas.',
        mid: 'Estilo promedio: ropa limpia que zafa para salir del paso sin llamar la atención.',
        high: '¡Mucha facha! El flow se nota a tres cuadras de distancia sin esfuerzo.',
        max: '🔥 ¡EL FLOW HECHO PERSONA! Rompes cuellos y marcas tendencia donde sea que pises.'
    },
    sad: {
        title: '🌧️ TEST DE TRISTEZA',
        name: 'Tristeza / Sad',
        low: 'Alegría pura y optimismo radiante. Sonríes hasta cuando te tropiezas.',
        mid: 'Sad regular: escuchas canciones melancólicas de noche mientras miras el techo.',
        high: 'Al borde del llanto: cualquier recuerdo nostálgico te deja pensativo dos horas.',
        max: '🥀 ¡DESPECHO CRÓNICO! La lluvia te persigue como personaje de caricatura trágica.'
    },
    suave: {
        title: '🍯 TEST DE DULZURA',
        name: 'Dulzura',
        low: 'Tratas a la gente con lija del número 80. La delicadeza no es lo tuyo.',
        mid: 'Suave con quienes se lo ganan, cortante con los que no caen bien.',
        high: 'Cariñoso, empático y atento. Tienes tacto diplomático para cualquier situación.',
        max: '☁️ ¡ALGODÓN DE AZÚCAR HUMANO! Eres un remanso de paz y suavidad infinita.'
    },
    loco: {
        title: '🤪 TEST DE LOCURA',
        name: 'Locura',
        low: 'Cuerdo hasta el aburrimiento. Sigues las reglas al pie de la letra.',
        mid: 'Locura divertida: te ríes solo recordando memes y haces cosas raras en privado.',
        high: '¡Tornillos bien flojos! Tus amigos tienen miedo de lo que vas a decir en público.',
        max: '⚡ ¡INTERNEN A ESTE INDIVIDUO! Te falta no solo un tornillo, te falta la ferretería entera.'
    },
    pervertido: {
        title: '🔞 TEST DE PERVERSIÓN',
        name: 'Picardía',
        low: 'Mente santa y puritana. Te sonrojas con solo escuchar la palabra "beso".',
        mid: 'Doble sentido moderado: entiendes los albures pero te haces el inocente.',
        high: '¡Mente en el fango! Todo lo que dicen lo malpiensas en menos de dos segundos.',
        max: '🔥 ¡PELIGRO BIOLÓGICO! Tu mente está en modo incógnito 24/7 sin descanso.'
    },
    valiente: {
        title: '🦁 TEST DE VALENTÍA',
        name: 'Valentía',
        low: 'Gritas y te subes a una silla si ves una cucaracha voladora a 5 metros.',
        mid: 'Valiente para las cosas normales, pero no te pidas entrar a una casa embrujada.',
        high: '¡Corazón de león! Encaras los problemas y defiendes a tus amigos sin dudar.',
        max: '⚔️ ¡GLADIADOR ESPARTANO! No le tienes miedo ni a la muerte ni al chanclazo de mamá.'
    },
    flojo: {
        title: '🦥 TEST DE FLOJERA',
        name: 'Flojera',
        low: 'Activo e hiperquinético. Haces ejercicio a las 6 am y limpias toda la casa.',
        mid: 'Flojera selectiva: postergas la tarea o el trabajo hasta 10 minutos antes del límite.',
        high: '¡Cansado de estar sentado! Prefieres no comer antes que pararte a calentar comida.',
        max: '🛌 ¡CAMPEÓN MUNDIAL DE LA PROCASTINACIÓN! Respirar ya te parece esfuerzo excesivo.'
    },
    santo: {
        title: '😇 TEST DE SANTIDAD',
        name: 'Santidad',
        low: 'Pecador de tiempo completo. Tienes boleto VIP directo al purgatorio.',
        mid: 'Pecas y rezas para empatar. Haces una buena acción por cada tres travesuras.',
        high: 'Alma limpia y noble. Ayudas a cruzar la calle a las ancianitas y no guardas rencor.',
        max: '🕊️ ¡CANONIZACIÓN INMEDIATA! La aureola se te nota en la oscuridad.'
    },
    bobo: {
        title: '🤡 TEST DE PAYASO',
        name: 'Nivel Payaso',
        low: 'Serio y maduro. Tienes la postura de un juez de la corte suprema.',
        mid: 'Haces tus papelones de vez en cuando, pero te ríes de ti mismo con gracia.',
        high: '¡El circo te busca! Siempre quedas como el payaso por confiar donde no debías.',
        max: '🎪 ¡CIRCO ENTERO CON CARPA Y LEONES! El meme personificado en carne y hueso.'
    },
    guapo: {
        title: '👑 TEST DE GUAPURA',
        name: 'Guapura',
        low: 'El espejo te pide clemencia por las mañanas. Tu belleza es una prueba de fe.',
        mid: 'Defendible: con un buen corte de pelo y perfume fino pasas desapercibido.',
        high: '¡Muy fachero! Te queda bien cualquier ropa y tienes porte de protagonista.',
        max: '🌟 ¡BELIKE A GOD! Pisas un lugar y hasta los meseros suspiran. Escultura griega viviente.'
    },
    otaku: {
        title: '🍙 TEST DE OTAKU',
        name: 'Nivel Otaku',
        low: '¿Anime? Lo único que conoces es Dragon Ball Z y porque lo daban en la tele abierta.',
        mid: 'Has visto un par de series de moda (Naruto, Shingeki) y te sabes un par de openings.',
        high: '¡Otaku certificado! Tienes waifu/husbando, dices "nani" y tu lista de MyAnimeList asusta.',
        max: '🌸 ¡CORRES COMO NARUTO POR LA CALLE! Tu habitación huele a ramen y hablas en japonés roto.'
    }
};

module.exports = {
    name: 'cek',
    alias: [
        'ceksuerte', 'cekrico', 'cekmaligno', 'cekinteligente', 'cekpobre',
        'cektocuen', 'cekgay', 'ceklindo', 'cekfiel', 'cektierno',
        'cektoxic', 'cekfacha', 'ceksad', 'ceksuave', 'cekloco',
        'cekpervertido', 'cekvaliente', 'cekflojo', 'ceksanto', 'cekbobo',
        'cekguapo', 'cekotaku', 'que-tan', 'quetan'
    ],
    category: 'herramientas',
    desc: 'Mide qué tan suertudo, rico, maligno, inteligente, tóxico, etc., eres tú o tus amigos con porcentaje y comentarios graciosos.',
    usage: '.cek <tema> [@usuario] o directamente .ceksuerte, .cekrico, etc.',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Detectar si fue invocado por alias directo (ej: .ceksuerte, .cekrico)
        const rawCmd = (m.body || '').split(/\s+/)[0].slice(1).toLowerCase();
        let topicKey = null;

        if (rawCmd.startsWith('cek') && rawCmd.length > 3) {
            topicKey = rawCmd.slice(3);
        } else if (args[0] && !args[0].startsWith('@')) {
            topicKey = args[0].toLowerCase();
        }

        // Si no especificó tema ni invocó comando directo, mostrar catálogo
        if (!topicKey) {
            const listNames = Object.keys(CATEGORIES).map(k => `• \`.cek${k}\``).join('\n┃  ');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔮 TESTS DE PERSONALIDAD (CEK) 》 ❐',
                    '┃',
                    '┃├◆ Mide qué tan algo eres con % y',
                    '┃  comentarios graciosos personalizados.',
                    '┃',
                    '┃├◆ 📋 *Temas disponibles:*',
                    `┃  ${listNames}`,
                    '┃',
                    '┃├◆ 📌 *Ejemplos de uso:*',
                    '┃  • `.ceksuerte` ➔ Mide tu propia suerte',
                    '┃  • `.cekrico @usuario` ➔ Mide la riqueza de otro',
                    '┃  • `.cek flojo` ➔ Usando el comando base',
                    '┃  • `.cek programador` ➔ ¡Prueba cualquier tema!',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // Resolver usuario objetivo (@mención, respuesta, o autor)
        let targetJid = sender;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted?.sender) {
            targetJid = m.quoted.sender;
        }

        const targetPhone = String(targetJid).split('@')[0].split(':')[0].replace(/\D/g, '');

        // Generar porcentaje divertido
        // Usamos una combinación determinista con base diaria para que sea consistente durante el día
        const todayStr = new Date().toISOString().slice(0, 10);
        let seed = 0;
        const seedStr = `${targetPhone}-${topicKey}-${todayStr}`;
        for (let i = 0; i < seedStr.length; i++) {
            seed = (seed * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
        }
        const percent = Math.abs(seed % 101); // 0 a 100%

        // Barra visual
        const filled = Math.round(percent / 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

        // Obtener datos del tema o generar dinámico
        const cat = CATEGORIES[topicKey];
        let title = '';
        let comment = '';

        if (cat) {
            title = cat.title;
            if (percent <= 25) comment = cat.low;
            else if (percent <= 50) comment = cat.mid;
            else if (percent <= 75) comment = cat.high;
            else comment = cat.max;
        } else {
            // Tema personalizado libre (ej: .cek programador)
            const cleanTopic = topicKey.charAt(0).toUpperCase() + topicKey.slice(1);
            title = `🎯 TEST DE ${cleanTopic.toUpperCase()}`;
            if (percent <= 25) comment = `Nivel casi nulo de ${cleanTopic}. Te falta mucha práctica y dedicación.`;
            else if (percent <= 50) comment = `Nivel regular de ${cleanTopic}. Cumples los requisitos pero no resaltas.`;
            else if (percent <= 75) comment = `¡Gran nivel de ${cleanTopic}! Tienes madera y talento natural para esto.`;
            else comment = `🔥 ¡NIVEL MAESTRO SUPREMO DE ${cleanTopic.toUpperCase()}! Nadie en el grupo te supera.`;
        }

        try {
            await m.react?.('🔮');
        } catch (_) {}

        const card = [
            `┏❐ 《 ${title} 》 ❐`,
            '┃',
            `┃├◆ 👤 *Evaluado:* @${targetPhone}`,
            `┃├◆ 📊 *Porcentaje:* ${percent}%`,
            `┃   [${bar}]`,
            '┃',
            '┃├◆ 💬 *Dictamen oficial:*',
            `┃   _${comment}_`,
            '┗❐\n',
            '_Unknown Codexツ</>_'
        ].join('\n');

        await sock.sendMessage(jid, {
            text: card,
            mentions: [targetJid]
        }, { quoted: m });
    }
};


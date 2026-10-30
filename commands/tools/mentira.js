'use strict';

const EXCUSAS = [
    // ─── TRABAJO / ESTUDIOS ───
    {
        situacion: 'Llegada tarde al trabajo o escuela ⏰',
        mentira: 'No pude llegar a tiempo porque la goma del autobús se pinchó dos veces en el elevado, y cuando nos montamos en otro carro público el chofer se quedó sin gas.',
        credibilidad: 88,
        descaro: 75,
        riesgo: 'Bajo',
        consejo: 'Llega un poco sudado y con la respiración entrecortada para mayor realismo.'
    },
    {
        situacion: 'Falta a reunión virtual de Zoom / Meet 💻',
        mentira: 'Justo cuando le di a entrar a la llamada se fue la luz en todo el sector, la batería de la laptop estaba en 2% y la compañía de internet mandó un aviso de mantenimiento de fibra óptica.',
        credibilidad: 93,
        descaro: 82,
        riesgo: 'Bajo',
        consejo: 'Apaga el Wi-Fi de tu móvil por 20 minutos para que tus mensajes no lleguen de una vez.'
    },
    {
        situacion: 'No entregó el informe / tarea 📄',
        mentira: 'Lo tenía listo en la memoria USB, pero cuando la conecté a la computadora de la oficina el antivirus detectó un troyano fantasma y me bloqueó el archivo en cuarentena.',
        credibilidad: 81,
        descaro: 90,
        riesgo: 'Medio',
        consejo: 'Muestra una captura de pantalla borrosa de un error de Windows.'
    },
    {
        situacion: 'Falta un lunes por resaca 🍺',
        mentira: 'Comí unos camarones anoche que claramente rompieron la cadena de frío. Amanecí intoxicado y el médico me mandó reposo absoluto e hidratación con suero.',
        credibilidad: 94,
        descaro: 85,
        riesgo: 'Bajo',
        consejo: 'Habla con voz débil y ronca si te llaman por teléfono.'
    },

    // ─── PAREJA / WHATSAPP ───
    {
        situacion: 'No contestó mensajes en 6 horas 📱',
        mentira: 'Dejé el celular cargando en la sala y se me activó el modo No Molestar sin darme cuenta porque el sistema operativo se actualizó solo a las 3 de la tarde.',
        credibilidad: 86,
        descaro: 89,
        riesgo: 'Medio',
        consejo: 'Envía el mensaje como si te acabaras de levantar asustado buscando el teléfono.'
    },
    {
        situacion: 'Visto dejado sin responder 👀',
        mentira: 'Te juraba que te había respondido mentalmente. Escribí todo el párrafo en mi cabeza pero justo me tocaron la puerta y se me quedó en borrador.',
        credibilidad: 79,
        descaro: 92,
        riesgo: 'Alto',
        consejo: 'Acompaña la disculpa con un sticker tierno o confundido.'
    },
    {
        situacion: 'Salida con amigos no autorizada 🍻',
        mentira: 'Un primo de Santiago que tenía 4 años sin ver cayó de sorpresa en casa de mi tía porque tenía un asunto legal urgente y me tocó acompañarlo de chofer.',
        credibilidad: 84,
        descaro: 91,
        riesgo: 'Medio',
        consejo: 'Menciona el nombre de un familiar lejano que nadie del grupo conozca.'
    },
    {
        situacion: 'Por qué estabas en línea a las 3:00 AM 🌙',
        mentira: 'Se me cayó el teléfono debajo de la cama, cuando me agaché a buscarlo lo desbloqueé sin querer con la cara y se quedó la pantalla encendida.',
        credibilidad: 65,
        descaro: 98,
        riesgo: 'Crítico',
        consejo: 'Mantén una fe ciega y no te contradigas bajo ningún interrogatorio.'
    },

    // ─── AMIGOS / FIESTAS ───
    {
        situacion: 'No ir al cumpleaños / juntadera 🎉',
        mentira: 'Tengo un dolor de muela del juicio insoportable que me empezó a latir hace una hora, me tomé un calmante fuerte y el doctor me prohibió el sereno y la música alta.',
        credibilidad: 91,
        descaro: 80,
        riesgo: 'Bajo',
        consejo: 'Promete que en la próxima salida tú invitas la primera ronda (aunque sea mentira).'
    },
    {
        situacion: 'Irse temprano de un evento aburrido 🏃‍♂️',
        mentira: 'Me acaba de llamar el vecino que una tubería de agua del patio se rompió y se le está inundando el callejón, tengo que ir volando a cerrar la llave de paso.',
        credibilidad: 95,
        descaro: 78,
        riesgo: 'Bajo',
        consejo: 'Guarda las llaves en la mano mientras hablas y mira el reloj con cara de estrés.'
    },
    {
        situacion: 'No querer prestar el vehículo 🚗',
        mentira: 'El carro tiene un fallo extraño en la cremallera de la dirección; el mecánico me advirtió que no lo pase de 40 km/h porque la rueda puede trabarse sola.',
        credibilidad: 92,
        descaro: 76,
        riesgo: 'Bajo',
        consejo: 'Frunce el ceño y haz ruidos mecánicos con la boca al describirlo.'
    },

    // ─── DINERO / PRÉSTAMOS ───
    {
        situacion: 'Cobro de dinero que debes 💸',
        mentira: 'Hice la transferencia interbancaria por ACH desde ayer por la tarde, pero como cambiaron el sistema del banco central me dijeron que entra en compensación mañana a primera hora.',
        credibilidad: 85,
        descaro: 96,
        riesgo: 'Medio',
        consejo: 'Echa la culpa al banco con total indignación ciudadana.'
    },
    {
        situacion: 'Cuando te piden dinero prestado 🚫',
        mentira: 'Hermano, me agarras en el peor momento: metí todos los ahorros en un depósito a plazo fijo de 6 meses que no puedo tocar sin que me cobren una penalidad del 30%.',
        credibilidad: 89,
        descaro: 84,
        riesgo: 'Bajo',
        consejo: 'Suspira hondo y quéjate de lo cara que está la vida antes de responder.'
    },
    {
        situacion: 'Por qué no compraste la comida del grupo 🍕',
        mentira: 'Pasé la tarjeta por el punto y salía "Error 57 - Transacción Declinada por Seguridad". Llamé al banco y me dijeron que bloquearon el plástico por sospecha de clonación.',
        credibilidad: 87,
        descaro: 93,
        riesgo: 'Bajo',
        consejo: 'Muestra tu billetera vacía con expresión de sorpresa e impotencia.'
    }
];

module.exports = {
    name: 'mentira',
    alias: ['excusa', 'pretexto', 'labia'],
    category: 'diversion',
    desc: 'Genera una mentira o excusa ingeniosa, convincente y viral para cualquier ocasión',
    usage: '.mentira [trabajo | pareja | fiesta | dinero]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const filtro = (args[0] || '').toLowerCase().trim();

        let pool = EXCUSAS;
        if (filtro.includes('trabajo') || filtro.includes('escuela') || filtro.includes('jefe')) {
            pool = EXCUSAS.filter(e => e.situacion.toLowerCase().includes('trabajo') || e.situacion.toLowerCase().includes('tarea') || e.situacion.toLowerCase().includes('reunión'));
        } else if (filtro.includes('amor') || filtro.includes('pareja') || filtro.includes('novi') || filtro.includes('chat')) {
            pool = EXCUSAS.filter(e => e.situacion.toLowerCase().includes('whatsapp') || e.situacion.toLowerCase().includes('visto') || e.situacion.toLowerCase().includes('salida') || e.situacion.toLowerCase().includes('3:00'));
        } else if (filtro.includes('dinero') || filtro.includes('plata') || filtro.includes('prest')) {
            pool = EXCUSAS.filter(e => e.situacion.toLowerCase().includes('dinero') || e.situacion.toLowerCase().includes('transferencia') || e.situacion.toLowerCase().includes('tarjeta'));
        } else if (filtro.includes('fiesta') || filtro.includes('salida') || filtro.includes('amigo')) {
            pool = EXCUSAS.filter(e => e.situacion.toLowerCase().includes('cumpleaños') || e.situacion.toLowerCase().includes('evento') || e.situacion.toLowerCase().includes('vehículo'));
        }

        if (!pool.length) pool = EXCUSAS;

        const item = pool[Math.floor(Math.random() * pool.length)];

        const text = [
            '🎭 *GENERADOR DE EXCUSAS & MENTIRAS 🤥*',
            '━━━━━━━━━━━━━━━━━━━━━━',
            `👤 *Solicitante:* @${sender.split('@')[0]}`,
            `🏷️ *Situación:* ${item.situacion}`,
            '',
            '🗣️ *La Mentira Maestra:*',
            `_"${item.mentira}"_`,
            '',
            '📊 *Ficha Técnica de la Coartada:*',
            `• 📈 *Credibilidad:* ${item.credibilidad}%`,
            `• 🎭 *Descaro:* ${item.descaro}%`,
            `• ⚠️ *Riesgo de que te pillen:* ${item.riesgo}`,
            '',
            `💡 *Consejo de actuación:* ${item.consejo}`,
            '━━━━━━━━━━━━━━━━━━━━━━',
            '_Unknown Codexツ</>_'
        ].join('\n');

        return await sock.sendMessage(jid, {
            text,
            mentions: [sender]
        }, { quoted: m });
    }
};


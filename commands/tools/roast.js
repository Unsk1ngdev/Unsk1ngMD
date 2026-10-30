'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const axios = require('axios');
const userNames = require('../../lib/userNames');
const config = require('../../config');
const logger = require('../../lib/logger');

const ROASTS_CURADOS = [
    'Tiene el récord Guinness de pasar 18 horas seguidas conectado a WhatsApp y ninguna de esas horas produce un solo centavo de dólar.',
    'Tiene cara de que cuando le cobran un dinero prestado en la calle, se pone el teléfono en la oreja y finge que la señal se le cayó.',
    'Se viste como si estuviera a punto de grabar un video de reggaetón en el 2007, pero su cuenta de banco tiene saldo negativo.',
    'Es el tipo de persona que manda notas de voz de 6 minutos para decirte "ok hermano, nos vemos ahorita".',
    'Tiene menos vida amorosa que un Nokia 3310 sin tarjeta SIM, y aun así da consejos de parejas en los estados de WhatsApp.',
    'Si la flojera pagara salario mínimo, este sujeto ya le habría comprado la mansión a Elon Musk al contado.',
    'Tiene una foto de perfil con filtro blanco y negro creyéndose modelo de pasarela, pero en persona parece un render de PlayStation 1.',
    'Se cree el líder del grupo pero cada vez que hay que poner 100 pesos para la pizza se le olvida la billetera en la casa de la abuela.',
    'Tiene tanta suerte en el amor que si se tira al mar a nadar, los tiburones lo ignoran por falta de química.',
    'Su nivel de relevancia en este grupo es comparable al botón de "Términos y Condiciones": todo el mundo sabe que existe, pero nadie lo lee.',
    'Habla de emprender negocios y libertad financiera, pero le pide la clave de Netflix al vecino y le queda debiendo 50 pesos al colmado.',
    'Tiene menos reflejos sociales que una piedra mojada. Se ríe de los chistes tres días después en una nota de voz solitaria.',
    'Si le hicieran una radiografía encontrarían que su cerebro está operando con 128 MB de memoria RAM y Windows 95 sin licencia.',
    'Es la única persona del planeta capaz de llegar tarde a una reunión que era por Zoom y desde su propia cama.',
    'Publica frases motivacionales de lobos solitarios a las 2 de la mañana, pero le da vergüenza pedirle salsa de tomate al mesero.',
    'Tiene el autoestima tan inflada que si se tropieza en la acera se levanta y le aplaude al pavimento por haber tenido el honor de tocarlo.'
];

module.exports = {
    name: 'roast',
    alias: ['quemar', 'humillar', 'roastear'],
    category: 'diversion',
    desc: 'Genera un insulto creativo, cómico y callejero (roast) sobre el usuario mencionado',
    usage: '.roast @usuario [o citando]',

    execute: async ({ sock, m, text }) => {
        const jid = m.chat || m.key.remoteJid;

        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let target = mentioned[0];

        if (!target && m.quoted?.sender) {
            target = m.quoted.sender;
        }
        if (!target) {
            target = m.sender;
        }

        const botJid = (sock.user?.id || sock.user?.jid || '').split(':')[0] + '@s.whatsapp.net';
        const cleanTarget = target.replace(/:\d+/, '').split('@')[0] + '@s.whatsapp.net';

        // Si intentan quemar al propio bot:
        if (cleanTarget === botJid) {
            return await sock.sendMessage(jid, {
                text: [
                    '🤖 *[UNSK1NGMD ROAST DEFENSE]* 🛡️',
                    '',
                    '¿Intentando quemarme a mí, genio?',
                    'Yo soy un bot corriendo en la nube procesando miles de datos por segundo, y tú estás desempleado un viernes a las tres de la tarde peleando con una inteligencia artificial por WhatsApp.',
                    '',
                    '💀 *Diagnóstico:* Búscate un oficio antes de desafiar a las máquinas.',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const isSelf = cleanTarget === (m.sender || '').replace(/:\d+/, '').split('@')[0] + '@s.whatsapp.net';
        const targetPhone = cleanTarget.split('@')[0];
        const targetName = userNames.get(cleanTarget) || `@${targetPhone}`;

        try {
            await m.react('🔥');
        } catch (_) {}

        let roastText = null;

        // 1. Intentar generación con IA (Groq Cloud) si está disponible
        let apiKey = (process.env.GROQ_API_KEY || config.groqApiKey || '').trim();
        if (!apiKey) {
            try {
                const envPath = path.resolve(__dirname, '../../.env');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const mKey = envContent.match(/^GROQ_API_KEY=(.*)$/m);
                    if (mKey) apiKey = mKey[1].trim();
                }
            } catch (_) {}
        }

        if (apiKey) {
            try {
                const promptSystem = `Eres un comediante profesional de 'Roast Battle' en español callejero caribeño/latino.
Genera una burla cómica, sarcástica, picante e ingeniosa de máximo 3 o 4 oraciones sobre el usuario llamado ${targetName}.
Búrlate con humor sobre cosas típicas de grupos de WhatsApp: desempleo, que no paga sus deudas, que manda audios eternos, su falta de vida amorosa, o que se cree modelo.
Mantén la comedia callejera y frena antes de cualquier tipo de odio real o violencia. Solo texto directo del chiste sin introducciones ni comillas.`;

                const response = await axios.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: 'system', content: promptSystem },
                            { role: 'user', content: `Destruye cómicamente a ${targetName} con un roast callejero épico.` }
                        ],
                        temperature: 0.8,
                        max_tokens: 300
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );

                const aiRoast = response.data?.choices?.[0]?.message?.content?.trim();
                if (aiRoast) roastText = aiRoast;
            } catch (_) {}
        }

        // 2. Si no hay IA o falló la red, seleccionar del catálogo curado
        if (!roastText) {
            roastText = ROASTS_CURADOS[Math.floor(Math.random() * ROASTS_CURADOS.length)];
        }

        const headerTitle = isSelf
            ? `🔥 *AUTO-ROAST: @${targetPhone} SE HUMILLÓ SOLO* 🔥`
            : `🔥 *ROAST CALLEJERO PARA @${targetPhone}* 🔥`;

        const finalText = [
            headerTitle,
            '━━━━━━━━━━━━━━━━━━━━━━',
            `💀 _"${roastText}"_`,
            '━━━━━━━━━━━━━━━━━━━━━━',
            '🚑 _Se solicita una unidad de bomberos y crema para quemaduras de tercer grado._',
            '',
            '_Unknown Codexツ</>_'
        ].join('\n');

        return await sock.sendMessage(jid, {
            text: finalText,
            mentions: [cleanTarget]
        }, { quoted: m });
    }
};


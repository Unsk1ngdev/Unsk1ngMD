'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Obtiene la API Key de Groq si está configurada
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
 * Genera un contraargumento mediante Groq Cloud si está disponible
 */
async function generarContraargumentoIA(tema, posicion, ronda, argumentoUsuario, historial = []) {
    const apiKey = getGroqApiKey();
    if (!apiKey) return null;

    const posturaBot = posicion === 'favor' ? 'A FAVOR' : 'EN CONTRA';
    const systemPrompt = `Eres un debatiente implacable, altamente elocuente, analítico y carismático en un debate formal de 5 rondas.
Tema del debate: "${tema}".
Tu postura fija e inquebrantable: ${posturaBot}.
Ronda actual: ${ronda} de 5.

Instrucciones estrictas:
- Contraargumenta DIRECTAMENTE lo que acaba de decir el usuario con argumentos de peso, analogías punzantes o lógica irrefutable.
- Tu respuesta debe ser en español, de 2 a 3 oraciones contundentes y persuasivas.
- Si es la ronda 5, haz un cierre magistral defendiendo tu postura como la ganadora definitiva.
- Si no es la ronda 5, cierra desafiando al usuario a rebatir tu punto.
- Mantén siempre el rol de debatiente profesional pero competitivo.`;

    try {
        const messages = [
            { role: 'system', content: systemPrompt },
            ...historial,
            { role: 'user', content: argumentoUsuario }
        ];

        const candidateModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
        let reply = null;

        for (const model of candidateModels) {
            try {
                const response = await axios.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        model,
                        messages,
                        temperature: 0.7,
                        max_tokens: 300
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 9000
                    }
                );
                reply = response.data?.choices?.[0]?.message?.content?.trim();
                if (reply) break;
            } catch (_) {}
        }

        return reply || null;
    } catch (_) {
        return null;
    }
}

/**
 * Motor heurístico inteligente de debate cuando no hay IA o falla la conexión
 */
function evaluarYContraargumentarHeuristico(tema, posicion, ronda, argumentoUsuario) {
    const text = (argumentoUsuario || '').toLowerCase().trim();
    const len = text.length;

    // Detectar patrones retóricos
    const tieneConectores = /\b(porque|ya que|debido a|por lo tanto|en consecuencia|sin embargo|ademas|además|por ejemplo|dado que)\b/i.test(text);
    const tieneDatos = /\b(estudios|datos|historia|ciencia|expertos|evidencia|demostrado|estadisticas|estadísticas|realidad)\b/i.test(text);
    const esEmocional = /\b(siento que|creo que|me parece|para mi|en mi opinion|en mi opinión|pienso)\b/i.test(text);
    const esCorto = len < 25;
    const esLargo = len > 100;

    // Puntuación del argumento del usuario en esta ronda (de 30 a 100 pts)
    let scoreUsuario = 50;
    let scoreBot = Math.floor(Math.random() * 20) + 75; // 75 a 94 pts
    let reaccion = '🤔';

    if (esCorto) {
        scoreUsuario = Math.floor(Math.random() * 20) + 30; // 30 - 50
        reaccion = '🥱';
    } else if (esLargo && (tieneConectores || tieneDatos)) {
        scoreUsuario = Math.floor(Math.random() * 15) + 85; // 85 - 100
        reaccion = '💪';
    } else if (tieneConectores || tieneDatos) {
        scoreUsuario = Math.floor(Math.random() * 20) + 70; // 70 - 90
        reaccion = '🔥';
    } else if (esEmocional) {
        scoreUsuario = Math.floor(Math.random() * 20) + 55; // 55 - 75
        reaccion = '😏';
    }

    // Banco de argumentos dinámicos y estructurados
    const respuestasAFavor = [
        `Comprendo hacia dónde apuntas, pero cometes un error fundamental: estás confundiendo una excepción aislada con la norma general sobre *${tema}*. Cuando observamos el panorama completo, la evidencia demuestra que los beneficios superan cualquier inconveniente temporal. 📊`,
        `Tu planteamiento suena atractivo superficialmente, pero carece de viabilidad práctica. Defender lo contrario a *${tema}* solo nos llevaría al estancamiento, mientras que abrazarlo genera progreso y soluciones sostenibles en el tiempo. 🔥`,
        `Interesante intento, pero estás ignorando el costo de oportunidad. Si descartamos *${tema}*, ¿cuál es tu alternativa real? Ninguna con la misma solidez o respaldo colectivo comprobado. 💪`,
        `Ese razonamiento presenta una falacia de causa falsa. Atribuyes consecuencias negativas a *${tema}* que en realidad provienen de una mala gestión externa, no de la idea misma. Te reto a refutar ese principio básico. ⚡`,
        `Tu postura se basa más en el miedo al cambio que en un análisis objetivo. La historia demuestra una y otra vez que posturas como la que defiendo respecto a *${tema}* son las que terminan transformando el mundo para bien. 🚀`
    ];

    const respuestasEnContra = [
        `Aunque intentas darle un matiz positivo, no puedes tapar el sol con un dedo: los efectos colaterales de *${tema}* son demasiado graves para ignorarlos. El precio que se paga supera por mucho cualquier ganancia teórica. ⚠️`,
        `Tu argumento se sostiene en el entusiasmo más que en la prudencia. Si analizamos los precedentes históricos de *${tema}*, vemos promesas incumplidas y una larga estela de complicaciones estructurales que sigues sin responder. 🛑`,
        `Caes en la trampa del idealismo. En un mundo perfecto tu visión de *${tema}* podría funcionar, pero en la realidad cotidiana existen variables humanas y económicas que la vuelven insostenible y riesgosa. 📉`,
        `Mencionas puntos válidos pero irrelevantes para el problema central. Lo que está en juego con *${tema}* no es si tiene alguna ventaja menor, sino si los riesgos estructurales son tolerables. Y claramente no lo son. ❌`,
        `Te concentras en el corto plazo olvidando por completo las secuelas a largo plazo. *${tema}* es una solución fácil que crea problemas infinitamente mayores para el día de mañana. ¿Cómo justificas ese daño? 💥`
    ];

    const lista = posicion === 'favor' ? respuestasAFavor : respuestasEnContra;
    const contraelegida = lista[Math.floor(Math.random() * lista.length)];

    return {
        texto: contraelegida,
        scoreUsuario,
        scoreBot,
        reaccion
    };
}

module.exports = {
    generarContraargumentoIA,
    evaluarYContraargumentarHeuristico
};


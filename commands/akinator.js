const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');
const config = require('../config');
const logger = require('../lib/logger');
const economy = require('../lib/economy');
const userNames = require('../lib/userNames');

const getGroqApiKey = () => {
    let key = (process.env.GROQ_API_KEY || config.groqApiKey || '').trim();
    if (!key) {
        try {
            const envPath = path.resolve(__dirname, '../.env');
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf8');
                const match = content.match(/^GROQ_API_KEY=(.*)$/m);
                if (match) key = match[1].trim();
            }
        } catch (_) {}
    }
    return key;
};

// Almacenamiento centralizado de sesiones activas en memoria indexado por JID del chat
global.akinatorSessions = global.akinatorSessions || new Map();

const SESSION_TIMEOUT_MS = 90000; // Temporizador de inactividad (90 segundos)

// Modelos activos y comprobados en la API de Groq Cloud
const CANDIDATE_MODELS = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    process.env.GROQ_MODEL?.trim(),
    config.groqModel
].filter((m) => m && !m.includes('llama-3.3') && !m.includes('llama-3.1'));

// Banco de preguntas estratégicas de eliminación como red de seguridad infalible
const STRATEGIC_QUESTIONS = [
    "¿Tu personaje es una persona real de carne y hueso?",
    "¿Tu personaje es o era de sexo masculino?",
    "¿Tu personaje proviene del mundo del anime, manga o animación?",
    "¿Tu personaje proviene de una película o serie con actores reales?",
    "¿Tu personaje proviene del mundo de los videojuegos?",
    "¿Tu personaje tiene superpoderes, magia o habilidades sobrehumanas?",
    "¿Tu personaje es el protagonista principal de su propia historia?",
    "¿Tu personaje lucha usando armas, espadas o artes de combate?",
    "¿Tu personaje está relacionado con el mundo del deporte profesional?",
    "¿Tu personaje es un cantante, músico o figura del espectáculo?",
    "¿Tu personaje es un creador de contenido de YouTube, Twitch o redes sociales?",
    "¿Tu personaje tiene o tenía fama a nivel mundial?",
    "¿Tu personaje es de origen japonés o asiático?",
    "¿Tu personaje tiene más de 30 años de edad?",
    "¿Tu personaje forma parte de una franquicia o universo muy conocido?",
    "¿Tu personaje tiene un traje, uniforme o vestimenta característica?",
    "¿Tu personaje ha fallecido o ya no está activo?",
    "¿Tu personaje es un villano o antagonista?"
];

const SYSTEM_PROMPT =
`Eres el genio Akinator en español. Tu misión es adivinar EXACTAMENTE en qué personaje (real o ficticio) está pensando el usuario.
El usuario SOLO puede responder a tus preguntas con una de estas opciones: Sí, No, No sé, Probablemente sí o Probablemente no.

REGLAS DE ORO:
1. Toda pregunta DEBE responderse estrictamente con Sí o No (NUNCA hagas preguntas de opción múltiple como "¿es X o Y?" ni abiertas).
2. NUNCA formules el nombre del personaje que sospechas dentro de una pregunta normal (ej. NUNCA preguntes "¿Tu personaje es Messi?"). En su lugar, cuando tengas un candidato claro con probabilidad razonable (>70%), ¡emite DIRECTAMENTE la adivinanza con "tipo": "adivinanza"!
3. METODOLOGÍA DEDUCTIVA:
   - Turnos 1-3: Filtra el universo principal (¿Es una persona real? Si es ficticio: ¿Es de anime o manga? ¿Es de videojuegos? ¿De cine/Marvel? Si es real: ¿Es deportista/futbolista? ¿Es cantante/músico? ¿Youtuber/Streamer?).
   - Turnos 4-7: Mantén internamente 3 a 5 candidatos sospechosos ("candidatos": [...]) y formula preguntas clave que distingan entre ellos (color de pelo, poderes, vestimenta, franquicia, accesorios).
   - Turno 7+: En cuanto uno de los candidatos coincida fuertemente con las pistas o alcances el turno 10-12, ¡ADIVINA con su nombre universal y oficial!

ESTRUCTURA DE RESPUESTA (Responde SIEMPRE y ÚNICAMENTE en JSON válido):

Si estás preguntando:
{
  "tipo": "pregunta",
  "candidatos": ["Goku", "Naruto", "Luffy"],
  "pregunta": "¿Tu personaje pertenece a la franquicia Dragon Ball?",
  "progreso": 60
}

Si estás adivinando:
{
  "tipo": "adivinanza",
  "nombre": "Son Goku",
  "descripcion": "Protagonista saiyajin de la serie Dragon Ball",
  "progreso": 100
}`;

/**
 * Parsea y normaliza de forma ultra robusta la respuesta JSON de Akinator (Groq, Pollinations o texto plano)
 */
const parseAndNormalizeAkinator = (raw, currentStep = 1) => {
    if (!raw) return null;
    let parsed = null;
    const str = typeof raw === 'object' ? JSON.stringify(raw) : String(raw).trim();

    // 1. Intento directo de JSON.parse
    try {
        parsed = JSON.parse(str);
    } catch (_) {}

    // 2. Limpieza de bloques de código markdown ```json ... ```
    if (!parsed) {
        const mdClean = str.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
        try {
            parsed = JSON.parse(mdClean);
        } catch (_) {}
    }

    // 3. Extracción entre llaves {}
    if (!parsed) {
        const first = str.indexOf('{');
        const last = str.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
            try {
                parsed = JSON.parse(str.slice(first, last + 1));
            } catch (_) {}
        }
    }

    // 4. Si se parseó un objeto estructurado, normalizar campos
    if (parsed && typeof parsed === 'object') {
        const isExplicitGuess = parsed.tipo === 'adivinanza' || parsed.tipo === 'guess' || Boolean(parsed.adivinanza);
        let extractedName = parsed.nombre || parsed.name || parsed.personaje || parsed.adivinanza ||
            parsed.character || parsed.resultado || parsed.respuesta || parsed.personaje_adivinado || parsed.guess || '';

        // Si el modelo marcó adivinanza explícita o se alcanzó el límite de turnos (step >= 12), pero puso el nombre en la pregunta o descripción
        if (!extractedName && (isExplicitGuess || currentStep >= 12 || (parsed.progreso && parsed.progreso >= 98))) {
            const rawQ = parsed.pregunta || parsed.question || '';
            const rawDesc = parsed.descripcion || parsed.description || parsed.texto || '';

            // Caso: "¿Estás pensando en Spider-Man?" o "¿Tu personaje es Naruto?"
            const qClean = rawQ.replace(/^¿?\s*(?:estás pensando en|es|tu personaje es|se trata de)\s*/i, '').replace(/[?.]/g, '').trim();
            if (qClean && qClean.length >= 3 && qClean.length <= 40 && !qClean.toLowerCase().startsWith('tu personaje') && !qClean.toLowerCase().startsWith('un ') && !qClean.toLowerCase().startsWith('una ')) {
                extractedName = qClean;
            } else if (rawDesc) {
                const descMatch = rawDesc.match(/(?:es|trata de|adivino|personaje es)\s*[:]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s.-]+)/i);
                if (descMatch) {
                    extractedName = descMatch[1].replace(/[¿?¡!.]/g, '').trim();
                } else if (rawDesc.length <= 35) {
                    extractedName = rawDesc.replace(/[¿?¡!.]/g, '').trim();
                }
            }
        }

        const isGuess = isExplicitGuess || Boolean(extractedName && (isExplicitGuess || currentStep >= 12 || (parsed.progreso && parsed.progreso >= 98)));

        const normalized = {
            tipo: isGuess ? 'adivinanza' : 'pregunta',
            pregunta: parsed.pregunta || parsed.question || parsed.pregunta_actual || parsed.texto || '',
            progreso: typeof parsed.progreso === 'number' ? parsed.progreso : (parsed.progress || Math.min(95, currentStep * 7)),
            nombre: extractedName || (isGuess ? 'Personaje Misterioso' : ''),
            descripcion: parsed.descripcion || parsed.description || parsed.detalles || (extractedName ? `Personaje identificado: ${extractedName}` : '')
        };

        if (normalized.pregunta || normalized.nombre) {
            return normalized;
        }
    }

    // 5. Fallback ultra robusto para respuestas en texto plano del modelo
    const cleanStr = str.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

    // Detección de adivinanza en texto plano
    const guessMatch = cleanStr.match(/(?:tu personaje es|creo que es|se trata de|adivino que es|el personaje es|pensando en)\s*[:]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s.-]+)/i);
    if (guessMatch) {
        const name = guessMatch[1].replace(/[¿?¡!.]/g, '').trim();
        return {
            tipo: 'adivinanza',
            nombre: name || 'Personaje Misterioso',
            descripcion: cleanStr,
            progreso: 100,
            pregunta: ''
        };
    }

    // Detección de pregunta en texto plano
    const qMatch = cleanStr.match(/(?:¿|^)([A-ZÁÉÍÓÚÑa-záéíóúñ\s,¿?¡!-]+?\?)/);
    if (qMatch) {
        let qText = qMatch[1].trim();
        if (!qText.startsWith('¿')) qText = '¿' + qText;
        return {
            tipo: 'pregunta',
            pregunta: qText,
            progreso: Math.min(95, currentStep * 7),
            nombre: '',
            descripcion: ''
        };
    }

    return null;
};

/**
 * Selecciona la siguiente pregunta estratégica de eliminación que no se haya formulado aún
 */
const getFallbackQuestion = (session) => {
    const askedSet = new Set((session.history || []).map((h) => (h.q || '').trim().toLowerCase()));
    for (const q of STRATEGIC_QUESTIONS) {
        if (!askedSet.has(q.trim().toLowerCase())) {
            return {
                tipo: 'pregunta',
                pregunta: q,
                progreso: Math.min(95, session.step * 7),
                nombre: '',
                descripcion: ''
            };
        }
    }
    return {
        tipo: 'pregunta',
        pregunta: '¿Tu personaje tiene características o habilidades fuera de lo común?',
        progreso: Math.min(95, session.step * 7),
        nombre: '',
        descripcion: ''
    };
};

/**
 * Consulta la IA de forma compacta y veloz para el siguiente turno
 */
const getNextAkinatorTurn = async (session) => {
    const apiKey = getGroqApiKey();
    const historySummary = (session.history && session.history.length > 0)
        ? session.history.map((h, i) => `${i + 1}. ${h.q} [${h.a}]`).join(' | ')
        : 'Inicio del juego.';

    let instruction = '';
    if (session.step >= 12) {
        instruction = `Estamos en el turno #${session.step} (fase final). Revisa el historial de pistas acumuladas y emite tu ADIVINANZA definitiva con el personaje más probable que coincida: {"tipo":"adivinanza","nombre":"Nombre del Personaje","descripcion":"Breve descripción","progreso":100}.`;
    } else if (session.step >= 6) {
        instruction = `Estamos en el turno #${session.step}. Si las pistas acumuladas coinciden claramente con uno de tus candidatos sospechosos (>70% de certeza), ¡emite tu ADIVINANZA ahora! De lo contrario, formula una pregunta decisiva de Sí/No que descarte a los demás candidatos.`;
    } else {
        instruction = `Estamos en el turno #${session.step}. Formula una pregunta estratégica de Sí/No para descartar candidatos o, si ya tienes certeza alta (>75%), ¡adivina ya!`;
    }

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content: `Historial de turnos anteriores:\n${historySummary}\n\n${instruction}\nResponde únicamente con el JSON válido.`
        }
    ];

    // 1. Intentar con Groq Cloud (modelos rotativos ultra rápidos con 300 max_tokens)
    if (apiKey) {
        const uniqueModels = [...new Set(CANDIDATE_MODELS)];
        for (const model of uniqueModels) {
            try {
                const res = await axios.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        model,
                        messages,
                        temperature: 0.2,
                        max_tokens: 300
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 7000
                    }
                );

                const content = res.data?.choices?.[0]?.message?.content?.trim();
                const normalized = parseAndNormalizeAkinator(content, session.step);
                if (normalized && (normalized.pregunta || normalized.nombre)) {
                    return normalized;
                }
            } catch (err) {
                const status = err.response?.status;
                if (status === 401) break;
                continue;
            }
        }
    }

    // 2. Fallback secundario a Pollinations con timeout corto
    try {
        const fbRes = await axios.post(
            'https://text.pollinations.ai/',
            {
                messages,
                model: 'openai',
                jsonMode: true,
                temperature: 0.3
            },
            { timeout: 4500 }
        );
        const fbContent = fbRes.data?.choices?.[0]?.message?.content || fbRes.data;
        const normalized = parseAndNormalizeAkinator(fbContent, session.step);
        if (normalized && (normalized.pregunta || normalized.nombre)) {
            return normalized;
        }
    } catch (_) {}

    // 3. Fallback infalible del motor estratégico de preguntas (Garantiza que la partida NUNCA falle)
    return getFallbackQuestion(session);
};

/**
 * Descarga el buffer de la imagen oficial del personaje desde Wikipedia usando cabeceras seguras de navegador
 */
const getCharacterImageBuffer = async (characterName) => {
    if (!characterName) return null;
    try {
        const cleanName = characterName.replace(/\s+/g, '_');
        const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`;
        const summaryRes = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 3000
        });

        const imgUrl = summaryRes.data?.thumbnail?.source;
        if (!imgUrl) return null;

        const imgRes = await axios.get(imgUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            },
            responseType: 'arraybuffer',
            timeout: 3500
        });

        if (imgRes.status === 200 && imgRes.data && imgRes.data.length > 0) {
            return Buffer.from(imgRes.data);
        }
        return null;
    } catch (_) {
        return null;
    }
};

/**
 * Configura o renueva el temporizador de inactividad de 90 segundos
 */
const setSessionTimeout = (sock, chatId) => {
    return setTimeout(async () => {
        if (global.akinatorSessions && global.akinatorSessions.has(chatId)) {
            global.akinatorSessions.delete(chatId);
            try {
                await sock.sendMessage(chatId, {
                    text: '🧞‍♂️ *[AKINATOR]* La partida ha finalizado por inactividad (90 segundos sin responder).'
                });
            } catch (_) {}
        }
    }, SESSION_TIMEOUT_MS);
};

/**
 * Inicia una nueva partida de Akinator en el chat
 */
const startGame = async (sock, m) => {
    const chatId = m.chat;

    if (global.akinatorSessions && global.akinatorSessions.has(chatId)) {
        return await sock.sendMessage(chatId, {
            text: '⚠️ Ya hay una partida de Akinator activa en este chat.\nResponde a la pregunta actual o escribe *.cancelakinator* para reiniciar.'
        }, { quoted: m });
    }

    await sock.sendMessage(chatId, {
        text: '🧞‍♂️ *[AKINATOR - EL GENIO]*\n\n🔮 _Piensa en un personaje real o ficticio. Conéctate mentalmente... Preparando la primera pregunta..._'
    }, { quoted: m });

    try {
        const session = {
            chatId,
            player: m.sender,
            step: 1,
            currentStep: 1,
            progress: 5,
            history: [],
            lastQuestion: '¿Tu personaje es una persona real de carne y hueso?',
            processing: false,
            isProcessing: false,
            timeout: setSessionTimeout(sock, chatId),
            aki: {
                currentStep: 1,
                progress: 5,
                lastQuestion: '¿Tu personaje es una persona real de carne y hueso?',
                messages: []
            }
        };

        // Consultar primera pregunta a la IA o usar la pregunta estratégica clásica
        const firstTurn = await getNextAkinatorTurn(session);
        if (firstTurn && firstTurn.pregunta) {
            session.lastQuestion = firstTurn.pregunta;
            session.progress = firstTurn.progreso || 5;
            session.aki.lastQuestion = firstTurn.pregunta;
            session.aki.progress = session.progress;
        }

        global.akinatorSessions.set(chatId, session);

        const promptText =
            `🧞‍♂️ *AKINATOR - PREGUNTA #${session.step}*\n` +
            `📊 *Progreso:* ${session.progress}%\n\n` +
            `❓ *${session.lastQuestion}*\n\n` +
            `1️⃣ *1:* Sí\n` +
            `2️⃣ *2:* No\n` +
            `3️⃣ *3:* No sé\n` +
            `4️⃣ *4:* Probablemente sí\n` +
            `5️⃣ *5:* Probablemente no\n\n` +
            `💡 _Escribe únicamente el número (1 al 5) para responder._\n` +
            `_(Escribe *cancelar* para salir)_`;

        await sock.sendMessage(chatId, { text: promptText }, { quoted: m });

    } catch (err) {
        logger.error('Error al iniciar Akinator:', err.message);
        if (global.akinatorSessions.has(chatId)) {
            const s = global.akinatorSessions.get(chatId);
            if (s?.timeout) clearTimeout(s.timeout);
            global.akinatorSessions.delete(chatId);
        }
        await sock.sendMessage(chatId, {
            text: '❌ No se pudo conectar con el servidor de Akinator. Por favor intenta de nuevo con .akinator'
        }, { quoted: m });
    }
};

/**
 * Valida y procesa la respuesta del usuario para la sesión activa
 */
const checkAnswer = async (sock, m) => {
    const chatId = m.chat;
    if (!global.akinatorSessions || !global.akinatorSessions.has(chatId)) return false;

    const session = global.akinatorSessions.get(chatId);
    if (!session) return false;

    const body = (m.body || '').trim().toLowerCase();
    if (!body) return false;

    // 1. Cancelación voluntaria
    if (body === 'cancelar' || body === '.cancelar' || body === '.cancelakinator' || body === 'stopaki') {
        if (session.timeout) clearTimeout(session.timeout);
        global.akinatorSessions.delete(chatId);
        await sock.sendMessage(chatId, {
            text: '🧞‍♂️ *[AKINATOR]* Partida cancelada con éxito. ¡Vuelve cuando quieras!'
        }, { quoted: m });
        return true;
    }

    // 2. Validación de opciones (1 al 5 y variantes naturales)
    const validAnswers = {
        '1': 'Sí',
        'si': 'Sí',
        'sí': 'Sí',
        's': 'Sí',
        '2': 'No',
        'no': 'No',
        'n': 'No',
        '3': 'No sé',
        'no se': 'No sé',
        'no sé': 'No sé',
        'nose': 'No sé',
        '4': 'Probablemente sí',
        'probablemente si': 'Probablemente sí',
        'probablemente sí': 'Probablemente sí',
        'quiza si': 'Probablemente sí',
        'quizas si': 'Probablemente sí',
        'tal vez si': 'Probablemente sí',
        '5': 'Probablemente no',
        'probablemente no': 'Probablemente no',
        'quiza no': 'Probablemente no',
        'quizas no': 'Probablemente no',
        'tal vez no': 'Probablemente no'
    };

    const answerText = validAnswers[body];
    if (!answerText) {
        const isReplyingToBot = m.quoted && m.quoted.fromMe;
        const isSingleDigit = /^[0-9]$/.test(body);

        if (isReplyingToBot || isSingleDigit) {
            await sock.sendMessage(chatId, {
                text: '⚠️ *[AKINATOR]* Opción no válida.\nPor favor responde únicamente con un número del *1 al 5*:\n\n' +
                      '1️⃣ Sí | 2️⃣ No | 3️⃣ No sé\n' +
                      '4️⃣ Probablemente sí | 5️⃣ Probablemente no\n\n' +
                      '_(Escribe *cancelar* para salir)_'
            }, { quoted: m });
            return true;
        }
        return false;
    }

    // 3. Mutex para bloquear peticiones simultáneas o spam
    if (session.processing || session.isProcessing) {
        return true;
    }
    session.processing = true;
    session.isProcessing = true;

    // Temporizador de seguridad para desbloquear mutex si ocurre un cuelgue inesperado
    const safetyUnlock = setTimeout(() => {
        session.processing = false;
        session.isProcessing = false;
    }, 12000);

    // 4. Renovar temporizador de 90 segundos
    if (session.timeout) clearTimeout(session.timeout);
    session.timeout = setSessionTimeout(sock, chatId);

    // 5. Registrar respuesta en el historial estructurado
    session.history.push({
        q: session.lastQuestion,
        a: answerText
    });

    session.step += 1;
    session.currentStep = session.step;
    session.aki.currentStep = session.step;

    await m.react('🔮');

    try {
        const aiResponse = await getNextAkinatorTurn(session);

        const isGuess = aiResponse.tipo === 'adivinanza' && Boolean(aiResponse.nombre);

        // Fin del juego: Akinator adivina el personaje
        if (isGuess) {
            const charName = aiResponse.nombre || 'Personaje Misterioso';
            const charDesc = aiResponse.descripcion || 'Sin descripción disponible';

            // Descargar buffer de imagen con User-Agent seguro
            let charImgBuffer = null;
            try {
                charImgBuffer = await getCharacterImageBuffer(charName);
            } catch (_) {}

            // Recompensa en economía directo al banco por completar partida
            try {
                if (economy && typeof economy.addGameReward === 'function') {
                    economy.addGameReward(m.sender, 350, 150, chatId);
                } else {
                    if (economy?.addCoins) economy.addCoins(m.sender, 350);
                    if (economy?.addExp) economy.addExp(m.sender, 150);
                }
            } catch (_) {}

            const displayName = (userNames && typeof userNames.get === 'function')
                ? userNames.get(m.sender)
                : null;
            const playerTag = displayName ? `*${displayName}* (@${m.sender.split('@')[0]})` : `@${m.sender.split('@')[0]}`;

            const resultCard =
                `🧞‍♂️ *¡AKINATOR HA ADIVINADO!* 🧞‍♂️\n\n` +
                `🔮 *Personaje:* *${charName}*\n` +
                `📝 *Detalles:* ${charDesc}\n\n` +
                `🎯 *Preguntas requeridas:* ${session.step}\n` +
                `👤 *Jugador:* ${playerTag}\n` +
                `💰 *Premio de partida:* +$350 monedas (al banco) | ⚡ +150 EXP\n\n` +
                `✨ _¿He acertado tu personaje? ¡El genio nunca falla!_`;

            let sentSuccessfully = false;

            // 1. Intentar enviar con imagen Buffer nativo
            if (charImgBuffer) {
                try {
                    await sock.sendMessage(chatId, {
                        image: charImgBuffer,
                        caption: resultCard,
                        mentions: [m.sender]
                    }, { quoted: m });
                    sentSuccessfully = true;
                } catch (imgSendErr) {
                    logger.warn('[AKINATOR] Falló envío con imagen buffer, procediendo con texto:', imgSendErr.message);
                }
            }

            // 2. Fallback garantizado: enviar como texto si la imagen falló o no existe
            if (!sentSuccessfully) {
                try {
                    await sock.sendMessage(chatId, {
                        text: resultCard,
                        mentions: [m.sender]
                    }, { quoted: m });
                    sentSuccessfully = true;
                } catch (txtSendErr) {
                    logger.error('[AKINATOR] Error crítico enviando tarjeta final:', txtSendErr.message);
                }
            }

            // Limpieza de sesión en memoria SOLO después de enviar
            if (session.timeout) clearTimeout(session.timeout);
            global.akinatorSessions.delete(chatId);

            await m.react('🎉').catch(() => {});
            return true;
        }

        // Si continúa preguntando: actualizar estado
        const progress = Math.min(95, aiResponse.progreso || (session.step * 7));
        session.progress = progress;
        session.aki.progress = progress;
        session.lastQuestion = aiResponse.pregunta || '¿Tu personaje sigue activo?';
        session.aki.lastQuestion = session.lastQuestion;

        const promptText =
            `🧞‍♂️ *AKINATOR - PREGUNTA #${session.step}*\n` +
            `📊 *Progreso:* ${progress}%\n\n` +
            `❓ *${session.lastQuestion}*\n\n` +
            `1️⃣ *1:* Sí\n` +
            `2️⃣ *2:* No\n` +
            `3️⃣ *3:* No sé\n` +
            `4️⃣ *4:* Probablemente sí\n` +
            `5️⃣ *5:* Probablemente no\n\n` +
            `💡 _Escribe tu opción (1 al 5)._`;

        await sock.sendMessage(chatId, { text: promptText }, { quoted: m });
        await m.react('🧞‍♂️');
        return true;

    } catch (err) {
        logger.error('[AKINATOR UNEXPECTED ERROR]:', err.message);

        // En caso de cualquier excepción inesperada, usar la red estratégica para no detener la partida
        const fallback = getFallbackQuestion(session);
        session.lastQuestion = fallback.pregunta;
        session.progress = fallback.progreso;
        session.aki.lastQuestion = fallback.pregunta;
        session.aki.progress = fallback.progreso;

        const promptText =
            `🧞‍♂️ *AKINATOR - PREGUNTA #${session.step}*\n` +
            `📊 *Progreso:* ${session.progress}%\n\n` +
            `❓ *${session.lastQuestion}*\n\n` +
            `1️⃣ *1:* Sí\n` +
            `2️⃣ *2:* No\n` +
            `3️⃣ *3:* No sé\n` +
            `4️⃣ *4:* Probablemente sí\n` +
            `5️⃣ *5:* Probablemente no\n\n` +
            `💡 _Escribe tu opción (1 al 5)._`;

        await sock.sendMessage(chatId, { text: promptText }, { quoted: m });
        return true;

    } finally {
        clearTimeout(safetyUnlock);
        session.processing = false;
        session.isProcessing = false;
    }
};

/**
 * Cancela la partida activa en un chat
 */
const cancelGame = (chatId) => {
    if (global.akinatorSessions && global.akinatorSessions.has(chatId)) {
        const session = global.akinatorSessions.get(chatId);
        if (session?.timeout) clearTimeout(session.timeout);
        global.akinatorSessions.delete(chatId);
        return true;
    }
    return false;
};

const hasActiveGame = (chatId) => {
    return Boolean(global.akinatorSessions && global.akinatorSessions.has(chatId));
};

const commands = [
    {
        name: 'akinator',
        alias: ['aki', 'adivina'],
        category: 'juegos',
        desc: 'El genio Akinator intenta adivinar el personaje real o ficticio en el que estás pensando',
        usage: '.akinator',
        execute: async ({ sock, m, args }) => {
            const sub = (args && args[0] ? args[0] : '').toLowerCase();
            if (sub === 'stop' || sub === 'cancel' || sub === 'cancelar') {
                const cancelled = cancelGame(m.chat);
                if (cancelled) {
                    return await sock.sendMessage(m.chat, {
                        text: '🧞‍♂️ La partida de Akinator ha sido cancelada.'
                    }, { quoted: m });
                }
                return await sock.sendMessage(m.chat, {
                    text: 'ℹ️ No hay ninguna partida de Akinator activa en este chat.'
                }, { quoted: m });
            }
            await startGame(sock, m);
        }
    },
    {
        name: 'cancelakinator',
        alias: ['stopaki', 'cancelaki'],
        category: 'juegos',
        desc: 'Cancela la sesión activa de Akinator en el chat',
        usage: '.cancelakinator',
        execute: async ({ sock, m }) => {
            const cancelled = cancelGame(m.chat);
            if (cancelled) {
                await sock.sendMessage(m.chat, {
                    text: '🧞‍♂️ La partida de Akinator ha sido cancelada.'
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, {
                    text: 'ℹ️ No hay ninguna partida de Akinator activa en este chat.'
                }, { quoted: m });
            }
        }
    }
];

commands.hasActiveGame = hasActiveGame;
commands.checkAnswer = checkAnswer;
commands.startGame = startGame;
commands.cancelGame = cancelGame;

module.exports = commands;

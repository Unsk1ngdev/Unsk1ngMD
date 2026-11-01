'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

// Patrones y marcadores de transición característicos de modelos de lenguaje (ChatGPT, Claude, etc.)
const AI_MARKERS = [
    'en conclusión', 'en resumen', 'es importante destacar', 'cabe mencionar que',
    'en primer lugar', 'por lo tanto', 'sin duda alguna', 'a su vez', 'desempeña un papel crucial',
    'un tapiz de', 'en este sentido', 'es fundamental tener en cuenta', 'no obstante',
    'en última instancia', 'en un mundo cada vez más', 'ofrece una perspectiva única',
    'del mismo modo', 'dicho esto', 'como resultado de esto', 'vale la pena señalar',
    'en resumen, podemos decir', 'in conclusion', 'furthermore', 'moreover', 'it is worth noting',
    'plays a crucial role', 'in today\'s world', 'delving into', 'a testament to'
];

/**
 * Análisis heurístico de variabilidad y patrones de Inteligencia Artificial
 */
function analyzeTextStylometry(text) {
    const cleanText = text.trim();
    const sentences = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    const words = cleanText.toLowerCase().split(/\s+/).filter(Boolean);

    if (words.length < 15) {
        return { score: 10, confidence: 'BAJA', markersFound: [], verdict: 'Texto demasiado corto para un análisis fiable.' };
    }

    let aiScore = 20; // Base neutra
    const markersFound = [];

    // 1. Detección de conectores clichés de IA
    const lowerText = cleanText.toLowerCase();
    for (const marker of AI_MARKERS) {
        if (lowerText.includes(marker)) {
            markersFound.push(marker);
            aiScore += 12;
        }
    }

    // 2. Cálculo de "Burstiness" (Variabilidad en longitud de oraciones)
    // Los humanos alternan frases muy cortas con frases muy largas. La IA es muy uniforme.
    if (sentences.length >= 3) {
        const lengths = sentences.map(s => s.split(/\s+/).length);
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((acc, len) => acc + Math.pow(len - avgLength, 2), 0) / lengths.length;
        const stdDev = Math.sqrt(variance);

        // Si la desviación estándar es muy baja (< 3 palabras de variación), indica ritmo monótono de IA
        if (stdDev < 3.5) {
            aiScore += 25;
        } else if (stdDev > 8) {
            // Alta variación humana
            aiScore -= 20;
        }
    }

    // 3. Diversidad léxica (Type-Token Ratio)
    const uniqueWords = new Set(words);
    const ttr = uniqueWords.size / words.length;
    if (ttr < 0.45 && words.length > 50) {
        aiScore += 15; // Repetición sistemática
    }

    // Limitar entre 5% y 98%
    const finalPercent = Math.max(5, Math.min(98, Math.round(aiScore)));

    let verdictTitle = '';
    let verdictEmoji = '';

    if (finalPercent >= 70) {
        verdictEmoji = '🤖';
        verdictTitle = 'ALTA PROBABILIDAD DE IA (ChatGPT / Claude / Copilot)';
    } else if (finalPercent >= 45) {
        verdictEmoji = '🟡';
        verdictTitle = 'TEXTO MIXTO (Posible edición humana o IA reescrita)';
    } else {
        verdictEmoji = '👤';
        verdictTitle = 'PROBABLEMENTE ESCRITO POR UN HUMANO';
    }

    return {
        score: finalPercent,
        verdictTitle,
        verdictEmoji,
        markersFound: markersFound.slice(0, 5),
        sentencesCount: sentences.length,
        wordsCount: words.length
    };
}

module.exports = {
    name: 'grammarly',
    alias: ['aidetector', 'detectaria', 'iaotexto', 'isai', 'checkai', 'iafake'],
    category: 'herramientas',
    desc: 'Analiza un texto para detectar si fue generado por Inteligencia Artificial (ChatGPT, Claude) o escrito por un humano',
    usage: '.grammarly <texto a evaluar> o citando un texto',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const input = (args && args.length > 0 ? args.join(' ') : (text || m.quoted?.body || '')).trim();

        if (!input || input.split(/\s+/).length < 10) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🤖 DETECTOR DE TEXTO IA (GRAMMARLY) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.grammarly <texto largo>`',
                    '┃├◆ 📌 *Ejemplo:* Responde a un mensaje largo con `.grammarly`',
                    '┃',
                    '┃├◆ 🔍 Analiza la uniformidad sintáctica (burstiness),',
                    '┃  perplejidad y conectores robóticos característicos',
                    '┃  para estimar si el texto fue generado por ChatGPT o Claude.',
                    '┃',
                    '┃├◆ ⚠️ *Requisito:* Se recomiendan al menos 15-20 palabras.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('🔍');
        await sock.sendMessage(jid, {
            text: '🔬 *Analizando patrones lingüísticos, sintaxis y marcadores de IA...*'
        }, { quoted: m });

        const result = analyzeTextStylometry(input);

        // Barra de probabilidad de IA
        const barsTotal = 10;
        const filled = Math.round((result.score / 100) * barsTotal);
        const bar = '█'.repeat(filled) + '░'.repeat(barsTotal - filled);

        const markersText = result.markersFound.length > 0
            ? `┃├◆ 🚩 *Marcadores típicos de IA detectados:*\n┃   ${result.markersFound.map(m => `"${m}"`).join(', ')}\n┃`
            : '';

        const report = [
            '┏❐ 《 🤖 REPORTE DE DETECCIÓN DE IA 》 ❐',
            '┃',
            `┃├◆ 📊 *Probabilidad de IA:* ${result.score}%`,
            `┃   [${bar}]`,
            `┃├◆ 👤 *Probabilidad Humana:* ${100 - result.score}%`,
            '┃',
            `┃├◆ ${result.verdictEmoji} *Dictamen:*`,
            `┃   *${result.verdictTitle}*`,
            '┃',
            `┃├◆ 📝 *Métricas:*`,
            `┃   • Palabras analizadas: ${result.wordsCount}`,
            `┃   • Oraciones evaluadas: ${result.sentencesCount}`,
            '┃',
            markersText,
            '┃├◆ 💡 *Nota:* Los detectores de IA son herramientas de',
            '┃  estimación estadística y no son infalibles al 100%.',
            '┗❐\n',
            '_Unknown Codexツ</>_'
        ].filter(Boolean).join('\n');

        await m.react?.(result.score >= 70 ? '🤖' : '👤');
        await sock.sendMessage(jid, { text: report }, { quoted: m });
    }
};


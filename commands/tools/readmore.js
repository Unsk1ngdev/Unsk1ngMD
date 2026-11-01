'use strict';

/**
 * Separador dual infalible para WhatsApp (Android, iOS y WhatsApp Web/Desktop):
 * 1. 4200 caracteres LRM (Unicode 8206 / \u200E): activa el truncado por longitud de caracteres (Web/Desktop).
 * 2. 18 líneas con Hangul Filler (\u3164): clasificado por Unicode como letra pero visualmente 100% invisible,
 *    generando la altura necesaria (18+ líneas) para forzar el colapso inmediato del mensaje
 *    y mostrar el botón nativo "... Leer más" en cualquier pantalla móvil (Android/iOS) sin importar la resolución.
 */
const LRM = String.fromCharCode(8206);
const HANGUL_FILLER = '\u3164';
const READ_MORE_SEPARATOR = LRM.repeat(4200) + '\n' + (HANGUL_FILLER + '\n').repeat(18);

module.exports = {
    name: 'readmore',
    alias: ['vermas', 'spoiler', 'leermaas', 'leermas'],
    category: 'herramientas',
    desc: 'Oculta texto detrás del botón "... Leer más" de WhatsApp (ideal para spoilers, bromas y sorpresas)',
    usage: '.readmore <texto visible> | <texto oculto> (o citando un mensaje)',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const rawText = (args && args.length > 0 ? args.join(' ') : (text || '')).trim();
        const quotedText = (m.quoted?.body || m.quoted?.text || '').trim();

        // Si no hay texto ni mensaje citado, mostrar guía interactiva de uso
        if (!rawText && !quotedText) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 👁️ CREADOR DE "LEER MÁS" 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.readmore visible | oculto`',
                    '┃├◆ 📌 *Ejemplo 1 (Broma):*',
                    '┃   `.readmore ¿Sabías qué? | ¡Caíste en la broma! 😂`',
                    '┃',
                    '┃├◆ 📌 *Ejemplo 2 (Spoiler):*',
                    '┃   `.readmore ⚠️ Alerta de Spoiler | El asesino era el mayordomo.`',
                    '┃',
                    '┃├◆ 📌 *Ejemplo 3 (Citando un mensaje):*',
                    '┃   Cita un mensaje y escribe: `.readmore Toca para leer`',
                    '┃',
                    '┃├◆ 💡 *Tip:* Usa la barra `|` para separar lo que se ve',
                    '┃   de lo que queda oculto tras el botón *"... Leer más"*.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        let visibleText = '';
        let hiddenText = '';

        // Prioridad 1: Separador explícito '|' (con o sin espacios)
        if (rawText.includes('|')) {
            const parts = rawText.split('|');
            visibleText = parts[0].trim();
            hiddenText = parts.slice(1).join('|').trim();
        }
        // Prioridad 2: Citando un mensaje
        else if (quotedText && rawText) {
            visibleText = rawText;
            hiddenText = quotedText;
        } else if (quotedText && !rawText) {
            visibleText = '📜 *Toca para ver el mensaje completo...*';
            hiddenText = quotedText;
        }
        // Prioridad 3: Separador de tres guiones '---'
        else if (rawText.includes('---')) {
            const parts = rawText.split('---');
            visibleText = parts[0].trim();
            hiddenText = parts.slice(1).join('---').trim();
        }
        // Prioridad 4: Separado por doble barra '//' o barra '/'
        else if (rawText.includes('//')) {
            const parts = rawText.split('//');
            visibleText = parts[0].trim();
            hiddenText = parts.slice(1).join('//').trim();
        }
        // Prioridad 5: Separado por salto de línea
        else if (rawText.includes('\n')) {
            const nlIdx = rawText.indexOf('\n');
            visibleText = rawText.substring(0, nlIdx).trim();
            hiddenText = rawText.substring(nlIdx + 1).trim();
        }
        // Prioridad 6: Si escribió varias palabras sin separador
        else {
            const words = rawText.split(/\s+/);
            if (words.length >= 2) {
                // Primera mitad como texto visible, segunda mitad oculta
                const mid = Math.ceil(words.length / 2);
                visibleText = words.slice(0, mid).join(' ');
                hiddenText = words.slice(mid).join(' ');
            } else {
                visibleText = rawText;
                hiddenText = '¡Sorpresa revelada! 🎉\n\n_Unknown Codexツ</>_';
            }
        }

        if (!visibleText) visibleText = 'Ver más';
        if (!hiddenText) hiddenText = '¡Contenido oculto!';

        // Construir mensaje final sin citar m para evitar spoilear el texto en la previsualización de cita
        const finalMessage = `${visibleText}${READ_MORE_SEPARATOR}${hiddenText}`;

        try {
            await m.react?.('👁️');
        } catch (_) {}

        await sock.sendMessage(jid, { text: finalMessage });
    }
};

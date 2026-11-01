'use strict';

/**
 * Comando: .readmore <texto visible> | <texto oculto>
 * 
 * Genera el colapso nativo "... Leer más" de WhatsApp (Android, iOS y WhatsApp Web).
 * Combina:
 * 1. 4001 caracteres LRM (Unicode 8206 / \u200E, Left-to-Right Mark): activa el truncado en WhatsApp Web y Desktop.
 * 2. 4001 caracteres ZWSP (Unicode 8203 / \u200B, Zero-Width Space): proporciona puntos de quiebre invisibles
 *    que activan el colapso nativo de texto en clientes móviles (Android e iOS) sin dejar huecos en blanco.
 * 3. Delimitación limpia con espacio y salto de línea: garantiza que el botón "... Leer más" aparezca
 *    justo al final del texto visible, revelando el contenido oculto limpiamente al pulsarlo.
 */
const LRM = String.fromCharCode(8206);
const ZWSP = String.fromCharCode(8203);
const READ_MORE_SEPARATOR = LRM.repeat(4001) + ZWSP.repeat(4001);

module.exports = {
    name: 'readmore',
    alias: ['vermas', 'spoiler', 'leermaas', 'leermas'],
    category: 'herramientas',
    desc: 'Oculta texto detrás del botón "... Leer más" de WhatsApp (ideal para spoilers, bromas y sorpresas)',
    usage: '.readmore <texto visible> | <texto oculto> (o citando un mensaje)',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;

        // Extraer texto crudo preservando saltos de línea originales desde m.body si está disponible
        let bodyText = '';
        if (m?.body) {
            const match = m.body.match(/^\S+\s*([\s\S]*)$/);
            if (match && match[1]) {
                bodyText = match[1].trim();
            }
        }

        const rawText = (bodyText || (args && args.length > 0 ? args.join(' ') : (text || ''))).trim();
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

        // Prioridad 1: Separador explícito barra vertical '|'
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
        // Prioridad 4: Separado por doble barra '//'
        else if (rawText.includes('//')) {
            const parts = rawText.split('//');
            visibleText = parts[0].trim();
            hiddenText = parts.slice(1).join('//').trim();
        }
        // Prioridad 5: Separado por salto de línea explícito
        else if (rawText.includes('\n')) {
            const nlIdx = rawText.indexOf('\n');
            visibleText = rawText.substring(0, nlIdx).trim();
            hiddenText = rawText.substring(nlIdx + 1).trim();
        }
        // Prioridad 6: Si escribió varias palabras sin delimitador
        else {
            const words = rawText.split(/\s+/);
            if (words.length >= 2) {
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

        // Construir mensaje final infalible para WhatsApp:
        // [visible] + [espacio] + [separador dual invisible] + [\n] + [oculto]
        const cleanVisible = visibleText.trim();
        const cleanHidden = hiddenText.trim();
        const finalMessage = `${cleanVisible} ${READ_MORE_SEPARATOR}\n${cleanHidden}`;

        try {
            await m.react?.('👁️');
        } catch (_) {}

        await sock.sendMessage(jid, { text: finalMessage });
    }
};

'use strict';

const MORSE_CODE_MAP = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'Ñ': '--.--', 'O': '---', 'P': '.--.', 'Q': '--.-',
    'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--',
    'X': '-..-', 'Y': '-.--', 'Z': '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
    '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
    ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
    '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};

const REVERSE_MORSE_MAP = {};
for (const [char, morse] of Object.entries(MORSE_CODE_MAP)) {
    REVERSE_MORSE_MAP[morse] = char;
}

function isMorseCode(str) {
    // Si contiene solo puntos, rayas, barras y espacios
    return /^[.\-\s\/]+$/.test(str.trim());
}

function textToMorse(text) {
    return text.toUpperCase().split(' ').map(word => {
        return word.split('').map(char => MORSE_CODE_MAP[char] || char).join(' ');
    }).join(' / ');
}

function morseToText(morse) {
    return morse.trim().split(/\s*\/\s*|\s{3,}/).map(word => {
        return word.trim().split(/\s+/).map(m => REVERSE_MORSE_MAP[m] || m).join('');
    }).join(' ');
}

module.exports = {
    name: 'morse',
    alias: ['codigomorse', 'morsecode', 'traducirmorse'],
    category: 'herramientas',
    desc: 'Codifica texto normal a código Morse o decodifica código Morse a texto legible',
    usage: '.morse <texto o código morse>',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const input = (args && args.length > 0 ? args.join(' ') : (text || m.quoted?.body || '')).trim();

        if (!input) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📻 TRADUCTOR DE CÓDIGO MORSE 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.morse <texto o morse>`',
                    '┃├◆ 📌 *Ejemplo 1 (Texto a Morse):*',
                    '┃   `.morse Hola Mundo`',
                    '┃   ➜ `.... --- .-.. .- / -- ..- -. -.. ---`',
                    '┃',
                    '┃├◆ 📌 *Ejemplo 2 (Morse a Texto):*',
                    '┃   `.morse ... --- ...`',
                    '┃   ➜ `SOS`',
                    '┃',
                    '┃├◆ 💡 *Detección automática:* El bot detecta si',
                    '┃  escribes texto o código morse y lo convierte.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const isMorse = isMorseCode(input);
        const result = isMorse ? morseToText(input) : textToMorse(input);
        const modeTitle = isMorse ? '🔤 Morse a Texto Decodificado' : '📻 Texto a Código Morse';

        await m.react?.('📻');
        await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 📻 CÓDIGO MORSE 》 ❐',
                '┃',
                `┃├◆ 🔄 *Modo:* ${modeTitle}`,
                '┃',
                '┃├◆ 📥 *Entrada:*',
                `┃   ${input}`,
                '┃',
                '┃├◆ 📤 *Resultado:*',
                `┃ \`${result}\``,
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};


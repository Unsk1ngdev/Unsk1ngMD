'use strict';

module.exports = {
    name: 'binary',
    alias: ['binario', 'decodebin', 'encodebin', 'textbin'],
    category: 'tools',
    desc: 'Convierte texto a código binario de 8 bits o traduce código binario a texto legible (bidireccional)',
    usage: '.binary <texto o código binario>',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const input = (args || []).join(' ').trim();

        if (!input) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 💻 CONVERSOR BINARIO ↔ TEXTO 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Cómo funciona?*',
                    '┃  Es bidireccional y automático:',
                    '┃  • Si envías texto normal → lo convierte a binario.',
                    '┃  • Si envías binario (0 y 1) → lo traduce a texto.',
                    '┃',
                    '┃├◆ 📌 *Ejemplo 1 (Texto a Binario):*',
                    '┃  `.binary Hola Mundo`',
                    '┃',
                    '┃├◆ 📌 *Ejemplo 2 (Binario a Texto):*',
                    '┃  `.binary 01001000 01101111 01101100 01100001`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // Comprobar si el texto ingresado es código binario (solo 0, 1 y espacios)
        const isBinary = /^[01\s]+$/.test(input) && input.replace(/\s+/g, '').length >= 7;

        if (isBinary) {
            // Decodificar binario a texto
            try {
                const cleanBits = input.trim().split(/\s+/).join('');
                let decoded = '';
                for (let i = 0; i < cleanBits.length; i += 8) {
                    const byte = cleanBits.substr(i, 8);
                    if (byte.length >= 7) {
                        decoded += String.fromCharCode(parseInt(byte, 2));
                    }
                }

                if (!decoded) {
                    throw new Error('El código binario no tiene una longitud válida en bytes.');
                }

                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 🔓 BINARIO TRADUCIDO A TEXTO 》 ❐',
                        '┃',
                        '┃├◆ 📥 *Binario original:*',
                        `┃   \`${input.length > 120 ? input.slice(0, 120) + '...' : input}\``,
                        '┃',
                        '┃├◆ 📤 *Texto resultante:*',
                        `┃   *${decoded}*`,
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            } catch (err) {
                return await sock.sendMessage(jid, {
                    text: `❌ Error al decodificar binario: ${err.message}\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }
        } else {
            // Codificar texto a binario de 8 bits
            const encoded = input.split('').map(char => {
                return char.charCodeAt(0).toString(2).padStart(8, '0');
            }).join(' ');

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔒 TEXTO CODIFICADO A BINARIO 》 ❐',
                    '┃',
                    '┃├◆ 📥 *Texto original:*',
                    `┃   *${input}*`,
                    '┃',
                    '┃├◆ 📤 *Código binario (8-bit):*',
                    `┃   \`${encoded}\``,
                    '┃',
                    '┃├◆ 💡 _Puedes copiar el binario y usar .binary para decodificarlo._',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }
    }
};


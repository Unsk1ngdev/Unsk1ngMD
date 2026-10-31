'use strict';

const assert = require('assert');
const reactch = require('../commands/tools/reactch');
const database = require('../lib/database');

async function runTests() {
    console.log('🧪 Iniciando pruebas para .reactch (Reacciones a Canales)...');

    // 1. Prueba: Rechazo silencioso si no es Owner
    {
        let sent = false;
        const mockSock = {
            sendMessage: async () => { sent = true; }
        };
        const mockM = {
            sender: '999999999@s.whatsapp.net',
            isOwner: false,
            chat: '999999999@s.whatsapp.net',
            reply: async () => {},
            react: async () => {}
        };

        await reactch.execute({ sock: mockSock, m: mockM, args: [], text: '' });
        assert.strictEqual(sent, false, 'No debe responder a usuarios que no son Owner');
        console.log('  ✅ Prueba 1 superada: Restricción exclusiva de Owner');
    }

    // 2. Prueba: Menú de ayuda si es Owner pero no pasa enlace ni cita mensaje
    {
        let repliedText = '';
        const mockSock = {
            sendMessage: async (chat, content) => {
                repliedText = content.text;
            }
        };
        const mockM = {
            sender: '18494509905@s.whatsapp.net',
            isOwner: true,
            chat: '18494509905@s.whatsapp.net',
            reply: async () => {},
            react: async () => {}
        };

        await reactch.execute({ sock: mockSock, m: mockM, args: [], text: '' });
        assert.ok(repliedText.includes('REACCIONES PARA CANALES'), 'Debe mostrar el menú de ayuda');
        console.log('  ✅ Prueba 2 superada: Menú de ayuda para .reactch');
    }

    // 3. Prueba: Envío con URL completa e inyección multi-cuenta
    {
        let reactedCalls = [];
        let finalReport = '';
        let reactEmoji = '';

        const mockSock = {
            newsletterMetadata: async (type, code) => {
                assert.strictEqual(code, '0029VaTest123');
                return { id: '120363000000000@newsletter', name: 'Canal de Prueba' };
            },
            newsletterReactMessage: async (jid, serverId, emoji) => {
                reactedCalls.push({ bot: 'Principal', jid, serverId, emoji });
            },
            sendMessage: async (chat, content) => {
                finalReport = content.text;
            }
        };

        // Simular un Sub-Bot activo en memoria
        global.subBots = new Map([
            ['15025392826', {
                sock: {
                    newsletterReactMessage: async (jid, serverId, emoji) => {
                        reactedCalls.push({ bot: 'Sub-Bot', jid, serverId, emoji });
                    }
                }
            }]
        ]);

        const mockM = {
            sender: '18494509905@s.whatsapp.net',
            isOwner: true,
            chat: '18494509905@s.whatsapp.net',
            react: async (e) => { reactEmoji = e; }
        };

        await reactch.execute({
            sock: mockSock,
            m: mockM,
            args: ['https://whatsapp.com/channel/0029VaTest123/45', '🔥', '❤️'],
            text: 'https://whatsapp.com/channel/0029VaTest123/45 🔥 ❤️'
        });

        assert.strictEqual(reactedCalls.length, 2, 'Deben haber reaccionado tanto el bot principal como el sub-bot');
        assert.strictEqual(reactedCalls[0].serverId, '45');
        assert.strictEqual(reactedCalls[0].jid, '120363000000000@newsletter');
        assert.strictEqual(reactEmoji, '✅', 'Debe marcar reacción de éxito');
        assert.ok(finalReport.includes('Canal de Prueba'), 'El reporte debe incluir el nombre del canal');
        assert.ok(finalReport.includes('#45'), 'El reporte debe incluir el Post ID #45');
        console.log('  ✅ Prueba 3 superada: Reacción por URL con integración de Sub-Bots');

        // Limpiar sub-bots mockeados
        global.subBots.clear();
    }

    // 4. Prueba: Autodetección desde mensaje citado reenviado de canal
    {
        let reactedMsg = null;
        let finalReport = '';
        const mockSock = {
            newsletterReactMessage: async (jid, serverId, emoji) => {
                reactedMsg = { jid, serverId, emoji };
            },
            sendMessage: async (chat, content) => {
                finalReport = content.text;
            }
        };

        const mockM = {
            sender: '18494509905@s.whatsapp.net',
            isOwner: true,
            chat: '18494509905@s.whatsapp.net',
            quoted: {
                message: {
                    extendedTextMessage: {
                        contextInfo: {
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363999999999@newsletter',
                                serverMessageId: 99,
                                newsletterName: 'Noticias VIP'
                            }
                        }
                    }
                }
            },
            react: async () => {}
        };

        await reactch.execute({
            sock: mockSock,
            m: mockM,
            args: ['🚀'],
            text: '🚀'
        });

        assert.ok(reactedMsg, 'Debe haber enviado reacción');
        assert.strictEqual(reactedMsg.jid, '120363999999999@newsletter');
        assert.strictEqual(reactedMsg.serverId, '99');
        assert.strictEqual(reactedMsg.emoji, '🚀');
        assert.ok(finalReport.includes('Noticias VIP'));
        console.log('  ✅ Prueba 4 superada: Autodetección de post citado desde canal');
    }

    // 5. Prueba: Conversión de texto plano a texto estilizado (círculos negros)
    {
        let reactedEmoji = '';
        const mockSock = {
            newsletterMetadata: async () => ({ id: '120363111111111@newsletter', name: 'Canal Estilo' }),
            newsletterReactMessage: async (jid, serverId, emoji) => {
                reactedEmoji = emoji;
            },
            sendMessage: async () => {}
        };

        const mockM = {
            sender: '18494509905@s.whatsapp.net',
            isOwner: true,
            chat: '18494509905@s.whatsapp.net',
            react: async () => {}
        };

        await reactch.execute({
            sock: mockSock,
            m: mockM,
            args: ['https://whatsapp.com/channel/0029VaEstilo123/88', 'hola'],
            text: 'https://whatsapp.com/channel/0029VaEstilo123/88 hola'
        });

        assert.strictEqual(reactedEmoji, '🅗🅞🅛🅐', 'Debe convertir las letras a caracteres estilizados');
        console.log('  ✅ Prueba 5 superada: Conversión a texto estilizado (círculos negros)');
    }

    // 6. Prueba: Modo Spam con cantidad y delay
    {
        let spamCount = 0;
        let finalReport = '';
        const mockSock = {
            newsletterMetadata: async () => ({ id: '120363222222222@newsletter', name: 'Canal Spam' }),
            newsletterReactMessage: async () => {
                spamCount++;
            },
            sendMessage: async (chat, content) => {
                finalReport = content.text;
            }
        };

        const mockM = {
            sender: '18494509905@s.whatsapp.net',
            isOwner: true,
            chat: '18494509905@s.whatsapp.net',
            react: async () => {}
        };

        await reactch.execute({
            sock: mockSock,
            m: mockM,
            args: ['https://whatsapp.com/channel/0029VaSpam123/77', '🔥', '2'],
            text: 'https://whatsapp.com/channel/0029VaSpam123/77 🔥 2'
        });

        assert.strictEqual(spamCount, 2, 'Debe haber enviado 2 reacciones en spam');
        assert.ok(finalReport.includes('SPAM DE REACCIONES ENVIADO'));
        assert.ok(finalReport.includes('2/2'));
        console.log('  ✅ Prueba 6 superada: Modo Spam con límite y reporte');
    }

    console.log('🎉 Todas las pruebas de .reactch pasaron exitosamente.\n');
}

runTests().catch(err => {
    console.error('❌ Error en pruebas de reactch:', err);
    process.exit(1);
});

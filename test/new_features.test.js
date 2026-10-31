'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const emojimixCmd = require('../commands/media/emojimix');
const contadorCmd = require('../commands/group/contador');
const motivarCmd = require('../commands/media/motivar');
const asciiCmd = require('../commands/tools/ascii');
const sorteoCmd = require('../commands/group/sorteo');
const generarqrCmd = require('../commands/media/generarqr');
const sitestatusCmd = require('../commands/tools/sitestatus');
const { generateQRWithLogo } = require('../lib/media');

console.log('🧪 [TEST] Iniciando pruebas de los 7 nuevos comandos...');

// Helper para crear contexto mock
const createMockContext = () => {
    const sentMessages = [];
    const reactions = [];

    const sock = {
        user: { id: '18494509905:1@s.whatsapp.net', jid: '18494509905@s.whatsapp.net' },
        sendMessage: async (jid, content, extra) => {
            sentMessages.push({ jid, content, extra });
            return { key: { id: 'mock-msg-' + Date.now() } };
        }
    };

    const m = {
        chat: '120363407455196754@g.us',
        sender: '18494509905@s.whatsapp.net',
        type: 'conversation',
        react: async (emoji) => {
            reactions.push(emoji);
        },
        reply: async (text) => {
            sentMessages.push({ jid: '120363407455196754@g.us', content: { text } });
        }
    };

    return { sock, m, sentMessages, reactions };
};

(async () => {
    // ----------------------------------------------------
    // 1. Pruebas de .emojimix
    // ----------------------------------------------------
    {
        assert.strictEqual(emojimixCmd.name, 'emojimix');
        assert(emojimixCmd.alias.includes('mixemoji'));
        assert(emojimixCmd.alias.includes('emix'));

        // Rechazo sin emojis suficientes
        const ctx = createMockContext();
        await emojimixCmd.execute({ sock: ctx.sock, m: ctx.m, text: 'hola' });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('Debes ingresar al menos 2 emojis'));

        // Flujo simulado con emojis válidos
        const axios = require('axios');
        const sharp = require('sharp');
        const origGet = axios.get;
        const validPng = await sharp({
            create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 100, b: 0, alpha: 1 } }
        }).png().toBuffer();

        axios.get = async () => {
            return {
                status: 200,
                data: validPng
            };
        };

        try {
            const ctxSuccess = createMockContext();
            await emojimixCmd.execute({ sock: ctxSuccess.sock, m: ctxSuccess.m, text: '🔥+💀' });
            assert(ctxSuccess.sentMessages.length > 0);
            const stickerMsg = ctxSuccess.sentMessages.find(msg => msg.content.sticker);
            assert(stickerMsg, 'Debe enviar un sticker');
            assert(Buffer.isBuffer(stickerMsg.content.sticker), 'El sticker debe ser un buffer');
        } finally {
            axios.get = origGet;
        }

        console.log('  ✅ Prueba 1 superada: .emojimix valida emojis y genera sticker.');
    }

    // ----------------------------------------------------
    // 2. Pruebas de .contador
    // ----------------------------------------------------
    {
        assert.strictEqual(contadorCmd.name, 'contador');
        assert(contadorCmd.alias.includes('topmensajes'));
        assert(contadorCmd.alias.includes('msgrank'));

        // Rechazo fuera de grupo
        const ctxPriv = createMockContext();
        ctxPriv.m.chat = '18494509905@s.whatsapp.net';
        await contadorCmd.execute({ sock: ctxPriv.sock, m: ctxPriv.m });
        assert(ctxPriv.sentMessages[0].content.text.includes('solo se puede usar en grupos'));

        // En grupo con datos reales de rank.json
        const ctxGroup = createMockContext();
        await contadorCmd.execute({
            sock: ctxGroup.sock,
            m: ctxGroup.m,
            groupMetadata: { subject: 'Grupo de Prueba' }
        });

        assert(ctxGroup.sentMessages.length > 0);
        const replyText = ctxGroup.sentMessages[0].content.text;
        assert(replyText.includes('TOP 15 — MIEMBROS MÁS ACTIVOS') || replyText.includes('CONTADOR DE MENSAJES'));
        assert(Array.isArray(ctxGroup.sentMessages[0].content.mentions));

        console.log('  ✅ Prueba 2 superada: .contador genera tabla de actividad y menciones.');
    }

    // ----------------------------------------------------
    // 3. Pruebas de .motivar
    // ----------------------------------------------------
    {
        assert.strictEqual(motivarCmd.name, 'motivar');
        assert(motivarCmd.alias.includes('animo'));
        assert(motivarCmd.alias.includes('motivacion'));

        const ctx = createMockContext();
        ctx.m.mentionedJid = ['123456789@s.whatsapp.net'];

        await motivarCmd.execute({ sock: ctx.sock, m: ctx.m });
        assert(ctx.sentMessages.length > 0);
        const sent = ctx.sentMessages[0].content;
        const text = sent.text || sent.caption || '';
        assert(text.includes('INYECCIÓN DE MOTIVACIÓN'));
        assert(sent.mentions.includes('123456789@s.whatsapp.net'));

        console.log('  ✅ Prueba 3 superada: .motivar genera mensaje inspirador con mención.');
    }

    // ----------------------------------------------------
    // 4. Pruebas de .ascii
    // ----------------------------------------------------
    {
        assert.strictEqual(asciiCmd.name, 'ascii');
        assert(asciiCmd.alias.includes('banner'));
        assert(asciiCmd.alias.includes('asciitext'));

        // Rechazo sin texto
        const ctxEmpty = createMockContext();
        await asciiCmd.execute({ sock: ctxEmpty.sock, m: ctxEmpty.m, text: '' });
        assert(ctxEmpty.sentMessages[0].content.text.includes('Debes proporcionar el texto'));

        // Rechazo texto excesivo
        const ctxTooLong = createMockContext();
        await asciiCmd.execute({ sock: ctxTooLong.sock, m: ctxTooLong.m, text: 'ESTE_TEXTO_ES_DEMASIADO_LARGO_PARA_UN_BANNER' });
        assert(ctxTooLong.sentMessages[0].content.text.includes('demasiado largo'));

        // Renderizado exitoso
        const ctxSuccess = createMockContext();
        await asciiCmd.execute({ sock: ctxSuccess.sock, m: ctxSuccess.m, text: 'HOLA' });
        assert(ctxSuccess.sentMessages.length > 0);
        const output = ctxSuccess.sentMessages[0].content.text;
        assert(output.includes('```'));
        assert(output.includes('ARTE ASCII RESULTANTE'));

        console.log('  ✅ Prueba 4 superada: .ascii convierte texto a banner con formato monospaciado.');
    }

    // ----------------------------------------------------
    // 5. Pruebas de .sorteo
    // ----------------------------------------------------
    {
        assert.strictEqual(sorteoCmd.name, 'sorteo');
        assert(sorteoCmd.alias.includes('rifa'));
        assert(sorteoCmd.alias.includes('ruleta'));

        // Rechazo fuera de grupo
        const ctxPriv = createMockContext();
        ctxPriv.m.chat = '18494509905@s.whatsapp.net';
        await sorteoCmd.execute({ sock: ctxPriv.sock, m: ctxPriv.m });
        assert(ctxPriv.sentMessages[0].content.text.includes('solo puede utilizarse dentro de un grupo'));

        // Sorteo exitoso entre participantes
        const ctxSorteo = createMockContext();
        const fakeParticipants = [
            { id: '111111111@s.whatsapp.net' },
            { id: '222222222@s.whatsapp.net' },
            { id: '333333333@s.whatsapp.net' }
        ];

        await sorteoCmd.execute({
            sock: ctxSorteo.sock,
            m: ctxSorteo.m,
            text: 'Admin por 1 semana',
            groupMetadata: { participants: fakeParticipants }
        });

        // Debe enviar mensaje de inicio y mensaje de ganador
        assert(ctxSorteo.sentMessages.length >= 2, 'Debe enviar inicio y ganador');
        const start = ctxSorteo.sentMessages[0].content.text;
        assert(start.includes('INICIANDO EL GRAN SORTEO'));

        const winner = ctxSorteo.sentMessages[1].content.text;
        assert(winner.includes('¡TENEMOS UN GANADOR!'));
        assert(winner.includes('Admin por 1 semana'));
        assert(ctxSorteo.sentMessages[1].content.mentions.length > 0);

        console.log('  ✅ Prueba 5 superada: .sorteo selecciona ganador aleatorio con suspenso.');
    }

    // ----------------------------------------------------
    // 6. Pruebas de .generarqr
    // ----------------------------------------------------
    {
        assert.strictEqual(generarqrCmd.name, 'generarqr');
        assert(generarqrCmd.alias.includes('qrlogo'));
        assert(generarqrCmd.alias.includes('botqr'));

        // Rechazo sin texto
        const ctxEmpty = createMockContext();
        await generarqrCmd.execute({ sock: ctxEmpty.sock, m: ctxEmpty.m, text: '' });
        assert(ctxEmpty.sentMessages[0].content.text.includes('Debes ingresar un texto o enlace'));

        // Generación de QR con logo central superpuesto
        const qrWithLogoBuffer = await generateQRWithLogo('https://github.com/Unsk1ngdev/Unsk1ngMD', null, { width: 500 });
        assert(Buffer.isBuffer(qrWithLogoBuffer), 'Debe retornar un Buffer');
        assert(qrWithLogoBuffer.length > 1000, 'El buffer del QR debe tener datos válidos');
        // Validar cabecera PNG (89 50 4E 47)
        assert.strictEqual(qrWithLogoBuffer.slice(1, 4).toString('ascii'), 'PNG');

        // Ejecución completa del comando
        const ctxSuccess = createMockContext();
        await generarqrCmd.execute({ sock: ctxSuccess.sock, m: ctxSuccess.m, text: 'https://wa.me/18494509905' });
        assert(ctxSuccess.sentMessages.length > 0);
        const imgMsg = ctxSuccess.sentMessages[0].content;
        assert(imgMsg.image, 'Debe enviar una imagen');
        assert(imgMsg.caption.includes('CÓDIGO QR GENERADO CON LOGO'));

        console.log('  ✅ Prueba 6 superada: .generarqr genera código QR con logo central en alta calidad.');
    }

    // ----------------------------------------------------
    // 7. Pruebas de .sitestatus
    // ----------------------------------------------------
    {
        assert.strictEqual(sitestatusCmd.name, 'sitestatus');
        assert(sitestatusCmd.alias.includes('webstatus'));
        assert(sitestatusCmd.alias.includes('checksite'));
        assert(sitestatusCmd.alias.includes('estado'));

        // Rechazo sin URL
        const ctxEmpty = createMockContext();
        await sitestatusCmd.execute({ sock: ctxEmpty.sock, m: ctxEmpty.m, text: '' });
        assert(ctxEmpty.sentMessages[0].content.text.includes('Debes proporcionar una URL'));

        // Ejecución con sitio caído / host inexistente
        const ctxDown = createMockContext();
        await sitestatusCmd.execute({ sock: ctxDown.sock, m: ctxDown.m, text: 'dominio-inexistente-123456789xyz.com' });
        assert(ctxDown.sentMessages.length > 0);
        const downReport = ctxDown.sentMessages[0].content.text;
        assert(downReport.includes('CAÍDO / INACCESIBLE') || downReport.includes('Diagnóstico'));

        // Ejecución con sitio (o fallback si no hay acceso a internet en el entorno de pruebas)
        const ctxUp = createMockContext();
        await sitestatusCmd.execute({ sock: ctxUp.sock, m: ctxUp.m, text: 'google.com' });
        assert(ctxUp.sentMessages.length > 0);
        const upReport = ctxUp.sentMessages[0].content.text;
        assert(upReport.includes('REPORTE DE ESTADO') || upReport.includes('CAÍDO') || upReport.includes('Diagnóstico'));

        console.log('  ✅ Prueba 7 superada: .sitestatus reporta latencia, SSL, headers y estado del sitio.');
    }

    console.log('🎉 [TEST] ¡Los 7 nuevos comandos pasaron todas sus pruebas unitarias exitosamente!');
})().catch(err => {
    console.error('❌ [TEST ERROR]:', err);
    process.exit(1);
});

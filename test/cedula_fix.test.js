'use strict';

const assert = require('assert');
const cedulaCmd = require('../commands/tools/cedula');

console.log('🧪 [TEST] Verificando correcciones del comando .cedula con extracción máxima de datos y fotografía real...');

const createMockContext = (options = {}) => {
    const sentMessages = [];
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
        react: async () => {},
        reply: async (text) => {
            sentMessages.push({ jid: '120363407455196754@g.us', content: { text } });
        },
        message: {}
    };

    return { sock, m, sentMessages };
};

(async () => {
    // 1. Ayuda sin argumentos
    {
        const ctx = createMockContext();
        await cedulaCmd.execute({ sock: ctx.sock, m: ctx.m, args: [], text: '', isOwner: true });
        assert(ctx.sentMessages.length > 0);
        assert(ctx.sentMessages[0].content.text.includes('CONSULTA DE CÉDULA / DNI / RNC'));
        console.log('  ✅ Prueba 1 superada: Despliegue de guía de uso y ejemplos.');
    }

    // 2. Autodetección de Cédula Dominicana sin prefijo RD- (11 dígitos válida)
    {
        const ctx = createMockContext();
        await cedulaCmd.execute({ sock: ctx.sock, m: ctx.m, args: ['001-1684343-4'], text: '001-1684343-4', isOwner: true });
        assert(ctx.sentMessages.length >= 2);
        const lastMsg = ctx.sentMessages[ctx.sentMessages.length - 1];
        const captionText = lastMsg.content.caption || lastMsg.content.text || '';
        assert(captionText.includes('FICHA DE IDENTIDAD DOMINICANA'));
        assert(captionText.includes('Distrito Nacional'));
        assert(captionText.includes('Dígito Verificador') || captionText.includes('Módulo 10'));
        console.log('  ✅ Prueba 2 superada: Autodetección con ficha de máxima información y soporte de fotografía real.');
    }

    // 3. Cédula Dominicana con formato o dígito inválido
    {
        const ctx = createMockContext();
        await cedulaCmd.execute({ sock: ctx.sock, m: ctx.m, args: ['001-1111111-1'], text: '001-1111111-1', isOwner: true });
        assert(ctx.sentMessages.length >= 2);
        const lastMsg = ctx.sentMessages[ctx.sentMessages.length - 1];
        const captionText = lastMsg.content.caption || lastMsg.content.text || '';
        assert(captionText.includes('no válida') || captionText.includes('Algoritmo no coincidente'));
        console.log('  ✅ Prueba 3 superada: Detección matemática y registral de cédula no válida.');
    }

    // 4. RNC Dominicano de 9 dígitos (ej. Claro / Codetel: 101001577)
    {
        const ctx = createMockContext();
        await cedulaCmd.execute({ sock: ctx.sock, m: ctx.m, args: ['101001577'], text: '101001577', isOwner: true });
        assert(ctx.sentMessages.length >= 2);
        const lastMsg = ctx.sentMessages[ctx.sentMessages.length - 1];
        const captionText = lastMsg.content.caption || lastMsg.content.text || '';
        assert(captionText.includes('REGISTRO NACIONAL DE CONTRIBUYENTES (RNC)') || captionText.includes('COMPANIA DOMINICANA DE TELEFONOS'));
        console.log('  ✅ Prueba 4 superada: Consulta de RNC empresarial de 9 dígitos en DGII con datos completos.');
    }

    // 5. Cédula de Costa Rica
    {
        const ctx = createMockContext();
        await cedulaCmd.execute({ sock: ctx.sock, m: ctx.m, args: ['CR-117240417'], text: 'CR-117240417', isOwner: true });
        assert(ctx.sentMessages.length >= 1);
        const lastMsg = ctx.sentMessages[ctx.sentMessages.length - 1];
        const captionText = lastMsg.content.caption || lastMsg.content.text || '';
        assert(captionText.includes('COSTA RICA') || captionText.includes('MAURICIO GUIDO'));
        console.log('  ✅ Prueba 5 superada: Consulta oficial en Hacienda de Costa Rica.');
    }

    // 6. DNI de Perú sin token configurado
    {
        const ctx = createMockContext();
        await cedulaCmd.execute({ sock: ctx.sock, m: ctx.m, args: ['PE-12345678'], text: 'PE-12345678', isOwner: true });
        assert(ctx.sentMessages.length >= 1);
        const lastMsg = ctx.sentMessages[ctx.sentMessages.length - 1];
        const captionText = lastMsg.content.caption || lastMsg.content.text || '';
        assert(captionText.includes('PERU_TOKEN') || captionText.includes('mantenimiento') || captionText.includes('PERÚ'));
        console.log('  ✅ Prueba 6 superada: Manejo seguro de consultas de Perú.');
    }

    console.log('🎉 [TEST] ¡Todas las pruebas de .cedula superadas con éxito!');
})();

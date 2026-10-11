'use strict';

const pdfParse = require('pdf-parse');

/**
 * Renderizador personalizado por página para estructurar el contenido,
 * detectar páginas ilustradas/gráficas y limpiar caracteres no imprimibles.
 */
const customPageRender = (pageData) => {
    const renderOptions = {
        normalizeWhitespace: true,
        disableCombineTextItems: false
    };

    return pageData.getTextContent(renderOptions)
        .then((textContent) => {
            let lastY, pageText = '';

            for (const item of textContent.items) {
                if (lastY === item.transform[5] || !lastY) {
                    pageText += item.str;
                } else {
                    pageText += '\n' + item.str;
                }
                lastY = item.transform[5];
            }

            const pageNum = (pageData.pageIndex || 0) + 1;
            // Limpieza de caracteres de control nulos o corruptos
            const sanitized = pageText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

            if (!sanitized) {
                return `\n\n════════════════════════════════\n📄 [ PÁGINA ${pageNum} — Ilustración / Imagen / Sin texto incrustado ]\n════════════════════════════════\n`;
            }

            return `\n\n════════════════════════════════\n📄 PÁGINA ${pageNum}\n════════════════════════════════\n${sanitized}\n`;
        })
        .catch(() => {
            const pageNum = (pageData.pageIndex || 0) + 1;
            return `\n\n════════════════════════════════\n📄 [ PÁGINA ${pageNum} — Gráfico no procesable ]\n════════════════════════════════\n`;
        });
};

module.exports = {
    name: 'pdf2txt',
    alias: ['pdftotxt', 'pdftexto', 'leerdft'],
    category: 'herramientas',
    desc: 'Convierte cualquier archivo PDF en un documento de texto (.txt) estructurado con todo su contenido',
    usage: '.pdf2txt (respondiendo a un PDF o adjunto)',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        const quoted = m.quoted;
        const msg = quoted ? quoted.message : m.message;
        const docMsg = quoted?.message?.documentMessage ||
                       m.message?.documentMessage ||
                       quoted?.message?.documentWithCaptionMessage?.message?.documentMessage ||
                       m.message?.documentWithCaptionMessage?.message?.documentMessage;

        const mimetype = docMsg?.mimetype || quoted?.mimetype || '';
        const isPdf = mimetype.includes('pdf') || (docMsg?.fileName && docMsg.fileName.toLowerCase().endsWith('.pdf'));

        if (!docMsg || !isPdf) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes responder a un PDF con *.pdf2txt*\n\n' +
                      '📄 Envía o responde a un documento PDF con este comando para convertirlo en archivo .txt.\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        await sock.sendMessage(jid, {
            text: '📄 Extrayendo texto y procesando páginas del PDF...\n🔄 Convirtiendo a archivo .txt estructurado...'
        }, { quoted: m });

        try {
            let buffer = null;
            if (quoted && typeof quoted.download === 'function') {
                buffer = await quoted.download();
            } else if (typeof m.download === 'function') {
                buffer = await m.download();
            }

            if (!buffer || buffer.length === 0) {
                throw new Error('No se pudo descargar el archivo PDF.');
            }

            // Procesar PDF con renderizador inteligente
            const options = {
                pagerender: customPageRender
            };

            const data = await pdfParse(buffer, options);
            const totalPaginas = data.numpages || 1;
            const originalName = docMsg?.fileName || 'documento.pdf';
            const outName = originalName.replace(/\.pdf$/i, '') + '.txt';

            const rawText = (data.text || '').replace(/\n{3,}/g, '\n\n').trim();
            const tieneImagenes = rawText.includes('Sin texto incrustado') || rawText.includes('Ilustración');

            // Encabezado estructurado con metadatos del documento
            const fechaHora = new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' });
            const docInfo = data.info || {};
            const tituloDoc = docInfo.Title ? `\n📌 Título original   : ${docInfo.Title}` : '';
            const autorDoc = docInfo.Author ? `\n👤 Autor              : ${docInfo.Author}` : '';

            const headerBanner =
                `╔══════════════════════════════════════════════════════════════╗\n` +
                `║              📄 TEXTO EXTRAÍDO DEL DOCUMENTO PDF             ║\n` +
                `╚══════════════════════════════════════════════════════════════╝\n` +
                `📁 Archivo Original : ${originalName}\n` +
                `📊 Total de Páginas : ${totalPaginas}` +
                `${tituloDoc}` +
                `${autorDoc}\n` +
                `📅 Fecha de Proceso : ${fechaHora}\n` +
                `🤖 Generado por     : Unknown Codexツ</>\n` +
                `════════════════════════════════════════════════════════════════\n`;

            const footerBanner =
                `\n\n════════════════════════════════════════════════════════════════\n` +
                `                   FIN DEL DOCUMENTO EXTRAÍDO\n` +
                `                     _Unknown Codexツ</>_\n` +
                `════════════════════════════════════════════════════════════════\n`;

            // Si el PDF no tiene texto legible (ej: 100% escaneado sin OCR)
            let contenidoFinal = '';
            if (!rawText || rawText.length === 0) {
                contenidoFinal = headerBanner +
                    `\n⚠️ AVISO: Este documento no contiene texto seleccionable incrustado.\n` +
                    `Es posible que esté compuesto únicamente por imágenes, gráficos o escaneos fotográficos sin capa de texto OCR.\n` +
                    footerBanner;
            } else {
                contenidoFinal = headerBanner + rawText + footerBanner;
            }

            const txtBuffer = Buffer.from(contenidoFinal, 'utf-8');

            await sock.sendMessage(jid, {
                document: txtBuffer,
                mimetype: 'text/plain; charset=utf-8',
                fileName: outName,
                caption: `📄 *PDF convertido a TXT exitosamente*\n\n` +
                         `📊 *Páginas:* ${totalPaginas}\n` +
                         `📝 *Caracteres:* ${contenidoFinal.length}\n` +
                         `📁 *Archivo:* ${outName}\n` +
                         `🖼️ *Contenido:* ${tieneImagenes ? 'Incluye páginas con imágenes/dibujos identificados' : 'Texto completo extraído'}\n\n` +
                         `_Unknown Codexツ</>_`
            }, { quoted: m });

        } catch (e) {
            console.error('[PDF2TXT] Error:', e.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al procesar el PDF.\n📋 ${e.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

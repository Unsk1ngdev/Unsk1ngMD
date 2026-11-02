'use strict';

const sharp = require('../../lib/sharp');
const logger = require('../../lib/logger');

function escapeXml(unsafe) {
    return (unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Parsea los ítems del recibo
 */
function parseItems(itemsRaw) {
    const items = [];
    const entries = itemsRaw.split(/[,;\n]/).map(e => e.trim()).filter(Boolean);

    for (const entry of entries) {
        // Ejemplos: "Camiseta x2 - 30", "Zapatos : 50", "Reloj $20", "2x Pizza = 25"
        const match = entry.match(/(.*?)(?:[-:=]|\$)\s*([\d.,]+)$/);
        if (match) {
            const desc = match[1].replace(/[-:=]/g, '').trim();
            const price = parseFloat(match[2].replace(',', '.'));
            if (desc && !isNaN(price)) {
                items.push({ desc, qty: 1, price });
                continue;
            }
        }
        // Fallback genérico
        items.push({ desc: entry.slice(0, 30), qty: 1, price: 10 });
    }

    return items.length > 0 ? items.slice(0, 8) : [{ desc: 'Servicio / Producto', qty: 1, price: 25 }];
}

/**
 * Genera el SVG del recibo y lo convierte a PNG con Sharp
 */
async function generateInvoicePng(clientName, items, sellerName) {
    const width = 850;
    const itemRowHeight = 45;
    const startY = 320;
    const baseHeight = 560;
    const height = baseHeight + (items.length * itemRowHeight);

    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const invoiceNum = 'INV-' + Math.floor(100000 + Math.random() * 900000);

    let subtotal = 0;
    let itemsSvg = '';

    items.forEach((item, idx) => {
        const itemTotal = item.qty * item.price;
        subtotal += itemTotal;
        const y = startY + (idx * itemRowHeight);
        const bgRow = idx % 2 === 0 ? '<rect x="40" y="' + (y - 25) + '" width="770" height="40" fill="#f8fafc" rx="4"/>' : '';

        itemsSvg += `
            ${bgRow}
            <text x="60" y="${y}" font-family="'Segoe UI', sans-serif" font-size="16" fill="#334155">${escapeXml(item.desc)}</text>
            <text x="490" y="${y}" font-family="'Segoe UI', sans-serif" font-size="16" fill="#64748b" text-anchor="middle">${item.qty}</text>
            <text x="620" y="${y}" font-family="'Segoe UI', sans-serif" font-size="16" fill="#64748b" text-anchor="end">$${item.price.toFixed(2)}</text>
            <text x="780" y="${y}" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="bold" fill="#0f172a" text-anchor="end">$${itemTotal.toFixed(2)}</text>
        `;
    });

    const tax = subtotal * 0.18; // ITBIS / Impuesto estándar 18%
    const total = subtotal + tax;

    const totalsY = startY + (items.length * itemRowHeight) + 30;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo general con bordes redondeados y sombra -->
        <rect width="100%" height="100%" fill="#ffffff" rx="16"/>
        <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#e2e8f0" stroke-width="2" rx="16"/>

        <!-- Cabecera moderna en color azul oscuro -->
        <path d="M 0 16 C 0 7.16 7.16 0 16 0 L ${width - 16} 0 C ${width - 7.16} 0 ${width} 7.16 ${width} 16 L ${width} 120 L 0 120 Z" fill="#0f172a"/>

        <!-- Título y Logotipo / Emblema -->
        <text x="50" y="55" font-family="'Segoe UI', sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="1">FACTURA / RECIBO</text>
        <text x="50" y="85" font-family="'Segoe UI', sans-serif" font-size="15" fill="#94a3b8">COMPROBANTE OFICIAL DE PAGO</text>

        <text x="${width - 50}" y="55" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="bold" fill="#38bdf8" text-anchor="end">${escapeXml(invoiceNum)}</text>
        <text x="${width - 50}" y="85" font-family="'Segoe UI', sans-serif" font-size="14" fill="#94a3b8" text-anchor="end">Fecha: ${escapeXml(dateStr)}</text>

        <!-- Bloque de Información del Cliente y Vendedor -->
        <rect x="40" y="145" width="370" height="100" fill="#f1f5f9" rx="8"/>
        <text x="60" y="175" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#64748b">FACTURADO A:</text>
        <text x="60" y="202" font-family="'Segoe UI', sans-serif" font-size="19" font-weight="bold" fill="#0f172a">${escapeXml(clientName)}</text>
        <text x="60" y="225" font-family="'Segoe UI', sans-serif" font-size="13" fill="#64748b">Cliente verificado de WhatsApp</text>

        <rect x="440" y="145" width="370" height="100" fill="#f1f5f9" rx="8"/>
        <text x="460" y="175" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#64748b">EMITIDO POR:</text>
        <text x="460" y="202" font-family="'Segoe UI', sans-serif" font-size="19" font-weight="bold" fill="#0f172a">${escapeXml(sellerName)}</text>
        <text x="460" y="225" font-family="'Segoe UI', sans-serif" font-size="13" fill="#64748b">Estado: Pagado en su totalidad ✅</text>

        <!-- Encabezado de la Tabla de Productos -->
        <rect x="40" y="265" width="770" height="35" fill="#1e293b" rx="6"/>
        <text x="60" y="288" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#f8fafc">DESCRIPCIÓN DEL ARTÍCULO</text>
        <text x="490" y="288" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#f8fafc" text-anchor="middle">CANT</text>
        <text x="620" y="288" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#f8fafc" text-anchor="end">PRECIO</text>
        <text x="780" y="288" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#f8fafc" text-anchor="end">TOTAL</text>

        <!-- Filas de Artículos -->
        ${itemsSvg}

        <!-- Línea divisoria antes de totales -->
        <line x1="40" y1="${totalsY - 10}" x2="810" y2="${totalsY - 10}" stroke="#cbd5e1" stroke-width="1.5"/>

        <!-- Resumen de Totales -->
        <text x="550" y="${totalsY + 20}" font-family="'Segoe UI', sans-serif" font-size="16" fill="#64748b">Subtotal:</text>
        <text x="780" y="${totalsY + 20}" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="bold" fill="#0f172a" text-anchor="end">$${subtotal.toFixed(2)}</text>

        <text x="550" y="${totalsY + 50}" font-family="'Segoe UI', sans-serif" font-size="16" fill="#64748b">Impuesto (ITBIS 18%):</text>
        <text x="780" y="${totalsY + 50}" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="bold" fill="#0f172a" text-anchor="end">$${tax.toFixed(2)}</text>

        <!-- Bloque de Total Destacado -->
        <rect x="520" y="${totalsY + 75}" width="290" height="55" fill="#0f172a" rx="8"/>
        <text x="540" y="${totalsY + 110}" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="bold" fill="#ffffff">TOTAL FINAL:</text>
        <text x="790" y="${totalsY + 112}" font-family="'Segoe UI', sans-serif" font-size="24" font-weight="900" fill="#38bdf8" text-anchor="end">$${total.toFixed(2)}</text>

        <!-- Sello de Pagado -->
        <g transform="translate(100, ${totalsY + 30}) rotate(-12)">
            <rect x="0" y="0" width="160" height="50" rx="8" fill="none" stroke="#16a34a" stroke-width="3" stroke-dasharray="6,3"/>
            <text x="80" y="33" font-family="'Segoe UI', sans-serif" font-size="22" font-weight="900" fill="#16a34a" text-anchor="middle" letter-spacing="2">PAGADO</text>
        </g>

        <!-- Pie de página -->
        <text x="${width / 2}" y="${height - 25}" font-family="'Segoe UI', sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">¡Muchas gracias por su preferencia! Documento generado automáticamente vía WhatsApp.</text>
    </svg>`;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = {
    name: 'invoicemaker',
    alias: ['factura', 'recibo', 'invoice', 'comprobante', 'ticket'],
    category: 'herramientas',
    desc: 'Genera una imagen profesional de factura o recibo de compra con desglose de ítems, impuestos y sello de pagado',
    usage: '.invoicemaker <Nombre del Cliente> | <Producto 1 - Precio>, <Producto 2 - Precio>',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const input = (args && args.length > 0 ? args.join(' ') : (text || '')).trim();

        if (!input) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🧾 CREADOR DE FACTURAS Y RECIBOS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.invoicemaker <Cliente> | <Artículos con precio>`',
                    '┃├◆ 📌 *Ejemplo 1:*',
                    '┃   `.invoicemaker Carlos Santana | Zapatillas Nike - 65, Camiseta Polo - 25`',
                    '┃',
                    '┃├◆ 📌 *Ejemplo 2:*',
                    '┃   `.invoicemaker Laura Diaz | Pizza Familiar - 20, Refresco 2L - 4, Delivery - 3`',
                    '┃',
                    '┃├◆ 💼 Genera una imagen PNG nítida con numeración de factura,',
                    '┃  desglose de ítems, cálculo de ITBIS/impuestos y sello oficial.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('🧾');

        let clientName = 'Cliente';
        let itemsString = input;

        if (input.includes('|')) {
            const parts = input.split('|');
            clientName = parts[0].trim() || 'Cliente';
            itemsString = parts.slice(1).join('|').trim();
        }

        const items = parseItems(itemsString);
        const sellerName = m.pushName || 'Tienda / Comercio Virtual';

        try {
            const invoiceBuffer = await generateInvoicePng(clientName, items, sellerName);

            await sock.sendMessage(jid, {
                image: invoiceBuffer,
                caption: `🧾 *Recibo generado exitosamente para ${clientName}*\n_Unknown Codexツ</>_`
            }, { quoted: m });

            await m.react?.('✅');

        } catch (err) {
            logger.error('[INVOICE ERROR]:', err.message);
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ Error al generar la factura: ${err.message}`
            }, { quoted: m });
        }
    }
};


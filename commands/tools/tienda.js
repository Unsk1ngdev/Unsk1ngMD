'use strict';

const economy = require('../../lib/economy');
const userNames = require('../../lib/userNames');

module.exports = [
    {
        name: 'tienda',
        alias: ['shop', 'store', 'mercado'],
        category: 'juegos',
        desc: 'Muestra el catálogo oficial de la tienda con artículos, mejoras y títulos',
        usage: '.tienda',

        execute: async ({ sock, m }) => {
            const chatId = m.chat || m.key.remoteJid;
            const sender = m.sender;
            const user = economy.getUser(sender);
            const userRank = economy.getUserRank(sender);

            const totalMoney = (user.monedas || 0) + (user.banco || 0);

            let catalogo =
                `🛍️ *TIENDA OFICIAL - UNSK1NGMD* 🛍️\n\n` +
                `👤 *Usuario:* @${sender.split('@')[0]}\n` +
                `🎖️ *Rango:* ${userRank.nombre}\n` +
                `💵 *En mano:* $${economy.formatNumber(user.monedas)}\n` +
                `🏦 *En banco:* $${economy.formatNumber(user.banco)}\n` +
                `💰 *Total disponible:* $${economy.formatNumber(totalMoney)}\n\n` +
                `═══════════════════════════\n` +
                `👑 *CATEGORÍA 1: PERSONALIZACIÓN Y STATUS*\n` +
                `═══════════════════════════\n\n` +
                `🏷️ *1. Título Personalizado:* \`titulo <texto>\`\n` +
                `   💵 *Precio:* $5,000 monedas\n` +
                `   📝 *Efecto:* Muestra un título exclusivo en tu perfil y ranking.\n` +
                `   👉 *Uso:* \`.comprar titulo Rey Supremo\`\n\n` +
                `💎 *2. Pase VIP / Premium:* \`vip\`\n` +
                `   💵 *Precio:* $25,000 monedas\n` +
                `   📝 *Efecto:* Membresía Premium del bot con acceso exclusivo.\n` +
                `   👉 *Uso:* \`.comprar vip\`\n\n` +
                `═══════════════════════════\n` +
                `⚔️ *CATEGORÍA 2: EQUIPAMIENTO RPG Y COMBATE*\n` +
                `═══════════════════════════\n\n` +
                `⚔️ *3. Espada de Batalla:* \`espada\`\n` +
                `   💵 *Precio:* $3,000 monedas\n` +
                `   📝 *Efecto:* +30 puntos de Ataque permanente para .duelo.\n` +
                `   👉 *Uso:* \`.comprar espada\`\n\n` +
                `🛡️ *4. Escudo Blindado:* \`escudo\`\n` +
                `   💵 *Precio:* $2,500 monedas\n` +
                `   📝 *Efecto:* +25 puntos de Defensa permanente para .duelo.\n` +
                `   👉 *Uso:* \`.comprar escudo\`\n\n` +
                `🧪 *5. Poción de Experiencia:* \`pocion\`\n` +
                `   💵 *Precio:* $3,500 monedas\n` +
                `   📝 *Efecto:* +400 EXP instantánea para subir de nivel y rango.\n` +
                `   👉 *Uso:* \`.comprar pocion\`\n\n` +
                `═══════════════════════════\n` +
                `🔒 *CATEGORÍA 3: SEGURIDAD Y PROTECCIÓN*\n` +
                `═══════════════════════════\n\n` +
                `🔒 *6. Seguro Anti-Robo:* \`seguro\`\n` +
                `   💵 *Precio:* $2,000 monedas\n` +
                `   📝 *Efecto:* Protege tu dinero en mano contra .robar por 24 horas.\n` +
                `   👉 *Uso:* \`.comprar seguro\`\n\n` +
                `💡 _Escribe *.comprar <articulo>* para adquirir lo que desees._\n` +
                `_Puedes pagar combinando tu dinero en mano y en banco automáticamente._`;

            await sock.sendMessage(chatId, {
                text: catalogo,
                mentions: [sender]
            }, { quoted: m });
        }
    },
    {
        name: 'comprar',
        alias: ['buy', 'adquirir'],
        category: 'juegos',
        desc: 'Compra un artículo del catálogo oficial de la tienda',
        usage: '.comprar <articulo> [parametro]',

        execute: async ({ sock, m, args }) => {
            const chatId = m.chat || m.key.remoteJid;
            const sender = m.sender;

            if (!args || args.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: '⚠️ Debes indicar qué artículo deseas comprar.\n\n' +
                          '🛒 *Ejemplos:*\n' +
                          '• `.comprar espada`\n' +
                          '• `.comprar escudo`\n' +
                          '• `.comprar pocion`\n' +
                          '• `.comprar seguro`\n' +
                          '• `.comprar vip`\n' +
                          '• `.comprar titulo Don Juan`\n\n' +
                          '👉 Escribe *.tienda* para consultar todo el catálogo.'
                }, { quoted: m });
            }

            const itemKey = args[0].toLowerCase().trim();
            const extraParam = args.slice(1).join(' ').trim();

            const res = economy.buyStoreItem(sender, itemKey, extraParam);

            if (!res.success) {
                return await sock.sendMessage(chatId, {
                    text: `❌ *Error en la compra:*\n${res.error}`
                }, { quoted: m });
            }

            const userRank = economy.getUserRank(sender);
            const comprobante =
                `🛍️ *¡COMPRA REALIZADA CON ÉXITO!* 🛍️\n\n` +
                `📦 *Artículo:* ${res.item.nombre}\n` +
                `💵 *Costo deducido:* $${economy.formatNumber(res.item.precio)} monedas\n` +
                `✨ *Efecto aplicado:* ${res.detalleEspecial}\n` +
                `🎖️ *Tu rango actual:* ${userRank.nombre}\n\n` +
                `📊 *Tus saldos actualizados:*\n` +
                `• *En mano:* $${economy.formatNumber(res.saldoMano)}\n` +
                `• *En banco:* $${economy.formatNumber(res.saldoBanco)}\n\n` +
                `_¡Gracias por comprar en la tienda de Unsk1ngMD!_`;

            await sock.sendMessage(chatId, {
                text: comprobante,
                mentions: [sender]
            }, { quoted: m });
        }
    }
];


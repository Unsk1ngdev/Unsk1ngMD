const axios = require('axios');

const CRYPTO_ALIASES = {
    'btc': 'bitcoin',
    'eth': 'ethereum',
    'sol': 'solana',
    'bnb': 'binancecoin',
    'xrp': 'ripple',
    'ada': 'cardano',
    'doge': 'dogecoin',
    'dot': 'polkadot',
    'matic': 'matic-network',
    'ltc': 'litecoin',
    'trx': 'tron',
    'avax': 'avalanche-2',
    'link': 'chainlink'
};

module.exports = {
    name: 'crypto',
    alias: ['cripto', 'btc', 'eth'],
    category: 'herramientas',
    desc: 'Consulta el precio actual y variación en 24h de cualquier criptomoneda vía CoinGecko',
    usage: '.crypto [bitcoin / btc / eth / sol]',
    execute: async ({ sock, m, args }) => {
        let coin = (args[0] || 'bitcoin').toLowerCase();
        if (CRYPTO_ALIASES[coin]) {
            coin = CRYPTO_ALIASES[coin];
        }

        await m.react('📈');

        try {
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=usd,eur&include_24hr_change=true`;
            const response = await axios.get(url, {
                timeout: 15000,
                headers: { 'Accept': 'application/json' }
            });

            const data = response.data[coin];
            if (!data) {
                return await m.reply(`❌ No se encontró la criptomoneda "${coin}". Intenta con su nombre en inglés o sigla (ej: btc, eth, sol, doge).`);
            }

            const usdPrice = Number(data.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
            const eurPrice = Number(data.eur).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
            const change24h = data.usd_24h_change ? data.usd_24h_change.toFixed(2) : '0.00';
            const changeEmoji = Number(change24h) >= 0 ? '🟢' : '🔴';

            const reply = `🪙 *Criptomoneda: ${coin.toUpperCase()}*\n\n` +
                `💵 *USD:* $${usdPrice}\n` +
                `💶 *EUR:* €${eurPrice}\n` +
                `${changeEmoji} *Variación 24h:* ${change24h}%`;

            await m.reply(reply);
            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error consultando precio crypto: ${err.message}`);
        }
    }
};


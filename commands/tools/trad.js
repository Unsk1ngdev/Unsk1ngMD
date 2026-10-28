const axios = require('axios');

module.exports = {
    name: 'trad',
    alias: ['translate', 'traductor', 'trt', 'tr'],
    category: 'herramientas',
    desc: 'Traduce texto a cualquier idioma (ej: en, es, fr, de, it, pt, ja)',
    usage: '.trad [idioma_destino] [texto o citando un mensaje]',
    execute: async ({ sock, m, args, text }) => {
        let targetLang = 'es';
        let textToTranslate = '';

        if (args.length > 0 && args[0].length <= 5) {
            targetLang = args[0].toLowerCase();
            textToTranslate = args.slice(1).join(' ');
        } else {
            textToTranslate = text;
        }

        if (!textToTranslate && m.quoted?.body) {
            textToTranslate = m.quoted.body;
        }

        if (!textToTranslate) {
            return await m.reply('❌ Proporciona el texto o cita el mensaje a traducir.\nEjemplo: *.trad en Hola amigo cómo estás*');
        }

        await m.react('🌐');

        try {
            // API pública de MyMemory Translation
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=autodetect|${targetLang}`;
            const response = await axios.get(url, { timeout: 15000 });

            const translated = response.data?.responseData?.translatedText;
            if (!translated) {
                throw new Error('No se pudo traducir el texto proporcionado.');
            }

            await m.reply(`🌐 *Traducción [${targetLang.toUpperCase()}]:*\n\n${translated}`);
            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error en la traducción: ${err.message}`);
        }
    }
};


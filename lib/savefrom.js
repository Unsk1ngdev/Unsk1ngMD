const axios = require('axios');
const crypto = require('crypto');
const vm = require('vm');

const HASH_SALT = 'b7944d7a59c9cb654228624880e7de59a53842c2d912b449fdf11febcf81cb21';

function generateHash(url) {
    return crypto.createHash('sha256').update(url + Date.now() + HASH_SALT).digest('hex');
}

/**
 * Extrae enlaces directos de descarga para YouTube, Instagram, X/Twitter y más usando SaveFrom
 * @param {string} url - URL del contenido
 * @param {number} timeout - Timeout en ms (default 15000)
 */
async function savefrom(url, timeout = 15000) {
    const postData = new URLSearchParams({
        sf_url: url,
        sf_submit: '',
        new: '2',
        lang: 'en',
        app: '',
        country: 'en',
        os: 'Windows',
        browser: 'Chrome',
        channel: 'main',
        'sf-nomad': '1',
        url: url,
        ts: Date.now(),
        _ts: 1720433117117,
        _tsc: 0,
        _s: generateHash(url),
        _x: 1
    }).toString();

    const response = await axios.post('https://worker.savefrom.net/savefrom.php', postData, {
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://en.savefrom.net',
            'referer': 'https://en.savefrom.net/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: timeout
    });

    const scriptData = response.data;
    if (!scriptData || typeof scriptData !== 'string') {
        throw new Error('Respuesta inválida de SaveFrom');
    }

    const locationObj = {
        hostname: 'en.savefrom.net',
        href: 'https://en.savefrom.net/',
        protocol: 'https:',
        host: 'en.savefrom.net'
    };

    const dummyBody = {
        firstChild: null,
        removeChild: () => {},
        appendChild: () => {}
    };

    const dummyDoc = {
        location: locationObj,
        body: dummyBody,
        getElementById: () => null,
        getElementsByTagName: () => [],
        createElement: () => ({ appendChild: () => {}, style: {} })
    };

    const context = {
        results: null,
        parent: {
            document: dummyDoc,
            location: locationObj,
            sf: {
                videoResult: {
                    show: (data) => {
                        context.results = JSON.stringify([data]);
                    },
                    showRows: (data) => {
                        context.results = JSON.stringify(data);
                    }
                },
                enableElement: () => {}
            }
        },
        document: dummyDoc,
        location: locationObj,
        frameElement: {},
        atob: (b) => Buffer.from(b, 'base64').toString(),
        _decodeURIComponent: (uri) => {
            const decoded = decodeURIComponent(uri);
            if (/showResult/.test(decoded) || /videoResult/.test(decoded)) {
                context.results = decoded;
                return 'true';
            }
            return decoded;
        }
    };
    context.window = context;

    vm.createContext(context);
    new vm.Script('decodeURIComponent=_decodeURIComponent;' + scriptData).runInContext(context);

    if (!context.results) {
        throw new Error('No se encontraron resultados en la evaluación de SaveFrom.');
    }

    // Si ya fue capturado en JSON
    if (typeof context.results === 'string' && context.results.startsWith('[')) {
        return JSON.parse(context.results);
    }

    const executed = (context.results.split('window.parent.sf.videoResult.show(')?.[1])
        || (context.results.split('window.parent.sf.videoResult.showRows(')?.[1]);

    if (!executed) {
        throw new Error('No se pudo extraer el bloque de datos de SaveFrom.');
    }

    let json = null;
    if (context.results.includes('showRows')) {
        const splits = executed.split('],"');
        const lastIndex = splits.findIndex(v => v.includes('window.parent.sf.enableElement'));
        json = JSON.parse(splits.slice(0, lastIndex).join('],"') + ']');
    } else {
        json = [JSON.parse(executed.split(');')[0])];
    }

    return json;
}

module.exports = {
    savefrom
};


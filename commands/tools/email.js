'use strict';

const axios = require('axios');
const dns = require('dns').promises;
const logger = require('../../lib/logger');

// Lista ampliada de dominios de correos temporales / desechables
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    '10minutemail.com', '10minutemail.net', '10minmail.com', 'tempmail.com', 'temp-mail.org',
    'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
    'sharklasers.com', 'grr.la', 'mailinator.com', 'mailinater.com', 'throwawaymail.com',
    'yopmail.com', 'yopmail.fr', 'yopmail.net', 'trashmail.com', 'trashmail.net',
    'dispostable.com', 'maildrop.cc', 'getairmail.com', 'mohmal.com', 'fakemailgenerator.com',
    'crazymailing.com', 'generator.email', 'emailondeck.com', 'mytemp.email', 'minuteinbox.com',
    'inboxkitten.com', 'burnermail.io', 'nada.ltd', 'dropmail.me', 'tempmailaddress.com',
    'guerrillamail.biz', 'guerrillamail.info', 'pokemail.net', 'spam4.me', 'bccto.me'
]);

async function queryDoH(name, type) {
    try {
        const res = await axios.get(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, { timeout: 4000 });
        if (res.data?.Answer) return res.data.Answer;
    } catch (_) {}
    try {
        const res = await axios.get(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
            headers: { 'Accept': 'application/dns-json' },
            timeout: 4000
        });
        if (res.data?.Answer) return res.data.Answer;
    } catch (_) {}
    return [];
}

async function queryMX(domain) {
    try {
        const mxList = await dns.resolveMx(domain);
        if (mxList && mxList.length > 0) {
            return mxList.sort((a, b) => a.priority - b.priority).map(m => m.exchange);
        }
    } catch (_) {}
    const dohAnswers = await queryDoH(domain, 'MX');
    return dohAnswers.map(a => a.data?.split(' ').slice(1).join(' ').replace(/\.$/, '') || a.data).filter(Boolean);
}

async function queryTxt(name) {
    try {
        const list = await dns.resolveTxt(name);
        if (Array.isArray(list)) return list.map(chunk => chunk.join(''));
    } catch (_) {}
    const dohAnswers = await queryDoH(name, 'TXT');
    return dohAnswers.map(a => (a.data || '').replace(/^"(.*)"$/, '$1')).filter(Boolean);
}

function detectProvider(domain, mxList = []) {
    const d = (domain || '').toLowerCase();
    const mxStr = (mxList || []).join(' ').toLowerCase();

    if (d === 'gmail.com' || d === 'googlemail.com' || mxStr.includes('google.com') || mxStr.includes('googlemail.com')) {
        return { name: 'Google Workspace / Gmail', icon: '🔴' };
    }
    if (d === 'outlook.com' || d === 'hotmail.com' || d === 'live.com' || d === 'msn.com' || mxStr.includes('outlook.com') || mxStr.includes('protection.outlook.com')) {
        return { name: 'Microsoft 365 / Outlook', icon: '🟦' };
    }
    if (d === 'proton.me' || d === 'protonmail.com' || d === 'pm.me' || mxStr.includes('protonmail.ch')) {
        return { name: 'Proton Mail (Cifrado E2E)', icon: '🟣' };
    }
    if (d === 'icloud.com' || d === 'me.com' || d === 'mac.com' || mxStr.includes('icloud.com')) {
        return { name: 'Apple iCloud Mail', icon: '🍏' };
    }
    if (d === 'yahoo.com' || d === 'ymail.com' || mxStr.includes('yahoodns.net')) {
        return { name: 'Yahoo! Mail', icon: '🟣' };
    }
    if (d === 'zoho.com' || mxStr.includes('zoho.com')) {
        return { name: 'Zoho Mail', icon: '🟡' };
    }
    if (d === 'tuta.com' || d === 'tutanota.com' || mxStr.includes('tutanota.de')) {
        return { name: 'Tuta Mail (Cifrado E2E)', icon: '🔴' };
    }
    return { name: 'Servidor Privado / Corporativo', icon: '🏢' };
}

function checkDisposable(domain) {
    if (!domain) return false;
    const d = domain.toLowerCase();
    if (DISPOSABLE_EMAIL_DOMAINS.has(d)) return true;
    return /temp|throwaway|dispos|guerrilla|10min|fakeinbox|trashmail|burnermail|fakemail/i.test(d);
}

async function checkBreaches(email) {
    const hibpKey = (process.env.HIBP_KEY || '').trim();

    // 1. Si hay clave HIBP, consultar HaveIBeenPwned oficial
    if (hibpKey) {
        try {
            const res = await axios.get(
                `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
                {
                    headers: { 'hibp-api-key': hibpKey, 'user-agent': 'Unsk1ngMD-Bot' },
                    timeout: 7000
                }
            );
            const breaches = Array.isArray(res.data) ? res.data : [];
            return {
                source: 'HaveIBeenPwned',
                pwned: breaches.length > 0,
                breaches: breaches.map(b => ({
                    name: b.Name || b.Title || 'Brecha',
                    date: b.BreachDate || 'N/A',
                    data: (b.DataClasses || []).slice(0, 4).join(', ')
                }))
            };
        } catch (err) {
            if (err.response?.status === 404) {
                return { source: 'HaveIBeenPwned', pwned: false, breaches: [] };
            }
        }
    }

    // 2. Consulta a XposedOrNot (Motor OSINT gratuito y público sin requerir API key)
    try {
        const res = await axios.get(
            `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`,
            {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 6000,
                validateStatus: (s) => s < 500
            }
        );

        if (res.data && res.data.breaches && Array.isArray(res.data.breaches[0])) {
            const names = res.data.breaches[0];
            return {
                source: 'XposedOrNot OSINT',
                pwned: names.length > 0,
                breaches: names.map(n => ({ name: n, date: 'Filtrado', data: 'Credenciales / Perfil' }))
            };
        }
        return { source: 'XposedOrNot OSINT', pwned: false, breaches: [] };
    } catch (_) {
        return { source: 'Desconectado', pwned: false, breaches: [], error: 'No se pudo contactar el servidor de brechas.' };
    }
}

module.exports = {
    name: 'email',
    alias: ['mail', 'checkmail', 'pwned', 'breach'],
    category: 'tools',
    desc: 'Verifica la validez, proveedor, seguridad DNS y filtraciones públicas de un correo electrónico',
    usage: '.email <correo@ejemplo.com>',

    execute: async ({ sock, m, args }) => {
        const query = (args[0] || '').toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!query || !emailRegex.test(query)) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Debes ingresar un correo electrónico válido.\n\n*Ejemplo:* `.email usuario@gmail.com`'
            }, { quoted: m });
        }

        await m.react?.('🔍');
        await sock.sendMessage(m.chat, { text: `🔍 Investigando correo *${query}*...` }, { quoted: m });

        const [localPart, domain] = query.split('@');

        const [mxList, txtRecords, dmarcRecords, breachData] = await Promise.all([
            queryMX(domain),
            queryTxt(domain),
            queryTxt(`_dmarc.${domain}`),
            checkBreaches(query)
        ]);

        const hasMX = mxList.length > 0;
        const provider = detectProvider(domain, mxList);
        const isDisposable = checkDisposable(domain);

        const spfTxt = txtRecords.find(t => t.toLowerCase().startsWith('v=spf1'));
        const dmarcTxt = dmarcRecords.find(t => t.toLowerCase().startsWith('v=dmarc1'));

        let breachSection = '';
        if (breachData.pwned) {
            const total = breachData.breaches.length;
            const top = breachData.breaches.slice(0, 6).map(b => {
                return `  • 🚨 *${b.name}* (${b.date})\n    _Datos expuestos:_ ${b.data}`;
            }).join('\n');
            const more = total > 6 ? `\n  _...y ${total - 6} filtraciones más_` : '';
            breachSection = `🚨 *¡ALERTA DE FILTRACIÓN! (${total} brechas encontradas):*\n${top}${more}\n\n⚠️ _Se recomienda cambiar la contraseña de inmediato y activar 2FA._`;
        } else {
            breachSection =
                `✅ *Sin filtraciones públicas detectadas.*\n` +
                `🛡️ No figura en bases de datos de brechas conocidas (${breachData.source}).`;
        }

        const report = [
            '╭━━━━〔 📧 *EMAIL AUDIT & OSINT* 〕━━━━⬣',
            '┃',
            `┃ 📬 *Correo:* \`${query}\``,
            `┃ 👤 *Buzón:* \`${localPart}\``,
            `┃ 🌐 *Dominio:* \`${domain}\``,
            `┃ ${provider.icon} *Proveedor:* ${provider.name}`,
            `┃ 📦 *Tipo:* ${isDisposable ? '⚠️ Desechable / Temporal (Alto Riesgo)' : '✅ Legítimo / Persistente'}`,
            '┃',
            '┃ 📨 ═〔 *ENTREGABILIDAD Y SERVIDORES* 〕═',
            `┃ 📬 *Servidores MX:* ${hasMX ? `Sí (${mxList.length} activos)` : '❌ Sin MX (No recibe correos)'}`,
            hasMX ? `┃    ↳ _Servidor principal:_ \`${mxList[0]}\`` : '',
            `┃ 🛡️ *Registro SPF:* ${spfTxt ? '✅ Configurado' : '⚠️ No configurado'}`,
            `┃ 🔐 *Registro DMARC:* ${dmarcTxt ? '✅ Configurado' : '⚠️ No configurado'}`,
            '┃',
            '┃ 🛡️ ═〔 *HISTORIAL DE BRECHAS* 〕═',
            `┃ ${breachSection.split('\n').join('\n┃ ')}`,
            '┃',
            '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣',
            '',
            '_Unknown Codexツ</>_'
        ].filter(Boolean).join('\n');

        await m.react?.('✅');
        await sock.sendMessage(m.chat, { text: report }, { quoted: m });
    }
};


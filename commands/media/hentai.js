'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const nsfwManager = require('../../lib/nsfw');
const config = require('../../config');

/**
 * Obtiene la API Key de Groq si está disponible para resolución inteligente
 */
function getGroqApiKey() {
    let key = (process.env.GROQ_API_KEY || config.groqApiKey || '').trim();
    if (!key) {
        try {
            const envPath = path.resolve(__dirname, '../../.env');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const mKey = envContent.match(/^GROQ_API_KEY=(.*)$/m);
                if (mKey) key = mKey[1].trim();
            }
        } catch (_) {}
    }
    return key;
}

/**
 * Diccionario de tags canónicos de waifus y personajes de anime para Boorus
 */
const WAIFU_TAG_MAP = {
    // Re:Zero
    'rem': ['rem_(re_zero)', 'rem_(re:zero)', 'rem'],
    'ram': ['ram_(re_zero)', 'ram_(re:zero)', 'ram'],
    'emilia': ['emilia_(re_zero)', 'emilia_(re:zero)', 'emilia'],
    'echidna': ['echidna_(re_zero)', 'echidna'],
    'beatrice': ['beatrice_(re_zero)', 'beatrice'],
    // Naruto / Boruto
    'tsunade': ['tsunade', 'tsunade_(naruto)'],
    'hinata': ['hyuuga_hinata', 'hinata_hyuga', 'hinata'],
    'sakura': ['haruno_sakura', 'sakura_haruno'],
    'ino': ['yamanaka_ino', 'ino_yamanaka'],
    'temari': ['temari_(naruto)', 'temari'],
    'kushina': ['uzumaki_kushina', 'kushina'],
    'mei': ['terumi_mei', 'mei_terumi'],
    'konan': ['konan_(naruto)', 'konan'],
    'sarada': ['uchiha_sarada', 'sarada'],
    // One Piece
    'nami': ['nami_(one_piece)', 'nami'],
    'robin': ['nico_robin', 'robin_(one_piece)'],
    'hancock': ['boa_hancock', 'hancock'],
    'yamato': ['yamato_(one_piece)', 'yamato'],
    'reiju': ['vinsmoke_reiju', 'reiju'],
    'vivi': ['nefertari_vivi', 'vivi_(one_piece)'],
    'perona': ['perona_(one_piece)', 'perona'],
    'uta': ['uta_(one_piece)', 'uta'],
    'carrot': ['carrot_(one_piece)', 'carrot'],
    // Sword Art Online
    'asuna': ['asuna_(sword_art_online)', 'yuuki_asuna', 'asuna'],
    'sinon': ['sinon', 'asada_shino'],
    'leafa': ['leafa', 'kirigaya_suguha'],
    'alice': ['alice_zuberg', 'alice_synthesis_thirty'],
    // Bleach
    'yoruichi': ['shihouin_yoruichi', 'yoruichi'],
    'rangiku': ['matsumoto_rangiku', 'rangiku'],
    'orihime': ['inoue_orihime', 'orihime'],
    'rukia': ['kuchiki_rukia', 'rukia'],
    'nel': ['nelliel_tu_odelschwanck', 'nel_tu'],
    'halibel': ['tier_halibel', 'harribel'],
    // Dragon Ball
    'bulma': ['bulma', 'bulma_briefs'],
    '18': ['android_18', 'c18', 'lazuli'],
    'androide 18': ['android_18', 'c18'],
    'videl': ['videl', 'videl_satan'],
    'chichi': ['chichi_(dragon_ball)', 'chichi'],
    'marcarita': ['marcarita_(dragon_ball)'],
    'caulifla': ['caulifla'],
    'kale': ['kale_(dragon_ball)'],
    // Demon Slayer (Kimetsu no Yaiba)
    'nezuko': ['kamado_nezuko', 'nezuko_kamado', 'nezuko'],
    'shinobu': ['kochou_shinobu', 'shinobu_kocho'],
    'mitsuri': ['kanroji_mitsuri', 'mitsuri_kanroji'],
    'kanae': ['kochou_kanae', 'kanae'],
    'kanao': ['tsuyuri_kanao', 'kanao'],
    'daki': ['daki_(kimetsu_no_yaiba)', 'daki'],
    // Spy x Family
    'yor': ['yor_briar', 'yor_forger'],
    'yor forger': ['yor_briar', 'yor_forger'],
    // Chainsaw Man
    'makima': ['makima_(chainsaw_man)', 'makima'],
    'power': ['power_(chainsaw_man)', 'power'],
    'reze': ['reze_(chainsaw_man)', 'reze'],
    'himeno': ['himeno_(chainsaw_man)', 'himeno'],
    'kobeni': ['higashiyama_kobeni', 'kobeni'],
    // Jujutsu Kaisen
    'nobara': ['kugisaki_nobara', 'nobara'],
    'maki': ['zenin_maki', 'maki_zenin'],
    'mei mei': ['mei_mei_(jujutsu_kaisen)', 'mei_mei'],
    'miwa': ['kasumi_miwa', 'miwa'],
    'shoko': ['ieiri_shoko', 'shoko'],
    // My Dress-Up Darling
    'marin': ['kitagawa_marin', 'marin_kitagawa', 'marin'],
    // Darling in the Franxx
    'zero two': ['zero_two_(darling_in_the_franxx)', 'zero_two'],
    '02': ['zero_two_(darling_in_the_franxx)', 'zero_two'],
    // High School DxD
    'rias': ['rias_gremory', 'rias'],
    'akeno': ['himejima_akeno', 'akeno_himejima', 'akeno'],
    'koneko': ['toujou_koneko', 'koneko'],
    'xenovia': ['xenovia_quarta', 'xenovia'],
    'asia': ['asia_argento', 'asia'],
    'kuroka': ['kuroka_(high_school_dxd)', 'kuroka'],
    // Konosuba
    'aqua': ['aqua_(konosuba)', 'aqua'],
    'megumin': ['megumin', 'megumin_(konosuba)'],
    'darkness': ['darkness_(konosuba)', 'lalatina'],
    'wiz': ['wiz_(konosuba)', 'wiz'],
    'yunyun': ['yunyun_(konosuba)', 'yunyun'],
    // Overlord
    'albedo': ['albedo_(overlord)', 'albedo'],
    'shalltear': ['shalltear_bloodfallen', 'shalltear'],
    // Frieren
    'frieren': ['frieren', 'sousou_no_frieren'],
    'fern': ['fern_(sousou_no_frieren)', 'fern'],
    'aura': ['aura_(sousou_no_frieren)', 'aura'],
    'methode': ['methode_(sousou_no_frieren)'],
    // One Punch Man
    'tatsumaki': ['tatsumaki', 'tornado_of_terror'],
    'fubuki': ['fubuki_(one-punch_man)', 'fubuki'],
    // Fairy Tail
    'lucy': ['lucy_heartfilia', 'lucy'],
    'erza': ['erza_scarlet', 'erza'],
    'juvia': ['juvia_lockser', 'juvia'],
    'mirajane': ['mirajane_strauss', 'mirajane'],
    'wendy': ['wendy_marvell', 'wendy'],
    // Attack on Titan
    'mikasa': ['mikasa_ackerman', 'mikasa'],
    'annie': ['annie_leonhart', 'annie'],
    'historia': ['historia_reiss', 'christa_lenz'],
    'sasha': ['sasha_braus', 'sasha_blouse'],
    // Genshin Impact
    'raiden': ['raiden_shogun', 'raiden_ei', 'raiden'],
    'ganyu': ['ganyu_(genshin_impact)', 'ganyu'],
    'hu tao': ['hu_tao_(genshin_impact)', 'hu_tao'],
    'mona': ['mona_(genshin_impact)', 'mona_megistus', 'mona'],
    'yae miko': ['yae_miko', 'yae'],
    'keqing': ['keqing_(genshin_impact)', 'keqing'],
    'shenhe': ['shenhe_(genshin_impact)', 'shenhe'],
    'yelan': ['yelan_(genshin_impact)', 'yelan'],
    'eula': ['eula_(genshin_impact)', 'eula'],
    'lisa': ['lisa_minci', 'lisa_(genshin_impact)'],
    'jean': ['jean_gunnhildr', 'jean_(genshin_impact)'],
    'furina': ['furina_(genshin_impact)', 'furina'],
    'navia': ['navia_(genshin_impact)', 'navia'],
    // NieR / Final Fantasy
    '2b': ['yorha_no.2_type_b', '2b_(nier:automata)', '2b'],
    'tifa': ['tifa_lockhart', 'tifa'],
    'aerith': ['aerith_gainsborough', 'aeris'],
    // Evangelion
    'asuka': ['souryuu_asuka_langley', 'asuka'],
    'rei': ['ayanami_rei', 'rei'],
    'misato': ['katsuragi_misato', 'misato'],
    // Fate
    'saber': ['artoria_pendragon', 'saber'],
    'rin': ['tohsaka_rin', 'rin_tohsaka'],
    'jalter': ['jeanne_alter', 'jeanne_d\'arc_alter'],
    // Quintessential Quintuplets
    'miku nakano': ['nakano_miku', 'miku_nakano'],
    'nino': ['nakano_nino', 'nino_nakano'],
    'ichika': ['nakano_ichika', 'ichika_nakano'],
    'yotsuba': ['nakano_yotsuba', 'yotsuba_nakano'],
    'itsuki': ['nakano_itsuki', 'itsuki_nakano'],
    // Kaguya-sama
    'chika': ['fujiwara_chika', 'chika_fujiwara'],
    'kaguya': ['shinomiya_kaguya', 'kaguya_shinomiya'],
    // Bocchi / Komi-san / Rent-a-Girlfriend
    'bocchi': ['gotou_hitori', 'hitori_gotou', 'bocchi'],
    'komi': ['komi_shouko', 'shouko_komi'],
    'chizuru': ['mizuhara_chizuru', 'ichinose_chizuru']
};

/**
 * Resuelve inteligentemente los tags de booru correspondientes al personaje
 */
async function resolverTags(personaje) {
    const rawClean = personaje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const candidateTags = [];

    // 1. Coincidencia con diccionario directo de alias
    for (const [key, tags] of Object.entries(WAIFU_TAG_MAP)) {
        if (rawClean === key || rawClean.includes(key) || key.includes(rawClean)) {
            candidateTags.push(...tags);
        }
    }

    // 2. Extraer palabras clave ignorando conectores en español
    const palabras = rawClean
        .split(/[\s_+.-]+/)
        .filter(w => !['de', 'del', 'la', 'el', 'los', 'las', 'waifu', 'anime', 'chica', 'personaje'].includes(w));

    if (palabras.length > 0) {
        // Tag directo con guiones bajos (ej: "tsunade", "marin_kitagawa")
        candidateTags.push(palabras.join('_'));

        if (palabras.length > 1) {
            // "rem_(re_zero)", "asuna_(sword_art_online)"
            candidateTags.push(palabras[0] + '_(' + palabras.slice(1).join('_') + ')');
            candidateTags.push(palabras[palabras.length - 1] + '_' + palabras.slice(0, palabras.length - 1).join('_'));
            candidateTags.push(palabras[0]);
        }
    }

    // 3. Consulta rápida al índice de tags de personajes (type 4 = Character) en Yande.re
    if (palabras.length > 0) {
        try {
            const queryTerm = palabras[0];
            const res = await axios.get(
                `https://yande.re/tag.json?name=*${encodeURIComponent(queryTerm)}*&order=count&limit=15`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3500 }
            );
            if (Array.isArray(res.data)) {
                const charTags = res.data.filter(t => t.type === 4);
                for (const ct of charTags) {
                    if (!candidateTags.includes(ct.name)) {
                        candidateTags.push(ct.name);
                    }
                }
            }
        } catch (_) {}
    }

    // 4. Asistente IA con Groq Cloud si la lista de tags es muy reducida
    if (candidateTags.length <= 1) {
        const apiKey = getGroqApiKey();
        if (apiKey) {
            try {
                const res = await axios.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        model: 'qwen/qwen3.8-27b',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are an anime booru tag expert. Given a character name, output ONLY their Danbooru/Yande.re character tag with underscores (e.g. rem_(re_zero), gotou_hitori, nami_(one_piece)). No other text, no quotes.'
                            },
                            { role: 'user', content: personaje }
                        ],
                        temperature: 0.1,
                        max_tokens: 30
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 4000
                    }
                );
                const aiTag = res.data?.choices?.[0]?.message?.content?.trim().toLowerCase().replace(/\s+/g, '_');
                if (aiTag && aiTag.length > 2 && !aiTag.includes(' ')) {
                    candidateTags.unshift(aiTag);
                }
            } catch (_) {}
        }
    }

    return [...new Set(candidateTags.filter(Boolean))];
}

/**
 * Busca publicaciones +18 verificando que pertenezcan al personaje
 */
async function buscarPostPersonaje(tags) {
    const filtrarValidos = (posts) => {
        if (!Array.isArray(posts)) return [];
        return posts.filter(p => {
            const url = p.sample_url || p.file_url || p.jpeg_url || p.url;
            return url && url.match(/\.(jpg|jpeg|png|webp|gif|mp4|webm)$/i);
        });
    };

    for (const tag of tags) {
        // Ejecutar las fuentes en paralelo con timeout controlado
        const fuentes = [
            // Fuente 1: Yande.re (Filtro explícito del personaje)
            axios.get(
                `https://yande.re/post.json?tags=${encodeURIComponent(tag)}+rating:explicit&limit=25`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4500 }
            ).then(res => {
                const validos = filtrarValidos(res.data);
                if (validos.length > 0) {
                    const post = validos[Math.floor(Math.random() * validos.length)];
                    return { url: post.sample_url || post.file_url || post.jpeg_url, tag };
                }
                return null;
            }).catch(() => null),

            // Fuente 2: Konachan (Filtro explícito del personaje)
            axios.get(
                `https://konachan.com/post.json?tags=${encodeURIComponent(tag)}+rating:explicit&limit=25`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4500 }
            ).then(res => {
                const validos = filtrarValidos(res.data);
                if (validos.length > 0) {
                    const post = validos[Math.floor(Math.random() * validos.length)];
                    return { url: post.sample_url || post.file_url, tag };
                }
                return null;
            }).catch(() => null),

            // Fuente 3: Rule34 API
            (async () => {
                const pid = Math.floor(Math.random() * 5);
                const res = await axios.get(
                    `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=25&pid=${pid}&tags=${encodeURIComponent(tag)}`,
                    { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4500 }
                );
                const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                const validos = filtrarValidos(json);
                if (validos.length > 0) {
                    const post = validos[Math.floor(Math.random() * validos.length)];
                    return { url: post.file_url, tag };
                }
                return null;
            })().catch(() => null),

            // Fuente 4: Búsqueda flexible sin rating:explicit en Yande.re
            axios.get(
                `https://yande.re/post.json?tags=${encodeURIComponent(tag)}&limit=25`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4500 }
            ).then(res => {
                const validos = filtrarValidos(res.data);
                if (validos.length > 0) {
                    const post = validos[Math.floor(Math.random() * validos.length)];
                    return { url: post.sample_url || post.file_url, tag };
                }
                return null;
            }).catch(() => null)
        ];

        const resultados = await Promise.all(fuentes);
        const match = resultados.find(r => r && r.url);
        if (match) return match;
    }

    return null;
}

module.exports = {
    name: 'hentai',
    alias: ['r34', 'rule34', 'hentaipic'],
    category: 'multimedia',
    desc: 'Busca contenido anime +18 de un personaje específico (NSFW activo)',
    usage: '.hentai [nombre del personaje]',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;

        // 1. Verificar NSFW activado en grupos
        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 El modo NSFW no está activado en este grupo.\n\n' +
                          'Un admin debe usar *.nsfw on* primero.\n\n' +
                          '_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        const personaje = text?.trim() || args.join(' ').trim();

        if (!personaje) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.hentai [nombre de la waifu/personaje]*\n\n' +
                      '📌 Ejemplos:\n' +
                      '*.hentai tsunade*\n' +
                      '*.hentai hinata*\n' +
                      '*.hentai nami*\n' +
                      '*.hentai rem re zero*\n' +
                      '*.hentai asuna sword art online*\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        m.react('🔞').catch(() => {});

        try {
            // Resolver tags inteligentes basados en el personaje solicitado
            const tags = await resolverTags(personaje);
            const resultado = await buscarPostPersonaje(tags);

            if (!resultado || !resultado.url) {
                return await sock.sendMessage(jid, {
                    text: `❌ No se encontró contenido +18 para *${personaje}*.\n\n` +
                          `💡 *Consejo:* Intenta escribir el nombre principal de la waifu (ej: *.hentai tsunade*, *.hentai rem*, *.hentai nami*).\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            const url = resultado.url;
            const esGif = Boolean(url.toLowerCase().match(/\.(gif|mp4|webm)$/));
            const caption = `🔞 *${personaje.toUpperCase()}* +18\n` +
                            `🏷️ *Tag:* #${resultado.tag}\n\n` +
                            `_Unknown Codexツ</>_`;

            if (esGif) {
                await sock.sendMessage(jid, {
                    video: { url },
                    caption,
                    gifPlayback: true
                }, { quoted: m });
            } else {
                await sock.sendMessage(jid, {
                    image: { url },
                    caption
                }, { quoted: m });
            }
        } catch (err) {
            await sock.sendMessage(jid, {
                text: `❌ Ocurrió un error al buscar contenido para *${personaje}*.\nIntenta nuevamente en unos momentos.\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

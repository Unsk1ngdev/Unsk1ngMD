'use strict';

const premium = require('../../lib/premium');
const database = require('../../lib/database');
const config = require('../../config');
const logger = require('../../lib/logger');

/**
 * Calcula el tiempo transcurrido en formato amigable
 */
function formatElapsed(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const diffMs = Date.now() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 30) return `Hace ${diffDays} días`;
    if (diffDays < 365) {
        const m = Math.floor(diffDays / 30);
        return m === 1 ? 'Hace 1 mes' : `Hace ${m} meses`;
    }
    const y = Math.floor(diffDays / 365);
    return y === 1 ? 'Hace 1 año' : `Hace ${y} años`;
}

/**
 * Determina la era / generación de Discord según el año de registro
 */
function getDiscordEra(year) {
    if (year <= 2015) return '🎖️ Era Fundacional / Alfa (2015)';
    if (year <= 2017) return '⚔️ Era Clásica / Primitiva (2016-2017)';
    if (year <= 2019) return '🚀 Era de Expansión Global (2018-2019)';
    if (year <= 2021) return '🌐 Era Masiva / Pandemia (2020-2021)';
    if (year <= 2023) return '✨ Era Nueva Identidad (2022-2023)';
    return '⚡ Era Contemporánea (2024+)';
}

module.exports = {
    name: 'discord',
    alias: ['dc', 'discorduser', 'discordsnowflake', 'dcuser'],
    category: 'premium',
    desc: 'Consulta inteligencia profunda de perfil de Discord por ID Snowflake (Premium)',
    usage: '.discord [ID Snowflake de Discord]',
    premiumOnly: true,

    execute: async ({ sock, m, args, text, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // 1. Verificación de permiso: Solo Owner y miembros Premium
        const isPermitted = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPermitted) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es solo para *Premium*.\nUsa *.prem* para más información.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const input = (text || (args || []).join(' ')).trim();

        if (!input) {
            return await sock.sendMessage(jid, {
                text: '╭━━━━〔 🎮 *DISCORD LOOKUP (PREMIUM)* 〕━━━━⬣\n' +
                      '┃\n' +
                      '┃ 📋 ═〔 *GUÍA DE USO* 〕═\n' +
                      '┃ ✦ `.discord [ID Snowflake]`\n' +
                      '┃\n' +
                      '┃ 💡 ═〔 *EJEMPLOS* 〕═\n' +
                      '┃ ✦ `.discord 155149108183695360` (ID numérico)\n' +
                      '┃ ✦ `.discord <@155149108183695360>` (Mención de Discord)\n' +
                      '┃\n' +
                      '┃ ❓ ═〔 *¿CÓMO OBTENER EL ID?* 〕═\n' +
                      '┃ 1. En Discord ve a: *Ajustes* ⚙️ → *Avanzado*.\n' +
                      '┃ 2. Activa la opción *Modo Desarrollador*.\n' +
                      '┃ 3. Da clic derecho al usuario → *Copiar ID de usuario*.\n' +
                      '┃ 4. Escribe: `.discord [ID copiado]`\n' +
                      '┃\n' +
                      '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // Limpiar posible formato de mención (<@123456789>)
        const cleanId = input.replace(/[<@!>]/g, '').trim();

        // Validar si es un Snowflake numérico puro de Discord (15 a 21 dígitos)
        if (!/^\d{15,21}$/.test(cleanId)) {
            return await sock.sendMessage(jid, {
                text: '⚠️ *Discord no permite buscar por nombre de usuario directamente.*\n\n' +
                      '🛡️ *¿Por qué razón?*\n' +
                      'Por privacidad de sus más de 600M de usuarios y prevención de acoso, la API de Discord no ofrece un directorio público por nombre. Solo permite consultar perfiles mediante su identificador numérico único universal (*Snowflake ID*).\n\n' +
                      '💡 *Cómo copiar el ID en 3 pasos:*\n' +
                      '1. En Discord: *Ajustes* ⚙️ → *Avanzado* → Activa *Modo Desarrollador*.\n' +
                      '2. Clic derecho en el usuario (o mantén pulsado en móvil).\n' +
                      '3. Elige *Copiar ID de usuario*.\n\n' +
                      '📌 *Ejemplo:* `.discord 155149108183695360`\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const DISCORD_TOKEN = config.discordToken || process.env.DISCORD_TOKEN;
        if (!DISCORD_TOKEN) {
            return await sock.sendMessage(jid, {
                text: '❌ No se ha configurado el token de bot de Discord en el bot.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (typeof m.react === 'function') {
            await m.react('🔍');
        }

        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), 8000);

        try {
            const res = await fetch(`https://discord.com/api/v10/users/${cleanId}`, {
                headers: {
                    'Authorization': `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutTimer);

            if (res.status === 404) {
                return await sock.sendMessage(jid, {
                    text: `❌ No se encontró ningún usuario de Discord con el ID *${cleanId}*.\n\n` +
                          `Verifica que el Snowflake copiado sea correcto.\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            if (res.status === 401) {
                return await sock.sendMessage(jid, {
                    text: '❌ Error de autenticación con la API de Discord: Token inválido o revocado.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            if (res.status === 429) {
                return await sock.sendMessage(jid, {
                    text: '⏱️ Límite de peticiones de Discord alcanzado (Rate Limit). Intenta nuevamente en unos segundos.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            if (!res.ok) {
                throw new Error(`Discord API Status ${res.status}`);
            }

            const d = await res.json();

            // 1. Desglose forense binario del Snowflake ID de 64 bits de Discord
            const snowflakeBig = BigInt(d.id);
            const DISCORD_EPOCH = 1420070400000n;
            const createdTimestamp = Number((snowflakeBig >> 22n) + DISCORD_EPOCH);
            const workerId = Number((snowflakeBig & 0x3E0000n) >> 17n);
            const processId = Number((snowflakeBig & 0x1F000n) >> 12n);
            const sequence = Number(snowflakeBig & 0xFFFn);

            const createdDate = new Date(createdTimestamp);
            const dateStr = createdDate.toLocaleDateString('es-DO', {
                timeZone: 'America/Santo_Domingo',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const timeStr = createdDate.toLocaleTimeString('es-DO', {
                timeZone: 'America/Santo_Domingo',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            const elapsed = formatElapsed(createdDate);
            const generation = getDiscordEra(createdDate.getFullYear());

            // 2. Avatar de usuario (animado GIF o PNG) y enlaces HD
            let avatarUrl = '';
            let avatarUrlHd = '';
            let isAvatarAnim = false;
            let avatarTipo = '⚪ Predeterminado de Discord';
            if (d.avatar) {
                isAvatarAnim = d.avatar.startsWith('a_');
                const ext = isAvatarAnim ? 'gif' : 'png';
                avatarUrl = `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.${ext}?size=1024`;
                avatarUrlHd = `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.${ext}?size=4096`;
                avatarTipo = isAvatarAnim ? '🎞️ GIF Animado (Exclusivo Nitro)' : '🖼️ Imagen Estática (PNG)';
            } else {
                const defaultIndex = d.discriminator === '0'
                    ? Number((snowflakeBig >> 22n) % 6n)
                    : (Number(d.discriminator) % 5);
                avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
                avatarUrlHd = avatarUrl;
            }

            // 3. Banner de perfil (estático o animado)
            let bannerUrl = null;
            let bannerUrlHd = null;
            let isBannerAnim = false;
            let bannerTipo = '⚪ Sin banner personalizado';
            if (d.banner) {
                isBannerAnim = d.banner.startsWith('a_');
                const ext = isBannerAnim ? 'gif' : 'png';
                bannerUrl = `https://cdn.discordapp.com/banners/${d.id}/${d.banner}.${ext}?size=1024`;
                bannerUrlHd = `https://cdn.discordapp.com/banners/${d.id}/${d.banner}.${ext}?size=4096`;
                bannerTipo = isBannerAnim ? '🎞️ GIF Animado (Exclusivo Nitro)' : '🖼️ Imagen Estática (PNG)';
            }

            // 4. Color de acento / Banner color
            const accentHex = (typeof d.accent_color === 'number')
                ? `#${d.accent_color.toString(16).padStart(6, '0').toUpperCase()}`
                : (d.banner_color || null);

            // 5. Decoración de avatar (Marco cosmético Nitro de la tienda)
            let avatarDecUrl = null;
            if (d.avatar_decoration_data?.asset) {
                avatarDecUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${d.avatar_decoration_data.asset}.png?size=512`;
            }

            // 6. Insignias / Public Flags oficiales de Discord
            const flags = [];
            const f = Number(d.public_flags || d.flags || 0);
            if (f & 1) flags.push('🛠️ Staff de Discord');
            if (f & 2) flags.push('🤝 Partner de Discord');
            if (f & 4) flags.push('🎉 HypeSquad Events');
            if (f & 8) flags.push('🐛 Bug Hunter Nivel 1 (Green)');
            if (f & 64) flags.push('🏠 HypeSquad Bravery (Valor)');
            if (f & 128) flags.push('🏠 HypeSquad Brilliance (Brillo)');
            if (f & 256) flags.push('🏠 HypeSquad Balance (Equilibrio)');
            if (f & 512) flags.push('💰 Early Supporter (Partidario Inicial)');
            if (f & 1024) flags.push('👥 Equipo de Desarrollador');
            if (f & 16384) flags.push('🐛 Bug Hunter Nivel 2 (Gold)');
            if (f & 65536) flags.push('✅ Bot Verificado');
            if (f & 131072) flags.push('💻 Desarrollador Pionero de Bots');
            if (f & 262144) flags.push('🎙️ Moderador Certificado (Alumni)');
            if (f & 524288) flags.push('⚡ Bot con Interacciones HTTP');
            if (f & 4194304) flags.push('🌟 Desarrollador Activo (Active Dev)');

            // 7. Tipo de cuenta
            let tipoCuenta = '👤 Usuario Humano';
            if (d.system) {
                tipoCuenta = '🛡️ Sistema Oficial de Discord';
            } else if (d.bot) {
                tipoCuenta = (f & 65536) ? '🤖 Bot Verificado Oficial' : '🤖 Bot de Discord';
            }

            // 8. Diagnóstico de Nitro / Estado cosmético
            let nitroStatus = '⚪ Básico (Sin indicios de Nitro activo)';
            if (isAvatarAnim || isBannerAnim) {
                nitroStatus = '💎 Nitro Activo (Avatar/Banner animado)';
            } else if (d.banner || avatarDecUrl) {
                nitroStatus = '✨ Perfil Personalizado (Banner o Marco)';
            } else if (f & 512) {
                nitroStatus = '💰 Early Supporter (Insignia Nitro Clásica)';
            }

            // 9. Clan / Tag de Gremio
            const clanTag = d.clan?.tag || d.primary_guild?.tag || null;

            // 10. Nombre de usuario formateado
            const userTag = d.discriminator && d.discriminator !== '0'
                ? `@${d.username}#${d.discriminator}`
                : `@${d.username}`;

            // Construcción estructurada, organizada y estética de la tarjeta
            const cardSections = [
                '╭━━━━〔 🎮 *DISCORD INTELLIGENCE (PREMIUM)* 〕━━━━⬣',
                '┃',
                '┃ 👤 ═〔 *IDENTIDAD & PERFIL* 〕═',
                `┃ ✦ *Usuario:* ${userTag}`,
                d.global_name ? `┃ ✦ *Nombre Global:* ${d.global_name}` : null,
                `┃ ✦ *Snowflake ID:* \`${d.id}\``,
                `┃ ✦ *Tipo de Cuenta:* ${tipoCuenta}`,
                `┃ ✦ *Estado Nitro:* ${nitroStatus}`,
                clanTag ? `┃ ✦ *Clan / Tag:* \`[${clanTag}]\`` : null,
                '┃',
                '┃ 📅 ═〔 *CRONOLOGÍA DE REGISTRO* 〕═',
                `┃ ✦ *Fecha:* ${dateStr}`,
                `┃ ✦ *Hora Local:* ${timeStr}`,
                `┃ ✦ *Antigüedad:* ${elapsed}`,
                `┃ ✦ *Generación:* ${generation}`,
                '┃',
                '┃ 🔬 ═〔 *ANÁLISIS FORENSE SNOWFLAKE* 〕═',
                `┃ ✦ *Datacenter Worker:* Cluster \`W${workerId}\``,
                `┃ ✦ *Proceso Interno:* PID \`#${processId}\``,
                `┃ ✦ *Secuencia Local:* Contador \`#${sequence}\``,
                '┃',
                '┃ 🎨 ═〔 *DISEÑO & PERSONALIZACIÓN* 〕═',
                `┃ ✦ *Avatar:* ${avatarTipo}`,
                `┃ ✦ *Banner:* ${bannerTipo}`,
                accentHex ? `┃ ✦ *Color de Acento:* \`${accentHex}\`` : null,
                avatarDecUrl ? `┃ ✦ *Marco Cosmético:* 🎭 Decoración Activa` : null,
                '┃',
                '┃ 🏅 ═〔 *INSIGNIAS OFICIALES* 〕═',
                flags.length > 0
                    ? flags.map(fl => `┃ ✦ ${fl}`).join('\n')
                    : '┃ ✦ ⚪ Sin insignias públicas registradas',
                '┃',
                '┃ 🔗 ═〔 *ENLACES DIRECTOS* 〕═',
                `┃ ✦ *Perfil:* https://discord.com/users/${d.id}`,
                `┃ ✦ *Avatar HD (4096px):* ${avatarUrlHd}`,
                bannerUrlHd ? `┃ ✦ *Banner HD (4096px):* ${bannerUrlHd}` : null,
                avatarDecUrl ? `┃ ✦ *Marco Cosmético:* ${avatarDecUrl}` : null,
                '┃',
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n_Unknown Codexツ</>_'
            ];

            const msg = cardSections.filter(Boolean).join('\n');

            // Enviar con imagen del avatar si está disponible
            if (avatarUrl) {
                try {
                    const imgRes = await fetch(avatarUrl, { signal: AbortSignal.timeout(6000) });
                    if (imgRes.ok) {
                        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
                        if (typeof m.react === 'function') await m.react('🎮');
                        return await sock.sendMessage(jid, {
                            image: imgBuffer,
                            caption: msg
                        }, { quoted: m });
                    }
                } catch (_) {}
            }

            if (typeof m.react === 'function') await m.react('🎮');
            return await sock.sendMessage(jid, { text: msg }, { quoted: m });

        } catch (err) {
            clearTimeout(timeoutTimer);
            if (err.name === 'AbortError') {
                return await sock.sendMessage(jid, {
                    text: '⏱️ El tiempo de consulta con Discord se ha agotado. Intenta de nuevo más tarde.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
            logger.error('[DISCORD ERROR]:', err);
            return await sock.sendMessage(jid, {
                text: `❌ Error al consultar la API de Discord: ${err.message || 'Error desconocido'}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

'use strict';

module.exports = {
    name: 'chismografo',
    alias: ['chisme', 'gossip'],
    category: 'herramientas',
    desc: 'Inventa un chisme divertido, exagerado y falso entre dos personas mencionadas',
    usage: '.chismografo @usuario1 @usuario2',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (mentioned.length < 2) {
            return await sock.sendMessage(jid, {
                text: '❌ Menciona a 2 personas.\nEjemplo: *.chismografo @usuario1 @usuario2*'
            }, { quoted: m });
        }

        const user1 = mentioned[0];
        const user2 = mentioned[1];
        const num1 = user1.replace('@s.whatsapp.net', '').split(':')[0];
        const num2 = user2.replace('@s.whatsapp.net', '').split(':')[0];

        const chismes = [
            // Romance
            `😱 *¡CHISME BOMBA!*\n\n` +
            `🔴 FUENTE EXCLUSIVA: Al parecer @${num1} y @${num2} fueron vistos juntos anoche en un restaurante lujoso. Los dos negaron todo pero las fotos no mienten. 📸 Se dice que llevan 3 meses en secreto y nadie sabía nada. ¡El grupo entero en shock! 💥`,

            // Pelea épica
            `💥 *¡ÚLTIMA HORA!*\n\n` +
            `🎙️ Testigos confirman que @${num1} y @${num2} tuvieron una discusión épica en los últimos días. El motivo: @${num1} supuestamente le contó un secreto de @${num2} a toda la gente. @${num2} está que echa fuego. 🔥 Dicen que el grupo ya tomó partido. ¡Están del lado de @${num1}! 😬`,

            // Traición
            `🤫 *¡EXCLUSIVA DEL CHISMÓGRAFO!*\n\n` +
            `🕵️ Información de fuentes confiables indica que @${num1} ha estado hablando mal de @${num2} por detrás. Todo. El. Tiempo. 😤 Pero lo más loco es que @${num2} ya lo sabe y está esperando el momento perfecto para la venganza. El drama que viene es histórico. 🍿`,

            // Alianza secreta
            `👀 *¡INFORMACIÓN CLASIFICADA FILTRADA!*\n\n` +
            `🤝 Al parecer @${num1} y @${num2} tienen una alianza secreta desde hace meses. Coordinan todo entre ellos antes de hablar con el resto del grupo. ¿El objetivo? Aún se desconoce. Lo que sí se sabe es que juntos son imparables. 😈 El grupo no sospecha nada. Hasta ahora. 👁️`,

            // Secreto revelado
            `🚨 *¡BREAKING NEWS DEL CHISMÓGRAFO!*\n\n` +
            `💬 @${num1} reveló accidentalmente en una historia de estado que admira muchísimo a @${num2}. Borró la historia a los 3 segundos pero el chismógrafo ya tenía el screenshot. 📱 @${num2} ya lo vio y no ha dicho nada... pero su última hora de conexión aumentó 10 veces hoy. 👀`,

            // Competencia
            `⚔️ *¡EL CHISMÓGRAFO INFORMA!*\n\n` +
            `🏆 Hay una guerra silenciosa entre @${num1} y @${num2} por ver quién es más popular en el grupo. Los dos suben el nivel de sus mensajes cuando el otro habla. La competencia es brutal. 😤 Las apuestas dicen que @${num1} va ganando pero @${num2} tiene un plan secreto que nadie conoce aún. 🎯`
        ];

        const chisme = chismes[Math.floor(Math.random() * chismes.length)];

        await sock.sendMessage(jid, {
            text: `${chisme}\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `⚠️ _Todo lo anterior es completamente inventado y falso. Solo para divertirse._ 😂\n\n` +
                  `_Unknown Codexツ</>_`,
            mentions: [user1, user2]
        }, { quoted: m });
    }
};


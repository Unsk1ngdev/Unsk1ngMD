'use strict';

const fs = require('fs-extra');
const path = require('path');

const REGLAS_FILE = path.join(process.cwd(), 'reglas.json');

const initReglas = () => {
    try {
        if (!fs.existsSync(REGLAS_FILE)) {
            fs.writeJsonSync(REGLAS_FILE, {}, { spaces: 2 });
        }
    } catch (_) {}
};

initReglas();

const loadReglas = () => {
    try {
        if (!fs.existsSync(REGLAS_FILE)) {
            initReglas();
            return {};
        }
        return fs.readJsonSync(REGLAS_FILE);
    } catch (_) {
        return {};
    }
};

const saveReglas = (data) => {
    try {
        fs.writeJsonSync(REGLAS_FILE, data, { spaces: 2 });
        return true;
    } catch (_) {
        return false;
    }
};

module.exports = {
    name: 'reglas',
    alias: ['rules', 'normas', 'reglamento'],
    category: 'grupo',
    desc: 'Muestra o configura las reglas oficiales del grupo',
    usage: '.reglas [ver / set <texto> / borrar]',
    groupOnly: true,

    execute: async ({ sock, m, args, isAdmin, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            return await sock.sendMessage(jid, {
                text: '❌ Este comando solo funciona en grupos.'
            }, { quoted: m });
        }

        const reglasData = loadReglas();
        const subCmd = args[0]?.toLowerCase();

        // 1. Ver reglas (Cualquier miembro del grupo puede verlas)
        if (!subCmd || subCmd === 'ver') {
            const reglas = reglasData[jid];
            if (!reglas || !reglas.texto) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No hay reglas configuradas en este grupo.\n\nUn admin puede configurarlas usando:\n*.reglas set [texto de las reglas]*\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: `╔══════════════════╗\n` +
                      `║  📝 *REGLAS DEL GRUPO*  ║\n` +
                      `╚══════════════════╝\n\n` +
                      `${reglas.texto}\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 2. Comprobación de permisos de admin para modificar o borrar
        if (!isOwner && !isAdmin) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo los administradores del grupo pueden configurar o borrar las reglas.'
            }, { quoted: m });
        }

        // 3. Borrar reglas
        if (subCmd === 'borrar' || subCmd === 'del' || subCmd === 'delete' || subCmd === 'reset') {
            delete reglasData[jid];
            saveReglas(reglasData);
            return await sock.sendMessage(jid, {
                text: '✅ Reglas eliminadas correctamente.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 4. Guardar reglas
        if (subCmd === 'set' || subCmd === 'poner' || subCmd === 'guardar') {
            const texto = args.slice(1).join(' ').trim();
            if (!texto) {
                return await sock.sendMessage(jid, {
                    text: '❌ Uso: *.reglas set [texto de las reglas]*\nEjemplo: *.reglas set 1. No spam\\n2. Respeto mutuo*'
                }, { quoted: m });
            }

            reglasData[jid] = { texto };
            saveReglas(reglasData);

            return await sock.sendMessage(jid, {
                text: `✅ *Reglas guardadas correctamente*\n\n` +
                      `📝 ${texto}\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 5. Ayuda de uso
        await sock.sendMessage(jid, {
            text: '📝 *Uso de .reglas:*\n\n' +
                  '*.reglas* — Ver reglas del grupo\n' +
                  '*.reglas set [texto]* — Guardar reglas (Admins)\n' +
                  '*.reglas borrar* — Eliminar reglas (Admins)\n\n' +
                  '_Unknown Codexツ</>_'
        }, { quoted: m });
    }
};


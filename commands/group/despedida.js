'use strict';

const fs = require('fs-extra');
const path = require('path');

const despedidaPath = path.join(process.cwd(), 'despedida.json');

const initDespedida = () => {
    try {
        if (!fs.existsSync(despedidaPath)) {
            fs.writeJsonSync(despedidaPath, {}, { spaces: 2 });
        }
    } catch (_) {}
};

initDespedida();

const loadDespedida = () => {
    try {
        if (!fs.existsSync(despedidaPath)) return {};
        return fs.readJsonSync(despedidaPath);
    } catch (_) {
        return {};
    }
};

const saveDespedida = (data) => {
    try {
        fs.writeJsonSync(despedidaPath, data, { spaces: 2 });
        return true;
    } catch (_) {
        return false;
    }
};

module.exports = {
    name: 'despedida',
    alias: ['goodbye', 'bye', 'farewell'],
    category: 'grupo',
    desc: 'Configura o desactiva el mensaje de despedida automático cuando alguien sale del grupo',
    usage: '.despedida [mensaje / off / ver]',
    groupOnly: true,

    execute: async ({ sock, m, args, groupMetadata, isAdmin, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo funciona en grupos.'
            }, { quoted: m });
        }

        let groupMeta = groupMetadata;
        if (!groupMeta) {
            try {
                groupMeta = await sock.groupMetadata(jid);
            } catch (_) {}
        }

        const senderAdmin = groupMeta?.participants?.find(p => {
            const cleanId = (p.id || '').split(':')[0] + '@s.whatsapp.net';
            const cleanSender = (m.sender || '').split(':')[0] + '@s.whatsapp.net';
            return cleanId === cleanSender;
        })?.admin;

        if (!isOwner && !isAdmin && !senderAdmin) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo admins pueden usar este comando.'
            }, { quoted: m });
        }

        const subCmd = args[0]?.toLowerCase();
        const despedidaData = loadDespedida();

        // 1. Ver mensaje actual
        if (subCmd === 'ver') {
            const config = despedidaData[jid];
            if (!config) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No hay mensaje de despedida configurado.'
                }, { quoted: m });
            }
            return await sock.sendMessage(jid, {
                text: `🚪 *Despedida actual:*\n\n` +
                      `${config.mensaje}\n\n` +
                      `Estado: ${config.activo ? '✅ Activo' : '❌ Desactivado'}\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 2. Desactivar despedida
        if (subCmd === 'off' || subCmd === 'desactivar') {
            if (despedidaData[jid]) {
                despedidaData[jid].activo = false;
                saveDespedida(despedidaData);
            }
            return await sock.sendMessage(jid, {
                text: '✅ *Despedida desactivada.*\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 3. Activar / Guardar mensaje de despedida
        const isOnCmd = subCmd === 'on' || subCmd === 'activar' || subCmd === 'enable';
        let mensaje = args.join(' ').trim();

        if (isOnCmd) {
            const rest = args.slice(1).join(' ').trim();
            mensaje = rest || '👋 Hasta luego {usuario}!\nEsperamos verte pronto en {grupo}. 🚪';
        } else if (!mensaje) {
            mensaje = '👋 Hasta luego {usuario}!\nEsperamos verte pronto en {grupo}. 🚪';
        }

        despedidaData[jid] = {
            mensaje,
            activo: true
        };
        saveDespedida(despedidaData);

        // ✅ Confirmación limpia sin mostrar variables ni instrucciones técnicas
        await sock.sendMessage(jid, {
            text: `✅ *Despedida activada*\n\n` +
                  `📝 *Mensaje guardado:*\n${mensaje}\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

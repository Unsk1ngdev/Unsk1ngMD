'use strict';

const premium = require('../../lib/premium');

module.exports = {
    name: 'fake',
    alias: ['fakeuser', 'fakeid', 'identidadfalsa'],
    category: 'herramientas',
    desc: 'Genera un perfil y datos de identidad ficticios aleatorios (solo premium)',
    usage: '.fake',

    execute: async ({ sock, m, isOwner }) => {
        const sender = m.sender;
        const jid = m.chat || m.key.remoteJid;

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const nombres = ['Carlos', 'Maria', 'Jose', 'Ana', 'Luis', 'Laura', 'Pedro', 'Sofia',
                         'Miguel', 'Isabella', 'Diego', 'Valentina', 'Andres', 'Camila', 'Juan'];
        const apellidos = ['Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Gonzalez', 'Perez',
                           'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Morales'];
        const ocupaciones = ['Ingeniero', 'Médico', 'Abogado', 'Profesor', 'Diseñador',
                             'Programador', 'Chef', 'Contador', 'Arquitecto', 'Enfermero'];
        const paises = ['México', 'Colombia', 'Argentina', 'Venezuela', 'Perú',
                        'Chile', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay'];
        const ciudades = ['Bogotá', 'Lima', 'Buenos Aires', 'Santiago', 'Caracas',
                          'Quito', 'La Paz', 'Asunción', 'Montevideo', 'Ciudad de México'];

        const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const randNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        const nombre = `${rand(nombres)} ${rand(apellidos)} ${rand(apellidos)}`;
        const telefono = `+${randNum(1, 99)}${randNum(1000000000, 9999999999)}`;
        const dia = randNum(1, 28);
        const mes = randNum(1, 12);
        const anio = randNum(1970, 2000);
        const email = `${nombre.split(' ')[0].toLowerCase()}${randNum(1, 999)}@gmail.com`;
        const ocupacion = rand(ocupaciones);
        const pais = rand(paises);
        const ciudad = rand(ciudades);

        await sock.sendMessage(jid, {
            text: `╔══════════════════╗\n` +
                  `║  🎭 *PERFIL FALSO*  ║\n` +
                  `╚══════════════════╝\n\n` +
                  `👤 *Nombre:* ${nombre}\n` +
                  `📱 *Teléfono:* ${telefono}\n` +
                  `🎂 *Nacimiento:* ${dia}/${mes}/${anio}\n` +
                  `📧 *Email:* ${email}\n` +
                  `💼 *Ocupación:* ${ocupacion}\n` +
                  `🌍 *País:* ${pais}\n` +
                  `🏙️ *Ciudad:* ${ciudad}\n\n` +
                  `⚠️ _Datos ficticios generados aleatoriamente_\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};


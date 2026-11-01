'use strict';

const guessGameManager = require('../../lib/guessGameManager');

module.exports = {
    name: 'tebakbendera',
    alias: ['adivinabandera', 'bandera', 'quizbandera'],
    category: 'juegos',
    desc: 'Inicia el juego de adivinar la bandera del país o envía tu respuesta (.bandera <país>)',
    usage: '.tebakbendera [nombre del país / pista / cancelar]',

    execute: async ({ sock, m, args }) => {
        const input = (args || []).join(' ').trim();
        if (input) {
            await guessGameManager.submitBenderaAnswer(sock, m, input);
        } else {
            await guessGameManager.startBendera(sock, m);
        }
    }
};

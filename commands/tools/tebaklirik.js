'use strict';

const guessGameManager = require('../../lib/guessGameManager');

module.exports = {
    name: 'tebaklirik',
    alias: ['adivinaletra', 'adivinalaletra', 'cancionletra', 'letracancion'],
    category: 'juegos',
    desc: 'Inicia el juego de adivinar la canción por un fragmento de su letra o envía tu respuesta (.tebaklirik <canción>)',
    usage: '.tebaklirik [título de la canción]',

    execute: async ({ sock, m, args }) => {
        const input = (args || []).join(' ').trim();
        if (input) {
            await guessGameManager.submitLirikAnswer(sock, m, input);
        } else {
            await guessGameManager.startLirik(sock, m);
        }
    }
};

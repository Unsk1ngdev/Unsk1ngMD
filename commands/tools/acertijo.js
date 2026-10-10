const acertijoManager = require('../../lib/acertijo');

module.exports = {
    name: 'acertijo',
    alias: ['acertijos', 'riddle', 'adivinanza'],
    category: 'herramientas',
    desc: 'Inicia un divertido juego de acertijos con límite de tiempo de 60 segundos',
    usage: '.acertijo',
    execute: async ({ sock, m }) => {
        await acertijoManager.startGame(sock, m);
    }
};


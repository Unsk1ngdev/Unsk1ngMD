'use strict';

const winkCmd = require('./wink');

module.exports = {
    name: 'hdvid',
    alias: ['videohd2', 'mejorarvid', 'hdvideoffmpeg'],
    category: 'multimedia',
    desc: 'Mejora y remasteriza la calidad visual, nitidez y contraste de un video mediante FFMPEG local (sin APIs externas)',
    usage: '.hdvid (respondiendo a un video o enviando un video con .hdvid)',

    execute: async ({ sock, m }) => {
        // Ejecuta el pipeline de remasterización con FFmpeg local
        await winkCmd.execute({ sock, m });
    }
};


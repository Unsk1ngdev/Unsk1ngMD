'use strict';

/**
 * Cargador resiliente y seguro para 'sharp'
 * Previene que el bot colapse con UNCAUGHT EXCEPTION en entornos Android Termux (android-arm64)
 * donde los binarios nativos de libvips no vienen preinstalados.
 */

let sharpModule = null;

function getSharp() {
    if (sharpModule) return sharpModule;

    // 1. Intento con sharp estándar nativo
    try {
        sharpModule = require('sharp');
        return sharpModule;
    } catch (_) {}

    // 2. Intento con fallback WebAssembly para Termux / Android (@img/sharp-wasm32)
    try {
        sharpModule = require('@img/sharp-wasm32');
        return sharpModule;
    } catch (_) {}

    sharpModule = null;
    return null;
}

/**
 * Proxy transparente para invocar sharp(...) de forma segura.
 * Si sharp no está disponible en el entorno, lanza un error limpio durante la ejecución del comando,
 * evitando que el bot colapse al arrancar (en require time).
 */
const safeSharp = new Proxy(function (...args) {
    const s = getSharp();
    if (!s) {
        throw new Error(
            'El módulo de procesamiento de imágenes "sharp" no está disponible en este entorno (Android Termux).\n' +
            '👉 Para habilitarlo por completo, ejecuta en Termux:\n' +
            '   npm install @img/sharp-wasm32'
        );
    }
    return s(...args);
}, {
    get(target, prop) {
        if (prop === 'isAvailable') {
            return () => Boolean(getSharp());
        }
        const s = getSharp();
        if (s && prop in s) {
            const val = s[prop];
            if (typeof val === 'function') return val.bind(s);
            return val;
        }
        return target[prop];
    }
});

module.exports = safeSharp;

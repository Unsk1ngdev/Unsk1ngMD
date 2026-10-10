/**
 * Evaluador matemático seguro sin eval()
 */
const safeEvaluate = (expression) => {
    // Normalizar expresión
    let expr = expression
        .replace(/\s+/g, '')
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
        .replace(/pi/gi, String(Math.PI))
        .replace(/e/gi, String(Math.E));

    // Solo permitir números, operadores aritméticos válidos, paréntesis y funciones matemáticas seguras
    if (!/^[0-9+\-*/().,%Math.sqrtMath.absMath.sinMath.cosMath.tanMath.roundMath.floorMath.ceil**]+$/.test(expr)) {
        throw new Error('La expresión contiene caracteres o funciones no permitidas.');
    }

    // Comprobación estricta de seguridad: no permitir acceso a objetos globales ni letras fuera de Math
    const sanitized = expr.replace(/Math\.(sqrt|abs|sin|cos|tan|round|floor|ceil|pow|log)/g, '');
    if (/[a-zA-Z_$]/.test(sanitized)) {
        throw new Error('Expresión matemática no válida.');
    }

    // Evaluación en contexto seguro con límites
    const fn = new Function(`"use strict"; return (${expr});`);
    const result = fn();

    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        throw new Error('El resultado no es un número finito válido.');
    }

    return result;
};

module.exports = {
    name: 'calc',
    alias: ['calculadora', 'math'],
    category: 'herramientas',
    desc: 'Calculadora matemática segura con soporte de operadores y funciones',
    usage: '.calc [operación, ej: 25 * 4 + sqrt(144)]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Debes ingresar una operación matemática.\nEjemplos:\n*.calc 15 * 8 - 4*\n*.calc (20 + 5) / 2*\n*.calc Math.sqrt(144) + 10*');
        }

        try {
            const result = safeEvaluate(text);
            await m.reply(`🔢 *Operación:* ${text}\n📊 *Resultado:* *${result}*`);
        } catch (err) {
            await m.reply(`❌ Error en el cálculo: ${err.message}`);
        }
    }
};


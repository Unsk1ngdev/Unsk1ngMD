const chalk = require('chalk');
const cfonts = require('cfonts');

const timestamp = () => {
    return new Date().toLocaleTimeString('es-ES', { hour12: false });
};

const logger = {
    // Silenciado: Evita logs redundantes de peticiones internas, cargas y buffers
    info: () => {},
    
    // Silenciado: Mantiene la terminal limpia sin spamear cada comando ejecutado
    cmd: () => {},

    // Avisos clave (ej: conexión exitosa a WhatsApp)
    success: (msg, ...args) => {
        if (/conectado|online|ready|operativo/i.test(msg)) {
            console.log(chalk.gray(`[${timestamp()}]`), chalk.green.bold('CONECTADO:'), chalk.green(msg), ...args);
        }
    },

    // Avisos críticos de conexión y estado de socket
    warn: (msg, ...args) => {
        if (/conexi|desconect|cerrad|reconex|loggedout/i.test(msg)) {
            console.log(chalk.gray(`[${timestamp()}]`), chalk.yellow.bold('AVISO:'), chalk.yellow(msg), ...args);
        }
    },

    // Errores críticos de conexión o autenticación
    error: (msg, ...args) => {
        if (/conexi|desconect|socket|auth|session|credencial/i.test(msg)) {
            console.log(chalk.gray(`[${timestamp()}]`), chalk.red.bold('ERROR:'), chalk.red(msg), ...args);
        }
    },

    // Banner Cyberpunk oficial
    banner: (socketStatus = 'Iniciando conexión...') => {
        console.clear();

        cfonts.say('Unsk1ngMD', {
            font: 'block',
            align: 'center',
            colors: ['cyan', 'magenta'],
            background: 'transparent',
            letterSpacing: 1,
            lineHeight: 1,
            space: false,
            maxLength: '0',
            gradient: ['cyan', 'magenta'],
            independentGradient: false,
            transitionGradient: false,
            env: 'node'
        });

        const boxWidth = 56;
        const border = (charLeft, charRight) => 
            chalk.hex('#00f7ff')(`${charLeft}${'─'.repeat(boxWidth)}${charRight}`);

        const infoLine = (label, value, valColor) => {
            const cleanLabel = ` ${label}: `;
            const cleanValue = `${value}`;
            const totalPad = boxWidth - cleanLabel.length - cleanValue.length;
            const padding = ' '.repeat(Math.max(0, totalPad));

            return chalk.hex('#00f7ff')('│') +
                chalk.hex('#ff007f').bold(cleanLabel) +
                valColor(cleanValue) +
                padding +
                chalk.hex('#00f7ff')('│');
        };

        console.log(border('┌', '┐'));
        console.log(infoLine('Creador', 'Unknown Codexツ</>', chalk.hex('#00ff66').bold));
        console.log(infoLine('Contacto', '+584160666286', chalk.hex('#38bdf8').bold));
        console.log(infoLine('Versión', 'Dev', chalk.hex('#facc15').bold));
        console.log(infoLine('Estado del socket', socketStatus, chalk.hex('#d946ef').bold));
        console.log(border('└', '┘') + '\n');
    }
};

module.exports = logger;

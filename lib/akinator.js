/**
 * Re-exportación unificada del gestor de Akinator hacia commands/akinator.js
 * Mantiene compatibilidad total con handlers/messageHandler.js
 */
const akinatorModule = require('../commands/akinator');

module.exports = akinatorModule;

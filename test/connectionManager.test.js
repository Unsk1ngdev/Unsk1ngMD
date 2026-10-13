'use strict';

const assert = require('assert');
const { DisconnectReason } = require('@whiskeysockets/baileys');
const connectionManager = require('../lib/connectionManager');

console.log('🧪 [TEST] Iniciando pruebas del sistema de reconexión controlada...');

// 1. Prueba de clasificación de desconexiones
{
    // 401 loggedOut -> NO debe reconectar
    const loggedOutEval = connectionManager.evaluateDisconnection(DisconnectReason.loggedOut);
    assert.strictEqual(loggedOutEval.canReconnect, false, '401 loggedOut no debe permitir reconexión');
    assert.strictEqual(loggedOutEval.action, 'LOGGED_OUT');

    // 403 forbidden -> NO debe reconectar
    const forbiddenEval = connectionManager.evaluateDisconnection(DisconnectReason.forbidden);
    assert.strictEqual(forbiddenEval.canReconnect, false, '403 forbidden no debe permitir reconexión');

    // 440 connectionReplaced -> NO debe reconectar
    const conflictEval = connectionManager.evaluateDisconnection(DisconnectReason.connectionReplaced);
    assert.strictEqual(conflictEval.canReconnect, false, '440 connectionReplaced no debe permitir reconexión');

    // 411 multideviceMismatch -> NO debe reconectar
    const mismatchEval = connectionManager.evaluateDisconnection(DisconnectReason.multideviceMismatch);
    assert.strictEqual(mismatchEval.canReconnect, false, '411 mismatch no debe permitir reconexión');

    // 428 connectionClosed -> SÍ debe reconectar
    const closedEval = connectionManager.evaluateDisconnection(DisconnectReason.connectionClosed);
    assert.strictEqual(closedEval.canReconnect, true, '428 connectionClosed debe permitir reconexión');

    // 515 restartRequired -> SÍ debe reconectar rápido
    const restartEval = connectionManager.evaluateDisconnection(DisconnectReason.restartRequired);
    assert.strictEqual(restartEval.canReconnect, true, '515 restartRequired debe permitir reconexión');
    assert.strictEqual(restartEval.isFastRestart, true);

    console.log('  ✅ Prueba 1 superada: Clasificación precisa de códigos DisconnectReason de Baileys.');
}

// 2. Prueba de Exponential Backoff y Jitter
{
    connectionManager.retryCount = 0;
    const delay1 = connectionManager.calculateBackoffDelay(false);
    assert(delay1 >= 2000 && delay1 <= 3500, `Intento 1 (${delay1}ms) debe estar alrededor de baseDelay`);

    const delay2 = connectionManager.calculateBackoffDelay(false);
    assert(delay2 > delay1 * 1.1, `Intento 2 (${delay2}ms) debe ser exponencialmente mayor que intento 1 (${delay1}ms)`);

    const delayFast = connectionManager.calculateBackoffDelay(true);
    assert.strictEqual(delayFast, 1200, 'Reinicio rápido (515) debe ser de ~1200ms');

    console.log('  ✅ Prueba 2 superada: Exponential backoff con jitter calculado correctamente.');
}

// 3. Prueba de límite de reintentos (prevención de bucle infinito)
{
    connectionManager.retryCount = connectionManager.maxRetries;
    const maxEval = connectionManager.evaluateDisconnection(DisconnectReason.connectionClosed);
    assert.strictEqual(maxEval.canReconnect, false, 'Al alcanzar maxRetries debe detener la reconexión');
    assert.strictEqual(maxEval.action, 'MAX_RETRIES_EXCEEDED');
    console.log('  ✅ Prueba 3 superada: Prevención de bucles infinitos con tope de reintentos consecutivos.');
}

// 4. Prueba de limpieza profunda de sockets y listeners
{
    let listenersCleared = false;
    let wsClosed = false;

    const mockSock = {
        ev: {
            removeAllListeners: (evt) => {
                listenersCleared = true;
            }
        },
        ws: {
            close: () => {
                wsClosed = true;
            }
        },
        end: () => {}
    };

    connectionManager.cleanupSocket(mockSock);
    assert.strictEqual(listenersCleared, true, 'Debe remover todos los listeners de Baileys');
    assert.strictEqual(wsClosed, true, 'Debe cerrar el socket WebSocket subyacente');
    console.log('  ✅ Prueba 4 superada: Limpieza de listeners y recursos para evitar fugas de memoria.');
}

// 5. Prueba de restablecimiento de reintentos tras conexión abierta
{
    connectionManager.retryCount = 5;
    connectionManager.onConnectionOpen({});
    assert.strictEqual(connectionManager.isStarting, false, 'isStarting debe liberarse al abrir conexión');
    assert(connectionManager.stabilityTimer !== null, 'Debe configurar el temporizador de estabilidad');

    connectionManager.cancelPendingReconnect();
    console.log('  ✅ Prueba 5 superada: Gestión de estabilidad y restablecimiento de contadores.');
}

console.log('🎉 [TEST] ¡Todas las pruebas del ConnectionManager pasaron exitosamente!\n');


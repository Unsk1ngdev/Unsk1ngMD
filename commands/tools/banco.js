'use strict';

const economy = require('../../lib/economy');

module.exports = {
    name: 'banco',
    alias: ['bank', 'prestamo', 'saldo'],
    category: 'herramientas',
    desc: 'Sistema bancario: consulta saldo, depósitos, retiros y préstamos financieros con interés',
    usage: '.banco [saldo | depositar <cant> | retirar <cant> | pedir <cant> | pagar <cant|todo> | deuda]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const subCmd = (args[0] || '').toLowerCase().trim();
        const user = economy.getUser(sender);

        // ── 1. SUBCOMANDO: DEPOSITAR ──────────────────────────────────────────
        if (subCmd === 'depositar' || subCmd === 'dep') {
            const val = (args[1] || '').toLowerCase().trim();
            if (!val) {
                return await sock.sendMessage(jid, {
                    text: '❌ Indica la cantidad a depositar en tu cuenta bancaria o escribe `todo`.\n*Ejemplo:* `.banco depositar 5000` o `.banco depositar todo`'
                }, { quoted: m });
            }

            const res = economy.deposit(sender, val);
            if (!res.success) {
                return await sock.sendMessage(jid, {
                    text: `⚠️ ${res.error}`
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '🏦 *DEPÓSITO BANCARIO EXITOSO*',
                    '',
                    `💵 *Depositado:* $${economy.formatNumber(res.depositado)} monedas`,
                    `💰 *En mano:* $${economy.formatNumber(res.enMano)}`,
                    `🏛️ *Saldo en banco:* $${economy.formatNumber(res.enBanco)}`,
                    '',
                    '🔒 _Tus fondos están resguardados en el banco._',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── 2. SUBCOMANDO: RETIRAR ───────────────────────────────────────────
        if (subCmd === 'retirar' || subCmd === 'ret') {
            const val = (args[1] || '').toLowerCase().trim();
            if (!val) {
                return await sock.sendMessage(jid, {
                    text: '❌ Indica la cantidad a retirar de tu cuenta bancaria o escribe `todo`.\n*Ejemplo:* `.banco retirar 5000` o `.banco retirar todo`'
                }, { quoted: m });
            }

            const res = economy.withdraw(sender, val);
            if (!res.success) {
                return await sock.sendMessage(jid, {
                    text: `⚠️ ${res.error}`
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '🏧 *RETIRO BANCARIO EXITOSO*',
                    '',
                    `💵 *Retirado:* $${economy.formatNumber(res.retirado)} monedas`,
                    `💰 *En mano:* $${economy.formatNumber(res.enMano)}`,
                    `🏛️ *Saldo restante en banco:* $${economy.formatNumber(res.enBanco)}`,
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── 3. SUBCOMANDO: PEDIR (Préstamo) ───────────────────────────────────
        if (subCmd === 'pedir' || subCmd === 'prestamo' || subCmd === 'prestar') {
            const amount = parseInt(args[1], 10);
            if (isNaN(amount) || amount <= 0) {
                return await sock.sendMessage(jid, {
                    text: '❌ Debes ingresar una cantidad válida.\n*Ejemplo:* `.banco pedir 50000` (Máx: $1,000,000)'
                }, { quoted: m });
            }

            const res = economy.requestLoan(sender, amount);
            if (!res.success) {
                return await sock.sendMessage(jid, {
                    text: `⚠️ ${res.error}`
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '🏛️ *BANCO CENTRAL — PRÉSTAMO APROBADO*',
                    '',
                    `💵 *Monto acreditado:* $${economy.formatNumber(res.capital)} monedas`,
                    `📈 *Interés aplicado (5%):* $${economy.formatNumber(res.totalPagar - res.capital)}`,
                    `💳 *Total a pagar:* $${economy.formatNumber(res.totalPagar)} monedas`,
                    `⏳ *Vencimiento:* 24 horas`,
                    '',
                    `💰 *Nuevo saldo en mano:* $${economy.formatNumber(user.monedas)}`,
                    '',
                    '_Usa .banco pagar <cantidad> o .banco pagar todo cuando desees liquidar._',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── 4. SUBCOMANDO: PAGAR (Abono o Liquidación) ────────────────────────
        if (subCmd === 'pagar' || subCmd === 'abonar') {
            const val = (args[1] || '').toLowerCase().trim();
            if (!val) {
                return await sock.sendMessage(jid, {
                    text: '❌ Indica la cantidad a pagar o escribe `todo`.\n*Ejemplo:* `.banco pagar 20000` o `.banco pagar todo`'
                }, { quoted: m });
            }

            const res = economy.payLoan(sender, val);
            if (!res.success) {
                return await sock.sendMessage(jid, {
                    text: `❌ ${res.error}`
                }, { quoted: m });
            }

            if (res.liquidado) {
                return await sock.sendMessage(jid, {
                    text: [
                        '🎉 *DEUDA TOTALMENTE LIQUIDADA*',
                        '',
                        `✅ Pagaste: *$${economy.formatNumber(res.pagado)}* monedas`,
                        '✨ ¡Felicidades! Has cancelado toda tu deuda bancaria.',
                        `💰 *Saldo en mano restante:* $${economy.formatNumber(res.saldoRestante)}`,
                        '',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '💳 *PAGO PROCESADO EXITOSAMENTE*',
                    '',
                    `💵 *Abono realizado:* $${economy.formatNumber(res.pagado)} monedas`,
                    `📉 *Deuda pendiente:* $${economy.formatNumber(res.restante)} monedas`,
                    `💰 *Saldo en mano restante:* $${economy.formatNumber(res.saldoRestante)}`,
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── 5. SUBCOMANDO: DEUDA (Detalles del préstamo) ──────────────────────
        if (subCmd === 'deuda') {
            const loan = economy.getLoanStatus(sender);
            if (!loan) {
                return await sock.sendMessage(jid, {
                    text: '✅ *No tienes ninguna deuda activa en el banco.*\n¡Tu historial crediticio está limpio! 🎉\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            return await sock.sendMessage(jid, {
                text: [
                    '📑 *ESTADO DE TU DEUDA ACTIVA*',
                    '',
                    `💳 *Monto total a pagar:* $${economy.formatNumber(loan.monto)} monedas`,
                    `💵 *Capital inicial prestado:* $${economy.formatNumber(loan.capital)}`,
                    `📈 *Intereses acumulados (5%):* $${economy.formatNumber(loan.interes)}`,
                    `⏳ *Plazo:* ${loan.tiempoRestante}`,
                    loan.vencida ? '⚠️ *¡ADVERTENCIA: Tu préstamo ha superado el plazo de 24 horas!*' : '',
                    '',
                    `💰 *Tu dinero disponible para pagar:* $${economy.formatNumber(user.monedas)}`,
                    '',
                    `_Usa .banco pagar todo para liquidar._`,
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n')
            }, { quoted: m });
        }

        // ── 6. SUBCOMANDO POR DEFECTO: SALDO GENERAL & GUÍA ───────────────────
        const loanStatus = economy.getLoanStatus(sender);
        const deudaText = loanStatus
            ? `⚠️ Deuda activa: *$${economy.formatNumber(loanStatus.monto)}* (${loanStatus.tiempoRestante})`
            : '✅ Sin deudas pendientes';

        return await sock.sendMessage(jid, {
            text: [
                '╔══════════════════════════╗',
                '║   🏛️  BANCO & ECONOMÍA   ║',
                '╚══════════════════════════╝',
                '',
                `👤 *Usuario:* @${sender.split('@')[0]}`,
                `💵 *Dinero en mano:* $${economy.formatNumber(user.monedas)}`,
                `🏦 *Dinero en banco:* $${economy.formatNumber(user.banco)}`,
                `⭐ *Nivel:* ${user.level} (EXP: ${user.exp}/${user.level * 250})`,
                `⚔️ *Ataque:* ${user.ataque} | 🛡️ *Defensa:* ${user.defensa}`,
                '',
                `📊 *Estado de crédito:*`,
                `${deudaText}`,
                '',
                '📋 *Comandos del Banco:*',
                '• `.banco saldo` — Ver tu balance general',
                '• `.banco depositar <cant|todo>` — Guardar dinero en tu banco',
                '• `.banco retirar <cant|todo>` — Sacar dinero del banco a la mano',
                '• `.banco pedir <cant>` — Solicitar préstamo (máx $1M, 5%)',
                '• `.banco pagar <cant>` — Pagar parte de la deuda',
                '• `.banco pagar todo` — Liquidar toda la deuda',
                '• `.banco deuda` — Consultar detalles de tu deuda',
                '',
                '💡 *¿Cómo ganar más monedas?*',
                '• `.diario` — Reclama tu recompensa diaria ($5,000 - $10,000)',
                '• `.trabajar` — Trabaja cada 15 min ($800 - $3,500 + EXP)',
                '• `.transferir @user <cant>` — Enviar monedas a un amigo',
                '',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

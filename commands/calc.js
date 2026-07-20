/**
 * Calculator command - safely evaluates math expressions
 * Usage: $calc 2+2 | $calc sqrt(144) | $calc (12*5)/3 | $calc 2^10
 *
 * Security model: validate the raw user input BEFORE any substitution.
 * After substitution we only produce `Math.*` calls + numbers + operators,
 * so there is no injection path once the input gate passes.
 */

const ALLOWED_FUNCTIONS = ['sqrt', 'sin', 'cos', 'tan', 'log', 'abs', 'pi', 'e'];
const FUNC_PATTERN = new RegExp(`\\b(${ALLOWED_FUNCTIONS.join('|')})\\b`, 'g');

function safeEval(expr) {
    const sanitized = expr.trim();
    if (!sanitized) throw new Error('Empty expression.');

    // Strip out allowed function names from the input, then check that ONLY
    // digits, whitespace, basic operators, parens, dots, and commas remain.
    // This validates the raw string before any substitution.
    const stripped = sanitized.replace(FUNC_PATTERN, '');
    if (!/^[\d\s+\-*/^%().,']+$/.test(stripped)) {
        throw new Error('Invalid expression — only numbers, operators (+−×÷%), and the functions sqrt/sin/cos/tan/log/abs are allowed.');
    }

    // Safe substitutions (operate on the original sanitized string, not stripped)
    const safe = sanitized
        .replace(/\^/g, '**')
        .replace(/\bsqrt\b/g, 'Math.sqrt')
        .replace(/\bsin\b/g, 'Math.sin')
        .replace(/\bcos\b/g, 'Math.cos')
        .replace(/\btan\b/g, 'Math.tan')
        .replace(/\blog\b/g, 'Math.log')
        .replace(/\babs\b/g, 'Math.abs')
        .replace(/\bpi\b/g, 'Math.PI')
        .replace(/\be\b/g, 'Math.E');

    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + safe + ')')();
    if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error(isNaN(result) ? 'Result is NaN — check your expression.' : 'Result is not a finite number (division by zero?).');
    }
    return result;
}

function formatResult(n) {
    if (Number.isInteger(n)) return n.toString();
    // Up to 10 significant digits, strip trailing zeros
    return parseFloat(n.toPrecision(10)).toString();
}

async function calcCommand(sock, chatId, message, userMessage) {
    const expr = userMessage.slice(5).trim(); // strip "$calc"

    if (!expr) {
        await sock.sendMessage(chatId, {
            text: [
                '🧮 *Calculator*',
                '',
                'Usage: `$calc <expression>`',
                '',
                '*Examples:*',
                '• `$calc 2 + 2`',
                '• `$calc 10 * 5 / 2`',
                '• `$calc sqrt(144)`',
                '• `$calc 2^10`',
                '• `$calc (15 + 3) * 4`',
                '• `$calc sin(0.5)`',
                '• `$calc log(100)`',
                '• `$calc pi * 2`',
                '',
                '*Supported:* `+  −  *  /  %  ^`',
                '*Functions:* `sqrt  sin  cos  tan  log  abs`',
                '*Constants:* `pi  e`',
            ].join('\n')
        }, { quoted: message });
        return;
    }

    try {
        const result = safeEval(expr);
        await sock.sendMessage(chatId, {
            text: `🧮 *Calculator*\n\n📥 Input: \`${expr}\`\n📤 Result: *${formatResult(result)}*`
        }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, {
            text: `❌ *Calculation Error*\n\n${err.message || 'Invalid expression.'}\n\nTry: \`$calc 2+2\``
        }, { quoted: message });
    }
}

module.exports = calcCommand;

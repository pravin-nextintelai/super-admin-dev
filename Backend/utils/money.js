// Integer-paise money helpers. Monetary values are stored as BIGINT paise in the Payment DB;
// this module converts to/from display strings without ever touching JS floating point.

/** Parse a BIGINT/NUMERIC/number into an integer number of paise, or null when absent/invalid. */
function toPaiseInt(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'bigint') return Number(value);
    const s = String(value).trim();
    if (!/^-?\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isSafeInteger(n) ? n : null;
}

/** 8475 → "84.75"; -5 → "-0.05"; null → null. */
function paiseToRupeeString(paise) {
    const p = toPaiseInt(paise);
    if (p === null) return null;
    const sign = p < 0 ? '-' : '';
    const abs = Math.abs(p);
    const whole = Math.floor(abs / 100);
    const frac = abs % 100;
    return `${sign}${whole}.${String(frac).padStart(2, '0')}`;
}

/** Same as paiseToRupeeString but returns a Number for JSON consumers that need one (2dp exact). */
function paiseToRupeeNumber(paise) {
    const s = paiseToRupeeString(paise);
    return s === null ? null : Number(s);
}

/**
 * "100", "100.5", "100.50", "0.05" → integer paise using string arithmetic (no float).
 * Rejects more than 2 decimals. Returns null when unparseable.
 */
function rupeesToPaise(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') value = value.toFixed(2);
    const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
    if (!m) return null;
    const [, sign, whole, frac = ''] = m;
    const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
    return Number.isSafeInteger(paise) ? (sign ? -paise : paise) : null;
}

function sumPaise(...values) {
    return values.reduce((acc, v) => acc + (toPaiseInt(v) || 0), 0);
}

module.exports = { toPaiseInt, paiseToRupeeString, paiseToRupeeNumber, rupeesToPaise, sumPaise };

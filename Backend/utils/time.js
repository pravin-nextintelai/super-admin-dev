/**
 * IST date/time utilities.
 * IST = UTC + 5:30 (Asia/Kolkata, no daylight saving).
 */

const IST_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Get current IST Date object.
 */
function nowIST() {
    const utc = new Date();
    return new Date(utc.getTime() + IST_OFFSET_MS);
}

/**
 * Get start of today in IST as a UTC Date (for SQL comparisons).
 * e.g. if IST is 2024-02-10 14:30, returns UTC representation of 2024-02-10 00:00 IST
 */
function startOfTodayIST() {
    const ist = nowIST();
    const dateStr = ist.toISOString().slice(0, 10); // YYYY-MM-DD
    // Start of day in IST = dateStr 00:00:00 IST = dateStr - 5:30 UTC
    return new Date(`${dateStr}T00:00:00+05:30`);
}

/**
 * Get end of today in IST as a UTC Date.
 */
function endOfTodayIST() {
    const ist = nowIST();
    const dateStr = ist.toISOString().slice(0, 10);
    return new Date(`${dateStr}T23:59:59.999+05:30`);
}

/**
 * Get a date N days ago from today IST start.
 */
function daysAgoIST(n) {
    const start = startOfTodayIST();
    return new Date(start.getTime() - n * 24 * 60 * 60 * 1000);
}

// ── Formatting ───────────────────────────────────────────────────────────────

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

// Fixed English abbreviations (Intl 'short' yields "Sept" in en-GB; we want "Sep").
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: IST_TIMEZONE, weekday: 'short' });

function toDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Render a timestamp in IST for API consumers.
 *
 * @param {Date|string|number} value  Any value `new Date()` accepts (DB TIMESTAMPTZ, ISO string, epoch ms).
 * @returns {null | {
 *   iso: string,        // 2026-09-11T14:35:20+05:30
 *   date: string,       // 11 Sep 2026
 *   time: string,       // 02:35 PM
 *   time24: string,     // 14:35
 *   weekday: string,    // Thu
 *   display: string,    // Thu, 11 Sep 2026, 02:35 PM IST
 *   timezone: 'Asia/Kolkata',
 *   utc: string,        // 2026-09-11T09:05:20.000Z
 *   epoch_ms: number
 * }}
 */
function formatIST(value) {
    const d = toDate(value);
    if (!d) return null;

    const p = {};
    for (const part of partsFormatter.formatToParts(d)) {
        if (part.type !== 'literal') p[part.type] = part.value;
    }

    const hour24 = Number(p.hour);
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const meridiem = hour24 < 12 ? 'AM' : 'PM';
    const monthShort = MONTHS_SHORT[Number(p.month) - 1] || p.month;
    const weekday = weekdayFormatter.format(d);

    const date = `${p.day} ${monthShort} ${p.year}`;
    const time = `${String(hour12).padStart(2, '0')}:${p.minute} ${meridiem}`;
    const time24 = `${p.hour}:${p.minute}`;

    return {
        iso: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${IST_OFFSET}`,
        date,
        time,
        time24,
        weekday,
        display: `${weekday}, ${date}, ${time} IST`,
        timezone: IST_TIMEZONE,
        utc: d.toISOString(),
        epoch_ms: d.getTime(),
    };
}

/**
 * IST calendar date (YYYY-MM-DD) for a timestamp.
 */
function istDateString(value) {
    const f = formatIST(value);
    return f ? f.iso.slice(0, 10) : null;
}

/**
 * Start of an IST calendar day as a UTC Date. `dateStr` is YYYY-MM-DD.
 */
function istDayStart(dateStr) {
    return toDate(`${dateStr}T00:00:00${IST_OFFSET}`);
}

/**
 * Exclusive end of an IST calendar day (start of next day) as a UTC Date.
 * Use `created_at < istDayEndExclusive(to)` so the whole `to` day is included.
 */
function istDayEndExclusive(dateStr) {
    const start = istDayStart(dateStr);
    return start ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : null;
}

/**
 * Human-readable elapsed time, e.g. "3h 20m", "2d 4h", "45m", "just now".
 */
function humanizeDuration(ms) {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return null;
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    if (totalMinutes < 1) return 'just now';
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
}

module.exports = {
    IST_TIMEZONE,
    IST_OFFSET,
    nowIST,
    startOfTodayIST,
    endOfTodayIST,
    daysAgoIST,
    formatIST,
    istDateString,
    istDayStart,
    istDayEndExclusive,
    humanizeDuration,
};

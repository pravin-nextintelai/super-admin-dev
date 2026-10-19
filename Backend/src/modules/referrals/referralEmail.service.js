/**
 * Sales Referrals → "Send to email": mails referral code(s) + signup link(s) to the sales owner using the
 * HTML template in templates/referral-code-email.html (kept verbatim; placeholders are substituted here).
 *
 * One email can carry several codes: the template's "Code panel" block (code + link) is repeated once per
 * code inside the same message, so an owner created with three codes gets ONE email, not three.
 *
 * Env:
 *   CUSTOMER_APP_URL / FRONTEND_URL   customer app base for the signup link (default https://jurinex-dev.netlify.app)
 *   REFERRAL_EMAIL_LOGO_URL           hosted PNG for {{logo_url}} (optional; the <img alt> shows "JuriNex" when unset)
 *   REFERRAL_EMAIL_SENDER_TITLE       {{sender_title}} (default "Sales Partner Programme")
 *   REFERRAL_EMAIL_SUPPORT            {{support_email}} (default EMAIL_FROM / EMAIL_USER)
 *   COMPANY_ADDRESS                   {{company_address}}
 *   EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS / EMAIL_FROM   SMTP (utils/sendEmail.js)
 */
const fs = require('fs');
const path = require('path');
const sendEmail = require('../../infrastructure/email/sendEmail');
const logger = require('../../config/logger');

const TEMPLATE_PATH = path.join(__dirname, '..', '..', '..', 'templates', 'email', 'referral-code-email.html');
const SIGNUP_PATH = '/register'; // same as the admin UI's share links (Frontend salesReferrals.utils SIGNUP_PATH)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PANEL_START = '<!-- Code panel -->';
const PANEL_END = '<!-- Button -->';

let templateCache = null;
function template() {
    if (!templateCache) templateCache = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    return templateCache;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const listText = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

function customerAppUrl() {
    return String(process.env.CUSTOMER_APP_URL || process.env.FRONTEND_URL || 'https://jurinex-dev.netlify.app').replace(/\/+$/, '');
}
function referralLink(code) {
    return `${customerAppUrl()}${SIGNUP_PATH}?ref=${encodeURIComponent(code)}`;
}
function issuedDate(d) {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d ? new Date(d) : new Date());
}

/**
 * Fill the template for one or more codes. `vars.codes` = [{ code, label, link, active, replacedByCode }].
 * The template text is the one supplied by the business and is not edited; the only dynamic rewrites are
 * (a) repeating the code panel per code and (b) swapping the "is active" sentence/status for disabled codes.
 */
function renderReferralCodeEmail(vars) {
    const codes = vars.codes && vars.codes.length ? vars.codes : [{ code: vars.code, label: vars.territory, link: vars.link, active: vars.active !== false, replacedByCode: vars.replacedByCode }];
    const first = codes[0];
    const many = codes.length > 1;
    const allActive = codes.every((c) => c.active);
    const codeList = listText(codes.map((c) => esc(c.code)));

    let html = template();

    // (a) one code panel per code, inside the single message
    const s = html.indexOf(PANEL_START);
    const e = html.indexOf(PANEL_END);
    if (s >= 0 && e > s) {
        const block = html.slice(s, e);
        const panels = codes.map((c) => block
            .replace(/\{\{referral_code\}\}/g, esc(c.code) + (many && c.label ? ` <span style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:0;font-weight:600;color:#71717A;">${esc(c.label)}</span>` : ''))
            .replace(/\{\{referral_link\}\}/g, esc(c.link))
            .replace('padding:0 40px;">', 'padding:0 40px 12px 40px;">')).join('');
        html = html.slice(0, s) + panels + html.slice(e);
    }

    // (b) remaining placeholders
    const map = {
        logo_url: vars.logoUrl || '',
        owner_name: vars.ownerName,
        territory: vars.territory,
        referral_code: many ? `one of your codes (${codes.map((c) => c.code).join(', ')})` : first.code,
        referral_link: first.link,
        issued_date: vars.issuedDate,
        sender_name: vars.senderName,
        sender_title: vars.senderTitle,
        support_email: vars.supportEmail,
        company_address: vars.companyAddress,
    };
    html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? esc(map[k]) : m));

    if (many) {
        html = html
            .replace('Your JuriNex referral code for the', 'Your JuriNex referral codes for the')
            .replace('Your referral code ' + esc(map.referral_code) + ' for', `Your referral codes ${codeList} for`)
            .replace('Please share it with the firms', 'Please share them with the firms')
            .replace('<title>Your JuriNex referral code</title>', '<title>Your JuriNex referral codes</title>');
    }
    if (!allActive) {
        const replaced = codes.filter((c) => !c.active && c.replacedByCode).map((c) => esc(c.replacedByCode));
        html = html
            .replace('color:#0F766E;font-weight:600;">Active</td>', 'color:#B91C1C;font-weight:600;">Disabled</td>')
            .replace(/has been set up and is active from today\. Please share (it|them) with the firms and professionals you are in touch with, so that their signups are credited to you\./,
                `${many ? 'have' : 'has'} been <strong style="color:#B91C1C;">disabled</strong>${replaced.length ? ` and replaced by <strong style="color:#0A0A0A;">${replaced.join(', ')}</strong>` : ''}. Please stop sharing ${many ? 'them' : 'this code'}; new signups will no longer be credited.`)
            .replace(/(Your referral codes? [^<]*? for [^<]*?) (is|are) active\./, '$1 ' + (many ? 'have' : 'has') + ' been disabled.');
    }
    return html;
}

function textVersion(vars) {
    const codes = vars.codes;
    const allActive = codes.every((c) => c.active);
    return [
        `Hi ${vars.ownerName},`,
        '',
        allActive
            ? `Your JuriNex referral ${codes.length > 1 ? 'codes' : 'code'} for the ${vars.territory} territory ${codes.length > 1 ? 'are' : 'is'} active.`
            : `Your JuriNex referral ${codes.length > 1 ? 'codes' : 'code'} for the ${vars.territory} territory ${codes.length > 1 ? 'have' : 'has'} been disabled.`,
        ...codes.flatMap((c) => [`Referral code: ${c.code}${c.label ? ` (${c.label})` : ''}${c.active ? '' : ` — disabled${c.replacedByCode ? `, replaced by ${c.replacedByCode}` : ''}`}`, `Referral link: ${c.link}`]),
        `Issued on: ${vars.issuedDate}`,
        '',
        `Regards, ${vars.senderName}, ${vars.senderTitle}, JuriNex`,
        `Questions? ${vars.supportEmail}`,
    ].join('\n');
}

function baseVars(ownerName, actor) {
    return {
        logoUrl: process.env.REFERRAL_EMAIL_LOGO_URL || '',
        ownerName: String(ownerName || '').trim().split(/\s+/)[0] || 'there',
        senderName: actor?.name || 'JuriNex Team',
        senderTitle: process.env.REFERRAL_EMAIL_SENDER_TITLE || 'Sales Partner Programme',
        supportEmail: process.env.REFERRAL_EMAIL_SUPPORT || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        companyAddress: process.env.COMPANY_ADDRESS || '',
    };
}

function preflight(recipient) {
    if (!EMAIL_RE.test(recipient)) {
        return { status: 400, code: 'RECIPIENT_REQUIRED', message: 'No email address for this sales owner. Add one to the owner or enter a recipient.' };
    }
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return { status: 503, code: 'EMAIL_NOT_CONFIGURED', message: 'Email sending is not configured on the server (EMAIL_USER / EMAIL_PASS).' };
    }
    return null;
}

async function markEmailed(pool, codeIds, recipient) {
    await pool.query(`UPDATE referral_codes SET last_emailed_at = NOW(), last_emailed_to = $1 WHERE id = ANY($2::uuid[])`, [recipient, codeIds])
        .catch((e) => logger.errorWithContext('Referral email audit update failed', e, { layer: 'SALES_REFERRALS', summary: { codeIds } }));
}

const CODE_SQL = `
    SELECT rc.id, rc.code, rc.label, rc.active, rc.created_at, rep.code AS replaced_by_code,
           so.id AS owner_id, so.name AS owner_name, so.email AS owner_email
    FROM referral_codes rc
    JOIN sales_owners so ON so.id = rc.owner_id
    LEFT JOIN referral_codes rep ON rep.id = rc.replaced_by_code_id`;

async function deliver(pool, { rows, recipient, actor, subject }) {
    const codes = rows.map((r) => ({ id: r.id, code: r.code, label: r.label || null, link: referralLink(r.code), active: Boolean(r.active), replacedByCode: r.replaced_by_code || null }));
    const labels = [...new Set(codes.map((c) => c.label).filter(Boolean))];
    const vars = {
        ...baseVars(rows[0].owner_name, actor),
        territory: labels.length ? labels.join(', ') : rows[0].owner_name,
        issuedDate: issuedDate(rows[0].created_at),
        codes,
    };
    await sendEmail({ email: recipient, subject, html: renderReferralCodeEmail(vars), text: textVersion(vars) });
    await markEmailed(pool, codes.map((c) => c.id), recipient);
    return { to: recipient, subject, codes: codes.map((c) => ({ id: c.id, code: c.code, status: c.active ? 'active' : 'disabled' })), sentAt: new Date().toISOString() };
}

/** One code (used for "this code was created / disabled / refreshed" notices). */
async function sendReferralCodeEmail(pool, { codeId, to, actor }) {
    const { rows } = await pool.query(`${CODE_SQL} WHERE rc.id = $1`, [codeId]);
    const row = rows[0];
    if (!row) return { error: { status: 404, code: 'REFERRAL_CODE_NOT_FOUND', message: 'Referral code not found.' } };
    const recipient = String(to || row.owner_email || '').trim();
    const bad = preflight(recipient);
    if (bad) return { error: bad };
    const subject = row.active
        ? `Your JuriNex referral code ${row.code}${row.label ? ` — ${row.label}` : ''}`
        : `JuriNex referral code ${row.code} has been disabled${row.replaced_by_code ? ` — use ${row.replaced_by_code}` : ''}`;
    const data = await deliver(pool, { rows, recipient, actor, subject });
    return { data: { codeId, code: row.code, status: row.active ? 'active' : 'disabled', ...data } };
}

/**
 * All of an owner's codes in ONE email (default: active codes only; `codeIds` narrows the set).
 */
async function sendOwnerCodesEmail(pool, { ownerId, codeIds, to, actor }) {
    const owner = await pool.query('SELECT id, name, email FROM sales_owners WHERE id = $1', [ownerId]);
    if (!owner.rows[0]) return { error: { status: 404, code: 'SALES_OWNER_NOT_FOUND', message: 'Sales owner not found.' } };
    const recipient = String(to || owner.rows[0].email || '').trim();
    const bad = preflight(recipient);
    if (bad) return { error: bad };
    const { rows } = codeIds && codeIds.length
        ? await pool.query(`${CODE_SQL} WHERE rc.owner_id = $1 AND rc.id = ANY($2::uuid[]) ORDER BY rc.created_at ASC`, [ownerId, codeIds])
        : await pool.query(`${CODE_SQL} WHERE rc.owner_id = $1 AND rc.active = TRUE ORDER BY rc.created_at ASC`, [ownerId]);
    if (!rows.length) return { error: { status: 400, code: 'NO_CODES_TO_SEND', message: 'This sales owner has no active referral codes to send.' } };
    const subject = rows.length === 1
        ? `Your JuriNex referral code ${rows[0].code}${rows[0].label ? ` — ${rows[0].label}` : ''}`
        : `Your JuriNex referral codes (${rows.length})`;
    const data = await deliver(pool, { rows, recipient, actor, subject });
    return { data: { ownerId, count: rows.length, ...data } };
}

module.exports = { sendReferralCodeEmail, sendOwnerCodesEmail, renderReferralCodeEmail, referralLink };

/**
 * Renders the Finance Admin invoice / receipt PDFs from the business-supplied Mustache templates:
 *   templates/tax-invoice.html      (application invoice — only when an app_invoices number exists)
 *   templates/payment-receipt.html  (same layout, receipt wording — any captured payment)
 *
 * Only the Mustache subset the templates use is implemented here (no dependency): escaped variables
 * `{{a.b}}`, sections `{{#x}}…{{/x}}` over arrays / truthy values, and `{{.}}` inside list sections.
 *
 * Env (all optional):
 *   COMPANY_NAME (default JuriNex), COMPANY_TAGLINE, COMPANY_LOGO_URL (or REFERRAL_EMAIL_LOGO_URL),
 *   COMPANY_ADDRESS, COMPANY_COUNTRY (default India), COMPANY_GSTIN, COMPANY_BILLING_EMAIL (or EMAIL_FROM),
 *   INVOICE_SAC (SAC code printed under the item), INVOICE_TERMS ("term one | term two")
 */
const fs = require('fs');
const path = require('path');
const { toPaiseInt, paiseToRupeeString } = require('../utils/money');

const TEMPLATES = {
    invoice: path.join(__dirname, '..', 'templates', 'tax-invoice.html'),
    receipt: path.join(__dirname, '..', 'templates', 'payment-receipt.html'),
};
const cache = {};
function template(kind) {
    if (!cache[kind]) cache[kind] = fs.readFileSync(TEMPLATES[kind], 'utf8');
    return cache[kind];
}

// ── Mustache subset ───────────────────────────────────────────────────────────
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function lookup(stack, key) {
    if (key === '.') return stack[stack.length - 1];
    for (let i = stack.length - 1; i >= 0; i -= 1) {
        let v = stack[i];
        let ok = true;
        for (const part of key.split('.')) {
            if (v != null && typeof v === 'object' && part in v) v = v[part];
            else { ok = false; break; }
        }
        if (ok) return v;
    }
    return undefined;
}

function render(tpl, stack) {
    // sections first (innermost-safe because we recurse on the body)
    const out = tpl.replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, key, body) => {
        const v = lookup(stack, key);
        if (Array.isArray(v)) return v.map((item) => render(body, [...stack, item])).join('');
        if (!v) return '';
        return render(body, typeof v === 'object' ? [...stack, v] : stack);
    });
    return out.replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
        const v = lookup(stack, key);
        return v == null ? '' : esc(v);
    });
}

function renderTemplate(kind, data) {
    return render(template(kind), [data]);
}

// ── Amount in words (Indian numbering) ───────────────────────────────────────
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function below100(n) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`; }
function below1000(n) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return [h ? `${ONES[h]} hundred` : '', r ? below100(r) : ''].filter(Boolean).join(' ');
}
function integerWords(n) {
    if (n === 0) return 'zero';
    const parts = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1e3); n %= 1e3;
    if (crore) parts.push(`${integerWords(crore)} crore`);
    if (lakh) parts.push(`${below100(lakh)} lakh`);
    if (thousand) parts.push(`${below100(thousand)} thousand`);
    if (n) parts.push(below1000(n));
    return parts.join(' ');
}
function rupeesInWords(paise) {
    const p = toPaiseInt(paise) || 0;
    const rupees = Math.floor(p / 100);
    const ps = p % 100;
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    let s = `${cap(integerWords(rupees))} rupee${rupees === 1 ? '' : 's'}`;
    if (ps) s += ` and ${below100(ps)} paise`;
    return `${s} only`;
}

// ── Data mapping ─────────────────────────────────────────────────────────────
const inr = (paise) => {
    const s = paiseToRupeeString(paise);
    if (s == null) return null;
    const [whole, frac] = s.split('.');
    const neg = whole.startsWith('-');
    return `${neg ? '-' : ''}${Number(whole.replace('-', '')).toLocaleString('en-IN')}.${frac}`;
};
const rate = (v) => (v == null ? null : String(Number(v)).replace(/\.0+$/, ''));
const dateIST = (d) => (d ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(d)) : null);
const nonZero = (paise) => (toPaiseInt(paise) ? inr(paise) : null); // Mustache sections treat "0.00" as truthy, so zero → null

function company() {
    const env = process.env;
    return {
        name: env.COMPANY_NAME || 'JuriNex',
        tagline: env.COMPANY_TAGLINE || 'Legal intelligence platform',
        logo_src: env.COMPANY_LOGO_URL || env.REFERRAL_EMAIL_LOGO_URL || null,
        address: env.COMPANY_ADDRESS || null,
        country: env.COMPANY_COUNTRY || 'India',
        email: env.COMPANY_BILLING_EMAIL || env.EMAIL_FROM || env.EMAIL_USER || null,
        gstin: env.COMPANY_GSTIN || null,
    };
}

function terms(kind) {
    const env = String(process.env.INVOICE_TERMS || '').trim();
    if (env) return env.split('|').map((t) => t.trim()).filter(Boolean);
    return kind === 'receipt'
        ? ['This receipt confirms the payment recorded against the Razorpay payment ID shown above.', 'Keep this receipt for your records; the tax invoice (when issued) carries the GST breakup for the same payment.']
        : ['Subscription is activated for the account named above from the purchase date.', 'Prices are inclusive of GST as shown; GST is charged as per the applicable rate on the purchase date.'];
}

/**
 * @param {'invoice'|'receipt'} kind
 * @param {object} pay   serialized payment (usersPlansService.serializePayment)
 * @param {object} user  { id, username, email, phone, location }
 * @param {object|null} firm  queryUserFirm row
 */
function buildData(kind, pay, user, firm) {
    const P = pay.paise;
    const taxable = P.basic != null ? P.basic : P.total;
    const cgstRate = pay.tax?.cgst_rate; const sgstRate = pay.tax?.sgst_rate; const igstRate = pay.tax?.igst_rate;
    const gstPaise = (P.cgst || 0) + (P.sgst || 0) + (P.igst || 0);
    const gstRate = pay.tax ? (pay.tax.type === 'IGST' ? Number(igstRate || 0) : Number(cgstRate || 0) + Number(sgstRate || 0)) : 0;
    const isReceipt = kind === 'receipt';
    const status = String(pay.status || '').toLowerCase();
    const paidLabel = pay.is_paid ? (pay.refund_status ? `${pay.refund_status === 'full' ? 'Refunded' : 'Partially refunded'}` : 'Paid') : (status.charAt(0).toUpperCase() + status.slice(1));
    const cityStatePin = firm ? [firm.city, firm.district, firm.state, firm.pin_code].filter(Boolean).join(', ') : (user.location || null);
    const number = isReceipt ? (pay.razorpay_receipt || `RCPT-${pay.payment_id}`) : pay.invoice_number;

    return {
        company: company(),
        customer: {
            name: firm && firm.member_role === 'admin' ? `${firm.firm_name} (${user.username || user.email})` : (user.username || user.email || `User #${user.id}`),
            address: firm?.office_address || null,
            city_state_pin: cityStatePin || null,
            email: user.email || firm?.firm_email || null,
            phone: user.phone || firm?.firm_mobile || null,
            gstin: firm?.gst_number || null,
        },
        invoice: {
            number,
            invoice_number: isReceipt ? (pay.invoice_number || null) : null,
            date: dateIST(isReceipt ? pay.purchase_date : (pay.invoice_issued_at || pay.purchase_date)),
            order_id: pay.razorpay_order_id || null,
            place_of_supply: null,                 // customer state is not captured by the payment flow yet
            reverse_charge: pay.tax ? 'No' : null,
            paid: Boolean(pay.is_paid),
            status_label: paidLabel,
            payment_method: pay.payment_method ? pay.payment_method.charAt(0).toUpperCase() + pay.payment_method.slice(1) : 'Razorpay',
            payment_id: pay.razorpay_payment_id || null,
            receipt: pay.razorpay_receipt || null,
        },
        items: [{
            index: 1,
            name: `${pay.plan_name || 'Plan'} subscription`,
            description: `Purchased on ${dateIST(pay.purchase_date)}${pay.tax?.basis === 'inclusive' ? ' · price inclusive of GST' : ''}`,
            sac: process.env.INVOICE_SAC || null,
            qty: 1,
            unit: null,
            rate: inr(taxable),
            taxable: inr(taxable),
            gst_amount: inr(gstPaise),
            gst_rate: rate(gstRate),
            total: inr(P.total),
        }],
        totals: {
            total_qty: 1,
            taxable: inr(taxable),
            cgst: nonZero(P.cgst), cgst_rate: rate(cgstRate),
            sgst: nonZero(P.sgst), sgst_rate: rate(sgstRate),
            igst: nonZero(P.igst), igst_rate: rate(igstRate),
            round_off: null,
            grand_total: inr(P.total),
            grand_total_label: isReceipt ? 'Amount received' : 'Total paid',
            amount_in_words: rupeesInWords(P.total),
        },
        terms: terms(kind),
    };
}

function renderBillingDocument(kind, pay, user, firm) {
    return renderTemplate(kind, buildData(kind, pay, user, firm));
}

module.exports = { renderBillingDocument, buildData, renderTemplate, rupeesInWords };

/**
 * Pure reconciliation logic: Razorpay payments vs Payment-DB rows → issues + summary.
 * No I/O here so it can be unit-tested with fixtures (tests/reconciliation_matcher.test.js).
 *
 * All amounts are integer paise. A DB row is one of:
 *   payments (plan purchase, carries GST breakdown + app invoice link),
 *   user_token_topup_purchases, user_storage_addon_purchases (amount only, no GST columns, no invoice).
 */

const ISSUE_TYPES = [
    'RAZORPAY_ONLY', 'DB_ONLY', 'DUPLICATE_REFERENCE', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'STATUS_MISMATCH',
    'ORDER_MISMATCH', 'REFUND_MISMATCH', 'TAX_BREAKDOWN_MISMATCH', 'MISSING_INVOICE', 'INCOMPLETE_RECORD',
];
const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'];

const PAID_DB = new Set(['captured', 'paid', 'success', 'succeeded', 'completed']);
const PENDING_DB = new Set(['authorized', 'created', 'pending', 'processing', 'initiated']);
const FAILED_DB = new Set(['failed', 'cancelled', 'canceled', 'error']);

/** Collapse the many status spellings into paid | pending | failed | refunded | unknown. */
function normalizeDbStatus(status, refundedPaise = 0, totalPaise = null) {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'refunded') return 'refunded';
    if (PAID_DB.has(s)) {
        if (refundedPaise > 0 && totalPaise != null && refundedPaise >= totalPaise) return 'refunded';
        return 'paid';
    }
    if (PENDING_DB.has(s)) return 'pending';
    if (FAILED_DB.has(s)) return 'failed';
    return s ? 'unknown' : 'unknown';
}

function normalizeRzStatus(p) {
    const s = String(p.status || '').toLowerCase();
    if (s === 'refunded') return 'refunded';
    if (s === 'captured') {
        if (p.amount_refunded_paise > 0 && p.amount_paise != null && p.amount_refunded_paise >= p.amount_paise) return 'refunded';
        return 'paid';
    }
    if (s === 'authorized' || s === 'created') return 'pending';
    if (s === 'failed') return 'failed';
    return 'unknown';
}

function refundClass(refundedPaise, totalPaise) {
    if (!refundedPaise || refundedPaise <= 0) return 'none';
    if (totalPaise != null && refundedPaise >= totalPaise) return 'full';
    return 'partial';
}

const inRange = (ts, from, to) => {
    if (!ts) return false;
    const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
    return t >= from.getTime() && t < to.getTime();
};

/**
 * @param {object} input
 * @param {Array}  input.razorpay   normalized Razorpay payments (razorpayClient.normalizeRazorpayPayment)
 * @param {Array}  input.db         normalized DB rows: { source_table, source_id, user_id, razorpay_payment_id, razorpay_order_id,
 *                                  amount_paise, currency, status, refund_status, amount_refunded_paise, purchased_at,
 *                                  tax: { basic, cgst, sgst, igst, total, type } | null, has_invoice, plan_name, kind }
 * @param {object} input.range      { from: Date, toExclusive: Date }   strict reporting window
 * @param {object} [input.flags]    { razorpayComplete: bool, dbComplete: bool }
 * @param {object} [input.policy]   { invoiceRequiredSince: Date|null }  (null → invoices never required)
 */
function reconcile({ razorpay = [], db = [], range, flags = {}, policy = {} }) {
    const razorpayComplete = flags.razorpayComplete !== false;
    const dbComplete = flags.dbComplete !== false;
    const canReportMissing = razorpayComplete && dbComplete;
    const invoiceSince = policy.invoiceRequiredSince ? new Date(policy.invoiceRequiredSince) : null;

    const issues = [];
    const add = (issue) => issues.push({ severity: 'medium', status: 'open', ...issue });

    // Index DB rows by Razorpay payment id (duplicates = same pay_ id on more than one row).
    const byPayment = new Map();
    const noReference = [];
    db.forEach((row) => {
        if (!row.razorpay_payment_id) { noReference.push(row); return; }
        const list = byPayment.get(row.razorpay_payment_id) || [];
        list.push(row);
        byPayment.set(row.razorpay_payment_id, list);
    });

    byPayment.forEach((rows, payId) => {
        if (rows.length > 1) {
            add({
                issue_type: 'DUPLICATE_REFERENCE', severity: 'high', razorpay_payment_id: payId,
                razorpay_order_id: rows[0].razorpay_order_id || null,
                source_table: rows[0].source_table, source_id: rows[0].source_id, user_id: rows[0].user_id,
                message: `Razorpay payment ${payId} is referenced by ${rows.length} database rows`,
                details: { rows: rows.map((r) => ({ source_table: r.source_table, source_id: r.source_id, user_id: r.user_id, amount_paise: r.amount_paise, status: r.status })) },
            });
        }
    });

    // DB rows with no Razorpay reference but a paid status are incomplete (cannot be matched at all).
    noReference.forEach((row) => {
        const norm = normalizeDbStatus(row.status, row.amount_refunded_paise, row.amount_paise);
        if (norm === 'paid' || norm === 'refunded') {
            add({
                issue_type: 'INCOMPLETE_RECORD', severity: 'high', source_table: row.source_table, source_id: row.source_id, user_id: row.user_id,
                razorpay_order_id: row.razorpay_order_id || null,
                message: `${row.source_table}#${row.source_id} is ${row.status} but has no razorpay_payment_id`,
                details: { missing: ['razorpay_payment_id'], amount_paise: row.amount_paise, status: row.status },
            });
        }
    });

    const rzById = new Map(razorpay.map((p) => [p.razorpay_payment_id, p]));
    const matched = [];
    const summary = {
        razorpay: { total: razorpay.length, paid: 0, pending: 0, failed: 0, refunded_full: 0, refunded_partial: 0, amount_paid_paise: 0, amount_refunded_paise: 0 },
        db: { total: db.length, paid: 0, pending: 0, failed: 0, refunded: 0, amount_paid_paise: 0, by_table: {} },
        matched: 0,
        issues: { total: 0, open: 0, by_type: {}, by_severity: {} },
        flags: { razorpayComplete, dbComplete, missingReported: canReportMissing },
    };

    db.forEach((row) => {
        const norm = normalizeDbStatus(row.status, row.amount_refunded_paise, row.amount_paise);
        summary.db[norm === 'unknown' ? 'pending' : norm] += 1;
        if (norm === 'paid') summary.db.amount_paid_paise += row.amount_paise || 0;
        summary.db.by_table[row.source_table] = (summary.db.by_table[row.source_table] || 0) + 1;
    });

    razorpay.forEach((rz) => {
        const rzNorm = normalizeRzStatus(rz);
        const rzRefund = refundClass(rz.amount_refunded_paise, rz.amount_paise);
        if (rzNorm === 'paid') { summary.razorpay.paid += 1; summary.razorpay.amount_paid_paise += rz.amount_paise || 0; }
        else if (rzNorm === 'pending') summary.razorpay.pending += 1;
        else if (rzNorm === 'failed') summary.razorpay.failed += 1;
        else if (rzNorm === 'refunded') { summary.razorpay.refunded_full += 1; summary.razorpay.amount_paid_paise += rz.amount_paise || 0; }
        if (rzRefund === 'partial') summary.razorpay.refunded_partial += 1;
        summary.razorpay.amount_refunded_paise += rz.amount_refunded_paise || 0;

        const rows = byPayment.get(rz.razorpay_payment_id);
        if (!rows || !rows.length) {
            if (!canReportMissing) return;
            const paidLike = rzNorm === 'paid' || rzNorm === 'refunded';
            add({
                issue_type: 'RAZORPAY_ONLY',
                severity: paidLike ? 'high' : 'info',
                razorpay_payment_id: rz.razorpay_payment_id, razorpay_order_id: rz.razorpay_order_id,
                message: paidLike
                    ? `Razorpay payment ${rz.razorpay_payment_id} (${rz.status}, ${rz.amount_paise} paise) has no database record`
                    : `Razorpay payment ${rz.razorpay_payment_id} is ${rz.status} and has no database record (informational)`,
                actual: { status: rz.status, amount_paise: rz.amount_paise, currency: rz.currency, email: rz.email, created_at: rz.razorpay_created_at, notes: rz.notes, error_code: rz.error_code },
            });
            return;
        }
        rows.forEach((row) => {
            matched.push({ rz, row });
            compare(rz, row, rzNorm, rzRefund, add, invoiceSince);
        });
    });
    summary.matched = matched.length;

    // DB rows (inside the strict window) whose Razorpay payment id was not returned by the API.
    if (canReportMissing) {
        db.forEach((row) => {
            if (!row.razorpay_payment_id || rzById.has(row.razorpay_payment_id)) return;
            if (!inRange(row.purchased_at, range.from, range.toExclusive)) return; // padded rows outside the window are only for matching
            const norm = normalizeDbStatus(row.status, row.amount_refunded_paise, row.amount_paise);
            const paidLike = norm === 'paid' || norm === 'refunded';
            add({
                issue_type: 'DB_ONLY', severity: paidLike ? 'high' : 'info',
                razorpay_payment_id: row.razorpay_payment_id, razorpay_order_id: row.razorpay_order_id || null,
                source_table: row.source_table, source_id: row.source_id, user_id: row.user_id,
                message: paidLike
                    ? `${row.source_table}#${row.source_id} (${row.status}) references ${row.razorpay_payment_id} which Razorpay did not return for this range`
                    : `${row.source_table}#${row.source_id} is ${row.status}; Razorpay returned no payment ${row.razorpay_payment_id} (informational)`,
                expected: { razorpay_payment_id: row.razorpay_payment_id, amount_paise: row.amount_paise, status: row.status },
            });
        });
    }

    issues.forEach((i) => {
        summary.issues.total += 1;
        if (i.status === 'open') summary.issues.open += 1;
        summary.issues.by_type[i.issue_type] = (summary.issues.by_type[i.issue_type] || 0) + 1;
        summary.issues.by_severity[i.severity] = (summary.issues.by_severity[i.severity] || 0) + 1;
    });
    return { issues, summary, matched };
}

function compare(rz, row, rzNorm, rzRefund, add, invoiceSince) {
    const base = {
        razorpay_payment_id: rz.razorpay_payment_id, razorpay_order_id: rz.razorpay_order_id || row.razorpay_order_id || null,
        source_table: row.source_table, source_id: row.source_id, user_id: row.user_id,
    };
    const dbNorm = normalizeDbStatus(row.status, row.amount_refunded_paise, row.amount_paise);

    if (rz.currency && row.currency && rz.currency.toUpperCase() !== row.currency.toUpperCase()) {
        add({ ...base, issue_type: 'CURRENCY_MISMATCH', severity: 'high', message: `Currency differs: Razorpay ${rz.currency}, database ${row.currency}`,
            expected: { currency: row.currency }, actual: { currency: rz.currency } });
    }
    if (rz.amount_paise != null && row.amount_paise != null && rz.amount_paise !== row.amount_paise) {
        add({ ...base, issue_type: 'AMOUNT_MISMATCH', severity: 'critical',
            message: `Amount differs: Razorpay ${rz.amount_paise} paise, database ${row.amount_paise} paise`,
            expected: { amount_paise: row.amount_paise }, actual: { amount_paise: rz.amount_paise } });
    } else if (row.amount_paise == null) {
        add({ ...base, issue_type: 'INCOMPLETE_RECORD', severity: 'medium', message: `${row.source_table}#${row.source_id} has no amount stored`,
            details: { missing: ['amount'] }, actual: { amount_paise: rz.amount_paise } });
    }
    if (rz.razorpay_order_id && row.razorpay_order_id && rz.razorpay_order_id !== row.razorpay_order_id) {
        add({ ...base, issue_type: 'ORDER_MISMATCH', severity: 'high', message: `Order id differs: Razorpay ${rz.razorpay_order_id}, database ${row.razorpay_order_id}`,
            expected: { razorpay_order_id: row.razorpay_order_id }, actual: { razorpay_order_id: rz.razorpay_order_id } });
    } else if (rz.razorpay_order_id && !row.razorpay_order_id) {
        add({ ...base, issue_type: 'INCOMPLETE_RECORD', severity: 'low', message: `${row.source_table}#${row.source_id} is missing razorpay_order_id`,
            details: { missing: ['razorpay_order_id'] }, actual: { razorpay_order_id: rz.razorpay_order_id } });
    }

    // Status: treat refunded as its own state, and compare refund amounts exactly.
    const dbRefund = refundClass(row.amount_refunded_paise, row.amount_paise);
    let refundMismatch = false;
    if (rzRefund !== 'none' || dbRefund !== 'none') {
        if ((rz.amount_refunded_paise || 0) !== (row.amount_refunded_paise || 0) || rzRefund !== dbRefund) {
            refundMismatch = true;
            add({ ...base, issue_type: 'REFUND_MISMATCH', severity: 'high',
                message: `Refund differs: Razorpay ${rzRefund} (${rz.amount_refunded_paise || 0} paise), database ${dbRefund} (${row.amount_refunded_paise || 0} paise)`,
                expected: { refund: dbRefund, amount_refunded_paise: row.amount_refunded_paise || 0, refund_status: row.refund_status || null },
                actual: { refund: rzRefund, amount_refunded_paise: rz.amount_refunded_paise || 0, refund_status: rz.refund_status || null } });
        }
    }
    // A paid↔refunded gap is already explained by REFUND_MISMATCH; only report other status disagreements.
    const settled = (s) => s === 'paid' || s === 'refunded';
    if (rzNorm !== dbNorm && !(refundMismatch && settled(rzNorm) && settled(dbNorm))) {
        add({ ...base, issue_type: 'STATUS_MISMATCH', severity: rzNorm === 'paid' || dbNorm === 'paid' ? 'high' : 'medium',
            message: `Status differs: Razorpay ${rz.status} (${rzNorm}), database ${row.status} (${dbNorm})`,
            expected: { status: row.status, normalized: dbNorm }, actual: { status: rz.status, normalized: rzNorm } });
    }

    // GST breakdown must be internally consistent and equal the amount Razorpay actually collected.
    if (row.tax) {
        const t = row.tax;
        const parts = (t.basic || 0) + (t.cgst || 0) + (t.sgst || 0) + (t.igst || 0);
        const problems = [];
        if (t.total != null && parts !== t.total) problems.push(`basic+cgst+sgst+igst=${parts} ≠ total=${t.total}`);
        if (t.total != null && rz.amount_paise != null && t.total !== rz.amount_paise) problems.push(`total=${t.total} ≠ razorpay amount=${rz.amount_paise}`);
        if (t.type === 'CGST_SGST' && (t.igst || 0) !== 0) problems.push('IGST present on a CGST_SGST transaction');
        if (t.type === 'IGST' && ((t.cgst || 0) !== 0 || (t.sgst || 0) !== 0)) problems.push('CGST/SGST present on an IGST transaction');
        if (problems.length) {
            add({ ...base, issue_type: 'TAX_BREAKDOWN_MISMATCH', severity: 'high', message: `Stored GST breakdown is inconsistent: ${problems.join('; ')}`,
                expected: { total_paise: rz.amount_paise }, actual: { ...t }, details: { problems } });
        }
    } else if (row.source_table === 'payments' && dbNorm === 'paid') {
        add({ ...base, issue_type: 'INCOMPLETE_RECORD', severity: 'medium', message: `payments#${row.source_id} is paid but has no stored GST breakdown`,
            details: { missing: ['basic_amount_paise', 'cgst_amount_paise', 'sgst_amount_paise', 'igst_amount_paise', 'total_amount_paise'] } });
    }

    // Invoices are only expected for plan payments made after invoicing went live (policy), never for packs.
    if (row.source_table === 'payments' && dbNorm === 'paid' && !row.has_invoice && invoiceSince
        && row.purchased_at && new Date(row.purchased_at).getTime() >= invoiceSince.getTime()) {
        add({ ...base, issue_type: 'MISSING_INVOICE', severity: 'low',
            message: `payments#${row.source_id} is paid on/after ${invoiceSince.toISOString().slice(0, 10)} but has no application invoice`,
            details: { invoice_required_since: invoiceSince.toISOString(), purchased_at: row.purchased_at } });
    }
}

module.exports = { reconcile, normalizeDbStatus, normalizeRzStatus, refundClass, ISSUE_TYPES, SEVERITIES };

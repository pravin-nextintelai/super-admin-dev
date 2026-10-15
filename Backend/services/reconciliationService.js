/**
 * Razorpay ↔ Payment DB reconciliation runs (Finance Admin).
 *
 * A run covers an inclusive IST date range. It (1) pulls every Razorpay payment created in that range
 * through the REST API (paged, retried), snapshots it, (2) loads the matching Payment-DB rows
 * (payments + top-ups + storage add-ons, padded by one day on each side so boundary timestamps still
 * match), (3) hands both to the pure matcher and (4) stores the issues + an audit trail.
 *
 * Nothing here writes to payments / invoices / refunds. All state lives in the reconciliation_* tables.
 *
 * Env (in addition to razorpayClient's):
 *   RECON_INVOICE_REQUIRED_SINCE   YYYY-MM-DD — plan payments on/after this IST day must have an app invoice.
 *                                  Unset → derived from the earliest app_invoices.issued_at (no invoice ⇒ never required).
 *   RECON_FETCH_ORDERS             'true' to also fetch Razorpay order details for RAZORPAY_ONLY / ORDER_MISMATCH payments.
 */
const fs = require('fs');
const path = require('path');
const { istDayStart, istDayEndExclusive } = require('../utils/time');
const { createRazorpayClient, normalizeRazorpayPayment, RazorpayApiError } = require('./razorpayClient');
const { reconcile, ISSUE_TYPES, SEVERITIES } = require('./reconciliationMatcher');
const { toPaiseInt, rupeesToPaise, paiseToRupeeString } = require('../utils/money');
const logger = require('../config/logger');

const RUN_STATUSES = ['queued', 'running', 'completed', 'completed_with_issues', 'partial', 'failed'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAD_MS = 24 * 60 * 60 * 1000;
const running = new Set(); // run ids executing in this process

async function ensureReconciliationSchema(payPool) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'create_reconciliation_tables.sql'), 'utf8');
    await payPool.query(sql);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const iso = (v) => (v ? new Date(v).toISOString() : null);
/** DATE columns arrive from pg as local-midnight Dates; format with local parts so the calendar day is preserved. */
const dateOnly = (v) => {
    if (!v) return null;
    if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    return String(v).slice(0, 10);
};

function parseRange(body = {}) {
    const start = String(body.startDate || body.start_date || body.from || '').trim();
    const end = String(body.endDate || body.end_date || body.to || '').trim();
    if (!DAY_RE.test(start) || !DAY_RE.test(end)) return { error: 'startDate and endDate are required as YYYY-MM-DD (IST calendar days)' };
    const [a, b] = start <= end ? [start, end] : [end, start];
    const from = istDayStart(a);
    const toExclusive = istDayEndExclusive(b);
    if (!from || !toExclusive) return { error: 'Invalid date' };
    if (toExclusive.getTime() > Date.now() + PAD_MS) return { error: 'endDate cannot be in the future' };
    if ((toExclusive - from) / PAD_MS > 92) return { error: 'Range too large: reconcile at most 92 days per run' };
    return {
        range_start: a, range_end: b, from, toExclusive,
        fromUnix: Math.floor(from.getTime() / 1000),
        toUnix: Math.floor(toExclusive.getTime() / 1000) - 1, // Razorpay `to` is inclusive
    };
}

function serializeRun(r) {
    if (!r) return null;
    return {
        id: r.id,
        range_start: dateOnly(r.range_start),
        range_end: dateOnly(r.range_end),
        from_ts: iso(r.from_ts), to_ts_exclusive: iso(r.to_ts_exclusive),
        razorpay_from_unix: Number(r.razorpay_from_unix), razorpay_to_unix: Number(r.razorpay_to_unix),
        status: r.status,
        requested_by: r.requested_by, requested_by_email: r.requested_by_email,
        attempt: r.attempt, retry_of_run_id: r.retry_of_run_id,
        started_at: iso(r.started_at), finished_at: iso(r.finished_at),
        razorpay_pages_fetched: r.razorpay_pages_fetched, razorpay_payments_fetched: r.razorpay_payments_fetched,
        razorpay_fetch_complete: r.razorpay_fetch_complete, db_rows_loaded: r.db_rows_loaded, db_load_complete: r.db_load_complete,
        api_calls: r.api_calls, api_retries: r.api_retries,
        summary: r.summary || {},
        error: r.error || null, error_details: r.error_details || null,
        created_at: iso(r.created_at), updated_at: iso(r.updated_at),
        ...(r.open_issues != null ? { open_issues: Number(r.open_issues), total_issues: Number(r.total_issues) } : {}),
    };
}

function serializeIssue(i) {
    if (!i) return null;
    return {
        id: i.id, run_id: i.run_id, issue_type: i.issue_type, severity: i.severity, status: i.status,
        razorpay_payment_id: i.razorpay_payment_id, razorpay_order_id: i.razorpay_order_id,
        source_table: i.source_table, source_id: i.source_id, user_id: i.user_id,
        message: i.message, expected: i.expected, actual: i.actual, details: i.details,
        resolved_by: i.resolved_by, resolved_by_email: i.resolved_by_email, resolved_at: iso(i.resolved_at), resolution_reason: i.resolution_reason,
        created_at: iso(i.created_at), updated_at: iso(i.updated_at),
    };
}

async function logEvent(payPool, runId, level, phase, message, details) {
    try {
        await payPool.query(
            `INSERT INTO reconciliation_run_events (run_id, level, phase, message, details) VALUES ($1,$2,$3,$4,$5)`,
            [runId, level, phase, message, details ? JSON.stringify(details) : null]
        );
    } catch (e) {
        logger.errorWithContext('Reconciliation event log failed', e, { layer: 'RECONCILIATION', summary: { runId, message } });
    }
}

async function updateRun(payPool, runId, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    const vals = keys.map((k) => (k === 'summary' || k === 'error_details' ? JSON.stringify(fields[k]) : fields[k]));
    await payPool.query(`UPDATE reconciliation_runs SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, [runId, ...vals]);
}

// ── DB side ──────────────────────────────────────────────────────────────────

/** Normalised Payment-DB rows for the padded window (plan payments + top-ups + add-ons). */
async function loadDbRows(payPool, from, toExclusive) {
    const pFrom = new Date(from.getTime() - PAD_MS);
    const pTo = new Date(toExclusive.getTime() + PAD_MS);
    const [plans, topups, addons] = await Promise.all([
        payPool.query(
            `SELECT p.id, p.user_id, p.razorpay_payment_id, p.razorpay_order_id, p.amount, p.amount_paise, p.currency, p.status,
                    p.refund_status, p.amount_refunded_paise, p.basic_amount_paise, p.cgst_amount_paise, p.sgst_amount_paise,
                    p.igst_amount_paise, p.total_amount_paise, p.tax_type,
                    COALESCE(p.purchase_date, p.captured_at, p.created_at) AS purchased_at,
                    COALESCE(NULLIF(TRIM(p.plan_name), ''), mp.name, sp.name) AS plan_name,
                    (p.app_invoice_id IS NOT NULL OR EXISTS (SELECT 1 FROM app_invoices ai WHERE ai.payment_id = p.id)) AS has_invoice
             FROM payments p
             LEFT JOIN user_subscriptions us ON us.id = p.subscription_id
             LEFT JOIN monthly_plans mp ON mp.id = COALESCE(p.monthly_plan_id, us.monthly_plan_id)
             LEFT JOIN subscription_plans sp ON sp.id = COALESCE(p.plan_id, us.plan_id)
             WHERE COALESCE(p.purchase_date, p.captured_at, p.created_at) >= $1 AND COALESCE(p.purchase_date, p.captured_at, p.created_at) < $2`,
            [pFrom, pTo]
        ),
        payPool.query(
            `SELECT t.id, t.user_id, t.razorpay_payment_id, t.razorpay_order_id, t.amount, t.currency, t.status, t.created_at AS purchased_at, pl.name AS plan_name
             FROM user_token_topup_purchases t LEFT JOIN topup_plans pl ON pl.id = t.topup_plan_id
             WHERE t.created_at >= $1 AND t.created_at < $2`,
            [pFrom, pTo]
        ).catch(() => ({ rows: [] })),
        payPool.query(
            `SELECT a.id, a.user_id, a.razorpay_payment_id, a.razorpay_order_id, a.amount, a.currency, a.status, a.created_at AS purchased_at, ap.name AS plan_name
             FROM user_storage_addon_purchases a LEFT JOIN addon_plans ap ON ap.id = a.addon_plan_id
             WHERE a.created_at >= $1 AND a.created_at < $2`,
            [pFrom, pTo]
        ).catch(() => ({ rows: [] })),
    ]);
    const packRow = (table, r) => ({
        source_table: table, source_id: r.id, user_id: r.user_id, kind: table === 'user_token_topup_purchases' ? 'topup' : 'addon',
        razorpay_payment_id: r.razorpay_payment_id || null, razorpay_order_id: r.razorpay_order_id || null,
        amount_paise: rupeesToPaise(r.amount), currency: r.currency || 'INR', status: r.status, refund_status: null, amount_refunded_paise: 0,
        purchased_at: r.purchased_at, tax: null, has_invoice: false, plan_name: r.plan_name || null,
    });
    return [
        ...plans.rows.map((r) => ({
            source_table: 'payments', source_id: r.id, user_id: r.user_id, kind: 'plan',
            razorpay_payment_id: r.razorpay_payment_id || null, razorpay_order_id: r.razorpay_order_id || null,
            amount_paise: toPaiseInt(r.total_amount_paise) ?? toPaiseInt(r.amount_paise) ?? rupeesToPaise(r.amount),
            currency: r.currency || 'INR', status: r.status, refund_status: r.refund_status || null,
            amount_refunded_paise: toPaiseInt(r.amount_refunded_paise) || 0, purchased_at: r.purchased_at,
            tax: r.basic_amount_paise != null ? {
                basic: toPaiseInt(r.basic_amount_paise), cgst: toPaiseInt(r.cgst_amount_paise) || 0, sgst: toPaiseInt(r.sgst_amount_paise) || 0,
                igst: toPaiseInt(r.igst_amount_paise) || 0, total: toPaiseInt(r.total_amount_paise), type: r.tax_type || null,
            } : null,
            has_invoice: Boolean(r.has_invoice), plan_name: r.plan_name || null,
        })),
        ...topups.rows.map((r) => packRow('user_token_topup_purchases', r)),
        ...addons.rows.map((r) => packRow('user_storage_addon_purchases', r)),
    ];
}

async function invoiceRequiredSince(payPool) {
    const env = String(process.env.RECON_INVOICE_REQUIRED_SINCE || '').trim();
    if (DAY_RE.test(env)) return istDayStart(env);
    const { rows } = await payPool.query(`SELECT MIN(issued_at) AS since FROM app_invoices`).catch(() => ({ rows: [{ since: null }] }));
    return rows[0]?.since ? new Date(rows[0].since) : null;
}

// ── Run lifecycle ────────────────────────────────────────────────────────────

async function createRun(payPool, { body, admin, retryOf = null }) {
    const range = parseRange(body);
    if (range.error) return { error: range.error, status: 400 };
    const dup = await payPool.query(
        `SELECT id FROM reconciliation_runs WHERE range_start = $1 AND range_end = $2 AND status IN ('queued','running') LIMIT 1`,
        [range.range_start, range.range_end]
    );
    if (dup.rows.length) return { error: `A run for this range is already in progress (run #${dup.rows[0].id})`, status: 409 };
    const { rows } = await payPool.query(
        `INSERT INTO reconciliation_runs (range_start, range_end, from_ts, to_ts_exclusive, razorpay_from_unix, razorpay_to_unix,
            status, requested_by, requested_by_email, attempt, retry_of_run_id)
         VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8,$9,$10) RETURNING *`,
        [range.range_start, range.range_end, range.from, range.toExclusive, range.fromUnix, range.toUnix,
            admin?.id ?? null, admin?.email ?? null, retryOf ? Number(retryOf.attempt) + 1 : 1, retryOf?.id ?? null]
    );
    const run = rows[0];
    await logEvent(payPool, run.id, 'info', 'queued', `Run created for ${range.range_start} → ${range.range_end} (IST)`, {
        from_ts: range.from, to_ts_exclusive: range.toExclusive, razorpay_from_unix: range.fromUnix, razorpay_to_unix: range.toUnix, retry_of_run_id: retryOf?.id ?? null,
    });
    return { run };
}

/** Execute a queued run. Resolves when finished; never throws (failures are recorded on the run). */
async function executeRun(payPool, runId, deps = {}) {
    if (running.has(runId)) return;
    running.add(runId);
    const { rows } = await payPool.query(`SELECT * FROM reconciliation_runs WHERE id = $1`, [runId]);
    const run = rows[0];
    if (!run) { running.delete(runId); return; }
    const from = new Date(run.from_ts);
    const toExclusive = new Date(run.to_ts_exclusive);
    const onEvent = ({ level, message, details }) => logEvent(payPool, runId, level, 'razorpay', message, details);

    let razorpayComplete = false;
    let dbComplete = false;
    let rzPayments = [];
    let dbRows = [];
    let client = null;
    try {
        await updateRun(payPool, runId, { status: 'running', started_at: new Date(), error: null, error_details: null });

        // 1) Razorpay
        try {
            client = deps.client || createRazorpayClient({}, { onEvent });
            const { items, pages } = await client.listPayments(
                { fromUnix: Number(run.razorpay_from_unix), toUnix: Number(run.razorpay_to_unix) },
                { onPage: async (p) => {
                    await updateRun(payPool, runId, { razorpay_pages_fetched: p.page, razorpay_payments_fetched: p.total, api_calls: client.stats.calls, api_retries: client.stats.retries });
                    await logEvent(payPool, runId, 'info', 'razorpay', `Fetched page ${p.page}: ${p.received} payments (total ${p.total})`, p);
                } }
            );
            rzPayments = items.map(normalizeRazorpayPayment);
            razorpayComplete = true;
            await snapshotRazorpay(payPool, runId, rzPayments);
            await updateRun(payPool, runId, { razorpay_pages_fetched: pages, razorpay_payments_fetched: rzPayments.length, razorpay_fetch_complete: true, api_calls: client.stats.calls, api_retries: client.stats.retries });
        } catch (e) {
            const details = e instanceof RazorpayApiError ? { status: e.status, code: e.code, attempt: e.attempt, url: e.url } : { message: e.message };
            await logEvent(payPool, runId, 'error', 'razorpay', `Razorpay fetch incomplete: ${e.message}`, details);
            await updateRun(payPool, runId, { error: `Razorpay fetch incomplete: ${e.message}`, error_details: details, api_calls: client?.stats.calls ?? 0, api_retries: client?.stats.retries ?? 0 });
        }

        // 2) Database
        try {
            dbRows = await loadDbRows(payPool, from, toExclusive);
            dbComplete = true;
            await updateRun(payPool, runId, { db_rows_loaded: dbRows.length, db_load_complete: true });
            await logEvent(payPool, runId, 'info', 'database', `Loaded ${dbRows.length} Payment-DB rows (window padded ±1 day for matching)`);
        } catch (e) {
            await logEvent(payPool, runId, 'error', 'database', `Payment DB load failed: ${e.message}`);
            await updateRun(payPool, runId, { error: `Payment DB load failed: ${e.message}`, error_details: { message: e.message } });
        }

        if (!razorpayComplete && !dbComplete) {
            await finish(payPool, runId, 'failed', { flags: { razorpayComplete, dbComplete } });
            return;
        }

        // 3) Optional order lookups for unmatched / mismatched payments
        if (razorpayComplete && client && String(process.env.RECON_FETCH_ORDERS).toLowerCase() === 'true') {
            await enrichOrders(payPool, runId, client, rzPayments, dbRows);
        }

        // 4) Match
        const since = await invoiceRequiredSince(payPool);
        const result = reconcile({
            razorpay: rzPayments, db: dbRows, range: { from, toExclusive },
            flags: { razorpayComplete, dbComplete }, policy: { invoiceRequiredSince: since },
        });
        await persistIssues(payPool, runId, result.issues);
        const summary = { ...result.summary, invoice_required_since: since ? since.toISOString() : null,
            amounts: { razorpay_paid: paiseToRupeeString(result.summary.razorpay.amount_paid_paise), db_paid: paiseToRupeeString(result.summary.db.amount_paid_paise) } };
        const status = !(razorpayComplete && dbComplete) ? 'partial' : result.issues.length ? 'completed_with_issues' : 'completed';
        await finish(payPool, runId, status, summary);
    } catch (e) {
        logger.errorWithContext('Reconciliation run crashed', e, { layer: 'RECONCILIATION', summary: { runId } });
        await logEvent(payPool, runId, 'error', 'run', `Run crashed: ${e.message}`);
        await finish(payPool, runId, 'failed', { flags: { razorpayComplete, dbComplete } }, e.message);
    } finally {
        running.delete(runId);
    }
}

async function finish(payPool, runId, status, summary, error) {
    await updateRun(payPool, runId, { status, finished_at: new Date(), summary, ...(error ? { error } : {}) });
    await logEvent(payPool, runId, status === 'failed' ? 'error' : 'info', 'run', `Run finished: ${status}`, { issues: summary?.issues?.total ?? 0 });
}

async function snapshotRazorpay(payPool, runId, payments) {
    if (!payments.length) return;
    const chunk = 200;
    for (let i = 0; i < payments.length; i += chunk) {
        const slice = payments.slice(i, i + chunk);
        const vals = [];
        const params = [];
        slice.forEach((p) => {
            const base = params.length;
            params.push(runId, p.razorpay_payment_id, p.razorpay_order_id, p.razorpay_invoice_id, p.amount_paise, p.amount_refunded_paise, p.currency, p.status,
                p.refund_status, p.captured, p.method, p.email, p.contact, p.razorpay_created_at, p.notes ? JSON.stringify(p.notes) : null, JSON.stringify(p.payload));
            vals.push(`(${Array.from({ length: 16 }, (_, k) => `$${base + k + 1}`).join(',')})`);
        });
        await payPool.query(
            `INSERT INTO reconciliation_razorpay_payments (run_id, razorpay_payment_id, razorpay_order_id, razorpay_invoice_id, amount_paise, amount_refunded_paise,
                currency, status, refund_status, captured, method, email, contact, razorpay_created_at, notes, payload)
             VALUES ${vals.join(',')} ON CONFLICT (run_id, razorpay_payment_id) DO NOTHING`,
            params
        );
    }
}

async function enrichOrders(payPool, runId, client, rzPayments, dbRows) {
    const dbByPay = new Map(dbRows.filter((r) => r.razorpay_payment_id).map((r) => [r.razorpay_payment_id, r]));
    const wanted = rzPayments.filter((p) => p.razorpay_order_id && (!dbByPay.has(p.razorpay_payment_id) || dbByPay.get(p.razorpay_payment_id).razorpay_order_id !== p.razorpay_order_id)).slice(0, 200);
    for (const p of wanted) {
        try {
            const order = await client.getOrder(p.razorpay_order_id);
            p.order = order;
            await payPool.query(`UPDATE reconciliation_razorpay_payments SET order_payload = $3, order_receipt = $4 WHERE run_id = $1 AND razorpay_payment_id = $2`,
                [runId, p.razorpay_payment_id, JSON.stringify(order), order?.receipt || null]);
        } catch (e) {
            await logEvent(payPool, runId, 'warn', 'razorpay', `Order lookup failed for ${p.razorpay_order_id}: ${e.message}`);
        }
    }
}

async function persistIssues(payPool, runId, issues) {
    if (!issues.length) return;
    const client = await payPool.connect();
    try {
        await client.query('BEGIN');
        for (const i of issues) {
            const { rows } = await client.query(
                `INSERT INTO reconciliation_issues (run_id, issue_type, severity, status, razorpay_payment_id, razorpay_order_id, source_table, source_id, user_id, message, expected, actual, details)
                 VALUES ($1,$2,$3,'open',$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
                [runId, i.issue_type, i.severity, i.razorpay_payment_id || null, i.razorpay_order_id || null, i.source_table || null, i.source_id ?? null, i.user_id ?? null,
                    i.message || null, i.expected ? JSON.stringify(i.expected) : null, i.actual ? JSON.stringify(i.actual) : null, i.details ? JSON.stringify(i.details) : null]
            );
            await client.query(
                `INSERT INTO reconciliation_issue_history (issue_id, action, previous_status, new_status) VALUES ($1,'created',NULL,'open')`,
                [rows[0].id]
            );
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// ── Queries for the API ──────────────────────────────────────────────────────

async function listRuns(payPool, { page = 1, pageSize = 20, status } = {}) {
    const limit = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
    const params = [];
    const where = [];
    if (status && RUN_STATUSES.includes(status)) { params.push(status); where.push(`r.status = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await payPool.query(`SELECT COUNT(*)::int AS total FROM reconciliation_runs r ${whereSql}`, params);
    const { rows } = await payPool.query(
        `SELECT r.*,
                (SELECT COUNT(*) FROM reconciliation_issues i WHERE i.run_id = r.id AND i.status = 'open') AS open_issues,
                (SELECT COUNT(*) FROM reconciliation_issues i WHERE i.run_id = r.id) AS total_issues
         FROM reconciliation_runs r ${whereSql}
         ORDER BY r.created_at DESC, r.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );
    return { rows: rows.map(serializeRun), total: count.rows[0].total, page: Math.floor(offset / limit) + 1, pageSize: limit };
}

async function getRun(payPool, runId) {
    const { rows } = await payPool.query(
        `SELECT r.*,
                (SELECT COUNT(*) FROM reconciliation_issues i WHERE i.run_id = r.id AND i.status = 'open') AS open_issues,
                (SELECT COUNT(*) FROM reconciliation_issues i WHERE i.run_id = r.id) AS total_issues
         FROM reconciliation_runs r WHERE r.id = $1`, [runId]);
    if (!rows[0]) return null;
    const [events, byType] = await Promise.all([
        payPool.query(`SELECT id, level, phase, message, details, created_at FROM reconciliation_run_events WHERE run_id = $1 ORDER BY created_at ASC, id ASC LIMIT 500`, [runId]),
        payPool.query(`SELECT issue_type, severity, status, COUNT(*)::int AS count FROM reconciliation_issues WHERE run_id = $1 GROUP BY 1,2,3 ORDER BY 1,2,3`, [runId]),
    ]);
    return { ...serializeRun(rows[0]), events: events.rows.map((e) => ({ ...e, created_at: iso(e.created_at) })), issue_counts: byType.rows };
}

async function listIssues(payPool, runId, q = {}) {
    const limit = Math.min(200, Math.max(1, Number(q.pageSize) || 50));
    const offset = (Math.max(1, Number(q.page) || 1) - 1) * limit;
    const params = [runId];
    const where = ['i.run_id = $1'];
    const push = (v) => { params.push(v); return `$${params.length}`; };
    if (q.status === 'open' || q.status === 'resolved') where.push(`i.status = ${push(q.status)}`);
    if (q.type && ISSUE_TYPES.includes(String(q.type).toUpperCase())) where.push(`i.issue_type = ${push(String(q.type).toUpperCase())}`);
    if (q.severity && SEVERITIES.includes(q.severity)) where.push(`i.severity = ${push(q.severity)}`);
    if (q.search) { const like = push(`%${String(q.search).trim()}%`); where.push(`(i.razorpay_payment_id ILIKE ${like} OR i.razorpay_order_id ILIKE ${like} OR i.message ILIKE ${like} OR i.user_id::text = ${push(String(q.search).trim())})`); }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const count = await payPool.query(`SELECT COUNT(*)::int AS total FROM reconciliation_issues i ${whereSql}`, params);
    const { rows } = await payPool.query(
        `SELECT i.* FROM reconciliation_issues i ${whereSql}
         ORDER BY array_position(ARRAY['critical','high','medium','low','info'], i.severity), i.status ASC, i.id ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );
    return { rows: rows.map(serializeIssue), total: count.rows[0].total, page: Math.floor(offset / limit) + 1, pageSize: limit };
}

async function getIssue(payPool, issueId) {
    const { rows } = await payPool.query(`SELECT * FROM reconciliation_issues WHERE id = $1`, [issueId]);
    if (!rows[0]) return null;
    const issue = serializeIssue(rows[0]);
    const [snapshot, history] = await Promise.all([
        issue.razorpay_payment_id
            ? payPool.query(`SELECT payload, order_payload FROM reconciliation_razorpay_payments WHERE run_id = $1 AND razorpay_payment_id = $2`, [issue.run_id, issue.razorpay_payment_id])
            : { rows: [] },
        issueHistory(payPool, issueId),
    ]);
    return { ...issue, razorpay_snapshot: snapshot.rows[0]?.payload || null, razorpay_order: snapshot.rows[0]?.order_payload || null, history };
}

async function issueHistory(payPool, issueId) {
    const { rows } = await payPool.query(`SELECT * FROM reconciliation_issue_history WHERE issue_id = $1 ORDER BY created_at ASC, id ASC`, [issueId]);
    return rows.map((h) => ({ ...h, created_at: iso(h.created_at) }));
}

/** Manual resolve / reopen. Only the issue row changes; payments, invoices and Razorpay are untouched. */
async function transitionIssue(payPool, issueId, action, { reason, admin }) {
    const text = String(reason || '').trim();
    if (action === 'resolve' && text.length < 5) return { error: 'A resolution reason (at least 5 characters) is required', status: 400 };
    const client = await payPool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT * FROM reconciliation_issues WHERE id = $1 FOR UPDATE`, [issueId]);
        const issue = rows[0];
        if (!issue) { await client.query('ROLLBACK'); return { error: 'Issue not found', status: 404 }; }
        const wantStatus = action === 'resolve' ? 'resolved' : 'open';
        if (issue.status === wantStatus) { await client.query('ROLLBACK'); return { error: `Issue is already ${wantStatus}`, status: 409 }; }
        const updated = await client.query(
            action === 'resolve'
                ? `UPDATE reconciliation_issues SET status = 'resolved', resolved_by = $2, resolved_by_email = $3, resolved_at = now(), resolution_reason = $4, updated_at = now() WHERE id = $1 RETURNING *`
                : `UPDATE reconciliation_issues SET status = 'open', resolved_by = NULL, resolved_by_email = NULL, resolved_at = NULL, resolution_reason = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
            action === 'resolve' ? [issueId, admin?.id ?? null, admin?.email ?? null, text] : [issueId]
        );
        await client.query(
            `INSERT INTO reconciliation_issue_history (issue_id, action, previous_status, new_status, reason, admin_id, admin_email, snapshot)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [issueId, action === 'resolve' ? 'resolved' : 'reopened', issue.status, wantStatus, text || null, admin?.id ?? null, admin?.email ?? null, JSON.stringify(serializeIssue(issue))]
        );
        await client.query('COMMIT');
        return { issue: serializeIssue(updated.rows[0]) };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function retryRun(payPool, runId, admin) {
    const { rows } = await payPool.query(`SELECT * FROM reconciliation_runs WHERE id = $1`, [runId]);
    const prev = rows[0];
    if (!prev) return { error: 'Run not found', status: 404 };
    if (!['failed', 'partial'].includes(prev.status)) return { error: `Only failed or partial runs can be retried (run is ${prev.status})`, status: 409 };
    return createRun(payPool, { body: { startDate: dateOnly(prev.range_start), endDate: dateOnly(prev.range_end) }, admin, retryOf: prev });
}

function csvCell(value) {
    if (value == null || value === '') return '';
    let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

async function exportRun(payPool, runId) {
    const run = await getRun(payPool, runId);
    if (!run) return null;
    const { rows } = await payPool.query(`SELECT * FROM reconciliation_issues WHERE run_id = $1 ORDER BY id ASC`, [runId]);
    const header = ['Issue ID', 'Type', 'Severity', 'Status', 'Razorpay Payment ID', 'Razorpay Order ID', 'Source Table', 'Source ID', 'User ID', 'Message', 'Expected', 'Actual', 'Resolved By', 'Resolved At', 'Resolution Reason', 'Created At'];
    const lines = rows.map((i) => [i.id, i.issue_type, i.severity, i.status, i.razorpay_payment_id, i.razorpay_order_id, i.source_table, i.source_id, i.user_id, i.message,
        i.expected, i.actual, i.resolved_by_email || i.resolved_by, iso(i.resolved_at), i.resolution_reason, iso(i.created_at)].map(csvCell).join(','));
    const csv = `﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
    return { run, csv, filename: `reconciliation-run-${runId}-${run.range_start}_to_${run.range_end}.csv` };
}

module.exports = {
    ensureReconciliationSchema, parseRange, createRun, executeRun, retryRun, listRuns, getRun,
    listIssues, getIssue, issueHistory, transitionIssue, exportRun, loadDbRows, invoiceRequiredSince,
    serializeRun, serializeIssue, RUN_STATUSES,
};

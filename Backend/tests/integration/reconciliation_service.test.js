#!/usr/bin/env node
/**
 * Reconciliation service — end-to-end against the real Payment DB with an injected (fake) Razorpay client.
 * Creates runs in reconciliation_* tables and deletes them at the end (cascade). Payments are never touched.
 * Usage: npm run test:reconciliation
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const assert = require('assert');
const { Pool } = require('pg');
const recon = require('../../src/modules/payments/reconciliation.service');
const { RazorpayApiError } = require('../../src/infrastructure/payments/razorpayClient');

if (!process.env.PAYMENT_DB_URL) { console.log('PAYMENT_DB_URL not set — skipping'); process.exit(0); }
const payPool = new Pool({ connectionString: process.env.PAYMENT_DB_URL });
const admin = { id: 0, email: 'test-runner@local' };
const created = [];
let passed = 0;
const test = async (name, fn) => { await fn(); passed += 1; console.log(`  ✓ ${name}`); };

/** Fake client whose /payments answer is derived from the real DB rows in the window, with optional tampering. */
function fakeClient(dbRows, { tamper = () => null, extra = [], fail = null } = {}) {
    const items = [];
    dbRows.forEach((r) => {
        if (!r.razorpay_payment_id) return;
        const base = { id: r.razorpay_payment_id, order_id: r.razorpay_order_id, amount: r.amount_paise, amount_refunded: r.amount_refunded_paise || 0, currency: r.currency || 'INR',
            status: ['captured', 'paid', 'success', 'succeeded', 'completed'].includes(String(r.status).toLowerCase()) ? 'captured' : String(r.status).toLowerCase() === 'failed' ? 'failed' : 'authorized',
            captured: true, created_at: Math.floor(new Date(r.purchased_at).getTime() / 1000), email: null, notes: {} };
        const t = tamper(base, r);
        if (t !== false) items.push(t || base);
    });
    items.push(...extra);
    const stats = { calls: 0, retries: 0 };
    return {
        stats,
        async listPayments(_, { onPage } = {}) {
            stats.calls += 1;
            if (fail) throw fail;
            if (onPage) await onPage({ page: 1, received: items.length, total: items.length });
            return { items, pages: 1 };
        },
        async getOrder() { return {}; },
    };
}

async function runWith(body, clientFactory) {
    const out = await recon.createRun(payPool, { body, admin });
    assert.ok(out.run, out.error);
    created.push(out.run.id);
    const { rows } = await payPool.query(`SELECT * FROM reconciliation_runs WHERE id = $1`, [out.run.id]);
    const dbRows = await recon.loadDbRows(payPool, new Date(rows[0].from_ts), new Date(rows[0].to_ts_exclusive));
    await recon.executeRun(payPool, out.run.id, { client: clientFactory(dbRows) });
    return { run: await recon.getRun(payPool, out.run.id), dbRows };
}

(async () => {
    console.log('reconciliation service (live Payment DB, fake Razorpay)');
    await recon.ensureReconciliationSchema(payPool);

    // Pick the most recent IST day that has captured plan payments.
    const { rows: dayRows } = await payPool.query(`SELECT to_char((COALESCE(purchase_date, captured_at, created_at) AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS d, COUNT(*)::int n
        FROM payments WHERE LOWER(status) = 'captured' GROUP BY 1 ORDER BY 1 DESC LIMIT 1`);
    const day = dayRows[0].d;
    console.log(`  using IST day ${day} (${dayRows[0].n} captured plan payments)`);

    await test('date range validation', () => {
        assert.ok(recon.parseRange({ startDate: '2026-13-01', endDate: '2026-10-01' }).error);
        assert.ok(!recon.parseRange({ startDate: '2026-01-01', endDate: '2026-06-30' }).error, 'six-month range (181 days) accepted');
        assert.ok(recon.parseRange({ startDate: '2026-01-01', endDate: '2026-07-31' }).error, 'range > 184 days rejected');
        const r = recon.parseRange({ startDate: '2026-10-12', endDate: '2026-10-12' });
        assert.strictEqual(r.from.toISOString(), '2026-10-11T18:30:00.000Z');
        assert.strictEqual(r.toExclusive.toISOString(), '2026-10-12T18:30:00.000Z');
        assert.strictEqual(r.razorpay_to_unix ?? r.toUnix, Math.floor(r.toExclusive.getTime() / 1000) - 1, 'Razorpay `to` is inclusive');
        const swapped = recon.parseRange({ startDate: '2026-10-12', endDate: '2026-10-10' });
        assert.strictEqual(swapped.range_start, '2026-10-10');
    });

    await test('clean run: Razorpay mirrors the DB → completed, matched = rows with references, no high issues', async () => {
        const { run, dbRows } = await runWith({ startDate: day, endDate: day }, (rows) => fakeClient(rows));
        assert.ok(['completed', 'completed_with_issues'].includes(run.status), run.status);
        assert.strictEqual(run.razorpay_fetch_complete, true);
        assert.strictEqual(run.db_load_complete, true);
        assert.strictEqual(run.summary.matched, dbRows.filter((r) => r.razorpay_payment_id).length);
        const bad = (run.issue_counts || []).filter((c) => ['critical', 'high'].includes(c.severity) && !['DB_ONLY'].includes(c.issue_type));
        assert.deepStrictEqual(bad, [], JSON.stringify(run.issue_counts));
        assert.ok(run.events.some((e) => e.phase === 'razorpay'));
    });

    await test('tampered amount + Razorpay-only + DB-only + duplicate → issues of each type, run completed_with_issues', async () => {
        const { run } = await runWith({ startDate: day, endDate: day }, (rows) => {
            const first = rows.find((r) => r.source_table === 'payments' && r.razorpay_payment_id);
            return fakeClient(rows, {
                tamper: (p, r) => (r.source_id === first.source_id ? { ...p, amount: p.amount + 1 } : null),
                extra: [{ id: 'pay_TEST_RZONLY', order_id: 'order_TEST', amount: 500, amount_refunded: 0, currency: 'INR', status: 'captured', captured: true, created_at: Math.floor(new Date(first.purchased_at).getTime() / 1000) },
                        { id: 'pay_TEST_FAILED', order_id: 'order_TEST2', amount: 500, amount_refunded: 0, currency: 'INR', status: 'failed', captured: false, created_at: Math.floor(new Date(first.purchased_at).getTime() / 1000) }],
            });
        });
        assert.strictEqual(run.status, 'completed_with_issues');
        const types = Object.fromEntries(run.issue_counts.map((c) => [`${c.issue_type}:${c.severity}`, c.count]));
        assert.strictEqual(types['AMOUNT_MISMATCH:critical'], 1);
        assert.strictEqual(types['RAZORPAY_ONLY:high'], 1);
        assert.strictEqual(types['RAZORPAY_ONLY:info'], 1, 'failed Razorpay payment without DB row is informational');
        const issues = await recon.listIssues(payPool, run.id, { type: 'AMOUNT_MISMATCH' });
        assert.strictEqual(issues.total, 1);
        const detail = await recon.getIssue(payPool, issues.rows[0].id);
        assert.ok(detail.razorpay_snapshot, 'snapshot of the Razorpay payment is attached');
        assert.strictEqual(detail.history[0].action, 'created');

        // resolve requires a reason, records admin + previous/new state, reopen restores
        const noReason = await recon.transitionIssue(payPool, detail.id, 'resolve', { reason: '', admin });
        assert.strictEqual(noReason.status, 400);
        const resolved = await recon.transitionIssue(payPool, detail.id, 'resolve', { reason: 'Verified manually with Razorpay dashboard', admin });
        assert.strictEqual(resolved.issue.status, 'resolved');
        assert.strictEqual(resolved.issue.resolved_by_email, admin.email);
        const again = await recon.transitionIssue(payPool, detail.id, 'resolve', { reason: 'resolving a second time', admin });
        assert.strictEqual(again.status, 409);
        assert.strictEqual(run.range_start, day, 'DATE columns must round-trip as the same IST calendar day');
        const reopened = await recon.transitionIssue(payPool, detail.id, 'reopen', { reason: 'needs another look', admin });
        assert.strictEqual(reopened.issue.status, 'open');
        const hist = await recon.issueHistory(payPool, detail.id);
        assert.deepStrictEqual(hist.map((h) => h.action), ['created', 'resolved', 'reopened']);
        assert.strictEqual(hist[1].previous_status, 'open');
        assert.strictEqual(hist[1].new_status, 'resolved');
        assert.strictEqual(hist[1].admin_email, admin.email);
        // payments untouched by resolution
        const { rows: pr } = await payPool.query(`SELECT updated_at FROM payments WHERE razorpay_payment_id = $1`, [detail.razorpay_payment_id]);
        assert.ok(pr.length === 1);

        const exp = await recon.exportRun(payPool, run.id);
        assert.ok(exp.csv.includes('AMOUNT_MISMATCH'));
        assert.ok(exp.csv.startsWith('﻿Issue ID,Type,Severity'));
    });

    await test('Razorpay API failure (auth) → run failed, no DB_ONLY/RAZORPAY_ONLY issues, retry creates attempt 2', async () => {
        const { run } = await runWith({ startDate: day, endDate: day }, (rows) => fakeClient(rows, { fail: new RazorpayApiError('Authentication failed', { status: 401, code: 'BAD_REQUEST_ERROR', attempt: 1 }) }));
        // DB loaded fine, Razorpay did not → partial (issues from DB-side checks only, no "missing" ones)
        assert.strictEqual(run.status, 'partial', run.status);
        assert.strictEqual(run.razorpay_fetch_complete, false);
        assert.ok(/Authentication failed/.test(run.error));
        assert.ok(!run.issue_counts.some((c) => ['DB_ONLY', 'RAZORPAY_ONLY'].includes(c.issue_type)));
        assert.ok(run.events.some((e) => e.level === 'error' && e.phase === 'razorpay'));
        const retry = await recon.retryRun(payPool, run.id, admin);
        assert.ok(retry.run, retry.error);
        created.push(retry.run.id);
        assert.strictEqual(retry.run.attempt, 2);
        assert.strictEqual(retry.run.retry_of_run_id, run.id);
        assert.strictEqual(recon.serializeRun(retry.run).range_start, day, 'retry reuses the exact same IST range');
        const notRetriable = await recon.retryRun(payPool, retry.run.id, admin); // queued → cannot retry
        assert.strictEqual(notRetriable.status, 409);
        await payPool.query(`UPDATE reconciliation_runs SET status = 'failed' WHERE id = $1`, [retry.run.id]);
    });

    await test('duplicate in-progress run for the same range is rejected (409)', async () => {
        const a = await recon.createRun(payPool, { body: { startDate: '2001-01-01', endDate: '2001-01-02' }, admin });
        created.push(a.run.id);
        const b = await recon.createRun(payPool, { body: { startDate: '2001-01-01', endDate: '2001-01-02' }, admin });
        assert.strictEqual(b.status, 409);
    });

    await test('runs list + pagination metadata', async () => {
        const list = await recon.listRuns(payPool, { page: 1, pageSize: 2 });
        assert.strictEqual(list.rows.length, 2);
        assert.ok(list.total >= created.length);
        assert.strictEqual(list.pageSize, 2);
    });

    console.log(`\n${passed} service tests passed`);
})().catch((e) => { console.error('FAILED', e); process.exitCode = 1; })
  .finally(async () => {
      if (created.length) await payPool.query(`DELETE FROM reconciliation_runs WHERE id = ANY($1::int[])`, [created]);
      console.log(`  cleaned up ${created.length} test run(s)`);
      await payPool.end();
  });

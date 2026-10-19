#!/usr/bin/env node
/**
 * Reconciliation matcher — pure unit tests (no DB, no network).
 * Usage: npm run test:reconciliation-matcher
 */
const assert = require('assert');
const { reconcile, normalizeDbStatus, normalizeRzStatus } = require('../../src/modules/payments/reconciliation.matcher');

const from = new Date('2026-10-11T18:30:00.000Z'); // 2026-10-12 00:00 IST
const toExclusive = new Date('2026-10-12T18:30:00.000Z');
const inside = new Date('2026-10-12T06:00:00.000Z');
const range = { from, toExclusive };

const rz = (over = {}) => ({
    razorpay_payment_id: 'pay_A', razorpay_order_id: 'order_A', razorpay_invoice_id: null, amount_paise: 10000, amount_refunded_paise: 0,
    currency: 'INR', status: 'captured', refund_status: null, captured: true, method: 'upi', email: 'a@x.com', contact: null,
    razorpay_created_at: inside, notes: null, payload: {}, ...over,
});
const dbPlan = (over = {}) => ({
    source_table: 'payments', source_id: 1, user_id: 7, kind: 'plan', razorpay_payment_id: 'pay_A', razorpay_order_id: 'order_A',
    amount_paise: 10000, currency: 'INR', status: 'captured', refund_status: null, amount_refunded_paise: 0, purchased_at: inside,
    tax: { basic: 8475, cgst: 763, sgst: 762, igst: 0, total: 10000, type: 'CGST_SGST' }, has_invoice: true, plan_name: 'Pro', ...over,
});
const types = (r) => r.issues.map((i) => i.issue_type).sort();
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };

console.log('reconciliation matcher');

test('status normalisation', () => {
    assert.strictEqual(normalizeDbStatus('captured'), 'paid');
    assert.strictEqual(normalizeDbStatus('completed'), 'paid');
    assert.strictEqual(normalizeDbStatus('authorized'), 'pending');
    assert.strictEqual(normalizeDbStatus('failed'), 'failed');
    assert.strictEqual(normalizeDbStatus('captured', 10000, 10000), 'refunded');
    assert.strictEqual(normalizeDbStatus('captured', 4000, 10000), 'paid');
    assert.strictEqual(normalizeRzStatus(rz()), 'paid');
    assert.strictEqual(normalizeRzStatus(rz({ status: 'refunded', amount_refunded_paise: 10000 })), 'refunded');
    assert.strictEqual(normalizeRzStatus(rz({ status: 'failed' })), 'failed');
});

test('paid user with valid GST breakup → no issues, matched 1', () => {
    const r = reconcile({ razorpay: [rz()], db: [dbPlan()], range });
    assert.deepStrictEqual(r.issues, []);
    assert.strictEqual(r.summary.matched, 1);
    assert.strictEqual(r.summary.razorpay.paid, 1);
    assert.strictEqual(r.summary.db.paid, 1);
    assert.strictEqual(r.summary.razorpay.amount_paid_paise, 10000);
});

test('free user (no payments on either side) → nothing to report', () => {
    const r = reconcile({ razorpay: [], db: [], range });
    assert.strictEqual(r.issues.length, 0);
    assert.strictEqual(r.summary.razorpay.total, 0);
});

test('multiple purchases by the same user are matched independently', () => {
    const r = reconcile({
        razorpay: [rz(), rz({ razorpay_payment_id: 'pay_B', razorpay_order_id: 'order_B', amount_paise: 1000 })],
        db: [dbPlan(), dbPlan({ source_id: 2, razorpay_payment_id: 'pay_B', razorpay_order_id: 'order_B', amount_paise: 1000, tax: { basic: 847, cgst: 76, sgst: 77, igst: 0, total: 1000, type: 'CGST_SGST' } })],
        range,
    });
    assert.deepStrictEqual(r.issues, []);
    assert.strictEqual(r.summary.matched, 2);
});

test('missing invoice is LOW and only when invoicing was live at purchase time', () => {
    const since = new Date('2026-10-12T00:00:00.000Z');
    const r1 = reconcile({ razorpay: [rz()], db: [dbPlan({ has_invoice: false })], range, policy: { invoiceRequiredSince: since } });
    assert.deepStrictEqual(types(r1), ['MISSING_INVOICE']);
    assert.strictEqual(r1.issues[0].severity, 'low');
    const r2 = reconcile({ razorpay: [rz()], db: [dbPlan({ has_invoice: false })], range, policy: { invoiceRequiredSince: new Date('2026-10-13T00:00:00.000Z') } });
    assert.deepStrictEqual(r2.issues, [], 'purchase before invoicing went live must not be flagged');
    const r3 = reconcile({ razorpay: [rz()], db: [dbPlan({ has_invoice: false })], range, policy: { invoiceRequiredSince: null } });
    assert.deepStrictEqual(r3.issues, [], 'no policy → never required');
    // top-ups never require an invoice
    const r4 = reconcile({ razorpay: [rz()], db: [{ ...dbPlan(), source_table: 'user_token_topup_purchases', tax: null, has_invoice: false }], range, policy: { invoiceRequiredSince: since } });
    assert.deepStrictEqual(r4.issues, []);
});

test('failed / pending Razorpay payment without DB row is informational only', () => {
    const r = reconcile({ razorpay: [rz({ status: 'failed', captured: false })], db: [], range });
    assert.deepStrictEqual(types(r), ['RAZORPAY_ONLY']);
    assert.strictEqual(r.issues[0].severity, 'info');
    assert.strictEqual(r.summary.razorpay.failed, 1);
});

test('captured Razorpay payment with no DB row → RAZORPAY_ONLY high', () => {
    const r = reconcile({ razorpay: [rz()], db: [], range });
    assert.deepStrictEqual(types(r), ['RAZORPAY_ONLY']);
    assert.strictEqual(r.issues[0].severity, 'high');
});

test('DB-only paid row inside the window → DB_ONLY high; padded rows outside the window are ignored', () => {
    const r = reconcile({ razorpay: [], db: [dbPlan()], range });
    assert.deepStrictEqual(types(r), ['DB_ONLY']);
    const outside = reconcile({ razorpay: [], db: [dbPlan({ purchased_at: new Date('2026-10-13T06:00:00.000Z') })], range });
    assert.deepStrictEqual(outside.issues, []);
});

test('missing transactions are NOT reported while the Razorpay fetch is incomplete', () => {
    const r = reconcile({ razorpay: [rz({ razorpay_payment_id: 'pay_Z' })], db: [dbPlan()], range, flags: { razorpayComplete: false } });
    assert.deepStrictEqual(r.issues, []);
    assert.strictEqual(r.summary.flags.missingReported, false);
});

test('duplicate payment reference across two DB rows', () => {
    const r = reconcile({ razorpay: [rz()], db: [dbPlan(), dbPlan({ source_id: 99 })], range });
    assert.ok(types(r).includes('DUPLICATE_REFERENCE'));
    assert.strictEqual(r.issues.find((i) => i.issue_type === 'DUPLICATE_REFERENCE').details.rows.length, 2);
});

test('amount and currency mismatches are compared in exact paise', () => {
    const r = reconcile({ razorpay: [rz({ amount_paise: 10001 })], db: [dbPlan()], range });
    assert.ok(types(r).includes('AMOUNT_MISMATCH'));
    assert.strictEqual(r.issues.find((i) => i.issue_type === 'AMOUNT_MISMATCH').severity, 'critical');
    const c = reconcile({ razorpay: [rz({ currency: 'USD' })], db: [dbPlan()], range });
    assert.ok(types(c).includes('CURRENCY_MISMATCH'));
});

test('status mismatch: Razorpay authorized vs DB captured', () => {
    const r = reconcile({ razorpay: [rz({ status: 'authorized', captured: false })], db: [dbPlan()], range });
    assert.deepStrictEqual(types(r), ['STATUS_MISMATCH']);
});

test('full refund recorded on both sides → no issue; refund only on Razorpay → REFUND_MISMATCH', () => {
    const ok = reconcile({ razorpay: [rz({ status: 'refunded', amount_refunded_paise: 10000, refund_status: 'full' })], db: [dbPlan({ status: 'refunded', amount_refunded_paise: 10000, refund_status: 'full' })], range });
    assert.deepStrictEqual(ok.issues, []);
    const bad = reconcile({ razorpay: [rz({ status: 'refunded', amount_refunded_paise: 10000, refund_status: 'full' })], db: [dbPlan()], range });
    assert.ok(types(bad).includes('REFUND_MISMATCH'));
    assert.ok(!types(bad).includes('STATUS_MISMATCH'), 'refund mismatch should not double-report as status mismatch when DB side has no refund');
});

test('partial refund: Razorpay partial (4000) vs DB partial (4000) ok; vs DB 0 flagged', () => {
    const ok = reconcile({ razorpay: [rz({ amount_refunded_paise: 4000, refund_status: 'partial' })], db: [dbPlan({ amount_refunded_paise: 4000, refund_status: 'partial' })], range });
    assert.deepStrictEqual(ok.issues, []);
    assert.strictEqual(ok.summary.razorpay.refunded_partial, 1);
    const bad = reconcile({ razorpay: [rz({ amount_refunded_paise: 4000, refund_status: 'partial' })], db: [dbPlan()], range });
    assert.deepStrictEqual(types(bad), ['REFUND_MISMATCH']);
});

test('GST breakdown must sum to total and equal the Razorpay amount', () => {
    const bad = reconcile({ razorpay: [rz()], db: [dbPlan({ tax: { basic: 8475, cgst: 763, sgst: 700, igst: 0, total: 10000, type: 'CGST_SGST' } })], range });
    assert.deepStrictEqual(types(bad), ['TAX_BREAKDOWN_MISMATCH']);
    const igst = reconcile({ razorpay: [rz()], db: [dbPlan({ tax: { basic: 8475, cgst: 0, sgst: 0, igst: 1525, total: 10000, type: 'IGST' } })], range });
    assert.deepStrictEqual(igst.issues, [], 'IGST transactions are valid');
    const noTax = reconcile({ razorpay: [rz()], db: [dbPlan({ tax: null })], range });
    assert.deepStrictEqual(types(noTax), ['INCOMPLETE_RECORD']);
});

test('paid DB row without razorpay_payment_id is INCOMPLETE_RECORD, not DB_ONLY', () => {
    const r = reconcile({ razorpay: [], db: [dbPlan({ razorpay_payment_id: null })], range });
    assert.deepStrictEqual(types(r), ['INCOMPLETE_RECORD']);
});

test('order id mismatch', () => {
    const r = reconcile({ razorpay: [rz({ razorpay_order_id: 'order_X' })], db: [dbPlan()], range });
    assert.deepStrictEqual(types(r), ['ORDER_MISMATCH']);
});

test('summary counts issues by type and severity', () => {
    const r = reconcile({ razorpay: [rz({ amount_paise: 1 })], db: [dbPlan({ has_invoice: false })], range, policy: { invoiceRequiredSince: from } });
    assert.strictEqual(r.summary.issues.total, r.issues.length);
    assert.strictEqual(r.summary.issues.by_type.AMOUNT_MISMATCH, 1);
    assert.strictEqual(r.summary.issues.by_severity.critical, 1);
});

console.log(`\n${passed} matcher tests passed`);

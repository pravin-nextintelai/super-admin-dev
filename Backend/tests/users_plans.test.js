#!/usr/bin/env node
/**
 * Users & Plans — money helpers, CSV escaping, query parsing (pure) + read-only checks against the live DBs.
 * Usage: npm run test:users-plans   (DB checks are skipped when DATABASE_URL / PAYMENT_DB_URL are unset)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const assert = require('assert');
const money = require('../utils/money');
const up = require('../services/usersPlansService');

let passed = 0;
const test = async (name, fn) => { await fn(); passed += 1; console.log(`  ✓ ${name}`); };

(async () => {
    console.log('users & plans');

    await test('paise ↔ rupee strings never go through floats', () => {
        assert.strictEqual(money.paiseToRupeeString(8475), '84.75');
        assert.strictEqual(money.paiseToRupeeString('763'), '7.63');
        assert.strictEqual(money.paiseToRupeeString(5), '0.05');
        assert.strictEqual(money.paiseToRupeeString(-5), '-0.05');
        assert.strictEqual(money.paiseToRupeeString(null), null);
        assert.strictEqual(money.rupeesToPaise('100'), 10000);
        assert.strictEqual(money.rupeesToPaise('100.5'), 10050);
        assert.strictEqual(money.rupeesToPaise('0.07'), 7);
        assert.strictEqual(money.rupeesToPaise('1.005'), null, 'more than 2dp is rejected');
        assert.strictEqual(money.sumPaise('8475', 763, 762, 0), 10000);
    });

    await test('₹100 inclusive of 18% GST example: 84.75 + 7.63 + 7.62 = 100.00', () => {
        const parts = money.sumPaise(8475, 763, 762);
        assert.strictEqual(parts, 10000);
        assert.strictEqual(money.paiseToRupeeString(parts), '100.00');
    });

    await test('CSV cells are quoted and formula-injection safe', () => {
        assert.strictEqual(up.csvCell('=SUM(A1)'), "'=SUM(A1)");
        assert.strictEqual(up.csvCell('+1'), "'+1");
        assert.strictEqual(up.csvCell('-5'), "'-5");
        assert.strictEqual(up.csvCell('@cmd'), "'@cmd");
        assert.strictEqual(up.csvCell('a,b'), '"a,b"');
        assert.strictEqual(up.csvCell('say "hi"'), '"say ""hi"""');
        assert.strictEqual(up.csvCell(null), '');
        assert.strictEqual(up.csvCell('84.75'), '84.75');
    });

    await test('parseExtendedQuery validates owner type, uuid, status, sort and view', () => {
        const q = up.parseExtendedQuery({ ownerType: 'internal', ownerId: 'not-a-uuid', userStatus: 'ACTIVE', sortBy: 'total_amount', sortDir: 'ASC', view: 'Transactions', code: ' NEXI-1 ' });
        assert.deepStrictEqual(q, { ownerType: 'INTERNAL', includeDirect: true, ownerId: null, code: 'NEXI-1', userStatus: 'active', sortBy: 'total_amount', sortDir: 'asc', view: 'transactions' });
        assert.strictEqual(up.parseExtendedQuery({ includeDirect: '0' }).includeDirect, false, 'includeDirect=0 → referred only');
        const d = up.parseExtendedQuery({});
        assert.deepStrictEqual(d, { ownerType: null, includeDirect: true, ownerId: null, code: null, userStatus: null, sortBy: 'joined', sortDir: 'desc', view: 'users' });
    });

    await test('inclusive IST day range → exclusive UTC boundary', () => {
        const { start, end } = up.purchaseRange('2026-10-12', '2026-10-12');
        assert.strictEqual(start.toISOString(), '2026-10-11T18:30:00.000Z');
        assert.strictEqual(end.toISOString(), '2026-10-12T18:30:00.000Z');
    });

    await test('serializePayment keeps invoice / payment / order references distinct and blank when absent', () => {
        const p = up.serializePayment({
            id: 49, user_id: 1, status: 'captured', amount: '100.00', amount_paise: '10000', basic_amount_paise: '8475', cgst_amount_paise: '763', sgst_amount_paise: '762',
            igst_amount_paise: '0', total_amount_paise: '10000', cgst_rate: '9.00', sgst_rate: '9.00', igst_rate: '0.00', tax_type: 'CGST_SGST', tax_basis: 'inclusive',
            razorpay_payment_id: 'pay_X', razorpay_order_id: 'order_X', razorpay_receipt: null, app_invoice_number: null, created_at: new Date('2026-10-12T12:10:48Z'),
        });
        assert.strictEqual(p.invoice_number, null, 'no app invoice ⇒ null, never derived from pay_/order_ ids');
        assert.strictEqual(p.razorpay_payment_id, 'pay_X');
        assert.strictEqual(p.razorpay_order_id, 'order_X');
        assert.strictEqual(p.basic_amount, '84.75');
        assert.strictEqual(p.cgst_amount, '7.63');
        assert.strictEqual(p.sgst_amount, '7.62');
        assert.strictEqual(p.total_amount, '100.00');
        assert.strictEqual(p.is_paid, true);
        assert.strictEqual(p.tax.type, 'CGST_SGST');
        const free = up.csvLine({ user_id: 5, username: 'Free User', email: 'f@x', owner_type: 'DIRECT', user_status: 'new', sales_owner: null, referral_code: null }, null, 'Free');
        assert.ok(free.startsWith('Free User,f@x,,DIRECT,,new,Free,0.00,0.00,0.00,0.00,0.00,,,,,'), free);
    });

    if (!process.env.DATABASE_URL || !process.env.PAYMENT_DB_URL) {
        console.log('  (skipping live DB checks: DATABASE_URL / PAYMENT_DB_URL not set)');
    } else {
        const { Pool } = require('pg');
        const authPool = new Pool({ connectionString: process.env.DATABASE_URL });
        const payPool = new Pool({ connectionString: process.env.PAYMENT_DB_URL });
        const tierSql = (expr, tier) => `(${expr} = '${tier}' OR ${expr} LIKE '${tier} %')`;

        await test('live: every stored GST breakdown sums to its total (data integrity)', async () => {
            const { rows } = await payPool.query(`SELECT COUNT(*)::int AS bad FROM payments WHERE basic_amount_paise IS NOT NULL
                AND basic_amount_paise + COALESCE(cgst_amount_paise,0) + COALESCE(sgst_amount_paise,0) + COALESCE(igst_amount_paise,0) <> total_amount_paise`);
            assert.strictEqual(rows[0].bad, 0);
        });
        await test('live: users page carries attribution + derived status for every row', async () => {
            const filters = { page: 1, pageSize: 10, search: '', plan: null, day: null, month: null, ...up.parseExtendedQuery({}) };
            const { rows, total } = await up.queryUsersPage(authPool, filters, {}, tierSql, 10, 0);
            assert.ok(total > 0);
            rows.forEach((r) => {
                assert.ok(['INTERNAL', 'OUTSOURCED', 'DIRECT'].includes(r.owner_type));
                assert.ok(up.USER_STATUSES.includes(r.user_status));
                if (r.owner_type === 'DIRECT') assert.strictEqual(r.referral_code, null);
                else assert.ok(r.referral_code && r.owner_name);
            });
        });
        await test('live: purchase-date filter is inclusive of the whole `to` IST day', async () => {
            const { rows } = await payPool.query(`SELECT to_char((COALESCE(purchase_date, captured_at, created_at) AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS d FROM payments WHERE LOWER(status) IN ('captured') ORDER BY 1 DESC LIMIT 1`);
            const day = rows[0].d;
            const ids = await up.queryUserIdsPurchasedBetween(payPool, day, day);
            assert.ok(ids.length > 0, `expected purchases on ${day}`);
        });
        await test('live: a user with several captured payments gets every one back from the history query', async () => {
            const { rows } = await payPool.query(`SELECT user_id, COUNT(*)::int n FROM payments WHERE LOWER(status)='captured' GROUP BY user_id HAVING COUNT(*)>1 ORDER BY n DESC LIMIT 1`);
            if (!rows.length) return;
            const h = await up.queryUserPaymentHistory(payPool, rows[0].user_id);
            assert.ok(h.payments.filter((p) => up.isPaidStatus(p.status)).length === rows[0].n);
        });
        await authPool.end(); await payPool.end();
    }
    console.log(`\n${passed} users & plans tests passed`);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });

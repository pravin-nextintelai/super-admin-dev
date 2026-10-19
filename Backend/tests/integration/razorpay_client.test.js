#!/usr/bin/env node
/**
 * Razorpay client — pagination, rate-limit retry, timeout retry exhaustion, non-retriable auth errors.
 * Uses an injected `request` so no network is touched. Usage: npm run test:razorpay-client
 */
const assert = require('assert');
const { createRazorpayClient, RazorpayApiError, normalizeRazorpayPayment } = require('../../src/infrastructure/payments/razorpayClient');

const creds = { keyId: 'rzp_test_x', keySecret: 'secret', minIntervalMs: 0, maxRetries: 2, pageSize: 2, timeoutMs: 50 };
let passed = 0;
const test = async (name, fn) => { await fn(); passed += 1; console.log(`  ✓ ${name}`); };

(async () => {
    console.log('razorpay client');

    await test('pages through /payments with count/skip until a short page', async () => {
        const calls = [];
        const pages = [[{ id: 'pay_1' }, { id: 'pay_2' }], [{ id: 'pay_3' }]];
        const client = createRazorpayClient(creds, { request: async (req) => { calls.push(req.params); return { status: 200, data: { items: pages[calls.length - 1] || [] } }; } });
        const { items, pages: n } = await client.listPayments({ fromUnix: 1, toUnix: 2 });
        assert.strictEqual(items.length, 3);
        assert.strictEqual(n, 2);
        assert.deepStrictEqual(calls.map((c) => c.skip), [0, 2]);
        assert.strictEqual(calls[0].count, 2);
        assert.strictEqual(client.stats.calls, 2);
    });

    await test('exact page boundary performs one extra empty-page call and stops', async () => {
        const seq = [[{ id: 'a' }, { id: 'b' }], []];
        let i = 0;
        const client = createRazorpayClient(creds, { request: async () => ({ status: 200, data: { items: seq[i++] } }) });
        const { items } = await client.listPayments({ fromUnix: 1, toUnix: 2 });
        assert.strictEqual(items.length, 2);
        assert.strictEqual(client.stats.calls, 2);
    });

    await test('429 is retried with backoff and then succeeds', async () => {
        let n = 0;
        const events = [];
        const client = createRazorpayClient(creds, {
            request: async () => (++n === 1 ? { status: 429, data: { error: { description: 'Too many' } }, headers: {} } : { status: 200, data: { items: [{ id: 'pay_ok' }] } }),
            onEvent: (e) => events.push(e),
        });
        const { items } = await client.listPayments({ fromUnix: 1, toUnix: 2 });
        assert.strictEqual(items[0].id, 'pay_ok');
        assert.strictEqual(client.stats.retries, 1);
        assert.ok(events.some((e) => e.level === 'warn' && /429/.test(e.message)));
    });

    await test('timeouts are retried up to maxRetries then surface as a RazorpayApiError (incomplete fetch)', async () => {
        const client = createRazorpayClient(creds, { request: async () => { const e = new Error('timeout of 50ms exceeded'); e.code = 'ECONNABORTED'; throw e; } });
        await assert.rejects(() => client.listPayments({ fromUnix: 1, toUnix: 2 }), (e) => e instanceof RazorpayApiError && e.code === 'ECONNABORTED' && e.attempt === 3);
        assert.strictEqual(client.stats.retries, 2);
    });

    await test('401 authentication failure is NOT retried', async () => {
        let n = 0;
        const client = createRazorpayClient(creds, { request: async () => { n++; return { status: 401, data: { error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } } }; } });
        await assert.rejects(() => client.listPayments({ fromUnix: 1, toUnix: 2 }), (e) => e.status === 401 && e.code === 'BAD_REQUEST_ERROR');
        assert.strictEqual(n, 1);
    });

    await test('missing credentials throw immediately', () => {
        assert.throws(() => createRazorpayClient({ keyId: '', keySecret: '' }), (e) => e.code === 'NO_CREDENTIALS');
    });

    await test('normalizeRazorpayPayment keeps integer paise and unix → Date', () => {
        const p = normalizeRazorpayPayment({ id: 'pay_1', order_id: 'order_1', amount: 10000, amount_refunded: 0, currency: 'INR', status: 'captured', captured: true, created_at: 1760000000, notes: { a: 1 } });
        assert.strictEqual(p.amount_paise, 10000);
        assert.strictEqual(p.razorpay_created_at.toISOString(), new Date(1760000000 * 1000).toISOString());
        assert.deepStrictEqual(p.notes, { a: 1 });
    });

    console.log(`\n${passed} client tests passed`);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });

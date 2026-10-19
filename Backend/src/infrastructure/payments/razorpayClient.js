/**
 * Minimal Razorpay REST client for reconciliation (read-only).
 *
 * Env:
 *   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET   Basic-auth credentials (required)
 *   RAZORPAY_API_BASE                       default https://api.razorpay.com/v1
 *   RAZORPAY_TIMEOUT_MS                     per-request timeout, default 15000
 *   RAZORPAY_MAX_RETRIES                    retries on 429 / 5xx / network errors, default 4
 *   RAZORPAY_PAGE_SIZE                      list page size (Razorpay max 100), default 100
 *   RAZORPAY_MIN_INTERVAL_MS                minimum gap between calls (soft rate limit), default 120
 *
 * All list calls page with count/skip until a short page is returned, so a range is fully fetched
 * or an error is thrown (callers must treat a throw as "incomplete", never as "no more data").
 */
const axios = require('axios');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveConfig(overrides = {}) {
    const env = process.env;
    return {
        keyId: overrides.keyId ?? env.RAZORPAY_KEY_ID,
        keySecret: overrides.keySecret ?? env.RAZORPAY_KEY_SECRET,
        baseUrl: (overrides.baseUrl ?? env.RAZORPAY_API_BASE ?? 'https://api.razorpay.com/v1').replace(/\/+$/, ''),
        timeoutMs: Number(overrides.timeoutMs ?? env.RAZORPAY_TIMEOUT_MS ?? 15000),
        maxRetries: Number(overrides.maxRetries ?? env.RAZORPAY_MAX_RETRIES ?? 4),
        pageSize: Math.min(100, Math.max(1, Number(overrides.pageSize ?? env.RAZORPAY_PAGE_SIZE ?? 100))),
        minIntervalMs: Number(overrides.minIntervalMs ?? env.RAZORPAY_MIN_INTERVAL_MS ?? 120),
    };
}

class RazorpayApiError extends Error {
    constructor(message, { status, code, attempt, url, retriable } = {}) {
        super(message);
        this.name = 'RazorpayApiError';
        this.status = status ?? null;
        this.code = code ?? null;
        this.attempt = attempt ?? null;
        this.url = url ?? null;
        this.retriable = Boolean(retriable);
    }
}

/**
 * @param {object} [options]            see resolveConfig
 * @param {object} [deps]
 * @param {function} [deps.request]      (axios-like) for tests: async ({ method, url, params, auth, timeout }) => { status, data }
 * @param {function} [deps.onEvent]      ({ level, message, details }) → void  (API call / retry log)
 */
function createRazorpayClient(options = {}, deps = {}) {
    const cfg = resolveConfig(options);
    const request = deps.request || ((req) => axios({ ...req, validateStatus: () => true }));
    const onEvent = deps.onEvent || (() => {});
    const stats = { calls: 0, retries: 0 };
    let lastCallAt = 0;

    if (!cfg.keyId || !cfg.keySecret) {
        throw new RazorpayApiError('Razorpay credentials missing: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET', { code: 'NO_CREDENTIALS' });
    }

    async function get(path, params = {}) {
        const url = `${cfg.baseUrl}${path}`;
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            attempt += 1;
            const gap = cfg.minIntervalMs - (Date.now() - lastCallAt);
            if (gap > 0) await sleep(gap);
            lastCallAt = Date.now();
            stats.calls += 1;
            let res;
            try {
                res = await request({
                    method: 'GET', url, params, timeout: cfg.timeoutMs,
                    auth: { username: cfg.keyId, password: cfg.keySecret },
                    headers: { Accept: 'application/json' },
                });
            } catch (err) {
                // network / timeout
                const retriable = attempt <= cfg.maxRetries;
                onEvent({ level: retriable ? 'warn' : 'error', message: `Razorpay ${path} network error (attempt ${attempt})`, details: { url, params, error: err.code || err.message } });
                if (!retriable) throw new RazorpayApiError(`Razorpay request failed after ${attempt} attempts: ${err.message}`, { code: err.code || 'NETWORK', attempt, url, retriable: false });
                stats.retries += 1;
                await sleep(backoff(attempt));
                continue;
            }
            if (res.status >= 200 && res.status < 300) return res.data;

            const body = res.data || {};
            const desc = body.error?.description || body.error?.reason || `HTTP ${res.status}`;
            const code = body.error?.code || `HTTP_${res.status}`;
            const retriable = (res.status === 429 || res.status >= 500) && attempt <= cfg.maxRetries;
            onEvent({ level: retriable ? 'warn' : 'error', message: `Razorpay ${path} → ${res.status} ${desc} (attempt ${attempt})`, details: { url, params, status: res.status, code } });
            if (!retriable) {
                throw new RazorpayApiError(`Razorpay API error ${res.status}: ${desc}`, { status: res.status, code, attempt, url, retriable: false });
            }
            stats.retries += 1;
            const retryAfter = Number(res.headers?.['retry-after']);
            await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
        }
    }

    function backoff(attempt) {
        return Math.min(8000, 400 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
    }

    /**
     * Every payment created in [fromUnix, toUnix] (inclusive unix seconds). `onPage` is called per page.
     * Resolves { items, pages }. Throws when the range could not be fetched completely.
     */
    async function listPayments({ fromUnix, toUnix }, { onPage } = {}) {
        const items = [];
        let skip = 0;
        let pages = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const data = await get('/payments', { from: fromUnix, to: toUnix, count: cfg.pageSize, skip });
            const page = Array.isArray(data?.items) ? data.items : [];
            pages += 1;
            items.push(...page);
            if (onPage) await onPage({ page: pages, received: page.length, total: items.length, declaredCount: data?.count ?? null });
            if (page.length < cfg.pageSize) break;
            skip += page.length;
        }
        return { items, pages };
    }

    const getPayment = (paymentId) => get(`/payments/${encodeURIComponent(paymentId)}`);
    const getOrder = (orderId) => get(`/orders/${encodeURIComponent(orderId)}`);
    const getInvoice = (invoiceId) => get(`/invoices/${encodeURIComponent(invoiceId)}`);
    const listRefundsForPayment = async (paymentId) => {
        const data = await get(`/payments/${encodeURIComponent(paymentId)}/refunds`, { count: 100 });
        return Array.isArray(data?.items) ? data.items : [];
    };

    return { listPayments, getPayment, getOrder, getInvoice, listRefundsForPayment, stats, config: { ...cfg, keySecret: undefined } };
}

/** Normalise a Razorpay payment entity into the shape the matcher consumes (amounts stay integer paise). */
function normalizeRazorpayPayment(p) {
    return {
        razorpay_payment_id: p.id,
        razorpay_order_id: p.order_id || null,
        razorpay_invoice_id: p.invoice_id || null,
        amount_paise: Number.isFinite(Number(p.amount)) ? Number(p.amount) : null,
        amount_refunded_paise: Number.isFinite(Number(p.amount_refunded)) ? Number(p.amount_refunded) : 0,
        currency: p.currency || null,
        status: p.status || null,                     // created|authorized|captured|refunded|failed
        refund_status: p.refund_status || null,       // null|partial|full
        captured: Boolean(p.captured),
        method: p.method || null,
        email: p.email || null,
        contact: p.contact != null ? String(p.contact) : null,
        razorpay_created_at: p.created_at ? new Date(Number(p.created_at) * 1000) : null,
        notes: p.notes && typeof p.notes === 'object' ? p.notes : null,
        error_code: p.error_code || null,
        error_description: p.error_description || null,
        payload: p,
    };
}

module.exports = { createRazorpayClient, normalizeRazorpayPayment, RazorpayApiError, resolveConfig };

// Plan-centric analytics — STRICTLY READ-ONLY (SELECT only; never mutates any table).
// "How many users bought each plan" + drill-in lists of those users.
//   monthly → subscribers from user_subscriptions.monthly_plan_id + paid amount from payments
//   topup   → buyers from user_token_topup_purchases.topup_plan_id
//   addon   → buyers from user_storage_addon_purchases
//   totals  → paid users + income across monthly/topup/addon
// pools = { authPool, paymentPool }.

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const PAID = ['captured', 'paid', 'success', 'succeeded', 'completed'];
const { logPortalFlow } = require('../utils/portalAdminLog');
const logger = require('../config/logger');
const up = require('../services/usersPlansService');
const { paiseToRupeeString } = require('../utils/money');

/** Enrich Payment-DB rows (which only have user_id) with username/email from the Auth DB. */
async function attachUsers(rows, authPool) {
    const ids = [...new Set(rows.map((r) => r.user_id).filter((v) => v != null))];
    if (!ids.length) return rows.map((r) => ({ ...r, username: null, email: null, is_blocked: false }));
    const { rows: users } = await authPool.query(
        'SELECT id, username, email, is_blocked FROM users WHERE id = ANY($1::int[])',
        [ids]
    );
    const map = new Map(users.map((u) => [String(u.id), u]));
    return rows.map((r) => {
        const u = map.get(String(r.user_id));
        return { ...r, username: u?.username || null, email: u?.email || null, is_blocked: u?.is_blocked || false };
    });
}

async function queryPaidTotals(paymentPool) {
    const empty = {
        paid_users: 0,
        monthly_revenue: 0,
        monthly_paid_count: 0,
        monthly_paid_users: 0,
        topup_revenue: 0,
        topup_paid_count: 0,
        topup_paid_users: 0,
        addon_revenue: 0,
        addon_paid_count: 0,
        addon_paid_users: 0,
        total_income: 0,
    };
    try {
        const [planPay, topupPay, addonPay, paidUsers] = await Promise.all([
            paymentPool.query(
                `SELECT
                    COALESCE(SUM(amount) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])), 0)::numeric AS revenue,
                    COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[]))::int AS paid_count,
                    COUNT(DISTINCT user_id) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[]))::int AS paid_users
                 FROM payments`,
                [PAID]
            ),
            paymentPool.query(
                `SELECT
                    COALESCE(SUM(amount) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])), 0)::numeric AS revenue,
                    COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[]))::int AS paid_count,
                    COUNT(DISTINCT user_id) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[]))::int AS paid_users
                 FROM user_token_topup_purchases`,
                [PAID]
            ),
            paymentPool.query(
                `SELECT
                    COALESCE(SUM(amount) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])), 0)::numeric AS revenue,
                    COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[]))::int AS paid_count,
                    COUNT(DISTINCT user_id) FILTER (WHERE LOWER(COALESCE(status, '')) = ANY($1::text[]))::int AS paid_users
                 FROM user_storage_addon_purchases`,
                [PAID]
            ).catch(() => ({ rows: [{ revenue: 0, paid_count: 0, paid_users: 0 }] })),
            paymentPool.query(
                `SELECT COUNT(DISTINCT user_id)::int AS paid_users FROM (
                    SELECT user_id FROM payments
                      WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])
                    UNION
                    SELECT user_id FROM user_token_topup_purchases
                      WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])
                    UNION
                    SELECT user_id FROM user_storage_addon_purchases
                      WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])
                 ) paid`,
                [PAID]
            ).catch(async () => paymentPool.query(
                `SELECT COUNT(DISTINCT user_id)::int AS paid_users FROM (
                    SELECT user_id FROM payments
                      WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])
                    UNION
                    SELECT user_id FROM user_token_topup_purchases
                      WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])
                 ) paid`,
                [PAID]
            )),
        ]);
        const monthlyRevenue = num(planPay.rows[0]?.revenue);
        const topupRevenue = num(topupPay.rows[0]?.revenue);
        const addonRevenue = num(addonPay.rows[0]?.revenue);
        return {
            paid_users: num(paidUsers.rows[0]?.paid_users),
            monthly_revenue: monthlyRevenue,
            monthly_paid_count: num(planPay.rows[0]?.paid_count),
            monthly_paid_users: num(planPay.rows[0]?.paid_users),
            topup_revenue: topupRevenue,
            topup_paid_count: num(topupPay.rows[0]?.paid_count),
            topup_paid_users: num(topupPay.rows[0]?.paid_users),
            addon_revenue: addonRevenue,
            addon_paid_count: num(addonPay.rows[0]?.paid_count),
            addon_paid_users: num(addonPay.rows[0]?.paid_users),
            total_income: monthlyRevenue + topupRevenue + addonRevenue,
        };
    } catch (e) {
        console.error('[planAnalytics] paid totals failed:', e.message);
        return { ...empty, error: e.message };
    }
}

/** GET /summary — counts per monthly plan + per topup plan, plus add-on catalog. */
exports.getSummary = async (req, res, pools) => {
    try {
        let monthly;
        try {
            monthly = await pools.paymentPool.query(
                `SELECT mp.id, mp.name, mp.price, mp.currency, mp.category, mp.is_custom,
                        COUNT(us.id)::int AS subscribers,
                        COUNT(us.id) FILTER (WHERE LOWER(COALESCE(us.status, 'active')) IN ('active', 'topup_only'))::int AS active_subscribers,
                        COALESCE(rev.revenue, 0)::numeric AS revenue,
                        COALESCE(rev.paid_users, 0)::int AS paid_users
                 FROM monthly_plans mp
                 LEFT JOIN user_subscriptions us ON us.monthly_plan_id = mp.id
                 LEFT JOIN (
                    SELECT us2.monthly_plan_id,
                           COALESCE(SUM(p.amount) FILTER (WHERE LOWER(COALESCE(p.status, '')) = ANY($1::text[])), 0)::numeric AS revenue,
                           COUNT(DISTINCT p.user_id) FILTER (WHERE LOWER(COALESCE(p.status, '')) = ANY($1::text[]))::int AS paid_users
                    FROM user_subscriptions us2
                    JOIN payments p ON p.subscription_id = us2.id
                    GROUP BY us2.monthly_plan_id
                 ) rev ON rev.monthly_plan_id = mp.id
                 GROUP BY mp.id, mp.name, mp.price, mp.currency, mp.category, mp.is_custom, mp.sort_order, rev.revenue, rev.paid_users
                 ORDER BY subscribers DESC, mp.sort_order ASC, mp.id ASC`,
                [PAID]
            );
        } catch (e) {
            console.error('[planAnalytics] monthly revenue join failed, falling back to subscriber counts:', e.message);
            monthly = await pools.paymentPool.query(
                `SELECT mp.id, mp.name, mp.price, mp.currency, mp.category, mp.is_custom,
                        COUNT(us.id)::int AS subscribers,
                        COUNT(us.id) FILTER (WHERE LOWER(COALESCE(us.status, 'active')) IN ('active', 'topup_only'))::int AS active_subscribers,
                        0::numeric AS revenue,
                        0::int AS paid_users
                 FROM monthly_plans mp
                 LEFT JOIN user_subscriptions us ON us.monthly_plan_id = mp.id
                 GROUP BY mp.id, mp.name, mp.price, mp.currency, mp.category, mp.is_custom, mp.sort_order
                 ORDER BY subscribers DESC, mp.sort_order ASC, mp.id ASC`
            );
        }
        const topup = await pools.paymentPool.query(
            `SELECT tp.id, tp.name, tp.price, tp.currency, tp.tokens,
                    COUNT(DISTINCT up.user_id)::int AS buyers,
                    COUNT(up.id)::int AS purchases,
                    COALESCE(SUM(up.amount) FILTER (WHERE LOWER(COALESCE(up.status, '')) = ANY($1::text[])), 0)::numeric AS revenue
             FROM topup_plans tp
             LEFT JOIN user_token_topup_purchases up ON up.topup_plan_id = tp.id
             GROUP BY tp.id, tp.name, tp.price, tp.currency, tp.tokens
             ORDER BY purchases DESC, tp.sort_order ASC, tp.id ASC`,
            [PAID]
        );
        // Per-add-on purchase analytics — the user-facing app now records buys in user_storage_addon_purchases.
        let addons;
        try {
            const perPlan = await pools.paymentPool.query(
                `SELECT ap.id, ap.name, ap.price, ap.currency, ap.storage_gb,
                        COUNT(DISTINCT up.user_id)::int AS buyers,
                        COUNT(up.id)::int AS purchases,
                        COUNT(up.id) FILTER (WHERE LOWER(COALESCE(up.status, '')) = 'completed')::int AS completed,
                        COALESCE(SUM(up.amount) FILTER (WHERE LOWER(COALESCE(up.status, '')) = 'completed'), 0)::numeric AS revenue,
                        COALESCE(SUM(up.storage_bytes_granted) FILTER (WHERE LOWER(COALESCE(up.status, '')) = 'completed'), 0)::bigint AS bytes_granted
                 FROM addon_plans ap
                 LEFT JOIN user_storage_addon_purchases up ON up.addon_plan_id = ap.id
                 GROUP BY ap.id, ap.name, ap.price, ap.currency, ap.storage_gb
                 ORDER BY purchases DESC, ap.sort_order ASC, ap.id ASC`
            );
            // purchases whose addon_plan_id no longer matches a catalog plan (stale ids)
            const orphan = await pools.paymentPool.query(
                `SELECT COUNT(*)::int AS purchases, COUNT(DISTINCT user_id)::int AS buyers,
                        COALESCE(SUM(amount) FILTER (WHERE LOWER(COALESCE(status, '')) = 'completed'), 0)::numeric AS revenue
                 FROM user_storage_addon_purchases up
                 WHERE NOT EXISTS (SELECT 1 FROM addon_plans ap WHERE ap.id = up.addon_plan_id)`
            );
            // grand totals across ALL purchases (incl. orphans) — powers the top KPIs
            const totals = await pools.paymentPool.query(
                `SELECT COUNT(*)::int AS purchases, COUNT(DISTINCT user_id)::int AS buyers,
                        COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'completed')::int AS completed,
                        COALESCE(SUM(amount) FILTER (WHERE LOWER(COALESCE(status, '')) = 'completed'), 0)::numeric AS revenue,
                        COALESCE(SUM(storage_bytes_granted) FILTER (WHERE LOWER(COALESCE(status, '')) = 'completed'), 0)::bigint AS bytes_granted
                 FROM user_storage_addon_purchases`
            );
            addons = { tracked: true, plans: perPlan.rows, unmatched: orphan.rows[0], totals: totals.rows[0] };
        } catch (e) {
            const catalog = await pools.paymentPool.query(
                `SELECT id, name, price, currency, storage_gb FROM addon_plans WHERE is_active = true ORDER BY sort_order ASC, id ASC`
            );
            addons = {
                tracked: false,
                plans: catalog.rows.map((c) => ({ ...c, buyers: 0, purchases: 0, completed: 0, revenue: 0, bytes_granted: 0 })),
                unmatched: null,
                error: e.message,
            };
        }
        const finance = await queryPaidTotals(pools.paymentPool);
        const totalSubscriptions = monthly.rows.reduce((s, m) => s + num(m.subscribers), 0);
        const activeSubscribers = monthly.rows.reduce((s, m) => s + num(m.active_subscribers), 0);
        const totals = {
            currency: 'INR',
            total_subscriptions: totalSubscriptions,
            active_subscribers: activeSubscribers,
            paid_users: finance.paid_users,
            monthly_revenue: finance.monthly_revenue,
            monthly_paid_users: finance.monthly_paid_users,
            monthly_paid_count: finance.monthly_paid_count,
            topup_revenue: finance.topup_revenue,
            topup_paid_users: finance.topup_paid_users,
            topup_paid_count: finance.topup_paid_count,
            addon_revenue: finance.addon_revenue,
            addon_paid_users: finance.addon_paid_users,
            addon_paid_count: finance.addon_paid_count,
            total_income: finance.total_income,
            ...(finance.error ? { error: finance.error } : {}),
        };
        logPortalFlow(req, 'Plan analytics summary loaded', {
            layer: 'PLAN_ANALYTICS',
            summary: {
                monthlyPlans: monthly.rows.length,
                topupPlans: topup.rows.length,
                addonPlans: addons?.plans?.length || 0,
                addonTracked: Boolean(addons?.tracked),
            },
            output: totals,
            table: monthly.rows.slice(0, 8).map((m) => ({
                id: m.id,
                name: m.name,
                subscribers: m.subscribers,
                paid_users: m.paid_users,
                revenue: m.revenue,
            })),
        });
        return res.status(200).json({
            success: true,
            data: {
                monthly: monthly.rows,
                topup: topup.rows,
                addons,
                totals,
            },
        });
    } catch (e) {
        logger.errorWithContext('Plan analytics summary failed', e, {
            requestId: req.requestId,
            layer: 'PLAN_ANALYTICS',
            summary: { role: req.user?.role || null, userId: req.user?.id || null },
        });
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /monthly/:planId/subscribers */
exports.getMonthlySubscribers = async (req, res, pools) => {
    const planId = parseInt(req.params.planId, 10);
    if (!Number.isFinite(planId)) return res.status(400).json({ success: false, message: 'Invalid plan id' });
    try {
        const { rows } = await pools.paymentPool.query(
            `SELECT us.user_id, us.status, us.start_date, us.last_reset_date, us.end_date, us.created_at,
                    COALESCE(us.current_token_balance, 0)::bigint AS current_token_balance,
                    COALESCE(us.topup_token_balance, 0)::bigint  AS topup_token_balance
             FROM user_subscriptions us
             WHERE us.monthly_plan_id = $1
             ORDER BY us.created_at DESC NULLS LAST`,
            [planId]
        );
        const data = await attachUsers(rows, pools.authPool);
        logPortalFlow(req, 'Plan analytics monthly subscribers loaded', {
            layer: 'PLAN_ANALYTICS',
            summary: { planId, rowCount: data.length },
            table: data.slice(0, 8).map((r) => ({
                user_id: r.user_id,
                email: r.email,
                status: r.status,
            })),
        });
        return res.status(200).json({ success: true, data });
    } catch (e) {
        logger.errorWithContext('Plan analytics monthly subscribers failed', e, {
            requestId: req.requestId,
            layer: 'PLAN_ANALYTICS',
            summary: { planId },
        });
        return res.status(500).json({ success: false, message: e.message });
    }
};

exports.getAddonBuyers = async (req, res, pools) => {
    const planId = parseInt(req.params.planId, 10);
    if (!Number.isFinite(planId)) return res.status(400).json({ success: false, message: 'Invalid plan id' });
    try {
        const { rows } = await pools.paymentPool.query(
            `SELECT up.user_id, up.amount, up.currency, up.storage_bytes_granted, up.status, up.created_at, up.expires_at
             FROM user_storage_addon_purchases up
             WHERE up.addon_plan_id = $1
             ORDER BY up.created_at DESC NULLS LAST
             LIMIT 500`,
            [planId]
        );
        const data = await attachUsers(rows, pools.authPool);
        logPortalFlow(req, 'Plan analytics addon buyers loaded', {
            layer: 'PLAN_ANALYTICS',
            summary: { planId, rowCount: data.length },
        });
        return res.status(200).json({ success: true, data });
    } catch (e) {
        logger.errorWithContext('Plan analytics addon buyers failed', e, {
            requestId: req.requestId,
            layer: 'PLAN_ANALYTICS',
            summary: { planId },
        });
        return res.status(500).json({ success: false, message: e.message });
    }
};

const clampPage = (v, def = 1) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 1 ? n : def;
};
const clampPageSize = (v, def = 25) => {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) return def;
    return Math.min(n, 100);
};
const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXPORT_LIMIT = 10000;

const PLAN_TIERS = ['free', 'pro', 'plus', 'lite', 'enterprise'];

function parseSubscriberQuery(query) {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const planIdRaw = parseInt(query.planId, 10);
    const topupPlanIdRaw = parseInt(query.topupPlanId, 10);
    const addonPlanIdRaw = parseInt(query.addonPlanId, 10);
    const day = DAY_RE.test(String(query.day || '').trim()) ? String(query.day).trim() : null;
    const planRaw = String(query.plan || '').trim().toLowerCase();
    const dateParam = (v) => (DAY_RE.test(String(v || '').trim()) ? String(v).trim() : null);
    let from = dateParam(query.from);
    let to = dateParam(query.to);
    if (from && to && from > to) [from, to] = [to, from];
    return {
        page,
        pageSize,
        planId: Number.isFinite(planIdRaw) ? planIdRaw : null,
        topupPlanId: Number.isFinite(topupPlanIdRaw) ? topupPlanIdRaw : null,
        addonPlanId: Number.isFinite(addonPlanIdRaw) ? addonPlanIdRaw : null,
        day,
        month: !day && MONTH_RE.test(String(query.month || '').trim()) ? String(query.month).trim() : null,
        search: String(query.search || '').trim().slice(0, 120),
        status: /^[a-z0-9_]{1,32}$/.test(String(query.status || '').trim().toLowerCase())
            ? String(query.status).trim().toLowerCase()
            : null,
        plan: PLAN_TIERS.includes(planRaw) ? planRaw : null,
        from,
        to,
        ...up.parseExtendedQuery(query),
    };
}

const PAID_IN = `'captured','paid','success','succeeded','completed'`;
const PAID_FILTER = `LOWER(COALESCE(p.status, '')) IN (${PAID_IN})`;

function canonicalPlanKey(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n || n === 'free' || n === 'free trial' || n === 'trial' || n.startsWith('free ')) return 'free';
    if (n === 'plus' || n.startsWith('plus ') || n.startsWith('plus-')) return 'plus';
    if (n === 'pro' || n.startsWith('pro ') || n.startsWith('pro-')) return 'pro';
    if (n === 'lite' || n.startsWith('lite ') || n.startsWith('lite-')) return 'lite';
    if (n === 'enterprise' || n.startsWith('enterprise ') || n.startsWith('enterprise-')) return 'enterprise';
    return n || 'free';
}

function tierSql(expr, tier) {
    if (tier === 'free') {
        return `(${expr} = '' OR ${expr} = 'free' OR ${expr} = 'free trial' OR ${expr} = 'trial' OR ${expr} LIKE 'free %')`;
    }
    if (tier === 'pro') return `(${expr} = 'pro' OR ${expr} LIKE 'pro %' OR ${expr} LIKE 'pro-%')`;
    if (tier === 'plus') return `(${expr} = 'plus' OR ${expr} LIKE 'plus %' OR ${expr} LIKE 'plus-%')`;
    if (tier === 'lite') return `(${expr} = 'lite' OR ${expr} LIKE 'lite %' OR ${expr} LIKE 'lite-%')`;
    if (tier === 'enterprise') return `(${expr} = 'enterprise' OR ${expr} LIKE 'enterprise %' OR ${expr} LIKE 'enterprise-%')`;
    return null;
}

function joinIds(values) {
    return [...new Set((values || []).map((v) => Number(v)).filter((n) => Number.isFinite(n)))];
}

function intersectIds(lists) {
    if (!lists.length) return [];
    let set = new Set(lists[0]);
    for (let i = 1; i < lists.length; i += 1) {
        const next = new Set(lists[i]);
        set = new Set([...set].filter((id) => next.has(id)));
    }
    return [...set];
}

function csvCell(value) {
    if (value == null || value === '') return '';
    let s = String(value);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/** Excel-friendly IST timestamp (no T/Z so Excel keeps it as text/date). */
function toExcelDate(value) {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(dt).map((p) => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** Same columns as the Users & Plans table: user, plan, amount paid, purchase date, invoice, receipt. */
function subscribersToCsv(rows) {
    const header = ['Username', 'Email', 'Plan', 'Amount paid (INR)', 'Purchase date', 'Invoice', 'Receipt'];
    const lines = [header.map(csvCell).join(',')];
    rows.forEach((r) => {
        const paymentId = r.latest_invoice_id;
        lines.push([
            r.username || `User #${r.user_id}`,
            r.email,
            r.plan_name || 'Free',
            paymentId ? num(r.latest_invoice_amount) : 0,
            paymentId ? toExcelDate(r.latest_invoice_at).slice(0, 10) : '',
            paymentId ? `INV-${paymentId}` : '',
            paymentId ? (r.latest_receipt || `RCPT-${paymentId}`) : '',
        ].map(csvCell).join(','));
    });
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}

async function queryIds(paymentPool, sql, params = []) {
    const { rows } = await paymentPool.query(sql, params);
    return joinIds(rows.map((r) => r.user_id));
}

async function loadCurrentBillingPlans(paymentPool) {
    const sql = (legacy) => `
        SELECT DISTINCT ON (us.user_id)
               us.user_id,
               TRIM(COALESCE(mp.name${legacy ? ', sp.name' : ''}, '')) AS plan_name
        FROM user_subscriptions us
        LEFT JOIN monthly_plans mp ON mp.id = us.monthly_plan_id
        ${legacy ? 'LEFT JOIN subscription_plans sp ON sp.id = us.plan_id' : ''}
        ORDER BY us.user_id,
                 CASE WHEN LOWER(COALESCE(us.status, '')) IN ('active', 'topup_only') THEN 0 ELSE 1 END,
                 COALESCE(us.created_at, us.start_date) DESC NULLS LAST`;
    try {
        const { rows } = await paymentPool.query(sql(true));
        return rows;
    } catch (e) {
        const { rows } = await paymentPool.query(sql(false));
        return rows;
    }
}

async function billingFilterIds(paymentPool, plan) {
    if (!plan) return { tierBillingIds: [], nonFreeBillingIds: [] };
    const rows = await loadCurrentBillingPlans(paymentPool);
    const tierBillingIds = [];
    const nonFreeBillingIds = [];
    rows.forEach((r) => {
        const key = canonicalPlanKey(r.plan_name);
        const id = Number(r.user_id);
        if (!Number.isFinite(id)) return;
        if (key !== 'free') nonFreeBillingIds.push(id);
        if (key === plan) tierBillingIds.push(id);
    });
    return { tierBillingIds: joinIds(tierBillingIds), nonFreeBillingIds: joinIds(nonFreeBillingIds) };
}

async function constraintUserIds(paymentPool, filters) {
    const lists = [];
    if (filters.from || filters.to) {
        // Purchase date = the user's latest paid plan payment (IST calendar days; `to` inclusive → exclusive boundary in SQL).
        lists.push(await up.queryUserIdsPurchasedBetween(paymentPool, filters.from, filters.to));
    }
    if (filters.planId != null) {
        lists.push(await queryIds(
            paymentPool,
            `SELECT DISTINCT user_id FROM user_subscriptions WHERE monthly_plan_id = $1`,
            [filters.planId]
        ));
    }
    if (filters.topupPlanId != null) {
        lists.push(await queryIds(
            paymentPool,
            `SELECT DISTINCT user_id FROM user_token_topup_purchases WHERE topup_plan_id = $1`,
            [filters.topupPlanId]
        ));
    }
    if (filters.addonPlanId != null) {
        try {
            lists.push(await queryIds(
                paymentPool,
                `SELECT DISTINCT user_id FROM user_storage_addon_purchases WHERE addon_plan_id = $1`,
                [filters.addonPlanId]
            ));
        } catch {
            lists.push([]);
        }
    }
    if (filters.status === 'pack_only') {
        let packed = [];
        try {
            packed = await queryIds(paymentPool, `
                SELECT user_id FROM user_token_topup_purchases
                UNION
                SELECT user_id FROM user_storage_addon_purchases`);
        } catch {
            packed = await queryIds(paymentPool, `SELECT user_id FROM user_token_topup_purchases`);
        }
        const subscribed = await queryIds(paymentPool, `SELECT DISTINCT user_id FROM user_subscriptions`);
        const sub = new Set(subscribed);
        lists.push(packed.filter((id) => !sub.has(id)));
    } else if (filters.status && filters.status !== 'free') {
        lists.push(await queryIds(
            paymentPool,
            `SELECT user_id FROM (
                SELECT DISTINCT ON (us.user_id) us.user_id, LOWER(COALESCE(us.status, '')) AS status
                FROM user_subscriptions us
                ORDER BY us.user_id,
                         CASE WHEN LOWER(COALESCE(us.status, '')) IN ('active', 'topup_only') THEN 0 ELSE 1 END,
                         COALESCE(us.created_at, us.start_date) DESC NULLS LAST
             ) s WHERE s.status = $1`,
            [filters.status]
        ));
    }
    if (!lists.length) return null;
    return intersectIds(lists.map(joinIds));
}

function buildUserWhere(filters, extra) {
    const where = [];
    const params = [];
    const add = (clause, value) => {
        params.push(value);
        where.push(clause.replace('$?', `$${params.length}`));
    };
    const planExpr = `LOWER(TRIM(COALESCE(u.active_plan_name, '')))`;
    if (filters.search) {
        params.push(`%${filters.search}%`);
        const like = params.length;
        params.push(filters.search);
        const exact = params.length;
        where.push(`(u.username ILIKE $${like} OR u.email ILIKE $${like} OR u.id::text = $${exact})`);
    }
    if (filters.plan === 'free') {
        where.push(tierSql(planExpr, 'free'));
        if (extra.nonFreeBillingIds.length) {
            params.push(extra.nonFreeBillingIds);
            where.push(`NOT (u.id = ANY($${params.length}::int[]))`);
        }
    } else if (filters.plan) {
        const parts = [tierSql(planExpr, filters.plan)];
        if (extra.tierBillingIds.length) {
            params.push(extra.tierBillingIds);
            parts.push(`(TRIM(COALESCE(u.active_plan_name, '')) = '' AND u.id = ANY($${params.length}::int[]))`);
        }
        where.push(`(${parts.join(' OR ')})`);
    }
    if (extra.constraintIds) {
        params.push(extra.constraintIds);
        where.push(`u.id = ANY($${params.length}::int[])`);
    }
    const joined = `(u.created_at AT TIME ZONE 'Asia/Kolkata')`;
    if (filters.day) add(`${joined}::date = $?::date`, filters.day);
    else if (filters.month) add(`to_char(${joined}, 'YYYY-MM') = $?`, filters.month);
    return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function queryCurrentSubs(paymentPool, ids) {
    const sql = (legacy) => `
        SELECT DISTINCT ON (us.user_id)
               us.user_id,
               COALESCE(NULLIF(TRIM(us.status), ''), 'active') AS status,
               COALESCE(us.current_token_balance, 0)::bigint AS current_token_balance,
               COALESCE(us.topup_token_balance, 0)::bigint AS topup_token_balance,
               TRIM(COALESCE(mp.name${legacy ? ', sp.name' : ''}, '')) AS billing_plan_name
        FROM user_subscriptions us
        LEFT JOIN monthly_plans mp ON mp.id = us.monthly_plan_id
        ${legacy ? 'LEFT JOIN subscription_plans sp ON sp.id = us.plan_id' : ''}
        WHERE us.user_id = ANY($1::int[])
        ORDER BY us.user_id,
                 CASE WHEN LOWER(COALESCE(us.status, '')) IN ('active', 'topup_only') THEN 0 ELSE 1 END,
                 COALESCE(us.created_at, us.start_date) DESC NULLS LAST`;
    try {
        return await paymentPool.query(sql(true), [ids]);
    } catch {
        return paymentPool.query(sql(false), [ids]);
    }
}

async function queryPlanInvoices(paymentPool, ids) {
    return paymentPool.query(
        `SELECT p.user_id,
                COUNT(*) FILTER (WHERE ${PAID_FILTER})::int AS invoice_count,
                COALESCE(SUM(p.amount) FILTER (WHERE ${PAID_FILTER}), 0)::numeric AS paid_total,
                MAX(p.created_at) FILTER (WHERE ${PAID_FILTER}) AS last_paid_at,
                (array_agg(p.id::text ORDER BY p.created_at DESC NULLS LAST) FILTER (WHERE ${PAID_FILTER}))[1:40] AS invoice_ids,
                (array_agg(p.razorpay_payment_id ORDER BY p.created_at DESC NULLS LAST)
                    FILTER (WHERE ${PAID_FILTER} AND COALESCE(p.razorpay_payment_id, '') <> ''))[1:40] AS receipt_ids,
                (array_agg(p.razorpay_order_id ORDER BY p.created_at DESC NULLS LAST)
                    FILTER (WHERE ${PAID_FILTER} AND COALESCE(p.razorpay_order_id, '') <> ''))[1:40] AS order_ids,
                (array_agg(p.amount ORDER BY p.created_at DESC NULLS LAST) FILTER (WHERE ${PAID_FILTER}))[1] AS latest_invoice_amount
         FROM payments p
         WHERE p.user_id = ANY($1::int[])
         GROUP BY p.user_id`,
        [ids]
    );
}

async function queryPackNames(paymentPool, ids) {
    const [topups, addons] = await Promise.all([
        paymentPool.query(
            `SELECT up.user_id, string_agg(DISTINCT tp.name, ', ' ORDER BY tp.name) AS names
             FROM user_token_topup_purchases up
             JOIN topup_plans tp ON tp.id = up.topup_plan_id
             WHERE up.user_id = ANY($1::int[])
             GROUP BY up.user_id`,
            [ids]
        ).catch(() => ({ rows: [] })),
        paymentPool.query(
            `SELECT ua.user_id, string_agg(DISTINCT ap.name, ', ' ORDER BY ap.name) AS names
             FROM user_storage_addon_purchases ua
             JOIN addon_plans ap ON ap.id = ua.addon_plan_id
             WHERE ua.user_id = ANY($1::int[])
             GROUP BY ua.user_id`,
            [ids]
        ).catch(() => ({ rows: [] })),
    ]);
    return { topups: topups.rows, addons: addons.rows };
}

async function queryPackPaid(paymentPool, ids) {
    const paid = `LOWER(COALESCE(status, '')) IN (${PAID_IN})`;
    const [topups, addons] = await Promise.all([
        paymentPool.query(
            `SELECT user_id,
                    COALESCE(SUM(amount) FILTER (WHERE ${paid}), 0)::numeric AS paid_total,
                    MAX(created_at) FILTER (WHERE ${paid}) AS last_paid_at
             FROM user_token_topup_purchases
             WHERE user_id = ANY($1::int[])
             GROUP BY user_id`,
            [ids]
        ).catch(() => ({ rows: [] })),
        paymentPool.query(
            `SELECT user_id,
                    COALESCE(SUM(amount) FILTER (WHERE ${paid}), 0)::numeric AS paid_total,
                    MAX(created_at) FILTER (WHERE ${paid}) AS last_paid_at
             FROM user_storage_addon_purchases
             WHERE user_id = ANY($1::int[])
             GROUP BY user_id`,
            [ids]
        ).catch(() => ({ rows: [] })),
    ]);
    return { topups: topups.rows, addons: addons.rows };
}

function laterDate(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return new Date(a) >= new Date(b) ? a : b;
}

async function attachBilling(userRows, paymentPool) {
    const ids = joinIds(userRows.map((u) => u.id));
    const subs = new Map();
    const invoices = new Map();
    const topupNames = new Map();
    const addonNames = new Map();
    const topupPaid = new Map();
    const addonPaid = new Map();
    const latest = new Map();
    if (ids.length) {
        const [subRes, invoiceRes, names, packs, latestRes] = await Promise.all([
            queryCurrentSubs(paymentPool, ids),
            queryPlanInvoices(paymentPool, ids).catch((e) => {
                logger.errorWithContext('Plan analytics invoice summary failed', e, {
                    layer: 'PLAN_ANALYTICS',
                    summary: { userCount: ids.length },
                });
                return { rows: [] };
            }),
            queryPackNames(paymentPool, ids),
            queryPackPaid(paymentPool, ids),
            up.queryLatestPlanPayments(paymentPool, ids).catch((e) => {
                logger.errorWithContext('Users & Plans latest payment lookup failed', e, { layer: 'PLAN_ANALYTICS', summary: { userCount: ids.length } });
                return new Map();
            }),
        ]);
        latestRes.forEach((r, id) => latest.set(id, r));
        subRes.rows.forEach((r) => subs.set(Number(r.user_id), r));
        invoiceRes.rows.forEach((r) => invoices.set(Number(r.user_id), r));
        names.topups.forEach((r) => topupNames.set(Number(r.user_id), r.names));
        names.addons.forEach((r) => addonNames.set(Number(r.user_id), r.names));
        packs.topups.forEach((r) => topupPaid.set(Number(r.user_id), r));
        packs.addons.forEach((r) => addonPaid.set(Number(r.user_id), r));
    }
    return userRows.map((u) => {
        const id = Number(u.id);
        const sub = subs.get(id);
        const inv = invoices.get(id);
        const top = topupPaid.get(id);
        const add = addonPaid.get(id);
        const active = String(u.active_plan_name || '').trim();
        const billingName = String(sub?.billing_plan_name || '').trim();
        const planName = active || billingName || 'Free';
        const planKey = canonicalPlanKey(planName);
        const receiptIds = Array.isArray(inv?.receipt_ids) ? inv.receipt_ids.filter(Boolean) : [];
        const invoiceIds = Array.isArray(inv?.invoice_ids) ? inv.invoice_ids.filter(Boolean) : [];
        const paidTotal = num(inv?.paid_total) + num(top?.paid_total) + num(add?.paid_total);
        const latestRow = latest.get(id);
        const latestPayment = latestRow ? up.serializePayment(latestRow) : null;
        const attrs = u.owner_type !== undefined ? up.serializeUserAttributes(u) : null;
        return {
            user_id: u.id,
            username: u.username || null,
            email: u.email || null,
            is_blocked: Boolean(u.is_blocked),
            // Users & Plans extensions (attribution, derived status, latest paid plan payment with GST + references)
            user_status: attrs?.user_status ?? null,
            owner_type: attrs?.owner_type ?? null,
            sales_owner: attrs?.sales_owner ?? null,
            referral_code: attrs?.referral_code ?? null,
            referral: attrs?.referral ?? null,
            latest_payment: latestPayment,
            plan_transaction_count: num(latestRow?.paid_count),
            plan_name: planKey === 'free' && !active && !billingName ? 'Free' : planName,
            plan_key: planKey,
            plan_category: planKey,
            status: sub?.status || (planKey === 'free' ? 'free' : 'active'),
            joined_at: u.created_at,
            created_at: u.created_at,
            invoice_count: num(inv?.invoice_count),
            invoice_ids: invoiceIds,
            receipt_ids: receiptIds,
            order_ids: Array.isArray(inv?.order_ids) ? inv.order_ids.filter(Boolean) : [],
            latest_invoice_id: invoiceIds[0] || null,
            latest_invoice_amount: inv?.latest_invoice_amount != null ? num(inv.latest_invoice_amount) : null,
            latest_receipt: receiptIds[0] || null,
            paid_total: paidTotal,
            last_paid_at: laterDate(laterDate(inv?.last_paid_at, top?.last_paid_at), add?.last_paid_at),
            latest_invoice_at: inv?.last_paid_at || null,
            current_token_balance: num(sub?.current_token_balance),
            topup_token_balance: num(sub?.topup_token_balance),
            topup_plan_names: topupNames.get(id) || null,
            addon_plan_names: addonNames.get(id) || null,
        };
    });
}

async function loadPlanTierCounts(authPool) {
    const { rows } = await authPool.query(
        `SELECT LOWER(TRIM(COALESCE(active_plan_name, ''))) AS name, COUNT(*)::int AS count
         FROM users
         GROUP BY 1`
    );
    const counts = { all: 0, free: 0, pro: 0, plus: 0, lite: 0, enterprise: 0, other: 0 };
    rows.forEach((r) => {
        const n = num(r.count);
        const key = canonicalPlanKey(r.name);
        counts.all += n;
        if (PLAN_TIERS.includes(key)) counts[key] += n;
        else counts.other += n;
    });
    return counts;
}

async function loadSubscriberFacets(authPool, paymentPool) {
    const [plans, topupPlans, addonRes, statusRes, tierCounts, salesOwners] = await Promise.all([
        paymentPool.query(`SELECT id, name FROM monthly_plans ORDER BY sort_order ASC, id ASC`),
        paymentPool.query(`SELECT id, name FROM topup_plans ORDER BY sort_order ASC, id ASC`),
        paymentPool.query(`SELECT id, name FROM addon_plans ORDER BY sort_order ASC, id ASC`).catch(() => ({ rows: [] })),
        paymentPool.query(
            `SELECT DISTINCT LOWER(COALESCE(status, 'active')) AS status
             FROM user_subscriptions
             WHERE COALESCE(status, '') <> ''
             ORDER BY 1`
        ).catch(() => ({ rows: [{ status: 'active' }, { status: 'topup_only' }] })),
        loadPlanTierCounts(authPool),
        up.listSalesOwners(authPool).catch(() => []),
    ]);
    const known = ['active', 'free', 'topup_only', 'pack_only', 'cancelled', 'expired', 'inactive'];
    const fromDb = statusRes.rows.map((r) => r.status).filter(Boolean);
    const statuses = [...new Set([...known, ...fromDb])];
    const tiers = PLAN_TIERS.map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        count: tierCounts[key] || 0,
    }));
    return {
        plans: plans.rows,
        topupPlans: topupPlans.rows,
        addonPlans: addonRes.rows,
        statuses,
        tiers,
        tierCounts,
        salesOwners,
        ownerTypes: up.OWNER_TYPES,
        userStatuses: up.USER_STATUSES,
        sortFields: up.SORT_FIELDS,
        transactionSortFields: up.TX_SORT_FIELDS,
    };
}

/** GET /filters — facet lists for the Users & Plans screen. */
exports.getSubscriberFilters = async (req, res, pools) => {
    try {
        const facets = await loadSubscriberFacets(pools.authPool, pools.paymentPool);
        return res.status(200).json({ success: true, data: facets });
    } catch (e) {
        logger.errorWithContext('Users & Plans filters failed', e, { requestId: req.requestId, layer: 'PLAN_ANALYTICS' });
        return res.status(500).json({ success: false, message: e.message });
    }
};

async function queryUsers(authPool, filters, extra, limit, offset) {
    const { whereSql, params } = buildUserWhere(filters, extra);
    const countRes = await authPool.query(
        `SELECT COUNT(*)::int AS total FROM users u ${whereSql}`,
        params
    );
    const listParams = offset == null ? [...params, limit] : [...params, limit, offset];
    const limitSql = offset == null
        ? `LIMIT $${params.length + 1}`
        : `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const { rows } = await authPool.query(
        `SELECT u.id, u.username, u.email, u.is_blocked, u.active_plan_name, u.created_at
         FROM users u
         ${whereSql}
         ORDER BY u.created_at DESC NULLS LAST, u.id DESC
         ${limitSql}`,
        listParams
    );
    return { total: countRes.rows[0]?.total || 0, rows };
}

function mapInvoiceRow(row, kind) {
    return {
        id: `${kind}-${row.id}`,
        kind,
        plan_name: row.plan_name || (kind === 'topup' ? 'Top-up' : kind === 'addon' ? 'Add-on' : 'Plan'),
        amount: num(row.amount),
        currency: row.currency || 'INR',
        status: row.status || null,
        payment_method: row.payment_method || (kind === 'plan' ? null : 'Razorpay'),
        invoice_id: row.id != null ? String(row.id) : null,
        receipt: row.razorpay_payment_id || null,
        order_id: row.razorpay_order_id || null,
        created_at: row.created_at || row.transaction_date || null,
    };
}

/**
 * GET /subscribers — every auth user, with current plan plus plan invoices and receipts.
 * Query: page, pageSize, plan (free|pro|plus|lite|enterprise), planId, topupPlanId, addonPlanId,
 * month (YYYY-MM), day (YYYY-MM-DD), search, status.
 */
exports.getSubscribers = async (req, res, pools) => {
    const filters = parseSubscriberQuery(req.query);
    if (!filters.plan && filters.status === 'free') filters.plan = 'free';
    const { page, pageSize, planId, topupPlanId, addonPlanId, day, month, search, status, plan, from, to, view, sortBy, sortDir } = filters;
    const offset = (page - 1) * pageSize;
    const logSummary = { page, pageSize, plan, planId, topupPlanId, addonPlanId, month, day, from, to, view, sortBy, sortDir,
        ownerType: filters.ownerType, ownerId: filters.ownerId, code: filters.code, userStatus: filters.userStatus, search: search || null, status };

    try {
        const [billingIds, constraintIds] = await Promise.all([
            billingFilterIds(pools.paymentPool, plan),
            constraintUserIds(pools.paymentPool, filters),
        ]);
        const facetsPromise = loadSubscriberFacets(pools.authPool, pools.paymentPool);
        const extra = { ...billingIds, constraintIds };

        if (view === 'transactions') {
            const data = await listTransactionsView(pools, filters, extra, pageSize, offset);
            data.filters = await facetsPromise;
            logPortalFlow(req, 'Plan analytics transactions list loaded', {
                layer: 'PLAN_ANALYTICS', summary: { ...logSummary, total: data.total, rowCount: data.rows.length },
            });
            return res.status(200).json({ success: true, data });
        }

        if (constraintIds && constraintIds.length === 0) {
            const facets = await facetsPromise;
            logPortalFlow(req, 'Plan analytics subscribers list loaded', { layer: 'PLAN_ANALYTICS', summary: { ...logSummary, total: 0, rowCount: 0 } });
            return res.status(200).json({ success: true, data: { rows: [], total: 0, page, pageSize, view: 'users', sortBy, sortDir, filters: facets } });
        }
        if (sortBy === 'purchase_date' || sortBy === 'total_amount') {
            extra.orderedIds = await up.queryUserIdsOrderedByPayment(pools.paymentPool, sortBy, sortDir);
        }
        const { total, rows } = await up.queryUsersPage(pools.authPool, filters, extra, tierSql, pageSize, offset);
        const enriched = await attachBilling(rows, pools.paymentPool);
        const facets = await facetsPromise;
        logPortalFlow(req, 'Plan analytics subscribers list loaded', {
            layer: 'PLAN_ANALYTICS',
            summary: { ...logSummary, total, rowCount: enriched.length },
            table: enriched.slice(0, 8).map((r) => ({
                user_id: r.user_id, email: r.email, plan_name: r.plan_name, user_status: r.user_status, owner_type: r.owner_type, invoice_count: r.invoice_count,
            })),
        });
        return res.status(200).json({
            success: true,
            data: { rows: enriched, total, page, pageSize, view: 'users', sortBy, sortDir, filters: facets },
        });
    } catch (e) {
        logger.errorWithContext('Plan analytics subscribers list failed', e, { requestId: req.requestId, layer: 'PLAN_ANALYTICS', summary: logSummary });
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** view=transactions — one row per paid plan payment (users with several purchases appear once per purchase). */
async function listTransactionsView(pools, filters, extra, limit, offset) {
    const userIds = await up.queryMatchingUserIds(pools.authPool, filters, extra, tierSql);
    if (userIds && userIds.length === 0) {
        return { rows: [], total: 0, page: filters.page, pageSize: filters.pageSize, view: 'transactions', sortBy: filters.sortBy, sortDir: filters.sortDir };
    }
    const txSort = up.TX_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : 'purchase_date';
    const { total, rows } = await up.queryPaymentsPage(
        pools.paymentPool,
        { userIds, from: filters.from, to: filters.to, paidOnly: true, sortBy: txSort, sortDir: filters.sortDir },
        limit,
        offset
    );
    const attrs = await up.queryUserAttributes(pools.authPool, joinIds(rows.map((r) => r.user_id)));
    const out = rows.map((r) => {
        const user = up.serializeUserAttributes(attrs.get(Number(r.user_id)))
            || { user_id: Number(r.user_id), username: null, email: null, user_status: null, owner_type: null, sales_owner: null, referral_code: null };
        return { ...user, plan_name: r.plan_name || null, payment: up.serializePayment(r) };
    });
    return { rows: out, total, page: filters.page, pageSize: filters.pageSize, view: 'transactions', sortBy: txSort, sortDir: filters.sortDir };
}

/** GET /subscribers/export — CSV of matching users (Free, Pro, Plus, Lite, Enterprise, or the active filters). */
exports.exportSubscribers = async (req, res, pools) => {
    const filters = parseSubscriberQuery(req.query);
    if (!filters.plan && filters.status === 'free') filters.plan = 'free';
    const { planId, topupPlanId, addonPlanId, day, month, search, status, plan, from, to, view } = filters;
    const filtered = Boolean(search || plan || planId || topupPlanId || addonPlanId || month || day || status || from || to
        || filters.ownerType || filters.ownerId || filters.code || filters.userStatus);
    const logSummary = { plan, planId, topupPlanId, addonPlanId, month, day, from, to, view, search: search || null, status, filtered,
        ownerType: filters.ownerType, ownerId: filters.ownerId, code: filters.code, userStatus: filters.userStatus };

    try {
        const [billingIds, constraintIds] = await Promise.all([
            billingFilterIds(pools.paymentPool, plan),
            constraintUserIds(pools.paymentPool, filters),
        ]);
        const extra = { ...billingIds, constraintIds };
        const lines = [];
        if (view === 'transactions') {
            const data = await listTransactionsView(pools, filters, extra, EXPORT_LIMIT, null);
            data.rows.forEach((r) => lines.push(up.csvLine(r, r.payment, r.plan_name)));
        } else if (!(constraintIds && constraintIds.length === 0)) {
            if (filters.sortBy === 'purchase_date' || filters.sortBy === 'total_amount') {
                extra.orderedIds = await up.queryUserIdsOrderedByPayment(pools.paymentPool, filters.sortBy, filters.sortDir);
            }
            const { rows } = await up.queryUsersPage(pools.authPool, filters, extra, tierSql, EXPORT_LIMIT, null);
            const enriched = await attachBilling(rows, pools.paymentPool);
            enriched.forEach((r) => lines.push(up.csvLine(r, r.latest_payment, r.plan_name)));
        }
        const csv = up.toCsv(lines);
        const stamp = new Date().toISOString().slice(0, 10);
        const range = from || to ? `-${from || 'start'}_to_${to || stamp}` : '';
        const filename = `users-plans-${view === 'transactions' ? 'transactions-' : ''}${plan || (filtered ? 'filtered' : 'all')}${range}-${stamp}.csv`;
        logPortalFlow(req, 'Plan analytics subscribers CSV exported', { layer: 'PLAN_ANALYTICS', summary: { ...logSummary, rowCount: lines.length } });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch (e) {
        logger.errorWithContext('Plan analytics subscribers CSV export failed', e, { requestId: req.requestId, layer: 'PLAN_ANALYTICS', summary: logSummary });
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /subscribers/:userId — profile, attribution, firm, subscription history, every payment with GST, refunds, packs. */
exports.getSubscriberDetail = async (req, res, pools) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    try {
        const attrs = await up.queryUserAttributes(pools.authPool, [userId]);
        const raw = attrs.get(userId);
        const user = up.serializeUserAttributes(raw);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const [firm, history] = await Promise.all([
            up.queryUserFirm(pools.authPool, userId),
            up.queryUserPaymentHistory(pools.paymentPool, userId),
        ]);
        const payments = history.payments.map(up.serializePayment);
        const paid = payments.filter((p) => p.is_paid);
        const data = {
            user: {
                ...user,
                phone: raw.phone || null,
                location: raw.location || null,
                plan_name: raw.active_plan_name || 'Free',
                plan_key: canonicalPlanKey(raw.active_plan_name || 'Free'),
            },
            firm: firm ? {
                id: firm.id, name: firm.firm_name, type: firm.firm_type, approval_status: firm.approval_status,
                city: firm.city, state: firm.state, gst_number: firm.gst_number || null, pan_number: firm.pan_number || null, member_role: firm.member_role,
            } : null,
            current_subscription: history.subscriptions.length ? up.serializeSubscription(history.subscriptions[0]) : null,
            subscriptions: history.subscriptions.map(up.serializeSubscription),
            payments,
            latest_payment: paid[0] || null,
            refunds: history.refunds.map(up.serializeRefund),
            topups: history.topups.map((r) => up.serializePack(r, 'topup')),
            addons: history.addons.map((r) => up.serializePack(r, 'addon')),
            totals: {
                paid_plan_payments: paid.length,
                plan_paid_total: paiseToRupeeString(paid.reduce((acc, p) => acc + (p.paise.total || 0), 0)),
                refunded_total: paiseToRupeeString(paid.reduce((acc, p) => acc + (p.paise.refunded || 0), 0)),
            },
        };
        logPortalFlow(req, 'Users & Plans user detail loaded', { layer: 'PLAN_ANALYTICS', summary: { userId, payments: payments.length, refunds: data.refunds.length } });
        return res.status(200).json({ success: true, data });
    } catch (e) {
        logger.errorWithContext('Users & Plans user detail failed', e, { requestId: req.requestId, layer: 'PLAN_ANALYTICS', summary: { userId } });
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /subscribers/:userId/transactions — complete history: plan payments (any status), top-ups, add-ons, refunds. */
exports.getSubscriberTransactions = async (req, res, pools) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    try {
        const exists = await pools.authPool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
        if (!exists.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
        const history = await up.queryUserPaymentHistory(pools.paymentPool, userId);
        const transactions = [
            ...history.payments.map(up.serializePayment),
            ...history.topups.map((r) => up.serializePack(r, 'topup')),
            ...history.addons.map((r) => up.serializePack(r, 'addon')),
        ].sort((a, b) => new Date(b.purchase_date || 0) - new Date(a.purchase_date || 0));
        logPortalFlow(req, 'Users & Plans transactions loaded', { layer: 'PLAN_ANALYTICS', summary: { userId, count: transactions.length } });
        return res.status(200).json({
            success: true,
            data: { user_id: userId, transactions, refunds: history.refunds.map(up.serializeRefund), total: transactions.length },
        });
    } catch (e) {
        logger.errorWithContext('Users & Plans transactions failed', e, { requestId: req.requestId, layer: 'PLAN_ANALYTICS', summary: { userId } });
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /subscribers/:userId/invoices — plan invoices plus top-up and add-on receipts for one user. */
exports.getSubscriberInvoices = async (req, res, pools) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    try {
        const userRes = await pools.authPool.query(
            `SELECT id, username, email, is_blocked, active_plan_name, created_at
             FROM users WHERE id = $1`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const planSql = (legacy) => `
            SELECT p.id, p.amount, p.currency, p.status, p.payment_method,
                   p.created_at, p.transaction_date, p.razorpay_payment_id, p.razorpay_order_id,
                   TRIM(COALESCE(mp.name${legacy ? ', sp.name' : ''}, '')) AS plan_name
            FROM payments p
            LEFT JOIN user_subscriptions us ON us.id = p.subscription_id
            LEFT JOIN monthly_plans mp ON mp.id = us.monthly_plan_id
            ${legacy ? 'LEFT JOIN subscription_plans sp ON sp.id = us.plan_id' : ''}
            WHERE p.user_id = $1
            ORDER BY p.created_at DESC NULLS LAST, p.id DESC`;
        let planRows;
        try {
            planRows = await pools.paymentPool.query(planSql(true), [userId]);
        } catch {
            planRows = await pools.paymentPool.query(planSql(false), [userId]);
        }
        const [topupRows, addonRows] = await Promise.all([
            pools.paymentPool.query(
                `SELECT tp.id, tp.amount, tp.currency, tp.status, tp.created_at,
                        tp.razorpay_payment_id, tp.razorpay_order_id, pl.name AS plan_name
                 FROM user_token_topup_purchases tp
                 LEFT JOIN topup_plans pl ON pl.id = tp.topup_plan_id
                 WHERE tp.user_id = $1
                 ORDER BY tp.created_at DESC NULLS LAST, tp.id DESC`,
                [userId]
            ).catch(() => ({ rows: [] })),
            pools.paymentPool.query(
                `SELECT up.id, up.amount, up.currency, up.status, up.created_at,
                        up.razorpay_payment_id, up.razorpay_order_id, ap.name AS plan_name
                 FROM user_storage_addon_purchases up
                 LEFT JOIN addon_plans ap ON ap.id = up.addon_plan_id
                 WHERE up.user_id = $1
                 ORDER BY up.created_at DESC NULLS LAST, up.id DESC`,
                [userId]
            ).catch(() => ({ rows: [] })),
        ]);
        const invoices = [
            ...planRows.rows.map((r) => mapInvoiceRow(r, 'plan')),
            ...topupRows.rows.map((r) => mapInvoiceRow(r, 'topup')),
            ...addonRows.rows.map((r) => mapInvoiceRow(r, 'addon')),
        ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        const active = String(user.active_plan_name || '').trim();
        logPortalFlow(req, 'Plan analytics user invoices loaded', {
            layer: 'PLAN_ANALYTICS',
            summary: { userId, invoiceCount: invoices.length },
        });
        return res.status(200).json({
            success: true,
            data: {
                user: {
                    user_id: user.id,
                    username: user.username || null,
                    email: user.email || null,
                    is_blocked: Boolean(user.is_blocked),
                    plan_name: active || 'Free',
                    plan_key: canonicalPlanKey(active || 'Free'),
                },
                invoices,
            },
        });
    } catch (e) {
        logger.errorWithContext('Plan analytics user invoices failed', e, {
            requestId: req.requestId,
            layer: 'PLAN_ANALYTICS',
            summary: { userId },
        });
        return res.status(500).json({ success: false, message: e.message });
    }
};

exports.getTopupBuyers = async (req, res, pools) => {
    const planId = parseInt(req.params.planId, 10);
    if (!Number.isFinite(planId)) return res.status(400).json({ success: false, message: 'Invalid plan id' });
    try {
        const { rows } = await pools.paymentPool.query(
            `SELECT up.user_id, up.amount, up.currency, up.tokens_credited, up.status, up.created_at, up.expires_at
             FROM user_token_topup_purchases up
             WHERE up.topup_plan_id = $1
             ORDER BY up.created_at DESC NULLS LAST
             LIMIT 500`,
            [planId]
        );
        const data = await attachUsers(rows, pools.authPool);
        logPortalFlow(req, 'Plan analytics topup buyers loaded', {
            layer: 'PLAN_ANALYTICS',
            summary: { planId, rowCount: data.length },
        });
        return res.status(200).json({ success: true, data });
    } catch (e) {
        logger.errorWithContext('Plan analytics topup buyers failed', e, {
            requestId: req.requestId,
            layer: 'PLAN_ANALYTICS',
            summary: { planId },
        });
        return res.status(500).json({ success: false, message: e.message });
    }
};


const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function billingDocHtml(doc, { user, pay }) {
    const isInvoice = doc === 'invoice';
    const date = pay.purchase_date || pay.created_at;
    const dateStr = date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
    const cur = pay.currency && pay.currency !== 'INR' ? `${escHtml(pay.currency)} ` : '₹';
    const money = (v) => (v == null ? '—' : `${cur}${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    const rows = [
        isInvoice ? ['Invoice number', escHtml(pay.invoice_number)] : ['Receipt reference', escHtml(pay.razorpay_receipt || `Payment ${pay.razorpay_payment_id || pay.payment_id}`)],
        ['Date', dateStr],
        ['Billed to', `${escHtml(user.username || `User #${user.id}`)}${user.email ? `<br><span class="muted">${escHtml(user.email)}</span>` : ''}`],
        ['Razorpay Payment ID', escHtml(pay.razorpay_payment_id || '—')],
        ['Razorpay Order ID', escHtml(pay.razorpay_order_id || '—')],
        ...(pay.razorpay_invoice_number ? [['Razorpay invoice', escHtml(pay.razorpay_invoice_number)]] : []),
        ['Payment method', escHtml(pay.payment_method || 'Razorpay')],
        ['Status', escHtml(pay.status || '—')],
        ...(pay.paise.refunded > 0 ? [['Refunded', money(pay.amount_refunded)]] : []),
    ];
    const taxLines = pay.tax ? [
        ['Taxable value', money(pay.basic_amount)],
        ...(pay.tax.type === 'IGST' ? [[`IGST @ ${escHtml(pay.tax.igst_rate || '')}%`, money(pay.igst_amount)]] : [
            [`CGST @ ${escHtml(pay.tax.cgst_rate || '')}%`, money(pay.cgst_amount)],
            [`SGST @ ${escHtml(pay.tax.sgst_rate || '')}%`, money(pay.sgst_amount)],
        ]),
    ] : [];
    return `<!doctype html><html><head><meta charset="utf-8"><style>
        body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;margin:48px;font-size:13px}
        h1{font-size:26px;margin:0 0 4px;color:#1d4ed8}.muted{color:#64748b;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
        th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b}.r{text-align:right}.total td{font-weight:bold;font-size:15px;border-bottom:2px solid #1e293b}
        .meta td:first-child{width:180px;color:#64748b}.sub td{color:#475569}
    </style></head><body>
        <h1>${isInvoice ? 'Tax Invoice' : 'Payment Receipt'}</h1>
        <div class="muted">${isInvoice ? 'Subscription invoice' : 'Payment received — thank you'}${pay.tax?.basis === 'inclusive' ? ' · prices inclusive of GST' : ''}</div>
        <table class="meta">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
        <table><tr><th>Description</th><th class="r">Amount</th></tr>
            <tr><td>${escHtml(pay.plan_name || 'Plan')} subscription</td><td class="r">${money(pay.tax ? pay.basic_amount : pay.total_amount)}</td></tr>
            ${taxLines.map(([k, v]) => `<tr class="sub"><td>${k}</td><td class="r">${v}</td></tr>`).join('')}
            <tr class="total"><td>${isInvoice ? 'Total' : 'Amount paid'}</td><td class="r">${money(pay.total_amount)}</td></tr></table>
        <p class="muted" style="margin-top:32px">This is a computer-generated document and does not require a signature.</p>
    </body></html>`;
}

/** GET /subscribers/:userId/payments/:paymentId/:doc — download a plan payment's invoice or receipt as PDF. */
exports.downloadSubscriberDocument = async (req, res, pools) => {
    const userId = parseInt(req.params.userId, 10);
    const paymentId = parseInt(req.params.paymentId, 10);
    const doc = req.params.doc;
    if (!Number.isFinite(userId) || !Number.isFinite(paymentId) || !['invoice', 'receipt'].includes(doc)) {
        return res.status(400).json({ success: false, message: 'Invalid request' });
    }
    let browser = null;
    try {
        const userRes = await pools.authPool.query('SELECT id, username, email FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const row = await up.queryPaymentForUser(pools.paymentPool, userId, paymentId);
        const pay = row ? up.serializePayment(row) : null;
        if (!pay || !pay.is_paid) return res.status(404).json({ success: false, message: 'Paid payment not found for this user' });
        if (doc === 'invoice' && !pay.invoice_number) {
            // Never fabricate an invoice number: only app_invoices rows are printable as invoices.
            return res.status(404).json({ success: false, code: 'NO_INVOICE', message: 'No application invoice exists for this payment. Download the payment receipt instead.' });
        }

        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(billingDocHtml(doc, { user, pay }), { waitUntil: 'load' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });

        logPortalFlow(req, 'Plan analytics billing document downloaded', { layer: 'PLAN_ANALYTICS', summary: { userId, paymentId, doc } });
        const safe = (v) => String(v).replace(/[^A-Za-z0-9._-]+/g, '_');
        const filename = doc === 'invoice' ? `invoice-${safe(pay.invoice_number)}.pdf` : `receipt-${safe(pay.razorpay_payment_id || pay.payment_id)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(Buffer.from(pdf));
    } catch (e) {
        logger.errorWithContext('Plan analytics billing document failed', e, { requestId: req.requestId, layer: 'PLAN_ANALYTICS', summary: { userId, paymentId, doc } });
        return res.status(500).json({ success: false, message: e.message });
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
};

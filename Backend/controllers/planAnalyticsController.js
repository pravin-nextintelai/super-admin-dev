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

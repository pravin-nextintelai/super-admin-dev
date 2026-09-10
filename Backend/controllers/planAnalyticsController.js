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
    return Math.min(n, 50);
};
const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXPORT_LIMIT = 10000;

function parseSubscriberQuery(query) {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const planIdRaw = parseInt(query.planId, 10);
    const topupPlanIdRaw = parseInt(query.topupPlanId, 10);
    const addonPlanIdRaw = parseInt(query.addonPlanId, 10);
    const day = DAY_RE.test(String(query.day || '').trim()) ? String(query.day).trim() : null;
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
    };
}

function buildSubscriberWhere(filters) {
    const where = [];
    const params = [];
    const add = (clause, value) => {
        params.push(value);
        where.push(clause.replace('$?', `$${params.length}`));
    };
    where.push('us.monthly_plan_id IS NOT NULL');
    if (filters.planId != null) add('us.monthly_plan_id = $?', filters.planId);
    if (filters.topupPlanId != null) {
        add(
            `EXISTS (
                SELECT 1 FROM user_token_topup_purchases up
                WHERE up.user_id = us.user_id AND up.topup_plan_id = $?
            )`,
            filters.topupPlanId
        );
    }
    if (filters.addonPlanId != null) {
        add(
            `EXISTS (
                SELECT 1 FROM user_storage_addon_purchases ap
                WHERE ap.user_id = us.user_id AND ap.addon_plan_id = $?
            )`,
            filters.addonPlanId
        );
    }
    if (filters.status) add('LOWER(COALESCE(us.status, \'\')) = $?', filters.status);
    if (filters.searchIds) add('us.user_id = ANY($?::int[])', filters.searchIds);
    const joinedIst = `(COALESCE(us.created_at, us.start_date) AT TIME ZONE 'Asia/Kolkata')`;
    if (filters.day) add(`${joinedIst}::date = $?::date`, filters.day);
    else if (filters.month) add(`to_char(${joinedIst}, 'YYYY-MM') = $?`, filters.month);
    return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

async function resolveSearchIds(authPool, search, limit = 500) {
    if (!search) return { searchIds: null, empty: false };
    const { rows } = await authPool.query(
        `SELECT id FROM users
         WHERE username ILIKE $1 OR email ILIKE $1
         LIMIT $2`,
        [`%${search}%`, limit]
    );
    const searchIds = rows.map((r) => r.id);
    return { searchIds, empty: searchIds.length === 0 };
}

const PAID_STATUSES = `'captured','paid','success','succeeded','completed'`;

const SUBSCRIBER_SELECT = `SELECT us.user_id,
                    us.status,
                    us.start_date,
                    us.end_date,
                    us.created_at,
                    COALESCE(us.created_at, us.start_date) AS joined_at,
                    COALESCE(us.current_token_balance, 0)::bigint AS current_token_balance,
                    COALESCE(us.topup_token_balance, 0)::bigint AS topup_token_balance,
                    mp.id AS plan_id,
                    mp.name AS plan_name,
                    mp.category AS plan_category,
                    mp.price AS plan_price,
                    mp.currency AS plan_currency,
                    (SELECT string_agg(DISTINCT tp.name, ', ' ORDER BY tp.name)
                     FROM user_token_topup_purchases up
                     JOIN topup_plans tp ON tp.id = up.topup_plan_id
                     WHERE up.user_id = us.user_id) AS topup_plan_names,
                    (SELECT string_agg(DISTINCT ap.name, ', ' ORDER BY ap.name)
                     FROM user_storage_addon_purchases ua
                     JOIN addon_plans ap ON ap.id = ua.addon_plan_id
                     WHERE ua.user_id = us.user_id) AS addon_plan_names,
                    (
                      COALESCE((
                        SELECT SUM(p.amount) FILTER (WHERE LOWER(COALESCE(p.status, '')) IN (${PAID_STATUSES}))
                        FROM payments p WHERE p.user_id = us.user_id
                      ), 0)
                      + COALESCE((
                        SELECT SUM(up.amount) FILTER (WHERE LOWER(COALESCE(up.status, '')) IN (${PAID_STATUSES}))
                        FROM user_token_topup_purchases up WHERE up.user_id = us.user_id
                      ), 0)
                      + COALESCE((
                        SELECT SUM(ua.amount) FILTER (WHERE LOWER(COALESCE(ua.status, '')) IN (${PAID_STATUSES}))
                        FROM user_storage_addon_purchases ua WHERE ua.user_id = us.user_id
                      ), 0)
                    )::numeric AS paid_total,
                    GREATEST(
                      (SELECT MAX(p.created_at) FROM payments p
                       WHERE p.user_id = us.user_id AND LOWER(COALESCE(p.status, '')) IN (${PAID_STATUSES})),
                      (SELECT MAX(up.created_at) FROM user_token_topup_purchases up
                       WHERE up.user_id = us.user_id AND LOWER(COALESCE(up.status, '')) IN (${PAID_STATUSES})),
                      (SELECT MAX(ua.created_at) FROM user_storage_addon_purchases ua
                       WHERE ua.user_id = us.user_id AND LOWER(COALESCE(ua.status, '')) IN (${PAID_STATUSES}))
                    ) AS last_paid_at
             FROM user_subscriptions us
             JOIN monthly_plans mp ON mp.id = us.monthly_plan_id`;

function csvCell(value) {
    if (value == null || value === '') return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function toIsoDate(value) {
    if (!value) return '';
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
}

function subscribersToCsv(rows) {
    const header = [
        'User ID', 'Username', 'Email', 'Blocked', 'Plan', 'Plan category',
        'Status', 'Joined at', 'Top-up packs', 'Add-ons', 'Paid total', 'Last paid at',
        'Plan balance', 'Top-up balance',
    ];
    const lines = [header.map(csvCell).join(',')];
    rows.forEach((r) => {
        lines.push([
            r.user_id,
            r.username,
            r.email,
            r.is_blocked ? 'yes' : 'no',
            r.plan_name,
            r.plan_category,
            r.status,
            toIsoDate(r.joined_at || r.created_at || r.start_date),
            r.topup_plan_names,
            r.addon_plan_names,
            r.paid_total,
            toIsoDate(r.last_paid_at),
            r.current_token_balance,
            r.topup_token_balance,
        ].map(csvCell).join(','));
    });
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}

async function loadSubscriberFacets(paymentPool) {
    const [plans, topupPlans, addonRes, statusRes] = await Promise.all([
        paymentPool.query(`SELECT id, name FROM monthly_plans ORDER BY sort_order ASC, id ASC`),
        paymentPool.query(`SELECT id, name FROM topup_plans ORDER BY sort_order ASC, id ASC`),
        paymentPool.query(`SELECT id, name FROM addon_plans ORDER BY sort_order ASC, id ASC`).catch(() => ({ rows: [] })),
        paymentPool.query(
            `SELECT DISTINCT LOWER(COALESCE(status, 'active')) AS status
             FROM user_subscriptions
             WHERE COALESCE(status, '') <> ''
             ORDER BY 1`
        ).catch(() => ({ rows: [{ status: 'active' }, { status: 'topup_only' }] })),
    ]);
    const known = ['active', 'topup_only', 'cancelled', 'expired', 'inactive'];
    const fromDb = statusRes.rows.map((r) => r.status).filter(Boolean);
    const statuses = [...new Set([...known, ...fromDb])];
    return { plans: plans.rows, topupPlans: topupPlans.rows, addonPlans: addonRes.rows, statuses };
}

/**
 * GET /subscribers — paginated list of monthly-plan subscribers (all plans).
 * Query: page, pageSize, planId, topupPlanId, addonPlanId, month (YYYY-MM), day (YYYY-MM-DD), search, status.
 * Day overrides month. Search matches Auth DB username/email then filters Payment rows.
 * topupPlanId / addonPlanId keep monthly subscribers who bought that pack.
 */
exports.getSubscribers = async (req, res, pools) => {
    const filters = parseSubscriberQuery(req.query);
    const { page, pageSize, planId, topupPlanId, addonPlanId, day, month, search, status } = filters;
    const offset = (page - 1) * pageSize;

    try {
        const found = await resolveSearchIds(pools.authPool, search);
        if (found.empty) {
            const facets = await loadSubscriberFacets(pools.paymentPool);
            logPortalFlow(req, 'Plan analytics subscribers list loaded', {
                layer: 'PLAN_ANALYTICS',
                summary: { page, pageSize, planId, topupPlanId, addonPlanId, month, day, search, status, total: 0, rowCount: 0 },
            });
            return res.status(200).json({
                success: true,
                data: { rows: [], total: 0, page, pageSize, filters: facets },
            });
        }

        const { whereSql, params } = buildSubscriberWhere({ ...filters, searchIds: found.searchIds });
        const countRes = await pools.paymentPool.query(
            `SELECT COUNT(*)::int AS total FROM user_subscriptions us ${whereSql}`,
            params
        );
        const total = countRes.rows[0]?.total || 0;
        const listParams = [...params, pageSize, offset];
        const { rows } = await pools.paymentPool.query(
            `${SUBSCRIBER_SELECT}
             ${whereSql}
             ORDER BY COALESCE(us.created_at, us.start_date) DESC NULLS LAST, us.user_id DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        );

        const enriched = await attachUsers(rows, pools.authPool);
        const facets = await loadSubscriberFacets(pools.paymentPool);
        logPortalFlow(req, 'Plan analytics subscribers list loaded', {
            layer: 'PLAN_ANALYTICS',
            summary: {
                page, pageSize, planId, topupPlanId, addonPlanId, month, day,
                search: search || null, status, total, rowCount: enriched.length,
            },
            table: enriched.slice(0, 8).map((r) => ({
                user_id: r.user_id, email: r.email, plan_name: r.plan_name, status: r.status,
            })),
        });
        return res.status(200).json({
            success: true,
            data: { rows: enriched, total, page, pageSize, filters: facets },
        });
    } catch (e) {
        logger.errorWithContext('Plan analytics subscribers list failed', e, {
            requestId: req.requestId,
            layer: 'PLAN_ANALYTICS',
            summary: { page, pageSize, planId, topupPlanId, addonPlanId, month, day, search: search || null, status },
        });
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /subscribers/export — CSV of all matching rows (same filters as the list, no page cap besides EXPORT_LIMIT). */
exports.exportSubscribers = async (req, res, pools) => {
    const filters = parseSubscriberQuery(req.query);
    const { planId, topupPlanId, addonPlanId, day, month, search, status } = filters;
    const filtered = Boolean(search || planId || topupPlanId || addonPlanId || month || day || status);

    try {
        const found = await resolveSearchIds(pools.authPool, search, 5000);
        if (found.empty) {
            const csv = subscribersToCsv([]);
            logPortalFlow(req, 'Plan analytics subscribers CSV exported', {
                layer: 'PLAN_ANALYTICS',
                summary: { planId, topupPlanId, addonPlanId, month, day, search, status, filtered, rowCount: 0 },
            });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="users-plans-${filtered ? 'filtered-' : ''}${new Date().toISOString().slice(0, 10)}.csv"`);
            return res.status(200).send(csv);
        }

        const { whereSql, params } = buildSubscriberWhere({ ...filters, searchIds: found.searchIds });
        const { rows } = await pools.paymentPool.query(
            `${SUBSCRIBER_SELECT}
             ${whereSql}
             ORDER BY COALESCE(us.created_at, us.start_date) DESC NULLS LAST, us.user_id DESC
             LIMIT ${EXPORT_LIMIT}`,
            params
        );
        const enriched = await attachUsers(rows, pools.authPool);
        const csv = subscribersToCsv(enriched);
        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `users-plans-${filtered ? 'filtered-' : ''}${stamp}.csv`;
        logPortalFlow(req, 'Plan analytics subscribers CSV exported', {
            layer: 'PLAN_ANALYTICS',
            summary: {
                planId, topupPlanId, addonPlanId, month, day,
                search: search || null, status, filtered, rowCount: enriched.length,
            },
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch (e) {
        logger.errorWithContext('Plan analytics subscribers CSV export failed', e, {
            requestId: req.requestId,
            layer: 'PLAN_ANALYTICS',
            summary: { planId, topupPlanId, addonPlanId, month, day, search: search || null, status, filtered },
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


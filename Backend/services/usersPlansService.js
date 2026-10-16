/**
 * Finance Admin → Users & Plans.
 *
 * Read-only queries that back GET /api/admin/users-plans (alias of /api/admin/plan-analytics/subscribers).
 *
 * Auth DB (authPool):    users, firms, firm_users, user_referrals, tenant_referrals, referral_codes, sales_owners
 * Payment DB (payPool):  payments (+ GST breakdown in paise), app_invoices, payment_refunds, user_subscriptions,
 *                        monthly_plans, subscription_plans, user_token_topup_purchases, topup_plans,
 *                        user_storage_addon_purchases, addon_plans
 *
 * Attribution (sales owner / referral code) is resolved the same way as the Sales Referrals module:
 * the user's workspace tenant_referrals row wins, else the user's own user_referrals row.
 * Owner type: sales_owners.internal → INTERNAL / OUTSOURCED; no referral → DIRECT.
 *
 * Money: every amount leaves this module as an exact 2dp string built from integer paise (utils/money).
 * Dates: purchase-date filters are IST calendar days; `to` is inclusive in the API and converted to an
 * exclusive boundary (`< start of next IST day`) in SQL.
 */
const { istDayStart, istDayEndExclusive } = require('../utils/time');
const { paiseToRupeeString, toPaiseInt } = require('../utils/money');

const PAID_STATUSES = ['captured', 'paid', 'success', 'succeeded', 'completed'];
const PAID_IN = PAID_STATUSES.map((s) => `'${s}'`).join(',');
const OWNER_TYPES = ['INTERNAL', 'OUTSOURCED', 'DIRECT'];
const USER_STATUSES = ['new', 'active', 'inactive', 'blocked', 'pending'];
const SORT_FIELDS = ['joined', 'username', 'email', 'plan', 'user_status', 'purchase_date', 'total_amount', 'sales_owner'];
const TX_SORT_FIELDS = ['purchase_date', 'total_amount', 'status'];

/** Derived user status. Order matters: blocked > pending approval > inactive > new (never logged in) > active. */
const USER_STATUS_SQL = `
  CASE
    WHEN COALESCE(u.is_blocked, false) THEN 'blocked'
    WHEN COALESCE(UPPER(u.approval_status), 'APPROVED') <> 'APPROVED' THEN 'pending'
    WHEN COALESCE(u.is_active, true) = false THEN 'inactive'
    WHEN u.last_login_at IS NULL THEN 'new'
    ELSE 'active'
  END`;

/** Joins that resolve each user's referral code + sales owner. Requires `users u` in FROM. */
const ATTRIBUTION_JOINS = `
  LEFT JOIN LATERAL (
    SELECT tr.code_id, tr.source, tr.signed_up_at
    FROM tenant_referrals tr
    WHERE tr.tenant_id IN (
      SELECT fu.firm_id FROM firm_users fu WHERE fu.user_id = u.id
      UNION
      SELECT f.id FROM firms f WHERE f.admin_user_id = u.id
    )
    ORDER BY tr.signed_up_at DESC NULLS LAST
    LIMIT 1
  ) tr ON true
  LEFT JOIN user_referrals ur ON ur.user_id = u.id
  LEFT JOIN referral_codes rc ON rc.id = COALESCE(tr.code_id, ur.code_id)
  LEFT JOIN sales_owners so ON so.id = rc.owner_id`;

const OWNER_TYPE_SQL = `CASE WHEN rc.id IS NULL THEN 'DIRECT' WHEN so.internal THEN 'INTERNAL' ELSE 'OUTSOURCED' END`;

const USER_COLUMNS = `
  u.id, u.username, u.email, u.is_blocked, u.is_active, u.approval_status, u.account_type,
  u.active_plan_name, u.active_plan_id, u.created_at, u.last_login_at, u.phone, u.location,
  ${USER_STATUS_SQL} AS user_status,
  rc.id AS referral_code_id, rc.code AS referral_code, rc.label AS referral_label, rc.active AS referral_code_active,
  CASE WHEN tr.code_id IS NOT NULL THEN 'workspace' WHEN ur.code_id IS NOT NULL THEN 'user' END AS referral_level,
  COALESCE(tr.source, ur.source) AS referral_source,
  so.id AS owner_id, so.name AS owner_name, so.internal AS owner_internal,
  ${OWNER_TYPE_SQL} AS owner_type`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeLike(s) {
    return String(s).replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Normalise the extra Users & Plans query params (the base ones are parsed by planAnalyticsController). */
function parseExtendedQuery(query = {}) {
    const ownerTypeRaw = String(query.ownerType || '').trim().toUpperCase();
    const ownerIdRaw = String(query.ownerId || '').trim();
    const userStatusRaw = String(query.userStatus || '').trim().toLowerCase();
    const sortByRaw = String(query.sortBy || '').trim().toLowerCase();
    const sortDirRaw = String(query.sortDir || '').trim().toLowerCase();
    const viewRaw = String(query.view || '').trim().toLowerCase();
    const directRaw = String(query.includeDirect ?? '').trim().toLowerCase();
    return {
        ownerType: OWNER_TYPES.includes(ownerTypeRaw) ? ownerTypeRaw : null,
        // Default true. includeDirect=0|false|no|off → referred users only (rows with a referral code).
        includeDirect: !['0', 'false', 'no', 'off'].includes(directRaw),
        ownerId: UUID_RE.test(ownerIdRaw) ? ownerIdRaw : null,
        code: String(query.code || query.referralCode || '').trim().slice(0, 64) || null,
        userStatus: USER_STATUSES.includes(userStatusRaw) ? userStatusRaw : null,
        sortBy: SORT_FIELDS.includes(sortByRaw) ? sortByRaw : 'joined',
        sortDir: sortDirRaw === 'asc' ? 'asc' : 'desc',
        view: viewRaw === 'transactions' ? 'transactions' : 'users',
    };
}

/** Inclusive IST day range → UTC boundaries for `ts >= start AND ts < end`. */
function purchaseRange(from, to) {
    return {
        start: from ? istDayStart(from) : null,
        end: to ? istDayEndExclusive(to) : null,
    };
}

// ── Auth DB: users ───────────────────────────────────────────────────────────

/**
 * WHERE clause for the users list. `filters` = parseSubscriberQuery() + parseExtendedQuery();
 * `extra` = { tierBillingIds, nonFreeBillingIds, constraintIds } from planAnalyticsController.
 */
function buildUsersWhere(filters, extra, tierSql) {
    const where = [];
    const params = [];
    const push = (v) => { params.push(v); return `$${params.length}`; };
    const planExpr = `LOWER(TRIM(COALESCE(u.active_plan_name, '')))`;

    if (filters.search) {
        const like = push(`%${escapeLike(filters.search)}%`);
        const exact = push(filters.search);
        where.push(`(u.username ILIKE ${like} ESCAPE '\\' OR u.email ILIKE ${like} ESCAPE '\\' OR u.id::text = ${exact})`);
    }
    if (filters.plan === 'free') {
        where.push(tierSql(planExpr, 'free'));
        if (extra.nonFreeBillingIds?.length) where.push(`NOT (u.id = ANY(${push(extra.nonFreeBillingIds)}::int[]))`);
    } else if (filters.plan) {
        const parts = [tierSql(planExpr, filters.plan)];
        if (extra.tierBillingIds?.length) {
            parts.push(`(TRIM(COALESCE(u.active_plan_name, '')) = '' AND u.id = ANY(${push(extra.tierBillingIds)}::int[]))`);
        }
        where.push(`(${parts.join(' OR ')})`);
    }
    if (extra.constraintIds) where.push(`u.id = ANY(${push(extra.constraintIds)}::int[])`);

    const joined = `(u.created_at AT TIME ZONE 'Asia/Kolkata')`;
    if (filters.day) where.push(`${joined}::date = ${push(filters.day)}::date`);
    else if (filters.month) where.push(`to_char(${joined}, 'YYYY-MM') = ${push(filters.month)}`);

    if (filters.ownerType === 'DIRECT') where.push('rc.id IS NULL');
    else if (filters.ownerType === 'INTERNAL') where.push('rc.id IS NOT NULL AND so.internal = true');
    else if (filters.ownerType === 'OUTSOURCED') where.push('rc.id IS NOT NULL AND so.internal = false');
    else if (filters.includeDirect === false) where.push('rc.id IS NOT NULL');
    if (filters.ownerId) where.push(`so.id = ${push(filters.ownerId)}::uuid`);
    if (filters.code) where.push(`rc.code ILIKE ${push(`%${escapeLike(filters.code)}%`)} ESCAPE '\\'`);
    if (filters.userStatus) where.push(`${USER_STATUS_SQL} = ${push(filters.userStatus)}`);

    return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function usersOrderSql(filters, extra, params) {
    const dir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
    const nulls = dir === 'ASC' ? 'NULLS FIRST' : 'NULLS LAST';
    switch (filters.sortBy) {
        case 'username': return `LOWER(COALESCE(u.username, '')) ${dir}, u.id ${dir}`;
        case 'email': return `LOWER(COALESCE(u.email, '')) ${dir}, u.id ${dir}`;
        case 'plan': return `LOWER(TRIM(COALESCE(u.active_plan_name, ''))) ${dir}, u.id ${dir}`;
        case 'user_status': return `${USER_STATUS_SQL} ${dir}, u.id ${dir}`;
        case 'sales_owner': return `LOWER(COALESCE(so.name, '')) ${dir} ${nulls}, u.id ${dir}`;
        case 'purchase_date':
        case 'total_amount': {
            // Payment-DB order resolved beforehand into extra.orderedIds (users without payments go last).
            params.push(extra.orderedIds || []);
            return `array_position($${params.length}::int[], u.id) ASC NULLS LAST, u.created_at DESC NULLS LAST, u.id DESC`;
        }
        case 'joined':
        default: return `u.created_at ${dir} ${nulls}, u.id ${dir}`;
    }
}

/** Paginated users with attribution + derived status. Returns { total, rows }. */
async function queryUsersPage(authPool, filters, extra, tierSql, limit, offset) {
    const { whereSql, params } = buildUsersWhere(filters, extra, tierSql);
    const countRes = await authPool.query(
        `SELECT COUNT(*)::int AS total FROM users u ${ATTRIBUTION_JOINS} ${whereSql}`,
        params
    );
    const listParams = [...params];
    const orderSql = usersOrderSql(filters, extra, listParams);
    listParams.push(limit);
    let limitSql = `LIMIT $${listParams.length}`;
    if (offset != null) { listParams.push(offset); limitSql += ` OFFSET $${listParams.length}`; }
    const { rows } = await authPool.query(
        `SELECT ${USER_COLUMNS}
         FROM users u
         ${ATTRIBUTION_JOINS}
         ${whereSql}
         ORDER BY ${orderSql}
         ${limitSql}`,
        listParams
    );
    return { total: countRes.rows[0]?.total || 0, rows };
}

/** Ids of users matching the user-level filters only (used by the transactions view). Null = no user filter. */
async function queryMatchingUserIds(authPool, filters, extra, tierSql) {
    const hasUserFilter = Boolean(
        filters.search || filters.plan || filters.day || filters.month || filters.ownerType ||
        filters.ownerId || filters.code || filters.userStatus || extra.constraintIds
    );
    if (!hasUserFilter) return null;
    const { whereSql, params } = buildUsersWhere(filters, extra, tierSql);
    const { rows } = await authPool.query(`SELECT u.id FROM users u ${ATTRIBUTION_JOINS} ${whereSql}`, params);
    return rows.map((r) => Number(r.id));
}

/** Attribute rows for an explicit id list (transactions view / detail). */
async function queryUserAttributes(authPool, ids) {
    if (!ids.length) return new Map();
    const { rows } = await authPool.query(
        `SELECT ${USER_COLUMNS} FROM users u ${ATTRIBUTION_JOINS} WHERE u.id = ANY($1::int[])`,
        [ids]
    );
    return new Map(rows.map((r) => [Number(r.id), r]));
}

async function queryUserFirm(authPool, userId) {
    const { rows } = await authPool.query(
        `SELECT f.id, f.firm_name, f.firm_type, f.approval_status, f.city, f.state, f.gst_number, f.pan_number,
                CASE WHEN f.admin_user_id = $1 THEN 'admin' ELSE fu.role END AS member_role
         FROM firms f
         LEFT JOIN firm_users fu ON fu.firm_id = f.id AND fu.user_id = $1
         WHERE f.admin_user_id = $1 OR fu.user_id = $1
         ORDER BY (f.admin_user_id = $1) DESC
         LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
}

async function listSalesOwners(authPool) {
    const { rows } = await authPool.query(
        `SELECT id, name, internal, CASE WHEN internal THEN 'INTERNAL' ELSE 'OUTSOURCED' END AS type
         FROM sales_owners ORDER BY LOWER(name)`
    );
    return rows;
}

// ── Payment DB: plan payments ────────────────────────────────────────────────

/** Columns of one plan payment with GST, invoice and refund references. Requires `payments p` in FROM. */
const PAYMENT_SELECT = `
  p.id, p.user_id, p.subscription_id, p.status, p.razorpay_status, p.payment_method, p.currency,
  p.amount, p.amount_paise, p.basic_amount_paise, p.cgst_rate, p.cgst_amount_paise, p.sgst_rate, p.sgst_amount_paise,
  p.igst_rate, p.igst_amount_paise, p.total_amount_paise, p.tax_basis, p.tax_type, p.tax_calculated_at,
  p.amount_refunded_paise, p.refund_status,
  p.razorpay_payment_id, p.razorpay_order_id, p.razorpay_receipt, p.razorpay_invoice_id, p.razorpay_invoice_number,
  p.verification_source, p.created_at, p.updated_at, p.transaction_date, p.captured_at,
  COALESCE(p.purchase_date, p.captured_at, p.created_at) AS purchase_date,
  COALESCE(NULLIF(TRIM(p.plan_name), ''), mp_direct.name, sp_direct.name, mp_sub.name, sp_sub.name) AS plan_name,
  COALESCE(p.monthly_plan_id, us.monthly_plan_id) AS monthly_plan_id,
  COALESCE(p.plan_id, us.plan_id) AS legacy_plan_id,
  p.plan_source,
  ai.id AS app_invoice_id, ai.invoice_number AS app_invoice_number, ai.invoice_kind AS app_invoice_kind, ai.issued_at AS app_invoice_issued_at`;

const PAYMENT_JOINS = `
  LEFT JOIN user_subscriptions us ON us.id = p.subscription_id
  LEFT JOIN monthly_plans mp_direct ON mp_direct.id = p.monthly_plan_id
  LEFT JOIN subscription_plans sp_direct ON sp_direct.id = p.plan_id
  LEFT JOIN monthly_plans mp_sub ON mp_sub.id = us.monthly_plan_id
  LEFT JOIN subscription_plans sp_sub ON sp_sub.id = us.plan_id
  LEFT JOIN app_invoices ai ON ai.id = p.app_invoice_id OR (p.app_invoice_id IS NULL AND ai.payment_id = p.id)`;

const PAID_P = `LOWER(COALESCE(p.status, '')) IN (${PAID_IN})`;
const PURCHASE_TS = `COALESCE(p.purchase_date, p.captured_at, p.created_at)`;

/** Latest paid plan payment per user + paid-transaction count. Map<user_id, row>. */
async function queryLatestPlanPayments(payPool, ids) {
    if (!ids.length) return new Map();
    const { rows } = await payPool.query(
        `WITH counts AS (
           SELECT user_id, COUNT(*)::int AS paid_count FROM payments p
           WHERE p.user_id = ANY($1::int[]) AND ${PAID_P}
           GROUP BY user_id
         )
         SELECT latest.*, c.paid_count
         FROM (
           SELECT DISTINCT ON (p.user_id) ${PAYMENT_SELECT}
           FROM payments p ${PAYMENT_JOINS}
           WHERE p.user_id = ANY($1::int[]) AND ${PAID_P}
           ORDER BY p.user_id, ${PURCHASE_TS} DESC NULLS LAST, p.id DESC
         ) latest
         LEFT JOIN counts c ON c.user_id = latest.user_id`,
        [ids]
    );
    return new Map(rows.map((r) => [Number(r.user_id), r]));
}

/** User ids ordered by their latest paid payment (for purchase_date / total_amount sorting of the users view). */
async function queryUserIdsOrderedByPayment(payPool, sortBy, sortDir) {
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
    const field = sortBy === 'total_amount' ? 'COALESCE(latest.total_amount_paise, latest.amount_paise, 0)' : 'latest.purchase_date';
    const { rows } = await payPool.query(
        `SELECT latest.user_id FROM (
           SELECT DISTINCT ON (p.user_id) p.user_id, ${PURCHASE_TS} AS purchase_date, p.total_amount_paise, p.amount_paise
           FROM payments p WHERE ${PAID_P}
           ORDER BY p.user_id, ${PURCHASE_TS} DESC NULLS LAST, p.id DESC
         ) latest
         ORDER BY ${field} ${dir} NULLS LAST, latest.user_id ${dir}`
    );
    return rows.map((r) => Number(r.user_id));
}

/** Users whose latest paid plan payment falls in the IST purchase-date range. */
async function queryUserIdsPurchasedBetween(payPool, from, to) {
    const { start, end } = purchaseRange(from, to);
    const { rows } = await payPool.query(
        `SELECT latest.user_id FROM (
           SELECT DISTINCT ON (p.user_id) p.user_id, ${PURCHASE_TS} AS purchased_at
           FROM payments p WHERE ${PAID_P}
           ORDER BY p.user_id, ${PURCHASE_TS} DESC NULLS LAST, p.id DESC
         ) latest
         WHERE ($1::timestamptz IS NULL OR latest.purchased_at >= $1::timestamptz)
           AND ($2::timestamptz IS NULL OR latest.purchased_at <  $2::timestamptz)`,
        [start, end]
    );
    return rows.map((r) => Number(r.user_id));
}

/**
 * Transactions view: one row per plan payment (any status unless `paidOnly`), newest first.
 * `userIds` null = no user-level filter.
 */
async function queryPaymentsPage(payPool, { userIds, from, to, paidOnly = true, sortBy, sortDir }, limit, offset) {
    const { start, end } = purchaseRange(from, to);
    const params = [userIds, start, end];
    const where = [
        `($1::int[] IS NULL OR p.user_id = ANY($1::int[]))`,
        `($2::timestamptz IS NULL OR ${PURCHASE_TS} >= $2::timestamptz)`,
        `($3::timestamptz IS NULL OR ${PURCHASE_TS} <  $3::timestamptz)`,
    ];
    if (paidOnly) where.push(PAID_P);
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
    const order = sortBy === 'total_amount'
        ? `COALESCE(p.total_amount_paise, p.amount_paise, 0) ${dir}, p.id ${dir}`
        : sortBy === 'status'
            ? `LOWER(COALESCE(p.status, '')) ${dir}, ${PURCHASE_TS} DESC, p.id DESC`
            : `${PURCHASE_TS} ${dir} NULLS LAST, p.id ${dir}`;
    const countRes = await payPool.query(`SELECT COUNT(*)::int AS total FROM payments p ${whereSql}`, params);
    const listParams = [...params, limit];
    let limitSql = `LIMIT $${listParams.length}`;
    if (offset != null) { listParams.push(offset); limitSql += ` OFFSET $${listParams.length}`; }
    const { rows } = await payPool.query(
        `SELECT ${PAYMENT_SELECT} FROM payments p ${PAYMENT_JOINS} ${whereSql} ORDER BY ${order} ${limitSql}`,
        listParams
    );
    return { total: countRes.rows[0]?.total || 0, rows };
}

/** Everything the Payment DB knows about one user. */
async function queryUserPaymentHistory(payPool, userId) {
    const [payments, refunds, subs, topups, addons] = await Promise.all([
        payPool.query(
            `SELECT ${PAYMENT_SELECT} FROM payments p ${PAYMENT_JOINS}
             WHERE p.user_id = $1 ORDER BY ${PURCHASE_TS} DESC NULLS LAST, p.id DESC`,
            [userId]
        ),
        payPool.query(
            `SELECT r.id, r.razorpay_refund_id, r.razorpay_payment_id, r.payment_id, r.amount_paise, r.currency, r.status, r.speed,
                    r.notes, r.razorpay_created_at, r.created_at, r.updated_at
             FROM payment_refunds r
             WHERE r.payment_id IN (SELECT id FROM payments WHERE user_id = $1)
                OR r.razorpay_payment_id IN (SELECT razorpay_payment_id FROM payments WHERE user_id = $1 AND razorpay_payment_id IS NOT NULL)
             ORDER BY r.created_at DESC`,
            [userId]
        ).catch(() => ({ rows: [] })),
        payPool.query(
            `SELECT us.id, us.status, us.start_date, us.end_date, us.created_at, us.activated_at, us.cancelled_at, us.completed_at,
                    us.last_charged_at, us.razorpay_subscription_id, us.razorpay_payment_id, us.current_token_balance,
                    us.topup_token_balance, us.monthly_plan_id, us.plan_id,
                    COALESCE(mp.name, sp.name) AS plan_name, COALESCE(mp.price, sp.price) AS plan_price
             FROM user_subscriptions us
             LEFT JOIN monthly_plans mp ON mp.id = us.monthly_plan_id
             LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
             WHERE us.user_id = $1
             ORDER BY COALESCE(us.created_at, us.start_date) DESC NULLS LAST, us.id DESC`,
            [userId]
        ),
        payPool.query(
            `SELECT tp.id, tp.amount, tp.currency, tp.status, tp.created_at, tp.expires_at, tp.tokens_credited,
                    tp.razorpay_payment_id, tp.razorpay_order_id, pl.name AS plan_name, tp.topup_plan_id
             FROM user_token_topup_purchases tp LEFT JOIN topup_plans pl ON pl.id = tp.topup_plan_id
             WHERE tp.user_id = $1 ORDER BY tp.created_at DESC NULLS LAST, tp.id DESC`,
            [userId]
        ).catch(() => ({ rows: [] })),
        payPool.query(
            `SELECT up.id, up.amount, up.currency, up.status, up.created_at, up.expires_at, up.storage_bytes_granted,
                    up.razorpay_payment_id, up.razorpay_order_id, ap.name AS plan_name, up.addon_plan_id
             FROM user_storage_addon_purchases up LEFT JOIN addon_plans ap ON ap.id = up.addon_plan_id
             WHERE up.user_id = $1 ORDER BY up.created_at DESC NULLS LAST, up.id DESC`,
            [userId]
        ).catch(() => ({ rows: [] })),
    ]);
    return { payments: payments.rows, refunds: refunds.rows, subscriptions: subs.rows, topups: topups.rows, addons: addons.rows };
}

/** One plan payment (any status) that belongs to `userId`, for the PDF endpoints. */
async function queryPaymentForUser(payPool, userId, paymentId) {
    const { rows } = await payPool.query(
        `SELECT ${PAYMENT_SELECT} FROM payments p ${PAYMENT_JOINS} WHERE p.id = $1 AND p.user_id = $2`,
        [paymentId, userId]
    );
    return rows[0] || null;
}

// ── Serialisers ──────────────────────────────────────────────────────────────

const iso = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function isPaidStatus(status) {
    return PAID_STATUSES.includes(String(status || '').toLowerCase());
}

/** Payment → API shape. Amounts are exact 2dp strings; paise kept for consumers that need integers. */
function serializePayment(p) {
    if (!p) return null;
    const amountPaise = toPaiseInt(p.amount_paise);
    const totalPaise = toPaiseInt(p.total_amount_paise) ?? amountPaise;
    const refunded = toPaiseInt(p.amount_refunded_paise) || 0;
    const taxStored = p.basic_amount_paise != null;
    return {
        payment_id: p.id,
        user_id: p.user_id,
        subscription_id: p.subscription_id,
        kind: 'plan',
        plan_name: p.plan_name || null,
        plan_id: p.monthly_plan_id ?? p.legacy_plan_id ?? null,
        plan_source: p.plan_source || (p.monthly_plan_id != null ? 'monthly_plans' : p.legacy_plan_id != null ? 'subscription_plans' : null),
        status: p.status || null,
        razorpay_status: p.razorpay_status || null,
        is_paid: isPaidStatus(p.status),
        payment_method: p.payment_method || null,
        currency: p.currency || 'INR',
        // Money (strings, 2dp, from integer paise)
        basic_amount: taxStored ? paiseToRupeeString(p.basic_amount_paise) : null,
        cgst_amount: taxStored ? paiseToRupeeString(p.cgst_amount_paise) : null,
        sgst_amount: taxStored ? paiseToRupeeString(p.sgst_amount_paise) : null,
        igst_amount: taxStored ? paiseToRupeeString(p.igst_amount_paise) : null,
        total_amount: paiseToRupeeString(totalPaise),
        amount_refunded: paiseToRupeeString(refunded),
        paise: {
            amount: amountPaise,
            basic: toPaiseInt(p.basic_amount_paise),
            cgst: toPaiseInt(p.cgst_amount_paise),
            sgst: toPaiseInt(p.sgst_amount_paise),
            igst: toPaiseInt(p.igst_amount_paise),
            total: totalPaise,
            refunded,
        },
        tax: taxStored ? {
            type: p.tax_type || null,
            basis: p.tax_basis || null,
            cgst_rate: p.cgst_rate != null ? String(p.cgst_rate) : null,
            sgst_rate: p.sgst_rate != null ? String(p.sgst_rate) : null,
            igst_rate: p.igst_rate != null ? String(p.igst_rate) : null,
            calculated_at: iso(p.tax_calculated_at),
        } : null,
        refund_status: p.refund_status || (refunded > 0 ? (totalPaise != null && refunded >= totalPaise ? 'full' : 'partial') : null),
        // References — kept strictly separate (never label a pay_/order_ id as an invoice)
        invoice_number: p.app_invoice_number || null,          // application-generated (app_invoices)
        invoice_kind: p.app_invoice_number ? (p.app_invoice_kind || 'application_generated') : null,
        invoice_issued_at: iso(p.app_invoice_issued_at),
        razorpay_invoice_id: p.razorpay_invoice_id || null,    // Razorpay Invoice resource (inv_…), when one exists
        razorpay_invoice_number: p.razorpay_invoice_number || null,
        razorpay_payment_id: p.razorpay_payment_id || null,    // pay_…
        razorpay_order_id: p.razorpay_order_id || null,        // order_…
        razorpay_receipt: p.razorpay_receipt || null,          // receipt string sent when the order was created
        verification_source: p.verification_source || null,
        purchase_date: iso(p.purchase_date),
        captured_at: iso(p.captured_at),
        created_at: iso(p.created_at),
        updated_at: iso(p.updated_at),
    };
}

function serializeUserAttributes(u) {
    if (!u) return null;
    const tracked = Boolean(u.referral_code_id);
    return {
        user_id: Number(u.id),
        username: u.username || null,
        email: u.email || null,
        is_blocked: Boolean(u.is_blocked),
        is_active: u.is_active !== false,
        approval_status: u.approval_status || null,
        account_type: u.account_type || null,
        user_status: u.user_status,
        joined_at: iso(u.created_at),
        last_login_at: iso(u.last_login_at),
        owner_type: u.owner_type,                 // INTERNAL | OUTSOURCED | DIRECT
        sales_owner: tracked ? { id: u.owner_id, name: u.owner_name, internal: Boolean(u.owner_internal) } : null,
        referral_code: tracked ? u.referral_code : null,
        referral: tracked ? {
            code_id: u.referral_code_id,
            code: u.referral_code,
            label: u.referral_label || null,
            active: u.referral_code_active !== false,
            level: u.referral_level,
            source: u.referral_source || null,
        } : null,
    };
}

function serializeRefund(r) {
    return {
        id: r.id,
        razorpay_refund_id: r.razorpay_refund_id,
        razorpay_payment_id: r.razorpay_payment_id,
        payment_id: r.payment_id,
        amount: paiseToRupeeString(r.amount_paise),
        amount_paise: toPaiseInt(r.amount_paise),
        currency: r.currency || 'INR',
        status: r.status,
        speed: r.speed || null,
        notes: r.notes || null,
        razorpay_created_at: iso(r.razorpay_created_at),
        created_at: iso(r.created_at),
    };
}

function serializePack(row, kind) {
    return {
        kind,
        id: row.id,
        plan_name: row.plan_name || (kind === 'topup' ? 'Top-up' : 'Storage add-on'),
        plan_id: kind === 'topup' ? row.topup_plan_id : row.addon_plan_id,
        amount: row.amount != null ? String(Number(row.amount).toFixed(2)) : null,
        currency: row.currency || 'INR',
        status: row.status || null,
        is_paid: isPaidStatus(row.status),
        razorpay_payment_id: row.razorpay_payment_id || null,
        razorpay_order_id: row.razorpay_order_id || null,
        tokens_credited: row.tokens_credited != null ? Number(row.tokens_credited) : undefined,
        storage_bytes_granted: row.storage_bytes_granted != null ? Number(row.storage_bytes_granted) : undefined,
        purchase_date: iso(row.created_at),
        expires_at: iso(row.expires_at),
    };
}

function serializeSubscription(s) {
    return {
        id: s.id,
        plan_name: s.plan_name || null,
        plan_price: s.plan_price != null ? String(Number(s.plan_price).toFixed(2)) : null,
        monthly_plan_id: s.monthly_plan_id,
        legacy_plan_id: s.plan_id,
        status: s.status || null,
        start_date: iso(s.start_date),
        end_date: iso(s.end_date),
        activated_at: iso(s.activated_at),
        cancelled_at: iso(s.cancelled_at),
        completed_at: iso(s.completed_at),
        last_charged_at: iso(s.last_charged_at),
        created_at: iso(s.created_at),
        razorpay_subscription_id: s.razorpay_subscription_id || null,
        razorpay_payment_id: s.razorpay_payment_id || null,
        current_token_balance: Number(s.current_token_balance || 0),
        topup_token_balance: Number(s.topup_token_balance || 0),
    };
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** RFC-4180 quoting + spreadsheet formula-injection guard (=, +, -, @, tab, CR). */
function csvCell(value) {
    if (value == null || value === '') return '';
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

const CSV_HEADER = [
    'Username', 'Email', 'Sales Owner', 'Owner Type', 'Referral Code', 'User Status', 'Plan',
    'Basic Amount (INR)', 'CGST Amount (INR)', 'SGST Amount (INR)', 'IGST Amount (INR)', 'Total Amount (INR)',
    'Purchase Date (IST)', 'Payment Status', 'Invoice Number', 'Razorpay Payment ID', 'Razorpay Order ID', 'Razorpay Receipt',
];

function istStamp(isoValue) {
    if (!isoValue) return '';
    const d = new Date(isoValue);
    if (Number.isNaN(d.getTime())) return '';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** One CSV line for a (user, payment|null) pair. */
function csvLine(user, payment, fallbackPlan) {
    const p = payment;
    return [
        user.username || `User #${user.user_id}`,
        user.email,
        user.sales_owner?.name || '',
        user.owner_type,
        user.referral_code || '',
        user.user_status,
        p?.plan_name || fallbackPlan || 'Free',
        p ? p.basic_amount ?? '' : '0.00',
        p ? p.cgst_amount ?? '' : '0.00',
        p ? p.sgst_amount ?? '' : '0.00',
        p ? p.igst_amount ?? '' : '0.00',
        p ? p.total_amount ?? '' : '0.00',
        p ? istStamp(p.purchase_date) : '',
        p ? p.status : '',
        p ? p.invoice_number || '' : '',
        p ? p.razorpay_payment_id || '' : '',
        p ? p.razorpay_order_id || '' : '',
        p ? p.razorpay_receipt || '' : '',
    ].map(csvCell).join(',');
}

function toCsv(lines) {
    return `﻿${[CSV_HEADER.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
}

module.exports = {
    PAID_STATUSES,
    OWNER_TYPES,
    USER_STATUSES,
    SORT_FIELDS,
    TX_SORT_FIELDS,
    parseExtendedQuery,
    purchaseRange,
    queryUsersPage,
    queryMatchingUserIds,
    queryUserAttributes,
    queryUserFirm,
    listSalesOwners,
    queryLatestPlanPayments,
    queryUserIdsOrderedByPayment,
    queryUserIdsPurchasedBetween,
    queryPaymentsPage,
    queryUserPaymentHistory,
    queryPaymentForUser,
    serializePayment,
    serializeUserAttributes,
    serializeRefund,
    serializePack,
    serializeSubscription,
    isPaidStatus,
    csvCell,
    csvLine,
    toCsv,
    CSV_HEADER,
    istStamp,
};

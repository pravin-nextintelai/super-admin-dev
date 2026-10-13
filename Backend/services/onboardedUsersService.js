/**
 * Onboarded users + complete subscription history.
 *
 * Two databases, joined in Node (no cross-DB SQL):
 *   Auth DB (pool)         users, firms / firm_users, user_referrals / tenant_referrals,
 *                          referral_codes, sales_owners, *_referral_history
 *   Payment DB (payPool)   user_subscriptions, payments, user_token_topup_purchases,
 *                          user_storage_addon_purchases, monthly_plans, subscription_plans,
 *                          topup_plans, addon_plans
 *
 * Onboarding channel (how the user came in), derived the same way as the Sales Referrals reports:
 *   INTERNAL   referral code owned by a sales owner with internal = true (in-house sales)
 *   OUTSOURCED referral code owned by an external sales owner / agency (internal = false)
 *   SELF       no referral code on the user nor on their workspace (direct signup)
 * The user's own referral (user_referrals) wins; otherwise the workspace's (tenant_referrals).
 *
 * Every timestamp leaves this module twice: raw UTC ISO plus an `*_ist` object (utils/time.js).
 */
const { IST_TIMEZONE, formatIST, istDayStart, istDayEndExclusive, humanizeDuration } = require('../utils/time');

const CHANNELS = ['SELF', 'INTERNAL', 'OUTSOURCED'];
/** `agency` is accepted as a filter alias of OUTSOURCED. */
const CHANNEL_ALIASES = { AGENCY: 'OUTSOURCED', DIRECT: 'SELF', INHOUSE: 'INTERNAL' };
const PLAN_STATUSES = ['PAID', 'LAPSED', 'FREE'];
const SORT_OPTIONS = ['newest', 'oldest', 'email', 'name', 'last_login', 'plan', 'revenue', 'last_payment'];
const MAX_USERS = 5000;

const FREE_PLAN_NAMES = String(process.env.REFERRALS_FREE_PLAN_NAMES || 'Free,Free Trial,Trial')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ── Helpers ──────────────────────────────────────────────────────────────────

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function num(v) {
  return v === null || v === undefined ? null : Number(v);
}
function money(v) {
  return v === null || v === undefined ? 0 : Math.round(Number(v) * 100) / 100;
}
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (m) => `\\${m}`);
}
function ts(value) {
  return { iso: iso(value), ist: formatIST(value) };
}
function normalizeChannel(raw) {
  if (!raw) return null;
  const v = String(raw).trim().toUpperCase();
  return CHANNEL_ALIASES[v] || v;
}
function isFreePlan(name) {
  return !name || FREE_PLAN_NAMES.includes(String(name).trim().toLowerCase());
}

/**
 * PAID   active_plan_name is a paid plan (users.active_plan_name)
 * LAPSED not paid now, but the Payment DB has at least one subscription for the user
 * FREE   everything else
 */
function planStatusOf(user, agg) {
  if (!isFreePlan(user.active_plan_name)) return 'PAID';
  if (agg && Number(agg.subscriptions) > 0) return 'LAPSED';
  return 'FREE';
}

// ── Auth DB: users with workspace + referral ─────────────────────────────────

/** Effective referral per user: own user_referrals row, else the workspace's tenant_referrals row. */
const USER_SELECT = `
  SELECT u.id, u.email, u.username, u.phone, u.location, u.role, u.domain_role, u.account_type, u.auth_type,
         u.approval_status, u.is_active, u.is_blocked, u.first_login,
         u.created_at, u.updated_at, u.last_login_at, u.last_seen_at,
         u.active_plan_id, u.active_plan_name, u.active_plan_updated_at, u.razorpay_customer_id,
         f.id AS firm_id, f.firm_name, f.firm_type, f.approval_status AS firm_approval_status, f.city AS firm_city, f.state AS firm_state,
         f.admin_user_id AS firm_admin_user_id, fu.role AS firm_role,
         pp.organization_name, pp.primary_role, pp.organization_type, pp.primary_jurisdiction, pp.main_areas_of_practice,
         ref.level AS referral_level, ref.code_id, ref.source AS referral_source, ref.signed_up_at AS referral_signed_up_at,
         ref.set_at AS referral_set_at, ref.set_by AS referral_set_by, ref.reason AS referral_reason,
         rc.code AS referral_code, rc.label AS referral_label, rc.active AS referral_code_active,
         so.id AS owner_id, so.name AS owner_name, so.internal AS owner_internal,
         CASE WHEN ref.code_id IS NULL THEN 'SELF' WHEN so.internal THEN 'INTERNAL' ELSE 'OUTSOURCED' END AS channel
  FROM users u
  LEFT JOIN LATERAL (
    SELECT fu.firm_id, fu.role FROM firm_users fu WHERE fu.user_id = u.id ORDER BY fu.created_at ASC LIMIT 1
  ) fu ON true
  LEFT JOIN firms f ON f.id = COALESCE(fu.firm_id, (SELECT f2.id FROM firms f2 WHERE f2.admin_user_id = u.id ORDER BY f2.created_at ASC LIMIT 1))
  LEFT JOIN LATERAL (
    SELECT p.organization_name, p.primary_role, p.organization_type, p.primary_jurisdiction, p.main_areas_of_practice
    FROM user_professional_profiles p WHERE p.user_id = u.id ORDER BY p.updated_at DESC NULLS LAST LIMIT 1
  ) pp ON true
  LEFT JOIN LATERAL (
    SELECT x.level, x.code_id, x.source, x.signed_up_at, x.set_at, x.set_by, x.reason
    FROM (
      SELECT 1 AS prio, 'user' AS level, ur.code_id, ur.source, ur.signed_up_at, ur.set_at, ur.set_by, ur.reason
      FROM user_referrals ur WHERE ur.user_id = u.id
      UNION ALL
      SELECT 2 AS prio, 'workspace' AS level, tr.code_id, tr.source, tr.signed_up_at, tr.set_at, tr.set_by, tr.reason
      FROM tenant_referrals tr WHERE f.id IS NOT NULL AND tr.tenant_id = f.id
    ) x ORDER BY x.prio LIMIT 1
  ) ref ON true
  LEFT JOIN referral_codes rc ON rc.id = ref.code_id
  LEFT JOIN sales_owners so ON so.id = rc.owner_id
`;

/**
 * @param {object} f { channels[], owner_ids[], codes[], sources[], account_types[], approval_statuses[],
 *                     active (bool), search, from, to, plan_names[], firm_id, user_ids[] }
 */
function buildUserFilters(f = {}) {
  const where = [];
  const values = [];
  const p = (v) => {
    values.push(v);
    return `$${values.length}`;
  };
  const anyOf = (col, arr, cast = 'text[]') => {
    if (Array.isArray(arr) && arr.length) where.push(`${col} = ANY(${p(arr)}::${cast})`);
  };

  if (Array.isArray(f.channels) && f.channels.length) {
    const parts = [];
    if (f.channels.includes('SELF')) parts.push('ref.code_id IS NULL');
    if (f.channels.includes('INTERNAL')) parts.push('(ref.code_id IS NOT NULL AND so.internal = true)');
    if (f.channels.includes('OUTSOURCED')) parts.push('(ref.code_id IS NOT NULL AND so.internal = false)');
    where.push(`(${parts.join(' OR ')})`);
  }
  anyOf('so.id', f.owner_ids, 'uuid[]');
  if (Array.isArray(f.codes) && f.codes.length) where.push(`UPPER(rc.code) = ANY(${p(f.codes.map((c) => String(c).toUpperCase()))}::text[])`);
  anyOf('ref.source', f.sources);
  anyOf('u.account_type', f.account_types);
  anyOf('u.approval_status', f.approval_statuses);
  anyOf('u.id', f.user_ids, 'int[]');
  if (f.firm_id) where.push(`f.id = ${p(f.firm_id)}::uuid`);
  if (typeof f.active === 'boolean') where.push(`(COALESCE(u.is_active, true) = ${p(f.active)} AND COALESCE(u.is_blocked, false) = ${p(!f.active)})`);
  if (Array.isArray(f.plan_names) && f.plan_names.length) {
    where.push(`LOWER(COALESCE(u.active_plan_name, '')) = ANY(${p(f.plan_names.map((s) => String(s).toLowerCase()))}::text[])`);
  }
  if (f.search) {
    const like = p(`%${escapeLike(String(f.search).trim())}%`);
    where.push(`(u.email ILIKE ${like} OR COALESCE(u.username, '') ILIKE ${like} OR COALESCE(u.phone, '') ILIKE ${like}
      OR COALESCE(f.firm_name, '') ILIKE ${like} OR COALESCE(rc.code, '') ILIKE ${like} OR COALESCE(so.name, '') ILIKE ${like}
      OR COALESCE(pp.organization_name, '') ILIKE ${like} OR u.id::text = ${p(String(f.search).trim())})`);
  }
  if (f.from) {
    const start = istDayStart(f.from);
    if (start) where.push(`u.created_at >= ${p(start)}`);
  }
  if (f.to) {
    const end = istDayEndExclusive(f.to);
    if (end) where.push(`u.created_at < ${p(end)}`);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

/** All users matching the Auth-DB filters (capped). Status / revenue filters are applied in Node afterwards. */
async function fetchUsers(pool, filters = {}) {
  const { whereSql, values } = buildUserFilters(filters);
  const { rows } = await pool.query(`${USER_SELECT} ${whereSql} ORDER BY u.created_at DESC, u.id DESC LIMIT ${MAX_USERS + 1}`, values);
  const truncated = rows.length > MAX_USERS;
  return { rows: truncated ? rows.slice(0, MAX_USERS) : rows, truncated };
}

async function fetchUserById(pool, userId) {
  const { rows } = await pool.query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
  return rows[0] || null;
}

async function fetchReferralHistory(pool, user) {
  const [u, t] = await Promise.all([
    pool.query(
      `SELECT h.id, 'user' AS level, h.previous_source, h.reason, h.changed_by, h.changed_at,
              pc.code AS previous_code, nc.code AS new_code, po.name AS previous_owner, no_.name AS new_owner,
              sa.name AS changed_by_name, sa.email AS changed_by_email
       FROM user_referral_history h
       LEFT JOIN referral_codes pc ON pc.id = h.previous_code_id LEFT JOIN sales_owners po ON po.id = pc.owner_id
       LEFT JOIN referral_codes nc ON nc.id = h.new_code_id LEFT JOIN sales_owners no_ ON no_.id = nc.owner_id
       LEFT JOIN super_admins sa ON sa.id = h.changed_by
       WHERE h.user_id = $1 ORDER BY h.changed_at ASC`,
      [user.id]
    ),
    user.firm_id
      ? pool.query(
          `SELECT h.id, 'workspace' AS level, h.previous_source, h.reason, h.changed_by, h.changed_at,
                  pc.code AS previous_code, nc.code AS new_code, po.name AS previous_owner, no_.name AS new_owner,
                  sa.name AS changed_by_name, sa.email AS changed_by_email
           FROM tenant_referral_history h
           LEFT JOIN referral_codes pc ON pc.id = h.previous_code_id LEFT JOIN sales_owners po ON po.id = pc.owner_id
           LEFT JOIN referral_codes nc ON nc.id = h.new_code_id LEFT JOIN sales_owners no_ ON no_.id = nc.owner_id
           LEFT JOIN super_admins sa ON sa.id = h.changed_by
           WHERE h.tenant_id = $1 ORDER BY h.changed_at ASC`,
          [user.firm_id]
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return [...u.rows, ...t.rows].map((h) => ({
    id: h.id,
    level: h.level,
    changed_at: iso(h.changed_at),
    changed_at_ist: formatIST(h.changed_at),
    previous_code: h.previous_code || null,
    previous_owner: h.previous_owner || null,
    previous_source: h.previous_source || null,
    new_code: h.new_code || null,
    new_owner: h.new_owner || null,
    reason: h.reason || null,
    changed_by: h.changed_by ? { id: h.changed_by, name: h.changed_by_name || null, email: h.changed_by_email || null } : null,
  }));
}

// ── Payment DB: per-user aggregates and full history ─────────────────────────

/** One aggregate row per user id (Map<userId, agg>). Never throws on an empty id list. */
async function fetchPaymentAggregates(payPool, userIds) {
  const ids = [...new Set(userIds.map(Number).filter(Number.isInteger))];
  const out = new Map();
  if (!ids.length) return out;

  const [subs, pays, tops, addons, current] = await Promise.all([
    payPool.query(
      `SELECT us.user_id,
              COUNT(*)::int AS subscriptions,
              COUNT(*) FILTER (WHERE us.status = 'active')::int AS active_subscriptions,
              COUNT(*) FILTER (WHERE us.cancelled_at IS NOT NULL)::int AS cancelled_subscriptions,
              MIN(us.start_date) AS first_subscription_start,
              MAX(us.end_date) AS last_subscription_end,
              MIN(us.created_at) AS first_subscribed_at,
              MAX(us.created_at) AS last_subscribed_at,
              array_agg(DISTINCT COALESCE(mp.name, sp.name)) FILTER (WHERE COALESCE(mp.name, sp.name) IS NOT NULL) AS plan_names
       FROM user_subscriptions us
       LEFT JOIN monthly_plans mp ON mp.id = us.monthly_plan_id
       LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = ANY($1::int[]) GROUP BY us.user_id`,
      [ids]
    ),
    payPool.query(
      `SELECT p.user_id,
              COUNT(*)::int AS payments,
              COUNT(*) FILTER (WHERE p.status = 'captured')::int AS captured_payments,
              COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'captured'), 0) AS total_paid,
              MAX(p.currency) AS currency,
              MIN(p.created_at) FILTER (WHERE p.status = 'captured') AS first_payment_at,
              MAX(p.created_at) FILTER (WHERE p.status = 'captured') AS last_payment_at,
              (array_agg(p.amount ORDER BY p.created_at DESC) FILTER (WHERE p.status = 'captured'))[1] AS last_payment_amount
       FROM payments p WHERE p.user_id = ANY($1::int[]) GROUP BY p.user_id`,
      [ids]
    ),
    payPool.query(
      `SELECT t.user_id, COUNT(*)::int AS topups, COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed_topups,
              COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'completed'), 0) AS topup_paid,
              COALESCE(SUM(t.tokens_credited) FILTER (WHERE t.status = 'completed'), 0)::bigint AS tokens_credited,
              MAX(t.created_at) FILTER (WHERE t.status = 'completed') AS last_topup_at
       FROM user_token_topup_purchases t WHERE t.user_id = ANY($1::int[]) GROUP BY t.user_id`,
      [ids]
    ),
    payPool.query(
      `SELECT a.user_id, COUNT(*)::int AS storage_addons, COUNT(*) FILTER (WHERE a.status = 'completed')::int AS completed_storage_addons,
              COALESCE(SUM(a.amount) FILTER (WHERE a.status = 'completed'), 0) AS storage_paid,
              COALESCE(SUM(a.storage_bytes_granted) FILTER (WHERE a.status = 'completed'), 0)::bigint AS storage_bytes_granted,
              MAX(a.created_at) FILTER (WHERE a.status = 'completed') AS last_storage_addon_at
       FROM user_storage_addon_purchases a WHERE a.user_id = ANY($1::int[]) GROUP BY a.user_id`,
      [ids]
    ),
    // Latest subscription per user (the "current" one)
    payPool.query(
      `SELECT DISTINCT ON (us.user_id) us.user_id, us.id AS subscription_id, us.status, us.start_date, us.end_date,
              us.activated_at, us.cancelled_at, us.completed_at, us.last_charged_at, us.created_at,
              us.current_token_balance, us.topup_token_balance, us.topup_expires_at, us.plan_tokens_used, us.extra_storage_bytes,
              us.razorpay_subscription_id, us.razorpay_payment_id,
              COALESCE(mp.name, sp.name) AS plan_name, COALESCE(mp.price, sp.price) AS plan_price, COALESCE(mp.currency, sp.currency) AS plan_currency,
              mp.billing_interval_months, mp.category AS plan_category, mp.monthly_tokens, mp.storage_limit_gb AS mp_storage_gb, sp.storage_limit_gb AS sp_storage_gb,
              CASE WHEN us.monthly_plan_id IS NOT NULL THEN 'monthly_plan' WHEN us.plan_id IS NOT NULL THEN 'subscription_plan' END AS plan_source
       FROM user_subscriptions us
       LEFT JOIN monthly_plans mp ON mp.id = us.monthly_plan_id
       LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = ANY($1::int[])
       ORDER BY us.user_id, us.created_at DESC, us.id DESC`,
      [ids]
    ),
  ]);

  const get = (id) => {
    if (!out.has(id)) out.set(id, { user_id: id });
    return out.get(id);
  };
  for (const r of subs.rows) Object.assign(get(Number(r.user_id)), r);
  for (const r of pays.rows) Object.assign(get(Number(r.user_id)), r);
  for (const r of tops.rows) Object.assign(get(Number(r.user_id)), r);
  for (const r of addons.rows) Object.assign(get(Number(r.user_id)), r);
  for (const r of current.rows) get(Number(r.user_id)).current = r;
  return out;
}

/** Complete history for one user: every subscription, payment, top-up and storage add-on. */
async function fetchPaymentHistory(payPool, userId) {
  const [subs, pays, tops, addons, storage] = await Promise.all([
    payPool.query(
      `SELECT us.*, COALESCE(mp.name, sp.name) AS plan_name, COALESCE(mp.price, sp.price) AS plan_price,
              COALESCE(mp.currency, sp.currency) AS plan_currency, mp.billing_interval_months, mp.category AS plan_category,
              mp.monthly_tokens, mp.daily_token_limit, COALESCE(mp.storage_limit_gb, sp.storage_limit_gb) AS storage_limit_gb,
              sp.interval AS sp_interval, sp.type AS sp_type,
              CASE WHEN us.monthly_plan_id IS NOT NULL THEN 'monthly_plan' WHEN us.plan_id IS NOT NULL THEN 'subscription_plan' END AS plan_source
       FROM user_subscriptions us
       LEFT JOIN monthly_plans mp ON mp.id = us.monthly_plan_id
       LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = $1 ORDER BY us.created_at ASC, us.id ASC`,
      [userId]
    ),
    payPool.query(
      `SELECT p.*, COALESCE(mp.name, sp.name) AS plan_name
       FROM payments p
       LEFT JOIN user_subscriptions us ON us.id = p.subscription_id
       LEFT JOIN monthly_plans mp ON mp.id = us.monthly_plan_id
       LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE p.user_id = $1 ORDER BY p.created_at ASC, p.id ASC`,
      [userId]
    ),
    payPool.query(
      `SELECT t.*, tp.name AS topup_plan_name, tp.tokens AS plan_tokens, tp.validity_days
       FROM user_token_topup_purchases t LEFT JOIN topup_plans tp ON tp.id = t.topup_plan_id
       WHERE t.user_id = $1 ORDER BY t.created_at ASC, t.id ASC`,
      [userId]
    ),
    payPool.query(
      `SELECT a.*, ap.name AS addon_plan_name, ap.storage_gb, ap.billing_type, ap.billing_interval_months, ap.validity_years
       FROM user_storage_addon_purchases a LEFT JOIN addon_plans ap ON ap.id = a.addon_plan_id
       WHERE a.user_id = $1 ORDER BY a.created_at ASC, a.id ASC`,
      [userId]
    ),
    payPool.query(`SELECT * FROM user_storage_stats WHERE user_id = $1`, [userId]),
  ]);
  return { subscriptions: subs.rows, payments: pays.rows, topups: tops.rows, storage_addons: addons.rows, storage: storage.rows[0] || null };
}

// ── Serialisation ────────────────────────────────────────────────────────────

function serializeOnboarding(row) {
  const tracked = Boolean(row.code_id);
  return {
    channel: row.channel,
    channel_label: row.channel === 'SELF' ? 'Self signup' : row.channel === 'INTERNAL' ? 'Internal sales' : 'Outsourced / agency',
    tracked,
    level: tracked ? row.referral_level : null, // 'user' (own code) | 'workspace' (firm's code)
    source: row.referral_source || null, // SIGNUP (entered at signup) | ADMIN (attached by a super admin)
    referral_code: row.referral_code || null,
    referral_label: row.referral_label || null,
    referral_code_active: tracked ? Boolean(row.referral_code_active) : null,
    sales_owner: tracked ? { id: row.owner_id, name: row.owner_name, internal: Boolean(row.owner_internal) } : null,
    signed_up_at: iso(row.referral_signed_up_at),
    signed_up_at_ist: formatIST(row.referral_signed_up_at),
    set_at: iso(row.referral_set_at),
    set_at_ist: formatIST(row.referral_set_at),
    reason: row.referral_reason || null,
  };
}

function serializeCurrentSubscription(c) {
  if (!c) return null;
  return {
    subscription_id: c.subscription_id ?? c.id,
    plan_name: c.plan_name || null,
    plan_source: c.plan_source || null,
    plan_category: c.plan_category || null,
    plan_price: num(c.plan_price),
    plan_currency: c.plan_currency || null,
    billing_interval_months: num(c.billing_interval_months),
    status: c.status || null,
    start_date: iso(c.start_date),
    start_date_ist: formatIST(c.start_date),
    end_date: iso(c.end_date),
    end_date_ist: formatIST(c.end_date),
    is_expired: c.end_date ? new Date(c.end_date).getTime() < Date.now() : null,
    activated_at: iso(c.activated_at),
    activated_at_ist: formatIST(c.activated_at),
    cancelled_at: iso(c.cancelled_at),
    cancelled_at_ist: formatIST(c.cancelled_at),
    last_charged_at: iso(c.last_charged_at),
    last_charged_at_ist: formatIST(c.last_charged_at),
    monthly_tokens: num(c.monthly_tokens),
    current_token_balance: num(c.current_token_balance),
    topup_token_balance: num(c.topup_token_balance),
    plan_tokens_used: num(c.plan_tokens_used),
    extra_storage_bytes: num(c.extra_storage_bytes),
    storage_limit_gb: num(c.mp_storage_gb ?? c.sp_storage_gb ?? c.storage_limit_gb),
    razorpay_subscription_id: c.razorpay_subscription_id || null,
    razorpay_payment_id: c.razorpay_payment_id || null,
  };
}

function serializeUser(row, agg, { now = new Date() } = {}) {
  const a = agg || {};
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const totalPaid = money(a.total_paid) + money(a.topup_paid) + money(a.storage_paid);
  return {
    id: row.id,
    email: row.email,
    username: row.username || null,
    phone: row.phone || null,
    location: row.location || null,
    auth_type: row.auth_type || null,
    role: row.role || null,
    domain_role: row.domain_role || null,
    account_type: row.account_type || null,
    approval_status: row.approval_status || null,
    is_active: row.is_active !== false,
    is_blocked: Boolean(row.is_blocked),
    first_login: row.first_login,
    created_at: iso(row.created_at),
    created_at_ist: formatIST(row.created_at),
    onboarded_ago: createdAt ? humanizeDuration(now.getTime() - createdAt.getTime()) : null,
    last_login_at: iso(row.last_login_at),
    last_login_at_ist: formatIST(row.last_login_at),
    last_seen_at: iso(row.last_seen_at),
    last_seen_at_ist: formatIST(row.last_seen_at),
    razorpay_customer_id: row.razorpay_customer_id || null,

    workspace: row.firm_id
      ? {
          id: row.firm_id,
          name: row.firm_name,
          type: row.firm_type || null,
          approval_status: row.firm_approval_status || null,
          city: row.firm_city || null,
          state: row.firm_state || null,
          is_admin: Number(row.firm_admin_user_id) === Number(row.id),
          member_role: row.firm_role || (Number(row.firm_admin_user_id) === Number(row.id) ? 'admin' : null),
        }
      : null,
    profile: {
      organization_name: row.organization_name || null,
      organization_type: row.organization_type || null,
      primary_role: row.primary_role || null,
      primary_jurisdiction: row.primary_jurisdiction || null,
      main_areas_of_practice: row.main_areas_of_practice || null,
    },

    onboarding: serializeOnboarding(row),

    plan: {
      status: planStatusOf(row, a),
      active_plan_id: row.active_plan_id ?? null,
      active_plan_name: row.active_plan_name || null,
      is_paid: !isFreePlan(row.active_plan_name),
      active_plan_updated_at: iso(row.active_plan_updated_at),
      active_plan_updated_at_ist: formatIST(row.active_plan_updated_at),
      current_subscription: serializeCurrentSubscription(a.current),
    },

    subscription_summary: {
      subscriptions: Number(a.subscriptions || 0),
      active_subscriptions: Number(a.active_subscriptions || 0),
      cancelled_subscriptions: Number(a.cancelled_subscriptions || 0),
      plan_names: Array.isArray(a.plan_names) ? a.plan_names.filter(Boolean) : [],
      first_subscribed_at: iso(a.first_subscribed_at),
      first_subscribed_at_ist: formatIST(a.first_subscribed_at),
      last_subscribed_at: iso(a.last_subscribed_at),
      last_subscribed_at_ist: formatIST(a.last_subscribed_at),
      first_subscription_start: iso(a.first_subscription_start),
      last_subscription_end: iso(a.last_subscription_end),
      last_subscription_end_ist: formatIST(a.last_subscription_end),
      payments: Number(a.payments || 0),
      captured_payments: Number(a.captured_payments || 0),
      subscription_paid: money(a.total_paid),
      topups: Number(a.topups || 0),
      completed_topups: Number(a.completed_topups || 0),
      topup_paid: money(a.topup_paid),
      tokens_credited: Number(a.tokens_credited || 0),
      storage_addons: Number(a.storage_addons || 0),
      completed_storage_addons: Number(a.completed_storage_addons || 0),
      storage_paid: money(a.storage_paid),
      storage_bytes_granted: Number(a.storage_bytes_granted || 0),
      total_paid: Math.round(totalPaid * 100) / 100,
      currency: a.currency || 'INR',
      first_payment_at: iso(a.first_payment_at),
      first_payment_at_ist: formatIST(a.first_payment_at),
      last_payment_at: iso(a.last_payment_at),
      last_payment_at_ist: formatIST(a.last_payment_at),
      last_payment_amount: a.last_payment_amount != null ? money(a.last_payment_amount) : null,
      last_topup_at: iso(a.last_topup_at),
      last_storage_addon_at: iso(a.last_storage_addon_at),
    },
    timezone: IST_TIMEZONE,
  };
}

function serializeSubscription(s) {
  return {
    id: s.id,
    plan_name: s.plan_name || null,
    plan_source: s.plan_source || null,
    plan_category: s.plan_category || null,
    plan_price: num(s.plan_price),
    plan_currency: s.plan_currency || null,
    billing_interval_months: num(s.billing_interval_months),
    sp_interval: s.sp_interval || null,
    sp_type: s.sp_type || null,
    monthly_tokens: num(s.monthly_tokens),
    daily_token_limit: num(s.daily_token_limit),
    storage_limit_gb: num(s.storage_limit_gb),
    status: s.status || null,
    created_at: iso(s.created_at),
    created_at_ist: formatIST(s.created_at),
    start_date: iso(s.start_date),
    start_date_ist: formatIST(s.start_date),
    end_date: iso(s.end_date),
    end_date_ist: formatIST(s.end_date),
    is_expired: s.end_date ? new Date(s.end_date).getTime() < Date.now() : null,
    activated_at: iso(s.activated_at),
    activated_at_ist: formatIST(s.activated_at),
    cancelled_at: iso(s.cancelled_at),
    cancelled_at_ist: formatIST(s.cancelled_at),
    completed_at: iso(s.completed_at),
    last_charged_at: iso(s.last_charged_at),
    last_charged_at_ist: formatIST(s.last_charged_at),
    last_reset_date: iso(s.last_reset_date),
    current_token_balance: num(s.current_token_balance),
    topup_token_balance: num(s.topup_token_balance),
    topup_expires_at: iso(s.topup_expires_at),
    plan_tokens_used: num(s.plan_tokens_used),
    extra_storage_bytes: num(s.extra_storage_bytes),
    razorpay_subscription_id: s.razorpay_subscription_id || null,
    razorpay_payment_id: s.razorpay_payment_id || null,
    updated_at: iso(s.updated_at),
  };
}

function serializePayment(p) {
  return {
    id: p.id,
    subscription_id: p.subscription_id ?? null,
    plan_name: p.plan_name || null,
    amount: money(p.amount),
    currency: p.currency || null,
    status: p.status || null,
    payment_method: p.payment_method || null,
    razorpay_payment_id: p.razorpay_payment_id || null,
    razorpay_order_id: p.razorpay_order_id || null,
    created_at: iso(p.created_at),
    created_at_ist: formatIST(p.created_at),
    transaction_date: iso(p.transaction_date),
    transaction_date_ist: formatIST(p.transaction_date),
  };
}

function serializeTopup(t) {
  return {
    id: t.id,
    topup_plan_id: t.topup_plan_id ?? null,
    topup_plan_name: t.topup_plan_name || null,
    tokens_credited: num(t.tokens_credited),
    plan_tokens: num(t.plan_tokens),
    validity_days: num(t.validity_days),
    amount: money(t.amount),
    currency: t.currency || null,
    status: t.status || null,
    razorpay_payment_id: t.razorpay_payment_id || null,
    razorpay_order_id: t.razorpay_order_id || null,
    expires_at: iso(t.expires_at),
    expires_at_ist: formatIST(t.expires_at),
    created_at: iso(t.created_at),
    created_at_ist: formatIST(t.created_at),
  };
}

function serializeStorageAddon(a) {
  return {
    id: a.id,
    addon_plan_id: a.addon_plan_id ?? null,
    addon_plan_name: a.addon_plan_name || null,
    storage_gb: num(a.storage_gb),
    storage_bytes_granted: num(a.storage_bytes_granted),
    billing_type: a.billing_type || null,
    billing_interval_months: num(a.billing_interval_months),
    validity_years: num(a.validity_years),
    amount: money(a.amount),
    currency: a.currency || null,
    status: a.status || null,
    razorpay_payment_id: a.razorpay_payment_id || null,
    razorpay_order_id: a.razorpay_order_id || null,
    expires_at: iso(a.expires_at),
    expires_at_ist: formatIST(a.expires_at),
    created_at: iso(a.created_at),
    created_at_ist: formatIST(a.created_at),
  };
}

/** One chronological list of everything that happened to the user's subscription. */
function buildTimeline(user, h) {
  const events = [];
  events.push({ at: user.created_at, type: 'SIGNUP', title: `Signed up (${user.onboarding.channel_label})`, detail: user.onboarding.referral_code ? `code ${user.onboarding.referral_code} · ${user.onboarding.sales_owner?.name || ''}`.trim() : 'direct', amount: null, currency: null, status: null, ref_id: null });
  for (const s of h.subscriptions) {
    events.push({ at: s.created_at, type: 'SUBSCRIPTION', title: `${s.plan_name || 'Plan'} subscription ${s.status || ''}`.trim(), detail: `${s.start_date_ist?.date || '—'} → ${s.end_date_ist?.date || '—'}`, amount: s.plan_price, currency: s.plan_currency, status: s.status, ref_id: s.id });
    if (s.cancelled_at) events.push({ at: s.cancelled_at, type: 'SUBSCRIPTION_CANCELLED', title: `${s.plan_name || 'Plan'} subscription cancelled`, detail: null, amount: null, currency: null, status: 'cancelled', ref_id: s.id });
  }
  for (const p of h.payments) events.push({ at: p.created_at, type: 'PAYMENT', title: `Payment ${p.status || ''}${p.plan_name ? ` · ${p.plan_name}` : ''}`.trim(), detail: p.payment_method ? `${p.payment_method} · ${p.razorpay_payment_id || ''}`.trim() : p.razorpay_payment_id, amount: p.amount, currency: p.currency, status: p.status, ref_id: p.id });
  for (const t of h.topups) events.push({ at: t.created_at, type: 'TOKEN_TOPUP', title: `Token top-up ${t.status || ''}${t.topup_plan_name ? ` · ${t.topup_plan_name}` : ''}`.trim(), detail: t.tokens_credited != null ? `${t.tokens_credited.toLocaleString('en-IN')} tokens` : null, amount: t.amount, currency: t.currency, status: t.status, ref_id: t.id });
  for (const a of h.storage_addons) events.push({ at: a.created_at, type: 'STORAGE_ADDON', title: `Storage add-on ${a.status || ''}${a.addon_plan_name ? ` · ${a.addon_plan_name}` : ''}`.trim(), detail: a.storage_gb != null ? `${a.storage_gb} GB` : null, amount: a.amount, currency: a.currency, status: a.status, ref_id: a.id });
  return events
    .filter((e) => e.at)
    .sort((x, y) => new Date(x.at) - new Date(y.at))
    .map((e) => ({ ...e, at_ist: formatIST(e.at) }));
}

function serializeStorage(s) {
  if (!s) return null;
  const n = (v) => Number(v || 0);
  return {
    file_count: n(s.file_count), chat_count: n(s.chat_count), draft_count: n(s.draft_count), citation_count: n(s.citation_count), embedding_count: n(s.embedding_count),
    files_bytes: n(s.files_bytes), chat_bytes: n(s.chat_bytes), draft_bytes: n(s.draft_bytes), citation_bytes: n(s.citation_bytes), embedding_bytes: n(s.embedding_bytes), question_bytes: n(s.question_bytes),
    total_bytes: n(s.total_bytes), total_gb: Math.round((n(s.total_bytes) / 1024 ** 3) * 1000) / 1000,
    updated_at: iso(s.updated_at), updated_at_ist: formatIST(s.updated_at),
  };
}

// ── In-Node filtering / sorting (fields that live in the Payment DB) ─────────

function applyNodeFilters(users, f = {}) {
  let out = users;
  if (Array.isArray(f.plan_statuses) && f.plan_statuses.length) out = out.filter((u) => f.plan_statuses.includes(u.plan.status));
  if (typeof f.has_payments === 'boolean') out = out.filter((u) => (u.subscription_summary.captured_payments > 0) === f.has_payments);
  if (typeof f.has_subscription === 'boolean') out = out.filter((u) => (u.subscription_summary.subscriptions > 0) === f.has_subscription);
  if (f.min_total_paid != null) out = out.filter((u) => u.subscription_summary.total_paid >= Number(f.min_total_paid));
  return out;
}

function sortUsers(users, sort) {
  const by = (fn, dir = 1) => (a, b) => {
    const x = fn(a), y = fn(b);
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (x > y ? 1 : -1) * dir;
  };
  switch (sort) {
    case 'oldest': return [...users].sort(by((u) => u.created_at));
    case 'email': return [...users].sort(by((u) => String(u.email || '').toLowerCase()));
    case 'name': return [...users].sort(by((u) => String(u.username || u.email || '').toLowerCase()));
    case 'last_login': return [...users].sort(by((u) => u.last_login_at, -1));
    case 'plan': return [...users].sort(by((u) => ['PAID', 'LAPSED', 'FREE'].indexOf(u.plan.status)));
    case 'revenue': return [...users].sort(by((u) => u.subscription_summary.total_paid, -1));
    case 'last_payment': return [...users].sort(by((u) => u.subscription_summary.last_payment_at, -1));
    case 'newest':
    default: return [...users].sort(by((u) => u.created_at, -1));
  }
}

/** Totals over an (already serialized) user set. */
function summarize(users) {
  const bucket = () => ({ users: 0, paid: 0, lapsed: 0, free: 0, with_workspace: 0, total_paid: 0, subscription_paid: 0, topup_paid: 0, storage_paid: 0, payments: 0 });
  const add = (b, u) => {
    b.users += 1;
    b[u.plan.status.toLowerCase()] += 1;
    if (u.workspace) b.with_workspace += 1;
    b.total_paid = Math.round((b.total_paid + u.subscription_summary.total_paid) * 100) / 100;
    b.subscription_paid = Math.round((b.subscription_paid + u.subscription_summary.subscription_paid) * 100) / 100;
    b.topup_paid = Math.round((b.topup_paid + u.subscription_summary.topup_paid) * 100) / 100;
    b.storage_paid = Math.round((b.storage_paid + u.subscription_summary.storage_paid) * 100) / 100;
    b.payments += u.subscription_summary.captured_payments;
  };
  const totals = bucket();
  const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, bucket()]));
  const byOwner = new Map();
  const byPlan = new Map();
  const byAccountType = new Map();
  for (const u of users) {
    add(totals, u);
    add(byChannel[u.onboarding.channel], u);
    if (u.onboarding.sales_owner) {
      const k = u.onboarding.sales_owner.id;
      if (!byOwner.has(k)) byOwner.set(k, { ...bucket(), owner: u.onboarding.sales_owner, channel: u.onboarding.channel });
      add(byOwner.get(k), u);
    }
    const pn = u.plan.active_plan_name || '(no plan)';
    if (!byPlan.has(pn)) byPlan.set(pn, { ...bucket(), plan_name: pn });
    add(byPlan.get(pn), u);
    const at = u.account_type || '(none)';
    if (!byAccountType.has(at)) byAccountType.set(at, { ...bucket(), account_type: at });
    add(byAccountType.get(at), u);
  }
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
  const withRate = (b) => ({ ...b, paid_rate_pct: pct(b.paid, b.users) });
  return {
    totals: withRate(totals),
    by_channel: CHANNELS.map((c) => ({ channel: c, ...withRate(byChannel[c]) })),
    by_owner: [...byOwner.values()].map(withRate).sort((a, b) => b.users - a.users),
    by_plan: [...byPlan.values()].map(withRate).sort((a, b) => b.users - a.users),
    by_account_type: [...byAccountType.values()].map(withRate).sort((a, b) => b.users - a.users),
  };
}

async function getMeta(pool, payPool) {
  const [owners, codes, acct, plansA, plansM, plansS] = await Promise.all([
    pool.query(`SELECT id, name, internal FROM sales_owners ORDER BY name`),
    pool.query(`SELECT rc.id, rc.code, rc.label, rc.active, rc.owner_id, so.name AS owner_name FROM referral_codes rc LEFT JOIN sales_owners so ON so.id = rc.owner_id ORDER BY rc.code`),
    pool.query(`SELECT account_type AS value, COUNT(*)::int AS count FROM users WHERE account_type IS NOT NULL GROUP BY 1 ORDER BY count DESC`),
    pool.query(`SELECT active_plan_name AS value, COUNT(*)::int AS count FROM users WHERE active_plan_name IS NOT NULL GROUP BY 1 ORDER BY count DESC`),
    payPool.query(`SELECT id, name, category, price, currency, billing_interval_months, is_active FROM monthly_plans ORDER BY sort_order NULLS LAST, name`),
    payPool.query(`SELECT id, name, type, price, currency, interval, is_active FROM subscription_plans ORDER BY name`),
  ]);
  return {
    channels: CHANNELS.map((c) => ({ value: c, label: c === 'SELF' ? 'Self signup' : c === 'INTERNAL' ? 'Internal sales' : 'Outsourced / agency', aliases: Object.entries(CHANNEL_ALIASES).filter(([, v]) => v === c).map(([k]) => k) })),
    plan_statuses: PLAN_STATUSES,
    sources: ['SIGNUP', 'ADMIN'],
    sales_owners: owners.rows.map((o) => ({ id: o.id, name: o.name, internal: Boolean(o.internal), channel: o.internal ? 'INTERNAL' : 'OUTSOURCED' })),
    referral_codes: codes.rows,
    account_types: acct.rows,
    active_plan_names: plansA.rows,
    monthly_plans: plansM.rows,
    subscription_plans: plansS.rows,
    free_plan_names: FREE_PLAN_NAMES,
    sort_options: SORT_OPTIONS,
  };
}

module.exports = {
  CHANNELS,
  CHANNEL_ALIASES,
  PLAN_STATUSES,
  SORT_OPTIONS,
  MAX_USERS,
  normalizeChannel,
  fetchUsers,
  fetchUserById,
  fetchReferralHistory,
  fetchPaymentAggregates,
  fetchPaymentHistory,
  serializeUser,
  serializeSubscription,
  serializePayment,
  serializeTopup,
  serializeStorageAddon,
  serializeStorage,
  buildTimeline,
  applyNodeFilters,
  sortUsers,
  summarize,
  getMeta,
};

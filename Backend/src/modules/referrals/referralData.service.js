/**
 * "All referral data" — one row per ACCOUNT (a workspace = `firms` row, or a solo user with no
 * workspace) with the sales owner / code it came through, its attribution, seats, current plan and
 * full plan history (purchases, upgrades, renewals, top-ups, storage add-ons).
 *
 * Auth DB (pool): firms, firm_users, users, tenant_referrals / user_referrals, referral_codes,
 *                 sales_owners, super_admins
 * Payment DB (payPool): via onboardedUsersService (user_subscriptions, payments, top-ups, add-ons)
 *
 * Attribution for a workspace: its tenant_referrals row, else the admin user's user_referrals row.
 * Owner type: sales_owners.internal → INTERNAL / OUTSOURCED; no code → DIRECT.
 * Plan status of an account: PAID if any seat is on a paid plan, else LAPSED if any seat ever had a
 * subscription, else FREE.
 */
const { IST_TIMEZONE, formatIST, istDayStart, istDayEndExclusive } = require('../../shared/utils/time');
const users = require('../users/onboardedUsers.service');

const OWNER_TYPES = ['INTERNAL', 'OUTSOURCED'];
const STATUSES = ['PAID', 'LAPSED', 'FREE'];
const SORT_OPTIONS = ['newest', 'oldest', 'name', 'owner', 'total_paid', 'last_purchase', 'seats', 'status'];
const EVENT_KINDS = ['trial', 'purchase', 'upgrade', 'renewal', 'topup', 'storage_addon', 'cancelled'];
const MAX_ACCOUNTS = 5000;

function iso(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function money(v) {
  return v === null || v === undefined ? 0 : Math.round(Number(v) * 100) / 100;
}
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (m) => `\\${m}`);
}
function normalizeType(raw) {
  if (!raw) return null;
  const v = String(raw).trim().toUpperCase();
  return { INT: 'INTERNAL', OUT: 'OUTSOURCED', AGENCY: 'OUTSOURCED', INHOUSE: 'INTERNAL' }[v] || v;
}

// ── Auth DB: accounts ────────────────────────────────────────────────────────

/**
 * Workspaces (firms) and solo users as one row set. Columns are aligned so both halves of the
 * UNION serialize the same way.
 */
const REFERRAL_COLS = `
  rc.code AS referral_code, rc.label AS referral_label, rc.active AS referral_code_active,
  so.id AS owner_id, so.name AS owner_name, so.internal AS owner_internal,
  sa.name AS set_by_name, sa.email AS set_by_email
`;

const ACCOUNT_SELECT = `
  WITH ws AS (
    SELECT 'workspace' AS kind, f.id::text AS account_id, f.id AS firm_id, f.firm_name AS name, f.firm_type, f.approval_status,
           f.city, f.state, f.created_at AS signed_up_at, f.is_active,
           u.id AS user_id, u.email AS user_email, u.username AS user_name, u.phone AS user_phone,
           u.account_type, u.active_plan_name AS admin_plan_name,
           r.code_id, r.source, r.level, r.set_by, r.set_at, r.reason, r.signed_up_at AS referral_signed_up_at,
           (SELECT COUNT(DISTINCT x.user_id)::int FROM (
              SELECT f.admin_user_id AS user_id UNION SELECT fu.user_id FROM firm_users fu WHERE fu.firm_id = f.id
            ) x JOIN users ux ON ux.id = x.user_id WHERE COALESCE(ux.is_active, true) AND NOT COALESCE(ux.is_blocked, false)) AS seats,
           (SELECT array_agg(DISTINCT x.user_id) FROM (
              SELECT f.admin_user_id AS user_id UNION SELECT fu.user_id FROM firm_users fu WHERE fu.firm_id = f.id
            ) x WHERE x.user_id IS NOT NULL) AS seat_user_ids
    FROM firms f
    LEFT JOIN users u ON u.id = f.admin_user_id
    LEFT JOIN LATERAL (
      SELECT x.code_id, x.source, x.level, x.set_by, x.set_at, x.reason, x.signed_up_at FROM (
        SELECT 1 AS prio, 'workspace' AS level, tr.code_id, tr.source, tr.set_by, tr.set_at, tr.reason, tr.signed_up_at FROM tenant_referrals tr WHERE tr.tenant_id = f.id
        UNION ALL
        SELECT 2, 'user', ur.code_id, ur.source, ur.set_by, ur.set_at, ur.reason, ur.signed_up_at FROM user_referrals ur WHERE ur.user_id = f.admin_user_id
      ) x ORDER BY x.prio LIMIT 1
    ) r ON true
  ),
  solo AS (
    SELECT 'user' AS kind, u.id::text AS account_id, NULL::uuid AS firm_id, COALESCE(NULLIF(u.username, ''), u.email) AS name, NULL::text AS firm_type, u.approval_status,
           NULL::text AS city, NULL::text AS state, u.created_at AS signed_up_at, COALESCE(u.is_active, true) AND NOT COALESCE(u.is_blocked, false) AS is_active,
           u.id AS user_id, u.email AS user_email, u.username AS user_name, u.phone AS user_phone,
           u.account_type, u.active_plan_name AS admin_plan_name,
           ur.code_id, ur.source, CASE WHEN ur.code_id IS NULL THEN NULL ELSE 'user' END AS level, ur.set_by, ur.set_at, ur.reason, ur.signed_up_at AS referral_signed_up_at,
           1 AS seats, ARRAY[u.id] AS seat_user_ids
    FROM users u
    LEFT JOIN user_referrals ur ON ur.user_id = u.id
    WHERE NOT EXISTS (SELECT 1 FROM firm_users fu WHERE fu.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM firms f WHERE f.admin_user_id = u.id)
  ),
  acc AS (SELECT * FROM ws UNION ALL SELECT * FROM solo)
  SELECT a.*, ${REFERRAL_COLS},
         CASE WHEN a.code_id IS NULL THEN 'DIRECT' WHEN so.internal THEN 'INTERNAL' ELSE 'OUTSOURCED' END AS owner_type
  FROM acc a
  LEFT JOIN referral_codes rc ON rc.id = a.code_id
  LEFT JOIN sales_owners so ON so.id = rc.owner_id
  LEFT JOIN super_admins sa ON sa.id = a.set_by
`;

function buildFilters(f = {}) {
  const where = [];
  const values = [];
  const p = (v) => {
    values.push(v);
    return `$${values.length}`;
  };
  if (Array.isArray(f.owner_ids) && f.owner_ids.length) where.push(`so.id = ANY(${p(f.owner_ids)}::uuid[])`);
  if (Array.isArray(f.codes) && f.codes.length) where.push(`UPPER(rc.code) = ANY(${p(f.codes.map((c) => String(c).toUpperCase()))}::text[])`);
  if (f.type === 'INTERNAL') where.push('a.code_id IS NOT NULL AND so.internal = true');
  else if (f.type === 'OUTSOURCED') where.push('a.code_id IS NOT NULL AND so.internal = false');
  if (f.include_direct === false) where.push('a.code_id IS NOT NULL');
  if (Array.isArray(f.sources) && f.sources.length) where.push(`a.source = ANY(${p(f.sources)}::text[])`);
  if (Array.isArray(f.kinds) && f.kinds.length) where.push(`a.kind = ANY(${p(f.kinds)}::text[])`);
  if (f.search) {
    const like = p(`%${escapeLike(String(f.search).trim())}%`);
    where.push(`(a.name ILIKE ${like} OR COALESCE(a.user_email, '') ILIKE ${like} OR COALESCE(a.user_name, '') ILIKE ${like}
      OR COALESCE(rc.code, '') ILIKE ${like} OR COALESCE(so.name, '') ILIKE ${like} OR a.account_id = ${p(String(f.search).trim())})`);
  }
  if (f.from) {
    const start = istDayStart(f.from);
    if (start) where.push(`a.signed_up_at >= ${p(start)}`);
  }
  if (f.to) {
    const end = istDayEndExclusive(f.to);
    if (end) where.push(`a.signed_up_at < ${p(end)}`);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

async function fetchAccounts(pool, filters = {}) {
  const { whereSql, values } = buildFilters(filters);
  const { rows } = await pool.query(`${ACCOUNT_SELECT} ${whereSql} ORDER BY a.signed_up_at DESC LIMIT ${MAX_ACCOUNTS + 1}`, values);
  const truncated = rows.length > MAX_ACCOUNTS;
  return { rows: truncated ? rows.slice(0, MAX_ACCOUNTS) : rows, truncated };
}

async function fetchAccountById(pool, accountId) {
  const { rows } = await pool.query(`${ACCOUNT_SELECT} WHERE a.account_id = $1`, [String(accountId)]);
  return rows[0] || null;
}

/** Seat users of one account (for the detail view). */
async function fetchSeats(pool, row) {
  const ids = (row.seat_user_ids || []).filter((x) => x != null).map(Number);
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.username, u.account_type, u.approval_status, COALESCE(u.is_active, true) AND NOT COALESCE(u.is_blocked, false) AS is_active,
            u.active_plan_name, u.created_at, u.last_login_at,
            COALESCE(fu.role, CASE WHEN f.admin_user_id = u.id THEN 'ADMIN' END) AS role
     FROM users u
     LEFT JOIN firm_users fu ON fu.user_id = u.id AND fu.firm_id = $2::uuid
     LEFT JOIN firms f ON f.id = $2::uuid
     WHERE u.id = ANY($1::int[]) ORDER BY (f.admin_user_id = u.id) DESC NULLS LAST, u.created_at ASC`,
    [ids, row.firm_id || null]
  );
  return rows.map((u) => ({
    id: u.id, email: u.email, username: u.username || null, role: u.role || null, account_type: u.account_type || null,
    approval_status: u.approval_status || null, is_active: Boolean(u.is_active), active_plan_name: u.active_plan_name || null,
    created_at: iso(u.created_at), created_at_ist: formatIST(u.created_at), last_login_at: iso(u.last_login_at), last_login_at_ist: formatIST(u.last_login_at),
  }));
}

// ── Plan history (events) ────────────────────────────────────────────────────

/**
 * Chronological plan events for one account from the seat users' Payment-DB history.
 * kinds: trial (signup), purchase (first paid subscription), upgrade (higher-priced plan than before),
 * renewal (another paid subscription / payment on the same or cheaper plan), topup, storage_addon, cancelled.
 */
function buildEvents(account, histories) {
  const ev = [];
  ev.push({ at: account.signed_up_at, kind: 'trial', title: 'Signed up', plan: account.admin_plan_name && !isPaidName(account.admin_plan_name) ? account.admin_plan_name : 'Free', billing: null, amount: 0, currency: 'INR', payment_id: null, status: null, user_id: account.user_id, user_email: account.user_email, note: account.code_id ? `via ${account.referral_code}` : 'direct' });

  for (const { userId, email, h } of histories) {
    const paidSubs = h.subscriptions.filter((s) => Number(s.plan_price || 0) > 0 || h.payments.some((p) => p.subscription_id === s.id && p.status === 'captured'));
    let lastPrice = null;
    for (const s of paidSubs) {
      const pays = h.payments.filter((p) => p.subscription_id === s.id && p.status === 'captured');
      const amount = pays.length ? pays.reduce((n, p) => n + Number(p.amount || 0), 0) : Number(s.plan_price || 0);
      const price = Number(s.plan_price || 0);
      const kind = lastPrice === null ? 'purchase' : price > lastPrice ? 'upgrade' : 'renewal';
      lastPrice = price;
      ev.push({ at: s.activated_at || s.created_at, kind, title: kind === 'purchase' ? 'Plan purchased' : kind === 'upgrade' ? 'Upgraded' : 'Renewed', plan: s.plan_name || null, billing: s.billing_interval_months ? (s.billing_interval_months === 12 ? 'Yearly' : s.billing_interval_months === 1 ? 'Monthly' : `${s.billing_interval_months} months`) : s.sp_interval || null, amount: money(amount), currency: s.plan_currency || pays[0]?.currency || 'INR', payment_id: pays[0]?.razorpay_payment_id || s.razorpay_payment_id || null, status: pays.length ? 'Success' : s.status || null, user_id: userId, user_email: email, subscription_id: s.id, period: { start: iso(s.start_date), end: iso(s.end_date) } });
      if (s.cancelled_at) ev.push({ at: s.cancelled_at, kind: 'cancelled', title: 'Cancelled', plan: s.plan_name || null, billing: null, amount: 0, currency: s.plan_currency || 'INR', payment_id: null, status: 'Cancelled', user_id: userId, user_email: email, subscription_id: s.id });
    }
    // Captured payments not tied to a subscription row
    for (const p of h.payments.filter((p) => p.status === 'captured' && !paidSubs.some((s) => s.id === p.subscription_id))) {
      ev.push({ at: p.created_at, kind: 'renewal', title: 'Payment', plan: p.plan_name || null, billing: null, amount: money(p.amount), currency: p.currency || 'INR', payment_id: p.razorpay_payment_id || null, status: 'Success', user_id: userId, user_email: email, payment_row_id: p.id });
    }
    for (const t of h.topups.filter((t) => t.status === 'completed')) ev.push({ at: t.created_at, kind: 'topup', title: 'Token top-up', plan: t.topup_plan_name || null, billing: t.validity_days ? `${t.validity_days} days` : null, amount: money(t.amount), currency: t.currency || 'INR', payment_id: t.razorpay_payment_id || null, status: 'Success', user_id: userId, user_email: email, tokens: Number(t.tokens_credited || 0) });
    for (const a of h.storage_addons.filter((a) => a.status === 'completed')) ev.push({ at: a.created_at, kind: 'storage_addon', title: 'Storage add-on', plan: a.addon_plan_name || null, billing: a.billing_type || null, amount: money(a.amount), currency: a.currency || 'INR', payment_id: a.razorpay_payment_id || null, status: 'Success', user_id: userId, user_email: email, storage_gb: a.storage_gb != null ? Number(a.storage_gb) : null });
  }
  return ev
    .filter((e) => e.at)
    .sort((x, y) => new Date(x.at) - new Date(y.at))
    .map((e) => ({ ...e, at: iso(e.at), at_ist: formatIST(e.at) }));
}

const FREE_NAMES = String(process.env.REFERRALS_FREE_PLAN_NAMES || 'Free,Free Trial,Trial').split(',').map((s) => s.trim().toLowerCase());
function isPaidName(name) {
  return Boolean(name) && !FREE_NAMES.includes(String(name).trim().toLowerCase());
}

// ── Serialisation ────────────────────────────────────────────────────────────

/** @param aggMap Map<userId, aggregate> from onboardedUsersService.fetchPaymentAggregates */
function serializeAccount(row, aggMap, { seatPlans = null } = {}) {
  const seatIds = (row.seat_user_ids || []).filter((x) => x != null).map(Number);
  const aggs = seatIds.map((id) => aggMap.get(id)).filter(Boolean);
  const sum = (k) => aggs.reduce((n, a) => n + Number(a[k] || 0), 0);
  const maxDate = (k) => aggs.map((a) => a[k]).filter(Boolean).sort((x, y) => new Date(y) - new Date(x))[0] || null;
  const minDate = (k) => aggs.map((a) => a[k]).filter(Boolean).sort((x, y) => new Date(x) - new Date(y))[0] || null;

  const paidSeat = seatPlans ? seatPlans.some((p) => isPaidName(p)) : isPaidName(row.admin_plan_name);
  const status = paidSeat ? 'PAID' : sum('subscriptions') > 0 ? 'LAPSED' : 'FREE';
  const current = aggs.map((a) => a.current).filter(Boolean).sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0] || null;
  const purchases = sum('captured_payments') + sum('completed_topups') + sum('completed_storage_addons');
  const totalPaid = money(sum('total_paid') + sum('topup_paid') + sum('storage_paid'));
  const lastPurchase = [maxDate('last_payment_at'), maxDate('last_topup_at'), maxDate('last_storage_addon_at')].filter(Boolean).sort((x, y) => new Date(y) - new Date(x))[0] || null;
  const tracked = Boolean(row.code_id);

  return {
    id: row.account_id,
    kind: row.kind, // workspace | user
    name: row.name,
    firm_id: row.firm_id || null,
    firm_type: row.firm_type || null,
    city: row.city || null,
    state: row.state || null,
    approval_status: row.approval_status || null,
    verified: row.approval_status === 'APPROVED',
    is_active: row.is_active !== false,
    primary_user: row.user_id ? { id: row.user_id, email: row.user_email, name: row.user_name || null, phone: row.user_phone || null, account_type: row.account_type || null } : null,
    seats: Number(row.seats || 0),
    seat_user_ids: seatIds,
    signed_up_at: iso(row.signed_up_at),
    signed_up_at_ist: formatIST(row.signed_up_at),
    owner_type: row.owner_type, // INTERNAL | OUTSOURCED | DIRECT
    sales_owner: tracked ? { id: row.owner_id, name: row.owner_name, internal: Boolean(row.owner_internal), type: row.owner_internal ? 'INTERNAL' : 'OUTSOURCED' } : null,
    code: tracked ? { code: row.referral_code, label: row.referral_label || null, active: Boolean(row.referral_code_active) } : null,
    attribution: tracked
      ? { source: row.source, level: row.level, signed_up_at: iso(row.referral_signed_up_at), set_at: iso(row.set_at), set_at_ist: formatIST(row.set_at), set_by: row.set_by ? { id: row.set_by, name: row.set_by_name || null, email: row.set_by_email || null } : null, reason: row.reason || null }
      : { source: 'DIRECT', level: null, signed_up_at: null, set_at: null, set_at_ist: null, set_by: null, reason: null },
    status,
    current_plan: {
      name: current?.plan_name || row.admin_plan_name || null,
      billing: current?.billing_interval_months ? (current.billing_interval_months === 12 ? 'Yearly' : current.billing_interval_months === 1 ? 'Monthly' : `${current.billing_interval_months} months`) : null,
      display: current?.plan_name ? `${current.plan_name}${current.billing_interval_months ? ` · ${current.billing_interval_months === 12 ? 'Yearly' : current.billing_interval_months === 1 ? 'Monthly' : `${current.billing_interval_months} mo`}` : ''}` : row.admin_plan_name || 'Free',
      status: current?.status || null,
      start_date: iso(current?.start_date), end_date: iso(current?.end_date), end_date_ist: formatIST(current?.end_date),
      is_expired: current?.end_date ? new Date(current.end_date).getTime() < Date.now() : null,
      price: current?.plan_price != null ? Number(current.plan_price) : null,
      currency: current?.plan_currency || null,
    },
    purchases,
    subscriptions: sum('subscriptions'),
    total_paid: totalPaid,
    subscription_paid: money(sum('total_paid')),
    topup_paid: money(sum('topup_paid')),
    storage_paid: money(sum('storage_paid')),
    currency: aggs.find((a) => a.currency)?.currency || 'INR',
    first_purchase_at: minDate('first_payment_at'),
    first_purchase_at_ist: formatIST(minDate('first_payment_at')),
    last_purchase_at: lastPurchase,
    last_purchase_at_ist: formatIST(lastPurchase),
    timezone: IST_TIMEZONE,
  };
}

function applyStatusFilter(accounts, statuses) {
  if (!Array.isArray(statuses) || !statuses.length) return accounts;
  return accounts.filter((a) => statuses.includes(a.status));
}

function sortAccounts(list, sort) {
  const by = (fn, dir = 1) => (a, b) => {
    const x = fn(a), y = fn(b);
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (x > y ? 1 : -1) * dir;
  };
  switch (sort) {
    case 'oldest': return [...list].sort(by((a) => a.signed_up_at));
    case 'name': return [...list].sort(by((a) => String(a.name || '').toLowerCase()));
    case 'owner': return [...list].sort(by((a) => String(a.sales_owner?.name || 'zzz').toLowerCase()));
    case 'total_paid': return [...list].sort(by((a) => a.total_paid, -1));
    case 'last_purchase': return [...list].sort(by((a) => a.last_purchase_at, -1));
    case 'seats': return [...list].sort(by((a) => a.seats, -1));
    case 'status': return [...list].sort(by((a) => STATUSES.indexOf(a.status)));
    case 'newest':
    default: return [...list].sort(by((a) => a.signed_up_at, -1));
  }
}

function summarize(accounts) {
  const b = () => ({ accounts: 0, workspaces: 0, users: 0, via_code: 0, direct: 0, paid: 0, lapsed: 0, free: 0, seats: 0, purchases: 0, total_paid: 0 });
  const add = (x, a) => {
    x.accounts += 1; x[a.kind === 'workspace' ? 'workspaces' : 'users'] += 1; x[a.code ? 'via_code' : 'direct'] += 1; x[a.status.toLowerCase()] += 1;
    x.seats += a.seats; x.purchases += a.purchases; x.total_paid = money(x.total_paid + a.total_paid);
  };
  const totals = b(); const byType = { INTERNAL: b(), OUTSOURCED: b(), DIRECT: b() }; const byOwner = new Map();
  for (const a of accounts) {
    add(totals, a); add(byType[a.owner_type], a);
    if (a.sales_owner) { if (!byOwner.has(a.sales_owner.id)) byOwner.set(a.sales_owner.id, { ...b(), owner: a.sales_owner }); add(byOwner.get(a.sales_owner.id), a); }
  }
  const pct = (p, w) => (w ? Math.round((p / w) * 1000) / 10 : 0);
  const r = (x) => ({ ...x, paid_pct: pct(x.paid, x.accounts) });
  return { totals: r(totals), by_owner_type: Object.entries(byType).map(([k, v]) => ({ owner_type: k, ...r(v) })), by_owner: [...byOwner.values()].map(r).sort((x, y) => y.accounts - x.accounts) };
}

module.exports = {
  OWNER_TYPES, STATUSES, SORT_OPTIONS, EVENT_KINDS, MAX_ACCOUNTS,
  normalizeType, isPaidName,
  fetchAccounts, fetchAccountById, fetchSeats,
  buildEvents, serializeAccount, applyStatusFilter, sortAccounts, summarize,
  fetchPaymentAggregates: users.fetchPaymentAggregates,
  fetchPaymentHistory: users.fetchPaymentHistory,
  serializers: { subscription: users.serializeSubscription, payment: users.serializePayment, topup: users.serializeTopup, storage_addon: users.serializeStorageAddon },
};

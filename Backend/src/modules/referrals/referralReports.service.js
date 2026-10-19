/**
 * Sales Referrals — report queries (A12–A15). Auth / Main DB.
 *
 * Every report shares one base population and one plan-status expression, so numbers reconcile
 * across screens. The population is the UNION of the two attribution tables written by the
 * user-side auth service:
 *   tenant_referrals — FIRM sign-ups (tenant_id uuid → firms.id)
 *   user_referrals   — SOLO lawyer sign-ups (user_id integer → users.id; solo users have no firm)
 *
 * Plan status is classified from the "plan user": the firm's admin user for FIRM rows, the user
 * itself for SOLO rows (users.active_plan_name), because this database keeps the plan on the user:
 *   PAID   : users.active_plan_name is set and is not a free plan name (REFERRALS_FREE_PLAN_NAMES)
 *   LAPSED : not PAID, but the admin user has at least one user_subscriptions row (was paid before)
 *   FREE   : everything else (including unverified workspaces)
 */
const { ApiError, loadOwnerRow, loadCode } = require('./salesReferrals.service');
const { formatIST, istDayStart, istDayEndExclusive } = require('../../shared/utils/time');

const DEFAULT_FREE_PLAN_NAMES = ['free', 'free trial', 'trial'];

function freePlanNames() {
  const raw = process.env.REFERRALS_FREE_PLAN_NAMES;
  if (!raw) return DEFAULT_FREE_PLAN_NAMES;
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : DEFAULT_FREE_PLAN_NAMES;
}

function trackingSince() {
  const v = (process.env.REFERRALS_TRACKING_SINCE || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

const ts = (v) => (v ? formatIST(v)?.iso ?? null : null);

function paidPercent(paid, signups) {
  const p = Number(paid || 0);
  const s = Number(signups || 0);
  if (!s) return 0;
  return Math.floor((p * 100) / s + 0.5);
}

function num(v) {
  return Number(v || 0);
}

const TENANT_TYPES = ['FIRM', 'SOLO'];
const SIGNUP_SOURCES = ['SIGNUP', 'ADMIN'];

/**
 * Base CTEs. `signups_raw` is the union of both attribution tables (one row per tracked FIRM or
 * SOLO sign-up); the date filter is applied inside each branch, before the UNION. `signups` adds
 * the plan user (firm admin / the solo user), the plan status and verification.
 *   tenant_type  'FIRM' | 'SOLO'
 *   tenant_id    text: firms.id (uuid) for FIRM, users.id for SOLO
 *   firm_id      uuid for FIRM rows, NULL for SOLO (used for seat counts)
 *   tenant_name  firm name / solo user's username
 * Params: $1 free plan names (text[]), $2 from (timestamptz|null), $3 to-exclusive (timestamptz|null).
 */
const SIGNUPS_CTE = `
  signups_raw AS (
    SELECT 'FIRM'::text        AS tenant_type,
           tr.tenant_id::text  AS tenant_id,
           f.id                AS firm_id,
           f.firm_name         AS tenant_name,
           f.email             AS tenant_email,
           f.admin_user_id     AS plan_user_id,
           tr.code_id, tr.source, tr.signed_up_at, tr.set_by, tr.set_at, tr.reason
    FROM tenant_referrals tr
    JOIN firms f ON f.id = tr.tenant_id
    WHERE ($2::timestamptz IS NULL OR tr.signed_up_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR tr.signed_up_at <  $3::timestamptz)
    UNION ALL
    SELECT 'SOLO'::text,
           ur.user_id::text,
           NULL::uuid,
           u.username,
           u.email,
           ur.user_id,
           ur.code_id, ur.source, ur.signed_up_at, ur.set_by, ur.set_at, ur.reason
    FROM user_referrals ur
    JOIN users u ON u.id = ur.user_id
    WHERE ($2::timestamptz IS NULL OR ur.signed_up_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR ur.signed_up_at <  $3::timestamptz)
  ),
  signups AS (
    SELECT r.tenant_type, r.tenant_id, r.firm_id, r.tenant_name, r.tenant_email, r.plan_user_id,
           r.code_id, r.source, r.signed_up_at, r.set_by, r.set_at, r.reason,
           pu.id AS owner_user_id, pu.email AS owner_email,
           (pu.approval_status = 'APPROVED') AS email_verified,
           CASE
             WHEN pu.active_plan_name IS NOT NULL AND lower(pu.active_plan_name) <> ALL($1::text[]) THEN 'PAID'
             WHEN EXISTS (SELECT 1 FROM user_subscriptions us WHERE us.user_id = pu.id) THEN 'LAPSED'
             ELSE 'FREE'
           END AS plan_status
    FROM signups_raw r
    LEFT JOIN users pu ON pu.id = r.plan_user_id
  )`;

function baseParams(filters) {
  return [freePlanNames(), filters.from ? istDayStart(filters.from) : null, filters.to ? istDayEndExclusive(filters.to) : null];
}

function typeClause(type, alias = 'so') {
  if (type === 'INTERNAL') return `${alias}.internal = TRUE`;
  if (type === 'OUTSOURCED') return `${alias}.internal = FALSE`;
  return null;
}

// ── A12 — summary ────────────────────────────────────────────────────────────

async function summary(pool, filters) {
  const params = baseParams(filters);
  const type = filters.type || 'ALL';
  const tc = typeClause(type);
  const { rows } = await pool.query(
    `WITH ${SIGNUPS_CTE}
     SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE s.code_id IS NOT NULL)::int AS via_code,
            COUNT(*) FILTER (WHERE s.code_id IS NULL)::int AS direct,
            COUNT(*) FILTER (WHERE s.plan_status = 'FREE')::int AS free_total,
            COUNT(*) FILTER (WHERE s.plan_status = 'FREE' AND s.code_id IS NOT NULL)::int AS free_via_code,
            COUNT(*) FILTER (WHERE s.plan_status = 'PAID')::int AS paid_total,
            COUNT(*) FILTER (WHERE s.plan_status = 'PAID' AND s.code_id IS NOT NULL)::int AS paid_via_code,
            COUNT(*) FILTER (WHERE s.plan_status = 'LAPSED')::int AS lapsed_total,
            COUNT(*) FILTER (WHERE s.plan_status = 'LAPSED' AND s.code_id IS NOT NULL)::int AS lapsed_via_code,
            COUNT(*) FILTER (WHERE s.tenant_type = 'FIRM')::int AS firm_count,
            COUNT(*) FILTER (WHERE s.tenant_type = 'SOLO')::int AS solo_count
     FROM signups s
     LEFT JOIN referral_codes rc ON rc.id = s.code_id
     LEFT JOIN sales_owners so ON so.id = rc.owner_id
     ${tc ? `WHERE ${tc}` : ''}`,
    params
  );
  const r = rows[0];
  return {
    trackingSince: trackingSince(),
    filters: { from: filters.from || null, to: filters.to || null, type },
    totalSignups: num(r.total),
    viaCode: num(r.via_code),
    direct: num(r.direct),
    free: { total: num(r.free_total), viaCode: num(r.free_via_code) },
    paid: { total: num(r.paid_total), viaCode: num(r.paid_via_code) },
    lapsed: { total: num(r.lapsed_total), viaCode: num(r.lapsed_via_code) },
    paidPercent: paidPercent(r.paid_total, r.total),
    byTenantType: { FIRM: num(r.firm_count), SOLO: num(r.solo_count) },
  };
}

// ── A13 — owners table ───────────────────────────────────────────────────────

const OWNER_SORTS = ['name', 'signups', 'free', 'paid', 'lapsed', 'paidPercent'];

async function ownersTable(pool, filters) {
  const params = baseParams(filters);
  const type = filters.type || 'ALL';
  const where = [];
  const tc = typeClause(type);
  if (tc) where.push(tc);
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`so.name ILIKE $${params.length}`);
  }

  const { rows } = await pool.query(
    `WITH ${SIGNUPS_CTE}
     SELECT so.id, so.name, so.internal, so.created_at,
            COUNT(s.tenant_id)::int AS signups,
            COUNT(s.tenant_id) FILTER (WHERE s.plan_status = 'FREE')::int AS free,
            COUNT(s.tenant_id) FILTER (WHERE s.plan_status = 'PAID')::int AS paid,
            COUNT(s.tenant_id) FILTER (WHERE s.plan_status = 'LAPSED')::int AS lapsed,
            (SELECT COUNT(*)::int FROM referral_codes c WHERE c.owner_id = so.id) AS codes_total,
            (SELECT COUNT(*)::int FROM referral_codes c WHERE c.owner_id = so.id AND c.active) AS codes_active
     FROM sales_owners so
     LEFT JOIN referral_codes rc ON rc.owner_id = so.id
     LEFT JOIN signups s ON s.code_id = rc.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY so.id
     ORDER BY lower(so.name)`,
    params
  );

  const owners = rows.map((r) => ({
    id: r.id,
    name: r.name,
    internal: Boolean(r.internal),
    createdAt: ts(r.created_at),
    codes: { active: num(r.codes_active), total: num(r.codes_total) },
    signups: num(r.signups),
    free: num(r.free),
    paid: num(r.paid),
    lapsed: num(r.lapsed),
    paidPercent: paidPercent(r.paid, r.signups),
  }));

  const sort = OWNER_SORTS.includes(filters.sort) ? filters.sort : 'signups';
  const dir = filters.direction === 'asc' ? 1 : -1;
  owners.sort((a, b) => {
    let c;
    if (sort === 'name') c = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    else c = a[sort] - b[sort];
    if (c === 0 && sort !== 'name') c = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir;
    return c * dir;
  });

  let direct = null;
  if (type === 'ALL') {
    const d = await pool.query(
      `WITH ${SIGNUPS_CTE}
       SELECT COUNT(*)::int AS signups,
              COUNT(*) FILTER (WHERE plan_status = 'FREE')::int AS free,
              COUNT(*) FILTER (WHERE plan_status = 'PAID')::int AS paid,
              COUNT(*) FILTER (WHERE plan_status = 'LAPSED')::int AS lapsed
       FROM signups WHERE code_id IS NULL`,
      baseParams(filters)
    );
    const r = d.rows[0];
    direct = { signups: num(r.signups), free: num(r.free), paid: num(r.paid), lapsed: num(r.lapsed), paidPercent: paidPercent(r.paid, r.signups) };
  }

  const counts = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM sales_owners) AS owners, (SELECT COUNT(*)::int FROM referral_codes) AS codes`
  );

  return {
    filters: { from: filters.from || null, to: filters.to || null, type, search: filters.search || null, sort, direction: dir === 1 ? 'asc' : 'desc' },
    ownerCountAll: num(counts.rows[0].owners),
    codeCountAll: num(counts.rows[0].codes),
    owners,
    direct,
  };
}

// ── A14 — per-code breakdown ─────────────────────────────────────────────────

async function ownerCodes(pool, ownerId, filters) {
  const owner = await loadOwnerRow(pool, ownerId);
  if (!owner) throw new ApiError(404, 'SALES_OWNER_NOT_FOUND', 'This sales owner no longer exists.');

  const params = baseParams(filters);
  params.push(ownerId);
  const { rows } = await pool.query(
    `WITH ${SIGNUPS_CTE}
     SELECT rc.id, rc.code, rc.label, rc.active, rc.created_at, rep.code AS replaced_by_code,
            COUNT(s.tenant_id)::int AS signups,
            COUNT(s.tenant_id) FILTER (WHERE s.plan_status = 'FREE')::int AS free,
            COUNT(s.tenant_id) FILTER (WHERE s.plan_status = 'PAID')::int AS paid,
            COUNT(s.tenant_id) FILTER (WHERE s.plan_status = 'LAPSED')::int AS lapsed
     FROM referral_codes rc
     LEFT JOIN referral_codes rep ON rep.id = rc.replaced_by_code_id
     LEFT JOIN signups s ON s.code_id = rc.id
     WHERE rc.owner_id = $${params.length}
     GROUP BY rc.id, rep.code
     ORDER BY rc.active DESC, rc.created_at DESC, rc.code ASC`,
    params
  );

  const codes = rows.map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label ?? null,
    active: Boolean(r.active),
    replacedByCode: r.replaced_by_code ?? null,
    createdAt: ts(r.created_at),
    signups: num(r.signups),
    free: num(r.free),
    paid: num(r.paid),
    lapsed: num(r.lapsed),
    paidPercent: paidPercent(r.paid, r.signups),
  }));
  const totals = codes.reduce(
    (t, c) => ({ signups: t.signups + c.signups, free: t.free + c.free, paid: t.paid + c.paid, lapsed: t.lapsed + c.lapsed }),
    { signups: 0, free: 0, paid: 0, lapsed: 0 }
  );
  totals.paidPercent = paidPercent(totals.paid, totals.signups);

  return {
    owner: { id: owner.id, name: owner.name, internal: Boolean(owner.internal) },
    filters: { from: filters.from || null, to: filters.to || null },
    totals,
    codes,
  };
}

// ── A15 — signups list ───────────────────────────────────────────────────────

const SIGNUP_STATUSES = ['FREE', 'PAID', 'LAPSED'];

async function signups(pool, filters) {
  const params = baseParams(filters);
  const where = [];
  const scope = { type: null, code: null, owner: null };

  if (filters.codeId) {
    const code = await loadCode(pool, filters.codeId);
    if (!code) throw new ApiError(404, 'REFERRAL_CODE_NOT_FOUND', 'This code no longer exists.');
    scope.type = 'CODE';
    scope.code = { id: code.id, code: code.code, label: code.label ?? null, active: Boolean(code.active) };
    scope.owner = { id: code.owner_id, name: code.owner_name, internal: Boolean(code.owner_internal) };
    params.push(code.id);
    where.push(`s.code_id = $${params.length}`);
  } else if (filters.ownerId) {
    const owner = await loadOwnerRow(pool, filters.ownerId);
    if (!owner) throw new ApiError(404, 'SALES_OWNER_NOT_FOUND', 'This sales owner no longer exists.');
    scope.type = 'OWNER';
    scope.owner = { id: owner.id, name: owner.name, internal: Boolean(owner.internal) };
    params.push(owner.id);
    where.push(`rc.owner_id = $${params.length}`);
  } else {
    scope.type = 'DIRECT';
    where.push('s.code_id IS NULL');
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`(s.tenant_name ILIKE $${params.length} OR s.owner_email ILIKE $${params.length})`);
  }
  if (filters.source && SIGNUP_SOURCES.includes(filters.source)) {
    params.push(filters.source);
    where.push(`s.source = $${params.length}`);
  }
  if (filters.tenantType && TENANT_TYPES.includes(filters.tenantType)) {
    params.push(filters.tenantType);
    where.push(`s.tenant_type = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const from = `FROM signups s LEFT JOIN referral_codes rc ON rc.id = s.code_id`;

  const countsRes = await pool.query(
    `WITH ${SIGNUPS_CTE}
     SELECT COUNT(*)::int AS all_count,
            COUNT(*) FILTER (WHERE s.plan_status = 'FREE')::int AS free,
            COUNT(*) FILTER (WHERE s.plan_status = 'PAID')::int AS paid,
            COUNT(*) FILTER (WHERE s.plan_status = 'LAPSED')::int AS lapsed
     ${from} ${whereSql}`,
    params
  );
  const c = countsRes.rows[0];
  const statusCounts = { all: num(c.all_count), free: num(c.free), paid: num(c.paid), lapsed: num(c.lapsed) };

  const listParams = [...params];
  let statusSql = '';
  if (filters.status && SIGNUP_STATUSES.includes(filters.status)) {
    listParams.push(filters.status);
    statusSql = ` AND s.plan_status = $${listParams.length}`;
  }
  const totalItems = filters.status ? statusCounts[filters.status.toLowerCase()] : statusCounts.all;

  const page = Number.isInteger(filters.page) && filters.page >= 0 ? filters.page : 0;
  const size = Number.isInteger(filters.size) && filters.size > 0 ? Math.min(filters.size, 100) : 20;
  listParams.push(size, page * size);

  const { rows } = await pool.query(
    `WITH ${SIGNUPS_CTE}
     SELECT s.tenant_type, s.tenant_id, s.tenant_name, s.owner_email, s.owner_user_id, s.signed_up_at, s.source, s.plan_status,
            s.email_verified, rc.code,
            CASE WHEN s.tenant_type = 'FIRM' THEN
              (SELECT COUNT(DISTINCT u2.id)::int
                 FROM users u2
                WHERE u2.is_active = TRUE
                  AND (u2.id = s.plan_user_id
                       OR u2.id IN (SELECT fu.user_id FROM firm_users fu WHERE fu.firm_id = s.firm_id)))
            ELSE
              (SELECT COUNT(*)::int FROM users u3 WHERE u3.id = s.plan_user_id AND u3.is_active = TRUE)
            END AS seats
     ${from} ${whereSql}${statusSql}
     ORDER BY s.signed_up_at DESC, s.tenant_id
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  const items = rows.map((r) => ({
    tenantType: r.tenant_type,
    tenantId: r.tenant_id,
    firmName: r.tenant_name,
    ownerEmail: r.owner_user_id ? r.owner_email : null,
    ownerAccountDeleted: !r.owner_user_id,
    signedUpAt: ts(r.signed_up_at),
    code: r.code ?? null,
    planStatus: r.plan_status,
    seats: num(r.seats),
    emailVerified: Boolean(r.email_verified),
    source: r.source,
  }));

  return {
    scope,
    filters: {
      from: filters.from || null, to: filters.to || null, status: filters.status || null, search: filters.search || null,
      source: filters.source || null, tenantType: filters.tenantType || null,
    },
    statusCounts,
    items,
    page,
    size,
    totalItems,
    totalPages: Math.ceil(totalItems / size),
  };
}

module.exports = {
  OWNER_SORTS,
  SIGNUP_STATUSES,
  TENANT_TYPES,
  SIGNUP_SOURCES,
  SIGNUPS_CTE,
  freePlanNames,
  trackingSince,
  paidPercent,
  summary,
  ownersTable,
  ownerCodes,
  signups,
};

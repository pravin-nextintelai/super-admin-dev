/**
 * Onboarded users + subscription history — controllers.
 *
 *   GET /api/admin/onboarded-users/summary     totals by channel / sales owner / plan / account type
 *   GET /api/admin/onboarded-users/meta        channels, owners, codes, plans (for filters)
 *   GET /api/admin/onboarded-users             paginated users with onboarding + plan + subscription summary
 *   GET /api/admin/onboarded-users/export      CSV: mode=users (one row per user) | history (one row per event)
 *   GET /api/admin/onboarded-users/:userId     one user with the complete subscription history + timeline
 *
 * Auth DB (pool) for users / workspaces / referrals; Payment DB (payPool) for subscriptions,
 * payments, top-ups, storage add-ons. Timestamps: UTC ISO + `*_ist`.
 */
const Joi = require('joi');
const logger = require('../config/logger');
const { logPortalFlow } = require('../utils/portalAdminLog');
const { CSV_BOM, csvHeader, csvRow } = require('../utils/csv');
const { formatIST, IST_TIMEZONE } = require('../utils/time');
const svc = require('../services/onboardedUsersService');

const LAYER = 'ONBOARDED_USERS';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 50000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fail(req, res, statusCode, code, message, details) {
  const body = { success: false, error: { code, message }, requestId: req.requestId };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}
function validate(schema, data) {
  const { error, value } = schema.validate(data || {}, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) return { error: error.details.map((d) => d.message) };
  return { value };
}
function csv(raw, { upper = false } = {}) {
  if (raw === undefined || raw === null || raw === '') return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(parts.map((s) => String(s).trim()).filter(Boolean).map((s) => (upper ? s.toUpperCase() : s)))];
}
function serverError(req, res, message, err) {
  logger.errorWithContext(message, err, { requestId: req.requestId, layer: LAYER });
  return fail(req, res, 500, 'INTERNAL_ERROR', message);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const boolish = () => Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false');
const dateStr = (label) => Joi.string().trim().pattern(DATE_RE).messages({ 'string.pattern.base': `"${label}" must be YYYY-MM-DD (IST calendar date)` });

const filterFields = {
  channel: Joi.string().trim().max(200).allow(''), // csv: self, internal, outsourced (alias agency)
  owner_id: Joi.string().trim().max(500).allow(''), // csv of sales_owners.id (uuid)
  code: Joi.string().trim().max(500).allow(''), // csv of referral codes
  source: Joi.string().trim().max(100).allow(''), // csv: SIGNUP, ADMIN
  account_type: Joi.string().trim().max(200).allow(''), // csv: SOLO, FIRM_ADMIN, FIRM_USER
  approval_status: Joi.string().trim().max(200).allow(''),
  plan_status: Joi.string().trim().max(100).allow(''), // csv: PAID, LAPSED, FREE
  plan: Joi.string().trim().max(500).allow(''), // csv of active_plan_name values
  active: boolish(),
  has_payments: boolish(),
  has_subscription: boolish(),
  min_total_paid: Joi.number().min(0),
  firm_id: Joi.string().trim().pattern(UUID_RE).allow('').messages({ 'string.pattern.base': '"firm_id" must be a UUID' }),
  search: Joi.string().trim().max(200).allow(''),
  q: Joi.string().trim().max(200).allow(''),
  from: dateStr('from'),
  to: dateStr('to'),
};

const listSchema = Joi.object({
  ...filterFields,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
  page_size: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
  sort: Joi.string().trim().lowercase().valid(...svc.SORT_OPTIONS).default('newest'),
});

const exportSchema = Joi.object({
  ...filterFields,
  sort: Joi.string().trim().lowercase().valid(...svc.SORT_OPTIONS).default('newest'),
  mode: Joi.string().trim().lowercase().valid('users', 'history').default('users'),
});

const summarySchema = Joi.object({ ...filterFields });

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * @param {import('pg').Pool} pool     Auth / Main DB
 * @param {import('pg').Pool} payPool  Payment DB
 */
function makeControllers(pool, payPool) {
  function resolveFilters(q) {
    const channels = csv(q.channel).map(svc.normalizeChannel);
    const bad = channels.filter((c) => !svc.CHANNELS.includes(c));
    if (bad.length) return { error: [`Unknown channel "${bad.join('", "')}". Allowed: self, internal, outsourced (alias agency)`] };
    const ownerIds = csv(q.owner_id);
    const badOwner = ownerIds.filter((o) => !UUID_RE.test(o));
    if (badOwner.length) return { error: ['"owner_id" must be a comma-separated list of UUIDs'] };
    const planStatuses = csv(q.plan_status, { upper: true });
    const badStatus = planStatuses.filter((s) => !svc.PLAN_STATUSES.includes(s));
    if (badStatus.length) return { error: [`Unknown plan_status "${badStatus.join('", "')}". Allowed: ${svc.PLAN_STATUSES.join(', ')}`] };
    if (q.from && q.to && q.from > q.to) return { error: ['"from" must be on or before "to"'] };

    const sql = {
      channels,
      owner_ids: ownerIds,
      codes: csv(q.code, { upper: true }),
      sources: csv(q.source, { upper: true }),
      account_types: csv(q.account_type, { upper: true }),
      approval_statuses: csv(q.approval_status, { upper: true }),
      plan_names: csv(q.plan),
      active: typeof q.active === 'boolean' ? q.active : undefined,
      firm_id: q.firm_id || undefined,
      search: q.search || q.q || undefined,
      from: q.from,
      to: q.to,
    };
    const node = {
      plan_statuses: planStatuses,
      has_payments: typeof q.has_payments === 'boolean' ? q.has_payments : undefined,
      has_subscription: typeof q.has_subscription === 'boolean' ? q.has_subscription : undefined,
      min_total_paid: q.min_total_paid,
    };
    const applied = {
      channel: channels.length ? channels : 'all',
      owner_id: ownerIds.length ? ownerIds : 'all',
      code: sql.codes.length ? sql.codes : 'all',
      source: sql.sources.length ? sql.sources : 'all',
      account_type: sql.account_types.length ? sql.account_types : 'all',
      approval_status: sql.approval_statuses.length ? sql.approval_statuses : 'all',
      plan: sql.plan_names.length ? sql.plan_names : 'all',
      plan_status: planStatuses.length ? planStatuses : 'all',
      active: sql.active ?? null,
      has_payments: node.has_payments ?? null,
      has_subscription: node.has_subscription ?? null,
      min_total_paid: node.min_total_paid ?? null,
      firm_id: sql.firm_id || null,
      search: sql.search || null,
      from: sql.from || null,
      to: sql.to || null,
      timezone: IST_TIMEZONE,
    };
    return { sql, node, applied };
  }

  /** Users matching the filters, fully serialized and sorted (Payment-DB aggregates merged in). */
  async function loadUsers(f, sort, now) {
    const { rows, truncated } = await svc.fetchUsers(pool, f.sql);
    const aggregates = await svc.fetchPaymentAggregates(payPool, rows.map((r) => r.id));
    const users = rows.map((r) => svc.serializeUser(r, aggregates.get(Number(r.id)), { now }));
    return { users: svc.sortUsers(svc.applyNodeFilters(users, f.node), sort), truncated };
  }

  // GET /
  const listUsers = async (req, res) => {
    try {
      const { error, value: q } = validate(listSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);

      const now = new Date();
      const limit = q.limit || q.page_size || DEFAULT_PAGE_SIZE;
      const { users, truncated } = await loadUsers(f, q.sort, now);
      const total = users.length;
      const page = users.slice((q.page - 1) * limit, q.page * limit);

      logPortalFlow(req, 'Onboarded users list loaded', {
        layer: LAYER,
        summary: { total, page: q.page, limit, returned: page.length, sort: q.sort, ...f.applied },
        table: page.slice(0, 8).map((u) => ({ id: u.id, email: u.email, channel: u.onboarding.channel, owner: u.onboarding.sales_owner?.name, plan: u.plan.active_plan_name, status: u.plan.status, paid: u.subscription_summary.total_paid })),
      });
      return res.json({
        success: true,
        data: {
          users: page,
          pagination: { page: q.page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
          filters: { ...f.applied, sort: q.sort },
          summary: svc.summarize(users).totals,
          truncated,
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load onboarded users', err);
    }
  };

  // GET /summary
  const getSummary = async (req, res) => {
    try {
      const { error, value: q } = validate(summarySchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);

      const now = new Date();
      const { users, truncated } = await loadUsers(f, 'newest', now);
      const s = svc.summarize(users);
      logPortalFlow(req, 'Onboarded users summary loaded', { layer: LAYER, summary: { users: s.totals.users, paid: s.totals.paid, totalPaid: s.totals.total_paid, ...f.applied } });
      return res.json({
        success: true,
        data: { timezone: IST_TIMEZONE, generated_at: now.toISOString(), generated_at_ist: formatIST(now), filters: f.applied, truncated, ...s },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load onboarded users summary', err);
    }
  };

  // GET /meta
  const getMeta = async (req, res) => {
    try {
      const m = await svc.getMeta(pool, payPool);
      return res.json({ success: true, data: { timezone: IST_TIMEZONE, ...m, limits: { max_page_size: MAX_PAGE_SIZE, max_export_rows: MAX_EXPORT_ROWS, max_users: svc.MAX_USERS } } });
    } catch (err) {
      return serverError(req, res, 'Failed to load onboarded users metadata', err);
    }
  };

  // GET /:userId
  const getUser = async (req, res) => {
    try {
      const userId = Number.parseInt(req.params.userId, 10);
      if (!Number.isInteger(userId) || userId <= 0) return fail(req, res, 400, 'VALIDATION_ERROR', 'userId must be a positive integer');

      const row = await svc.fetchUserById(pool, userId);
      if (!row) return fail(req, res, 404, 'NOT_FOUND', 'User not found');

      const now = new Date();
      const [aggregates, history, referralHistory] = await Promise.all([
        svc.fetchPaymentAggregates(payPool, [userId]),
        svc.fetchPaymentHistory(payPool, userId),
        svc.fetchReferralHistory(pool, row),
      ]);
      const user = svc.serializeUser(row, aggregates.get(userId), { now });
      const h = {
        subscriptions: history.subscriptions.map(svc.serializeSubscription),
        payments: history.payments.map(svc.serializePayment),
        topups: history.topups.map(svc.serializeTopup),
        storage_addons: history.storage_addons.map(svc.serializeStorageAddon),
      };

      logPortalFlow(req, 'Onboarded user detail loaded', {
        layer: LAYER,
        summary: { userId, email: user.email, channel: user.onboarding.channel, status: user.plan.status, subscriptions: h.subscriptions.length, payments: h.payments.length, totalPaid: user.subscription_summary.total_paid },
      });
      return res.json({
        success: true,
        data: {
          user,
          subscription_history: h,
          storage: svc.serializeStorage(history.storage),
          referral_history: referralHistory,
          timeline: svc.buildTimeline(user, h),
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load onboarded user', err);
    }
  };

  // GET /export?mode=users|history
  const exportCsv = async (req, res) => {
    try {
      const { error, value: q } = validate(exportSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);

      const now = new Date();
      const { users } = await loadUsers(f, q.sort, now);

      const userColumns = [
        { header: 'User id', key: 'id' },
        { header: 'Email', key: 'email' },
        { header: 'Name', key: 'username' },
        { header: 'Phone', key: 'phone' },
        { header: 'Account type', key: 'account_type' },
        { header: 'Role', key: 'domain_role' },
        { header: 'Approval status', key: 'approval_status' },
        { header: 'Active', get: (u) => (u.is_active && !u.is_blocked ? 'Yes' : 'No') },
        { header: 'Onboarded (IST)', get: (u) => u.created_at_ist?.display || '' },
        { header: 'Onboarded date (IST)', get: (u) => u.created_at_ist?.iso.slice(0, 10) || '' },
        { header: 'Last login (IST)', get: (u) => u.last_login_at_ist?.display || '' },
        { header: 'Workspace', get: (u) => u.workspace?.name || '' },
        { header: 'Workspace type', get: (u) => u.workspace?.type || '' },
        { header: 'Workspace role', get: (u) => u.workspace?.member_role || '' },
        { header: 'Organisation', get: (u) => u.profile.organization_name || '' },
        { header: 'Onboarding channel', get: (u) => u.onboarding.channel },
        { header: 'Channel label', get: (u) => u.onboarding.channel_label },
        { header: 'Referral level', get: (u) => u.onboarding.level || '' },
        { header: 'Referral source', get: (u) => u.onboarding.source || '' },
        { header: 'Referral code', get: (u) => u.onboarding.referral_code || '' },
        { header: 'Code label', get: (u) => u.onboarding.referral_label || '' },
        { header: 'Sales owner', get: (u) => u.onboarding.sales_owner?.name || '' },
        { header: 'Owner type', get: (u) => (u.onboarding.sales_owner ? (u.onboarding.sales_owner.internal ? 'Internal' : 'Outsourced') : '') },
        { header: 'Referral signed up (IST)', get: (u) => u.onboarding.signed_up_at_ist?.display || '' },
        { header: 'Plan status', get: (u) => u.plan.status },
        { header: 'Active plan', get: (u) => u.plan.active_plan_name || '' },
        { header: 'Plan updated (IST)', get: (u) => u.plan.active_plan_updated_at_ist?.display || '' },
        { header: 'Current subscription plan', get: (u) => u.plan.current_subscription?.plan_name || '' },
        { header: 'Current subscription status', get: (u) => u.plan.current_subscription?.status || '' },
        { header: 'Current subscription start (IST)', get: (u) => u.plan.current_subscription?.start_date_ist?.display || '' },
        { header: 'Current subscription end (IST)', get: (u) => u.plan.current_subscription?.end_date_ist?.display || '' },
        { header: 'Subscriptions', get: (u) => u.subscription_summary.subscriptions },
        { header: 'Active subscriptions', get: (u) => u.subscription_summary.active_subscriptions },
        { header: 'Plans used', get: (u) => u.subscription_summary.plan_names.join('; ') },
        { header: 'First subscribed (IST)', get: (u) => u.subscription_summary.first_subscribed_at_ist?.display || '' },
        { header: 'Last subscribed (IST)', get: (u) => u.subscription_summary.last_subscribed_at_ist?.display || '' },
        { header: 'Payments (captured)', get: (u) => u.subscription_summary.captured_payments },
        { header: 'Subscription paid', get: (u) => u.subscription_summary.subscription_paid },
        { header: 'Top-ups (completed)', get: (u) => u.subscription_summary.completed_topups },
        { header: 'Top-up paid', get: (u) => u.subscription_summary.topup_paid },
        { header: 'Tokens credited', get: (u) => u.subscription_summary.tokens_credited },
        { header: 'Storage add-ons (completed)', get: (u) => u.subscription_summary.completed_storage_addons },
        { header: 'Storage paid', get: (u) => u.subscription_summary.storage_paid },
        { header: 'Total paid', get: (u) => u.subscription_summary.total_paid },
        { header: 'Currency', get: (u) => u.subscription_summary.currency },
        { header: 'First payment (IST)', get: (u) => u.subscription_summary.first_payment_at_ist?.display || '' },
        { header: 'Last payment (IST)', get: (u) => u.subscription_summary.last_payment_at_ist?.display || '' },
        { header: 'Last payment amount', get: (u) => u.subscription_summary.last_payment_amount ?? '' },
        { header: 'Razorpay customer id', key: 'razorpay_customer_id' },
        { header: 'Onboarded (UTC)', key: 'created_at' },
      ];

      const stamp = formatIST(now);
      let fileName;
      let out;
      let exported;

      if (q.mode === 'history') {
        // One row per subscription / payment / top-up / storage add-on event, user columns repeated.
        const eventColumns = [
          { header: 'User id', get: (e) => e.user.id },
          { header: 'Email', get: (e) => e.user.email },
          { header: 'Name', get: (e) => e.user.username || '' },
          { header: 'Onboarding channel', get: (e) => e.user.onboarding.channel },
          { header: 'Sales owner', get: (e) => e.user.onboarding.sales_owner?.name || '' },
          { header: 'Referral code', get: (e) => e.user.onboarding.referral_code || '' },
          { header: 'Workspace', get: (e) => e.user.workspace?.name || '' },
          { header: 'Event (IST)', get: (e) => e.at_ist?.display || '' },
          { header: 'Event date (IST)', get: (e) => e.at_ist?.iso.slice(0, 10) || '' },
          { header: 'Event type', get: (e) => e.type },
          { header: 'Title', get: (e) => e.title },
          { header: 'Detail', get: (e) => e.detail || '' },
          { header: 'Status', get: (e) => e.status || '' },
          { header: 'Amount', get: (e) => (e.amount == null ? '' : e.amount) },
          { header: 'Currency', get: (e) => e.currency || '' },
          { header: 'Reference id', get: (e) => e.ref_id ?? '' },
          { header: 'Event (UTC)', get: (e) => e.at },
        ];
        const events = [];
        for (const u of users) {
          if (events.length >= MAX_EXPORT_ROWS) break;
          const hist = await svc.fetchPaymentHistory(payPool, u.id);
          const h = {
            subscriptions: hist.subscriptions.map(svc.serializeSubscription),
            payments: hist.payments.map(svc.serializePayment),
            topups: hist.topups.map(svc.serializeTopup),
            storage_addons: hist.storage_addons.map(svc.serializeStorageAddon),
          };
          for (const e of svc.buildTimeline(u, h)) events.push({ ...e, user: u });
        }
        const rows = events.slice(0, MAX_EXPORT_ROWS);
        fileName = `onboarded-users-history-${stamp.iso.slice(0, 10)}-${stamp.time24.replace(':', '')}-IST.csv`;
        out = CSV_BOM + csvHeader(eventColumns);
        for (const e of rows) out += csvRow(eventColumns, e);
        exported = rows.length;
        res.setHeader('X-Total-Rows', String(events.length));
      } else {
        const rows = users.slice(0, MAX_EXPORT_ROWS);
        fileName = `onboarded-users-${stamp.iso.slice(0, 10)}-${stamp.time24.replace(':', '')}-IST.csv`;
        out = CSV_BOM + csvHeader(userColumns);
        for (const u of rows) out += csvRow(userColumns, u);
        exported = rows.length;
        res.setHeader('X-Total-Rows', String(users.length));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Exported-Rows', String(exported));
      logPortalFlow(req, 'Onboarded users exported to CSV', { layer: LAYER, summary: { mode: q.mode, exported, users: users.length, fileName, ...f.applied } });
      return res.send(out);
    } catch (err) {
      return serverError(req, res, 'Failed to export onboarded users', err);
    }
  };

  return { listUsers, getSummary, getMeta, getUser, exportCsv };
}

module.exports = { makeControllers };

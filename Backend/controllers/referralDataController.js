/**
 * "All referral data" (Sales Referrals → All referral data screen) — controllers.
 *
 *   GET /api/admin/sales-referrals/data/summary          stat cards + by owner type / owner
 *   GET /api/admin/sales-referrals/data/workspaces       one row per account (workspace or solo user)
 *   GET /api/admin/sales-referrals/data/workspaces/:id   one account + seats + full plan history
 *   GET /api/admin/sales-referrals/data/purchases        one row per paid event across accounts
 *   GET /api/admin/sales-referrals/data/export           CSV: kind=workspaces|history, scope=filtered|all, columns=…
 *
 * Filters (all endpoints): owner_id, code, type (internal|outsourced|all), status (PAID|LAPSED|FREE),
 * include_direct (default true), source (SIGNUP|ADMIN), kind (workspace|user), q, from, to (IST days on signup).
 */
const Joi = require('joi');
const logger = require('../config/logger');
const { logPortalFlow } = require('../utils/portalAdminLog');
const { CSV_BOM, csvHeader, csvRow } = require('../utils/csv');
const { formatIST, IST_TIMEZONE } = require('../utils/time');
const svc = require('../services/referralDataService');

const LAYER = 'REFERRAL_DATA';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 50000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
const boolish = () => Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false');
const dateStr = (l) => Joi.string().trim().pattern(DATE_RE).messages({ 'string.pattern.base': `"${l}" must be YYYY-MM-DD (IST calendar date)` });

const filterFields = {
  owner_id: Joi.string().trim().max(500).allow(''),
  code: Joi.string().trim().max(500).allow(''),
  type: Joi.string().trim().max(20).allow(''),
  status: Joi.string().trim().max(100).allow(''),
  include_direct: boolish().default(true),
  source: Joi.string().trim().max(50).allow(''),
  kind: Joi.string().trim().max(50).allow(''),
  q: Joi.string().trim().max(200).allow(''),
  search: Joi.string().trim().max(200).allow(''),
  from: dateStr('from'),
  to: dateStr('to'),
};
const listSchema = Joi.object({
  ...filterFields,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
  page_size: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
  sort: Joi.string().trim().lowercase().valid(...svc.SORT_OPTIONS).default('newest'),
  include_history: boolish().default(false),
});
const purchasesSchema = Joi.object({
  ...filterFields,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
  page_size: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
  event: Joi.string().trim().max(200).allow(''), // csv of kinds: purchase, upgrade, renewal, topup, storage_addon
});
const exportSchema = Joi.object({
  ...filterFields,
  kind_export: Joi.any().strip(),
  export: Joi.string().trim().lowercase().valid('workspaces', 'history').default('workspaces'),
  scope: Joi.string().trim().lowercase().valid('filtered', 'all').default('filtered'),
  columns: Joi.string().trim().max(2000).allow(''),
  sort: Joi.string().trim().lowercase().valid(...svc.SORT_OPTIONS).default('newest'),
});
const summarySchema = Joi.object({ ...filterFields });

// CSV column catalogues (keys are what `columns=` accepts)
const WS_COLUMNS = [
  ['account_id', 'Account id', (a) => a.id],
  ['kind', 'Kind', (a) => a.kind],
  ['workspace', 'Workspace / user', (a) => a.name],
  ['firm_type', 'Workspace type', (a) => a.firm_type || ''],
  ['primary_user', 'Primary user', (a) => a.primary_user?.name || ''],
  ['email', 'Email', (a) => a.primary_user?.email || ''],
  ['phone', 'Phone', (a) => a.primary_user?.phone || ''],
  ['verified', 'Verified', (a) => (a.verified ? 'Yes' : 'No')],
  ['seats', 'Seats', (a) => a.seats],
  ['signup_date', 'Signup date (IST)', (a) => a.signed_up_at_ist?.display || ''],
  ['owner', 'Sales owner', (a) => a.sales_owner?.name || 'Direct'],
  ['owner_type', 'Owner type', (a) => (a.owner_type === 'DIRECT' ? 'Direct' : a.owner_type === 'INTERNAL' ? 'Internal' : 'Outsourced')],
  ['code', 'Code', (a) => a.code?.code || ''],
  ['code_label', 'Code label', (a) => a.code?.label || ''],
  ['attribution', 'Attribution', (a) => a.attribution.source],
  ['attributed_by', 'Attributed by', (a) => a.attribution.set_by?.name || a.attribution.set_by?.email || ''],
  ['attribution_reason', 'Attribution reason', (a) => a.attribution.reason || ''],
  ['status', 'Plan status', (a) => a.status],
  ['current_plan', 'Current plan', (a) => a.current_plan.display],
  ['plan_end', 'Plan ends (IST)', (a) => a.current_plan.end_date_ist?.display || ''],
  ['purchases', 'Purchases', (a) => a.purchases],
  ['total_paid', 'Total paid', (a) => a.total_paid],
  ['subscription_paid', 'Subscription paid', (a) => a.subscription_paid],
  ['topup_paid', 'Top-up paid', (a) => a.topup_paid],
  ['storage_paid', 'Storage paid', (a) => a.storage_paid],
  ['currency', 'Currency', (a) => a.currency],
  ['first_purchase', 'First purchase (IST)', (a) => a.first_purchase_at_ist?.display || ''],
  ['last_purchase', 'Last purchase (IST)', (a) => a.last_purchase_at_ist?.display || ''],
  ['signup_utc', 'Signup (UTC)', (a) => a.signed_up_at],
];
const HIST_COLUMNS = [
  ['date', 'Date (IST)', (e) => e.at_ist?.display || ''],
  ['account_id', 'Account id', (e) => e.account.id],
  ['workspace', 'Workspace / user', (e) => e.account.name],
  ['email', 'User email', (e) => e.user_email || e.account.primary_user?.email || ''],
  ['owner', 'Sales owner', (e) => e.account.sales_owner?.name || 'Direct'],
  ['owner_type', 'Owner type', (e) => (e.account.owner_type === 'DIRECT' ? 'Direct' : e.account.owner_type === 'INTERNAL' ? 'Internal' : 'Outsourced')],
  ['code', 'Code', (e) => e.account.code?.code || ''],
  ['event', 'Event', (e) => e.title],
  ['kind', 'Event kind', (e) => e.kind],
  ['plan', 'Plan', (e) => e.plan || ''],
  ['billing', 'Billing', (e) => e.billing || ''],
  ['amount', 'Amount', (e) => e.amount],
  ['currency', 'Currency', (e) => e.currency || ''],
  ['payment_id', 'Payment ID', (e) => e.payment_id || ''],
  ['status', 'Status', (e) => e.status || ''],
  ['note', 'Note', (e) => e.note || ''],
  ['date_utc', 'Date (UTC)', (e) => e.at],
];

function makeControllers(pool, payPool) {
  function resolveFilters(q) {
    const type = q.type && q.type.toLowerCase() !== 'all' ? svc.normalizeType(q.type) : undefined;
    if (type && !svc.OWNER_TYPES.includes(type)) return { error: [`Unknown type "${q.type}". Allowed: all, internal, outsourced`] };
    const statuses = csv(q.status, { upper: true }).filter((s) => s !== 'ALL');
    const badStatus = statuses.filter((s) => !svc.STATUSES.includes(s));
    if (badStatus.length) return { error: [`Unknown status "${badStatus.join('", "')}". Allowed: ${svc.STATUSES.join(', ')}`] };
    const ownerIds = csv(q.owner_id);
    if (ownerIds.some((o) => !UUID_RE.test(o))) return { error: ['"owner_id" must be a comma-separated list of UUIDs'] };
    if (q.from && q.to && q.from > q.to) return { error: ['"from" must be on or before "to"'] };
    const sql = {
      owner_ids: ownerIds, codes: csv(q.code, { upper: true }), type, include_direct: q.include_direct !== false,
      sources: csv(q.source, { upper: true }), kinds: csv(q.kind).map((k) => k.toLowerCase()), search: q.q || q.search || undefined, from: q.from, to: q.to,
    };
    const applied = {
      owner_id: ownerIds.length ? ownerIds : 'all', code: sql.codes.length ? sql.codes : 'all', type: type || 'all', status: statuses.length ? statuses : 'all',
      include_direct: sql.include_direct, source: sql.sources.length ? sql.sources : 'all', kind: sql.kinds.length ? sql.kinds : 'all',
      q: sql.search || null, from: q.from || null, to: q.to || null, timezone: IST_TIMEZONE,
    };
    return { sql, statuses, applied };
  }

  /** Accounts matching the filters, serialized (Payment-DB aggregates merged), status-filtered. */
  async function loadAccounts(f) {
    const { rows, truncated } = await svc.fetchAccounts(pool, f.sql);
    const allIds = [...new Set(rows.flatMap((r) => (r.seat_user_ids || []).filter((x) => x != null).map(Number)))];
    const [aggMap, plans] = await Promise.all([
      svc.fetchPaymentAggregates(payPool, allIds),
      allIds.length ? pool.query(`SELECT id, active_plan_name FROM users WHERE id = ANY($1::int[])`, [allIds]) : Promise.resolve({ rows: [] }),
    ]);
    const planOf = new Map(plans.rows.map((r) => [Number(r.id), r.active_plan_name]));
    const accounts = rows.map((r) => svc.serializeAccount(r, aggMap, { seatPlans: (r.seat_user_ids || []).filter((x) => x != null).map((id) => planOf.get(Number(id))) }));
    return { accounts: svc.applyStatusFilter(accounts, f.statuses), truncated };
  }

  async function historiesFor(account) {
    const out = [];
    for (const uid of account.seat_user_ids) {
      const h = await svc.fetchPaymentHistory(payPool, uid);
      out.push({ userId: uid, email: null, h: { subscriptions: h.subscriptions.map(svc.serializers.subscription), payments: h.payments.map(svc.serializers.payment), topups: h.topups.map(svc.serializers.topup), storage_addons: h.storage_addons.map(svc.serializers.storage_addon) } });
    }
    return out;
  }

  // GET /workspaces
  const listWorkspaces = async (req, res) => {
    try {
      const { error, value: q } = validate(listSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);
      const limit = q.limit || q.page_size || DEFAULT_PAGE_SIZE;
      const { accounts, truncated } = await loadAccounts(f);
      const sorted = svc.sortAccounts(accounts, q.sort);
      const page = sorted.slice((q.page - 1) * limit, q.page * limit);
      if (q.include_history) for (const a of page) a.events = svc.buildEvents({ ...a, signed_up_at: a.signed_up_at, admin_plan_name: a.current_plan.name, code_id: a.code ? 1 : null, referral_code: a.code?.code, user_id: a.primary_user?.id, user_email: a.primary_user?.email }, await historiesFor(a));
      logPortalFlow(req, 'Referral data: workspaces loaded', { layer: LAYER, summary: { total: sorted.length, page: q.page, limit, returned: page.length, ...f.applied } });
      return res.json({ success: true, data: { rows: page, pagination: { page: q.page, limit, total: sorted.length, totalPages: Math.max(1, Math.ceil(sorted.length / limit)) }, filters: { ...f.applied, sort: q.sort }, summary: svc.summarize(accounts).totals, truncated, timezone: IST_TIMEZONE } });
    } catch (err) {
      return serverError(req, res, 'Failed to load referral data', err);
    }
  };

  // GET /workspaces/:id
  const getWorkspace = async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id || id.length > 64) return fail(req, res, 400, 'VALIDATION_ERROR', 'id must be a workspace UUID or a user id');
      const row = await svc.fetchAccountById(pool, id);
      if (!row) return fail(req, res, 404, 'NOT_FOUND', 'Account not found');
      const seatIds = (row.seat_user_ids || []).filter((x) => x != null).map(Number);
      const [aggMap, seats] = await Promise.all([svc.fetchPaymentAggregates(payPool, seatIds), svc.fetchSeats(pool, row)]);
      const account = svc.serializeAccount(row, aggMap, { seatPlans: seats.map((s) => s.active_plan_name) });
      const hists = await historiesFor(account);
      for (const h of hists) h.email = seats.find((s) => s.id === h.userId)?.email || null;
      const events = svc.buildEvents({ ...row, referral_code: row.referral_code }, hists);
      logPortalFlow(req, 'Referral data: account detail loaded', { layer: LAYER, summary: { id, name: account.name, kind: account.kind, status: account.status, events: events.length } });
      return res.json({ success: true, data: { account, seats, events, history: Object.fromEntries(hists.map((h) => [h.userId, h.h])), timezone: IST_TIMEZONE } });
    } catch (err) {
      return serverError(req, res, 'Failed to load account', err);
    }
  };

  async function allEvents(accounts, { paidOnly = true, kinds = [] } = {}) {
    const out = [];
    for (const a of accounts) {
      const ev = svc.buildEvents({ ...a, admin_plan_name: a.current_plan.name, code_id: a.code ? 1 : null, referral_code: a.code?.code, user_id: a.primary_user?.id, user_email: a.primary_user?.email }, await historiesFor(a));
      for (const e of ev) {
        if (paidOnly && !(e.amount > 0)) continue;
        if (kinds.length && !kinds.includes(e.kind)) continue;
        out.push({ ...e, account: { id: a.id, kind: a.kind, name: a.name, primary_user: a.primary_user, sales_owner: a.sales_owner, owner_type: a.owner_type, code: a.code } });
      }
    }
    return out.sort((x, y) => new Date(y.at) - new Date(x.at));
  }

  // GET /purchases
  const listPurchases = async (req, res) => {
    try {
      const { error, value: q } = validate(purchasesSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);
      const kinds = csv(q.event).map((k) => k.toLowerCase());
      const bad = kinds.filter((k) => !svc.EVENT_KINDS.includes(k));
      if (bad.length) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', [`Unknown event "${bad.join('", "')}". Allowed: ${svc.EVENT_KINDS.join(', ')}`]);
      const limit = q.limit || q.page_size || DEFAULT_PAGE_SIZE;
      const { accounts, truncated } = await loadAccounts(f);
      const events = await allEvents(accounts, { paidOnly: true, kinds });
      const page = events.slice((q.page - 1) * limit, q.page * limit);
      const total_amount = events.reduce((n, e) => n + Number(e.amount || 0), 0);
      logPortalFlow(req, 'Referral data: purchases loaded', { layer: LAYER, summary: { total: events.length, page: q.page, limit, totalAmount: total_amount, ...f.applied } });
      return res.json({ success: true, data: { rows: page, pagination: { page: q.page, limit, total: events.length, totalPages: Math.max(1, Math.ceil(events.length / limit)) }, totals: { events: events.length, amount: Math.round(total_amount * 100) / 100, accounts: new Set(events.map((e) => e.account.id)).size }, filters: { ...f.applied, event: kinds.length ? kinds : 'all' }, truncated, timezone: IST_TIMEZONE } });
    } catch (err) {
      return serverError(req, res, 'Failed to load purchases', err);
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
      const { accounts, truncated } = await loadAccounts(f);
      const s = svc.summarize(accounts);
      logPortalFlow(req, 'Referral data: summary loaded', { layer: LAYER, summary: { ...s.totals, ...f.applied } });
      return res.json({ success: true, data: { timezone: IST_TIMEZONE, generated_at: now.toISOString(), generated_at_ist: formatIST(now), filters: f.applied, truncated, ...s } });
    } catch (err) {
      return serverError(req, res, 'Failed to load referral data summary', err);
    }
  };

  // GET /export?export=workspaces|history&scope=filtered|all&columns=a,b,c
  const exportCsv = async (req, res) => {
    try {
      const { error, value: q } = validate(exportSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = q.scope === 'all' ? resolveFilters({ include_direct: true }) : resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);
      const catalogue = q.export === 'history' ? HIST_COLUMNS : WS_COLUMNS;
      const wanted = csv(q.columns).map((c) => c.toLowerCase());
      const unknown = wanted.filter((c) => !catalogue.some(([k]) => k === c));
      if (unknown.length) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', [`Unknown column "${unknown.join('", "')}". Allowed: ${catalogue.map(([k]) => k).join(', ')}`]);
      const columns = (wanted.length ? catalogue.filter(([k]) => wanted.includes(k)) : catalogue).map(([, header, get]) => ({ header, get }));

      const now = new Date();
      const stamp = formatIST(now);
      const { accounts } = await loadAccounts(f);
      const sorted = svc.sortAccounts(accounts, q.sort);
      let rows, fileName, total;
      if (q.export === 'history') {
        const events = await allEvents(sorted, { paidOnly: false });
        total = events.length; rows = events.slice(0, MAX_EXPORT_ROWS);
        fileName = `referral-plan-history-${stamp.iso.slice(0, 10)}-${stamp.time24.replace(':', '')}-IST.csv`;
      } else {
        total = sorted.length; rows = sorted.slice(0, MAX_EXPORT_ROWS);
        fileName = `referral-workspaces-${stamp.iso.slice(0, 10)}-${stamp.time24.replace(':', '')}-IST.csv`;
      }
      let out = CSV_BOM + csvHeader(columns);
      for (const r of rows) out += csvRow(columns, r);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Total-Rows', String(total));
      res.setHeader('X-Exported-Rows', String(rows.length));
      logPortalFlow(req, 'Referral data exported to CSV', { layer: LAYER, summary: { export: q.export, scope: q.scope, columns: columns.length, exported: rows.length, total, fileName, ...f.applied } });
      return res.send(out);
    } catch (err) {
      return serverError(req, res, 'Failed to export referral data', err);
    }
  };

  // GET /columns — catalogue for the export dialog
  const getColumns = (req, res) =>
    res.json({ success: true, data: { workspaces: WS_COLUMNS.map(([key, header]) => ({ key, header })), history: HIST_COLUMNS.map(([key, header]) => ({ key, header })), event_kinds: svc.EVENT_KINDS, statuses: svc.STATUSES, owner_types: svc.OWNER_TYPES, sort_options: svc.SORT_OPTIONS, limits: { max_page_size: MAX_PAGE_SIZE, max_export_rows: MAX_EXPORT_ROWS } } });

  return { listWorkspaces, getWorkspace, listPurchases, getSummary, exportCsv, getColumns };
}

module.exports = { makeControllers };

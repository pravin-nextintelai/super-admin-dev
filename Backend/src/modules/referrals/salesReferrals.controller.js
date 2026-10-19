/**
 * Sales Referrals — super-admin controllers.
 * Mounted at /api/admin/sales-referrals (alias /api/v1/admin/sales-referrals). See docs/sales-referrals-admin-api.md.
 *
 *   A1  POST   /owners                            create owner with 1–10 codes
 *   A2  PUT    /owners/:ownerId                   update owner
 *   A3  GET    /owners/:ownerId                   owner + all codes
 *   A4  POST   /owners/:ownerId/codes             add a code
 *   A5  PATCH  /codes/:codeId                     edit label
 *   A6  POST   /codes/:codeId/deactivate
 *   A7  POST   /codes/:codeId/activate
 *   A8  POST   /codes/:codeId/refresh
 *   A9  GET    /codes/suggest
 *   A10 GET    /codes/availability
 *   A11 GET    /codes                             picker search
 *   A12 GET    /reports/summary
 *   A13 GET    /reports/owners
 *   A14 GET    /reports/owners/:ownerId/codes
 *   A15 GET    /reports/signups                 (+ source=, tenantType=FIRM|SOLO; items carry tenantType)
 *   A16 PUT    /tenants/:tenantId/referral      (:tenantId = firms.id uuid → FIRM, or users.id integer → SOLO)
 *   A17 GET    /tenants/:tenantId/referral, GET /users/:userId/referral   (referral block + tenantType)
 *
 * Envelope: { success: true, data } / { success: false, error: { code, message, details? }, requestId }.
 */
const Joi = require('joi');
const logger = require('../../config/logger');
const { logPortalFlow } = require('../../shared/utils/portalAdminLog');
const svc = require('./salesReferrals.service');
const reports = require('./referralReports.service');
const referralEmail = require('./referralEmail.service');

const LAYER = 'SALES_REFERRALS';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fail(req, res, statusCode, code, message, details) {
  const body = { success: false, error: { code, message }, requestId: req.requestId };
  if (details !== undefined && details !== null) body.error.details = details;
  return res.status(statusCode).json(body);
}

function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function validate(schema, data) {
  const { error, value } = schema.validate(data || {}, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    return {
      error: error.details.map((d) => ({ field: d.path.join('.') || null, message: d.message })),
    };
  }
  return { value };
}

function validationFailed(req, res, details) {
  return fail(req, res, 400, 'VALIDATION_FAILED', 'Invalid request', details);
}

function uuidParam(req, res, name) {
  const v = String(req.params[name] || '').trim();
  if (!UUID_RE.test(v)) {
    validationFailed(req, res, [{ field: name, message: `"${name}" must be a UUID` }]);
    return null;
  }
  return v.toLowerCase();
}

/** Tenant id of either shape: firms.id (uuid → FIRM) or users.id (integer → SOLO). */
function tenantIdParam(req, res, name = 'tenantId') {
  const key = svc.resolveTenantKey(req.params[name]);
  if (!key) {
    validationFailed(req, res, [{ field: name, message: `"${name}" must be a workspace UUID or a solo user id` }]);
    return null;
  }
  return String(key.id);
}

function intParam(req, res, name) {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) {
    validationFailed(req, res, [{ field: name, message: `"${name}" must be a positive integer` }]);
    return null;
  }
  return n;
}

/** Audit actor: super_admins.id for a dashboard JWT, null for the static ADMIN_TOKEN. */
function actorId(req) {
  const id = req.user && req.user.id != null ? Number(req.user.id) : null;
  return Number.isInteger(id) ? id : null;
}

function handleError(req, res, err, message) {
  if (err instanceof svc.ApiError) {
    logger.flow(`Sales referrals: ${err.code}`, {
      requestId: req.requestId,
      layer: LAYER,
      level: err.statusCode >= 500 ? 'error' : 'warn',
      summary: { code: err.code, status: err.statusCode, path: req.originalUrl, details: err.details || null },
    });
    return fail(req, res, err.statusCode, err.code, err.message, err.details);
  }
  if (err && err.code === '42P01') {
    logger.errorWithContext('Sales referrals: tables missing in Auth DB', err, { requestId: req.requestId, layer: LAYER });
    return fail(req, res, 503, 'SALES_REFERRALS_TABLE_MISSING', 'Sales referral tables are not created yet. Run `npm run migrate:sales-referrals`.');
  }
  logger.errorWithContext(message, err, { requestId: req.requestId, layer: LAYER });
  return fail(req, res, 500, 'INTERNAL_ERROR', message);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const boolish = () => Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false');
const dateStr = (label) =>
  Joi.string().trim().pattern(DATE_RE).messages({ 'string.pattern.base': `"${label}" must be YYYY-MM-DD (IST calendar date)` });

const codeItemSchema = Joi.object({
  code: Joi.string().trim().min(1).max(40).required(),
  label: Joi.string().trim().max(60).allow('', null),
});

const ownerEmail = () => Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).allow('', null);
const emailCodeSchema = Joi.object({
  to: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).allow('', null),
});
const emailOwnerSchema = Joi.object({
  to: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).allow('', null),
  codeIds: Joi.array().items(Joi.string().trim().pattern(UUID_RE)).max(50),
});

const createOwnerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  internal: Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false').required(),
  email: ownerEmail(),
  notes: Joi.string().trim().max(1000).allow('', null),
  codes: Joi.array().items(codeItemSchema).required(),
});

const updateOwnerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  internal: Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false').required(),
  email: ownerEmail(),
  notes: Joi.string().trim().max(1000).allow('', null),
});

const addCodeSchema = Joi.object({
  code: Joi.string().trim().min(1).max(40).required(),
  label: Joi.string().trim().max(60).allow('', null),
});

const labelSchema = Joi.object({
  label: Joi.string().trim().max(60).allow('', null).required(),
});

const suggestSchema = Joi.object({
  ownerName: Joi.string().trim().min(1).max(100),
  ownerId: Joi.string().trim().pattern(UUID_RE).messages({ 'string.pattern.base': '"ownerId" must be a UUID' }),
  count: Joi.number().integer().min(1).max(10).default(1),
  exclude: Joi.string().trim().max(1000).allow(''),
}).xor('ownerName', 'ownerId');

const availabilitySchema = Joi.object({
  code: Joi.string().trim().min(1).max(40).required(),
});

const searchCodesSchema = Joi.object({
  search: Joi.string().trim().max(100).allow(''),
  includeInactive: boolish().default(true),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

const reportBase = {
  from: dateStr('from'),
  to: dateStr('to'),
};

const summarySchema = Joi.object({
  ...reportBase,
  type: Joi.string().trim().uppercase().valid('ALL', 'INTERNAL', 'OUTSOURCED').default('ALL'),
});

const ownersReportSchema = Joi.object({
  ...reportBase,
  type: Joi.string().trim().uppercase().valid('ALL', 'INTERNAL', 'OUTSOURCED').default('ALL'),
  search: Joi.string().trim().max(100).allow(''),
  sort: Joi.string().trim().valid(...reports.OWNER_SORTS).default('signups'),
  direction: Joi.string().trim().lowercase().valid('asc', 'desc').default('desc'),
});

const ownerCodesReportSchema = Joi.object({ ...reportBase });

const signupsSchema = Joi.object({
  ...reportBase,
  codeId: Joi.string().trim().pattern(UUID_RE).messages({ 'string.pattern.base': '"codeId" must be a UUID' }),
  ownerId: Joi.string().trim().pattern(UUID_RE).messages({ 'string.pattern.base': '"ownerId" must be a UUID' }),
  direct: boolish(),
  status: Joi.string().trim().uppercase().valid(...reports.SIGNUP_STATUSES).allow(''),
  source: Joi.string().trim().uppercase().valid(...reports.SIGNUP_SOURCES).allow(''),
  tenantType: Joi.string().trim().uppercase().valid(...reports.TENANT_TYPES).allow(''),
  search: Joi.string().trim().max(200).allow(''),
  page: Joi.number().integer().min(0).default(0),
  size: Joi.number().integer().min(1).max(100).default(20),
});

const setReferralSchema = Joi.object({
  codeId: Joi.string().trim().pattern(UUID_RE).required().messages({ 'string.pattern.base': '"codeId" must be a UUID' }),
  reason: Joi.string().trim().max(500).allow('').required(),
});

function checkDateRange(q) {
  if (q.from && q.to && q.from > q.to) return [{ field: 'to', message: '"to" must be on or after "from"' }];
  return null;
}

// ── Factory ──────────────────────────────────────────────────────────────────

/** @param {import('pg').Pool} pool Auth / Main DB */
function makeControllers(pool) {
  // A1
  const createOwner = async (req, res) => {
    const { error, value } = validate(createOwnerSchema, req.body);
    if (error) return validationFailed(req, res, error);
    try {
      const data = await svc.createOwner(pool, value, actorId(req));
      logPortalFlow(req, 'Sales referrals: owner created', { layer: LAYER, summary: { ownerId: data.id, name: data.name, codes: data.codes.length } });
      return ok(res, data, 201);
    } catch (err) {
      return handleError(req, res, err, 'Failed to create sales owner');
    }
  };

  // A2
  const updateOwner = async (req, res) => {
    const ownerId = uuidParam(req, res, 'ownerId');
    if (!ownerId) return undefined;
    const { error, value } = validate(updateOwnerSchema, req.body);
    if (error) return validationFailed(req, res, error);
    try {
      const data = await svc.updateOwner(pool, ownerId, value, actorId(req));
      logPortalFlow(req, 'Sales referrals: owner updated', { layer: LAYER, summary: { ownerId, name: data.name } });
      return ok(res, data);
    } catch (err) {
      return handleError(req, res, err, 'Failed to update sales owner');
    }
  };

  // A18 — email a code + signup link to the sales owner (templates/referral-code-email.html)
  const emailCode = async (req, res) => {
    const codeId = uuidParam(req, res, 'codeId');
    if (!codeId) return undefined;
    const { error, value } = validate(emailCodeSchema, req.body);
    if (error) return validationFailed(req, res, error);
    try {
      const actor = req.user ? { id: req.user.id, name: req.user.name || req.user.email || null, email: req.user.email || null } : null;
      const out = await referralEmail.sendReferralCodeEmail(pool, { codeId, to: value.to || null, actor });
      if (out.error) return fail(req, res, out.error.status, out.error.code, out.error.message);
      logPortalFlow(req, 'Sales referrals: code emailed', { layer: LAYER, summary: { codeId, code: out.data.code, to: out.data.to, status: out.data.status } });
      return ok(res, out.data);
    } catch (err) {
      logger.errorWithContext('Sales referrals: code email failed', err, { requestId: req.requestId, layer: LAYER, summary: { codeId } });
      return fail(req, res, 502, 'EMAIL_SEND_FAILED', `Could not send the email: ${err.message}`);
    }
  };

  // A19 — ONE email with all of the owner's (active) codes + links
  const emailOwnerCodes = async (req, res) => {
    const ownerId = uuidParam(req, res, 'ownerId');
    if (!ownerId) return undefined;
    const { error, value } = validate(emailOwnerSchema, req.body);
    if (error) return validationFailed(req, res, error);
    try {
      const actor = req.user ? { id: req.user.id, name: req.user.name || req.user.email || null, email: req.user.email || null } : null;
      const out = await referralEmail.sendOwnerCodesEmail(pool, { ownerId, codeIds: value.codeIds || null, to: value.to || null, actor });
      if (out.error) return fail(req, res, out.error.status, out.error.code, out.error.message);
      logPortalFlow(req, 'Sales referrals: owner codes emailed', { layer: LAYER, summary: { ownerId, count: out.data.count, to: out.data.to } });
      return ok(res, out.data);
    } catch (err) {
      logger.errorWithContext('Sales referrals: owner codes email failed', err, { requestId: req.requestId, layer: LAYER, summary: { ownerId } });
      return fail(req, res, 502, 'EMAIL_SEND_FAILED', `Could not send the email: ${err.message}`);
    }
  };

  // A3
  const getOwner = async (req, res) => {
    const ownerId = uuidParam(req, res, 'ownerId');
    if (!ownerId) return undefined;
    try {
      return ok(res, await svc.getOwner(pool, ownerId));
    } catch (err) {
      return handleError(req, res, err, 'Failed to load sales owner');
    }
  };

  // A4
  const addCode = async (req, res) => {
    const ownerId = uuidParam(req, res, 'ownerId');
    if (!ownerId) return undefined;
    const { error, value } = validate(addCodeSchema, req.body);
    if (error) return validationFailed(req, res, error);
    try {
      const data = await svc.addCode(pool, ownerId, value, actorId(req));
      logPortalFlow(req, 'Sales referrals: code added', { layer: LAYER, summary: { ownerId, codeId: data.id, code: data.code } });
      return ok(res, data, 201);
    } catch (err) {
      return handleError(req, res, err, 'Failed to add referral code');
    }
  };

  // A5
  const updateCodeLabel = async (req, res) => {
    const codeId = uuidParam(req, res, 'codeId');
    if (!codeId) return undefined;
    const extra = Object.keys(req.body || {}).filter((k) => k !== 'label');
    if (extra.length) {
      return validationFailed(req, res, extra.map((k) => ({ field: k, message: `"${k}" cannot be changed here; only "label" is editable` })));
    }
    const { error, value } = validate(labelSchema, req.body);
    if (error) return validationFailed(req, res, error);
    try {
      const data = await svc.updateCodeLabel(pool, codeId, value, actorId(req));
      logPortalFlow(req, 'Sales referrals: code label updated', { layer: LAYER, summary: { codeId, label: data.label } });
      return ok(res, data);
    } catch (err) {
      return handleError(req, res, err, 'Failed to update referral code');
    }
  };

  // A6
  const deactivateCode = async (req, res) => {
    const codeId = uuidParam(req, res, 'codeId');
    if (!codeId) return undefined;
    try {
      const data = await svc.deactivateCode(pool, codeId, actorId(req));
      logPortalFlow(req, 'Sales referrals: code deactivated', { layer: LAYER, summary: { codeId, code: data.code } });
      return ok(res, data);
    } catch (err) {
      return handleError(req, res, err, 'Failed to deactivate referral code');
    }
  };

  // A7
  const activateCode = async (req, res) => {
    const codeId = uuidParam(req, res, 'codeId');
    if (!codeId) return undefined;
    try {
      const data = await svc.activateCode(pool, codeId, actorId(req));
      logPortalFlow(req, 'Sales referrals: code activated', { layer: LAYER, summary: { codeId, code: data.code } });
      return ok(res, data);
    } catch (err) {
      return handleError(req, res, err, 'Failed to activate referral code');
    }
  };

  // A8
  const refreshCode = async (req, res) => {
    const codeId = uuidParam(req, res, 'codeId');
    if (!codeId) return undefined;
    try {
      const data = await svc.refreshCode(pool, codeId, actorId(req));
      logPortalFlow(req, 'Sales referrals: code refreshed', {
        layer: LAYER,
        summary: { codeId, oldCode: data.oldCode.code, newCodeId: data.newCode.id, newCode: data.newCode.code },
      });
      return ok(res, data);
    } catch (err) {
      return handleError(req, res, err, 'Failed to refresh referral code');
    }
  };

  // A9
  const suggestCodes = async (req, res) => {
    const { error, value } = validate(suggestSchema, req.query);
    if (error) return validationFailed(req, res, error);
    try {
      const exclude = value.exclude ? value.exclude.split(',').map((s) => s.trim()).filter(Boolean) : [];
      return ok(res, await svc.suggestCodes(pool, { ownerName: value.ownerName, ownerId: value.ownerId, count: value.count, exclude }));
    } catch (err) {
      return handleError(req, res, err, 'Failed to suggest referral codes');
    }
  };

  // A10
  const checkAvailability = async (req, res) => {
    const { error, value } = validate(availabilitySchema, req.query);
    if (error) return validationFailed(req, res, error);
    try {
      return ok(res, await svc.checkAvailability(pool, value.code));
    } catch (err) {
      return handleError(req, res, err, 'Failed to check referral code availability');
    }
  };

  // A11
  const searchCodes = async (req, res) => {
    const { error, value } = validate(searchCodesSchema, req.query);
    if (error) return validationFailed(req, res, error);
    try {
      return ok(res, await svc.searchCodes(pool, { search: value.search || undefined, includeInactive: value.includeInactive, limit: value.limit }));
    } catch (err) {
      return handleError(req, res, err, 'Failed to search referral codes');
    }
  };

  // A12
  const reportSummary = async (req, res) => {
    const { error, value } = validate(summarySchema, req.query);
    if (error) return validationFailed(req, res, error);
    const range = checkDateRange(value);
    if (range) return validationFailed(req, res, range);
    try {
      return ok(res, await reports.summary(pool, value));
    } catch (err) {
      return handleError(req, res, err, 'Failed to load referral summary');
    }
  };

  // A13
  const reportOwners = async (req, res) => {
    const { error, value } = validate(ownersReportSchema, req.query);
    if (error) return validationFailed(req, res, error);
    const range = checkDateRange(value);
    if (range) return validationFailed(req, res, range);
    try {
      return ok(res, await reports.ownersTable(pool, { ...value, search: value.search || undefined }));
    } catch (err) {
      return handleError(req, res, err, 'Failed to load owners report');
    }
  };

  // A14
  const reportOwnerCodes = async (req, res) => {
    const ownerId = uuidParam(req, res, 'ownerId');
    if (!ownerId) return undefined;
    const { error, value } = validate(ownerCodesReportSchema, req.query);
    if (error) return validationFailed(req, res, error);
    const range = checkDateRange(value);
    if (range) return validationFailed(req, res, range);
    try {
      return ok(res, await reports.ownerCodes(pool, ownerId, value));
    } catch (err) {
      return handleError(req, res, err, 'Failed to load owner code breakdown');
    }
  };

  // A15
  const reportSignups = async (req, res) => {
    const { error, value } = validate(signupsSchema, req.query);
    if (error) return validationFailed(req, res, error);
    const range = checkDateRange(value);
    if (range) return validationFailed(req, res, range);
    const scopes = [value.codeId ? 'codeId' : null, value.ownerId ? 'ownerId' : null, value.direct === true ? 'direct' : null].filter(Boolean);
    if (scopes.length !== 1) {
      return validationFailed(req, res, [{ field: 'scope', message: 'Pass exactly one of codeId, ownerId or direct=true', given: scopes }]);
    }
    try {
      return ok(res, await reports.signups(pool, {
        ...value, status: value.status || undefined, search: value.search || undefined,
        source: value.source || undefined, tenantType: value.tenantType || undefined,
      }));
    } catch (err) {
      return handleError(req, res, err, 'Failed to load signups');
    }
  };

  // A16
  const setTenantReferral = async (req, res) => {
    const tenantId = tenantIdParam(req, res, 'tenantId');
    if (!tenantId) return undefined;
    const { error, value } = validate(setReferralSchema, req.body);
    if (error) return validationFailed(req, res, error);
    try {
      const data = await svc.setTenantReferral(pool, tenantId, value, actorId(req));
      logPortalFlow(req, 'Sales referrals: workspace referral set', {
        layer: LAYER,
        summary: { tenantId, tenantType: data.tenantType, previousCodeId: data.previous ? data.previous.codeId : null, newCodeId: value.codeId, reason: value.reason },
      });
      return ok(res, data);
    } catch (err) {
      return handleError(req, res, err, 'Failed to set workspace referral');
    }
  };

  // A17 (referral block, by workspace)
  const getTenantReferral = async (req, res) => {
    const tenantId = tenantIdParam(req, res, 'tenantId');
    if (!tenantId) return undefined;
    try {
      return ok(res, await svc.getTenantReferral(pool, tenantId));
    } catch (err) {
      return handleError(req, res, err, 'Failed to load workspace referral');
    }
  };

  // A17 (referral block, by user → their workspace)
  const getUserReferral = async (req, res) => {
    const userId = intParam(req, res, 'userId');
    if (!userId) return undefined;
    try {
      return ok(res, await svc.getUserReferral(pool, userId));
    } catch (err) {
      return handleError(req, res, err, 'Failed to load user referral');
    }
  };

  return {
    createOwner,
    updateOwner,
    getOwner,
    addCode,
    updateCodeLabel,
    deactivateCode,
    activateCode,
    refreshCode,
    emailCode,
    emailOwnerCodes,
    suggestCodes,
    checkAvailability,
    searchCodes,
    reportSummary,
    reportOwners,
    reportOwnerCodes,
    reportSignups,
    setTenantReferral,
    getTenantReferral,
    getUserReferral,
  };
}

module.exports = { makeControllers };

/**
 * Newsletter subscribers.
 *
 *   Public : POST /api/public/newsletter
 *   Admin  : /api/admin/newsletter-subscribers  (marketing-admin + super-admin)
 *
 * Stored timestamps are UTC; every API payload includes `*_ist` (Asia/Kolkata).
 */
const Joi = require('joi');
const logger = require('../config/logger');
const { logPortalFlow } = require('../utils/portalAdminLog');
const { CSV_BOM, csvHeader, csvRow } = require('../utils/csv');
const { formatIST, IST_TIMEZONE } = require('../utils/time');
const { getClientIp } = require('../middleware/publicRateLimit.middleware');
const { parseUserAgent } = require('../utils/userAgent');
const svc = require('../services/newsletterSubscriberService');

const LAYER = 'NEWSLETTER';
const MAX_EXPORT_ROWS = 10000;

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

function serverError(req, res, message, err) {
  logger.errorWithContext(message, err, { requestId: req.requestId, layer: LAYER });
  return fail(req, res, 500, 'INTERNAL_ERROR', message);
}

function idParam(req) {
  const id = Number.parseInt(req.params.id, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function pick(body, ...keys) {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) return v;
  }
  return undefined;
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const SORT_OPTIONS = ['newest', 'oldest', 'email_asc', 'email_desc'];

const subscribeSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).required().label('Email'),
  page_url: Joi.string().trim().max(2048).allow('', null),
  source: Joi.string().trim().max(64).allow('', null),
  honeypot: Joi.any(),
});

const listSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100),
  pageSize: Joi.number().integer().min(1).max(100),
  search: Joi.string().trim().max(120).allow(''),
  device_type: Joi.string().trim().lowercase().valid('desktop', 'mobile', 'tablet'),
  source: Joi.string().trim().max(64).allow(''),
  from: Joi.string().trim().pattern(dateRe).messages({ 'string.pattern.base': '"from" must be YYYY-MM-DD (IST calendar date)' }),
  to: Joi.string().trim().pattern(dateRe).messages({ 'string.pattern.base': '"to" must be YYYY-MM-DD (IST calendar date)' }),
  sort: Joi.string().trim().lowercase().valid(...SORT_OPTIONS).default('newest'),
});

function resolveListQuery(req, { forExport = false } = {}) {
  const { error, value } = validate(listSchema, req.query);
  if (error) return { error };
  const limit = forExport
    ? MAX_EXPORT_ROWS
    : (value.limit || value.pageSize || 20);
  const filters = {
    search: value.search || '',
    device_type: value.device_type || '',
    source: value.source || '',
    from: value.from || '',
    to: value.to || '',
  };
  return {
    page: value.page,
    limit,
    sort: value.sort,
    filters,
    applied: {
      search: filters.search || null,
      device_type: filters.device_type || null,
      source: filters.source || null,
      from: filters.from || null,
      to: filters.to || null,
      sort: value.sort,
    },
  };
}

function makeControllers(pool) {
  const subscribe = async (req, res) => {
    try {
      const ip = getClientIp(req);
      const userAgent = String(req.headers['user-agent'] || '').slice(0, 1000);
      const parsed = parseUserAgent(userAgent);
      const body = req.body || {};
      const normalized = {
        email: pick(body, 'email', 'email_address', 'emailAddress'),
        page_url: pick(body, 'page_url', 'pageUrl', 'source_url', 'sourceUrl', 'url'),
        source: pick(body, 'source'),
        honeypot: pick(body, 'website', 'company_website', 'fax', 'hp', '_honey'),
      };

      if (normalized.honeypot !== undefined && String(normalized.honeypot).trim() !== '') {
        logger.warn('Newsletter: honeypot triggered, submission dropped', {
          requestId: req.requestId, layer: LAYER, summary: { ip },
        });
        return res.status(202).json({ success: true, data: { accepted: true } });
      }

      const { error, value } = validate(subscribeSchema, normalized);
      if (error) {
        logger.warn('Newsletter: validation failed', {
          requestId: req.requestId, layer: LAYER, summary: { ip, errors: error.join('; ') },
        });
        return fail(req, res, 400, 'VALIDATION_ERROR', 'Please enter a valid email address.', error);
      }

      const existing = await svc.findByEmail(pool, value.email);
      if (existing) {
        const row = svc.serializeSubscriber(existing);
        logger.info('Newsletter: already subscribed', {
          requestId: req.requestId, layer: LAYER, summary: { id: row.id, email: row.email, ip },
        });
        return res.status(200).json({
          success: true,
          data: {
            id: row.id,
            already_subscribed: true,
            email: row.email,
            subscribed_at: row.subscribed_at,
            subscribed_at_ist: row.subscribed_at_ist,
            message: 'You are already on the Jurinex newsletter list.',
          },
        });
      }

      const created = await svc.createSubscriber(pool, {
        email: value.email,
        ip_address: ip === 'unknown' ? null : ip,
        browser: parsed.browser,
        os: parsed.os,
        device_type: parsed.device_type,
        user_agent: userAgent || null,
        source: value.source || 'website_newsletter',
        page_url: value.page_url || null,
      });
      const row = svc.serializeSubscriber(created);

      logger.flow('Newsletter subscriber saved', {
        requestId: req.requestId,
        layer: LAYER,
        level: 'info',
        summary: {
          id: row.id,
          email: row.email,
          ip: row.ip_address,
          browser: row.browser,
          os: row.os,
          device_type: row.device_type,
          subscribed_at_ist: row.subscribed_at_ist?.display,
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          id: row.id,
          already_subscribed: false,
          email: row.email,
          subscribed_at: row.subscribed_at,
          subscribed_at_ist: row.subscribed_at_ist,
          message: 'Thanks — you are subscribed to the Jurinex newsletter.',
        },
      });
    } catch (err) {
      if (err.code === '23505') {
        const existing = await svc.findByEmail(pool, String(req.body?.email || '').trim().toLowerCase()).catch(() => null);
        if (existing) {
          const row = svc.serializeSubscriber(existing);
          return res.status(200).json({
            success: true,
            data: {
              id: row.id,
              already_subscribed: true,
              email: row.email,
              subscribed_at: row.subscribed_at,
              subscribed_at_ist: row.subscribed_at_ist,
              message: 'You are already on the Jurinex newsletter list.',
            },
          });
        }
      }
      return serverError(req, res, 'Could not save your subscription. Please try again.', err);
    }
  };

  const getStats = async (req, res) => {
    try {
      const now = new Date();
      const s = await svc.getStats(pool);
      const t = s.totals;
      const data = {
        timezone: IST_TIMEZONE,
        generated_at: now.toISOString(),
        generated_at_ist: formatIST(now),
        totals: {
          total: t.total,
          today: t.today,
          yesterday: t.yesterday,
          last_7_days: t.last_7_days,
          this_month: t.this_month,
          unique_ips: t.unique_ips,
        },
        by_device: s.by_device,
        daily_trend: s.daily_trend,
      };
      logPortalFlow(req, 'Newsletter subscriber stats loaded', {
        layer: LAYER,
        summary: { total: t.total, today: t.today, this_month: t.this_month },
      });
      return res.json({ success: true, data });
    } catch (err) {
      return serverError(req, res, 'Failed to load newsletter subscriber stats', err);
    }
  };

  const listSubscribers = async (req, res) => {
    try {
      const q = resolveListQuery(req);
      if (q.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', q.error);

      const now = new Date();
      const { rows, total } = await svc.listSubscribers(pool, {
        filters: q.filters, sort: q.sort, page: q.page, limit: q.limit,
      });
      const subscribers = rows.map((r) => svc.serializeSubscriber(r, { now }));

      logPortalFlow(req, 'Newsletter subscribers list loaded', {
        layer: LAYER,
        summary: { total, page: q.page, limit: q.limit, returned: subscribers.length, ...q.applied },
        table: subscribers.slice(0, 8).map((s) => ({
          email: s.email,
          ip: s.ip_address,
          browser: s.browser,
          os: s.os,
          subscribed_ist: s.subscribed_at_ist?.display,
        })),
      });

      return res.json({
        success: true,
        data: {
          subscribers,
          pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit) || 1) },
          filters: q.applied,
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load newsletter subscribers', err);
    }
  };

  const getSubscriber = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Valid subscriber id is required');
      const row = await svc.getSubscriberById(pool, id);
      if (!row) return fail(req, res, 404, 'NOT_FOUND', 'Subscriber not found');
      return res.json({ success: true, data: svc.serializeSubscriber(row) });
    } catch (err) {
      return serverError(req, res, 'Failed to load subscriber', err);
    }
  };

  const exportCsv = async (req, res) => {
    try {
      const q = resolveListQuery(req, { forExport: true });
      if (q.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', q.error);

      const now = new Date();
      const { rows, total } = await svc.listSubscribers(pool, {
        filters: q.filters, sort: q.sort, page: 1, limit: MAX_EXPORT_ROWS,
      });
      const subscribers = rows.map((r) => svc.serializeSubscriber(r, { now }));
      const columns = [
        { header: 'Email', get: (s) => s.email },
        { header: 'IP address', get: (s) => s.ip_address },
        { header: 'Browser', get: (s) => s.browser },
        { header: 'OS', get: (s) => s.os },
        { header: 'Device', get: (s) => s.device_type },
        { header: 'Subscribed (IST)', get: (s) => s.subscribed_at_ist?.display },
        { header: 'Subscribed (UTC)', get: (s) => s.subscribed_at },
        { header: 'Source', get: (s) => s.source },
        { header: 'Page URL', get: (s) => s.page_url },
        { header: 'User agent', get: (s) => s.user_agent },
      ];

      const stamp = formatIST(now);
      const fileName = `newsletter-subscribers-${stamp.iso.slice(0, 10)}-${stamp.time24.replace(':', '')}-IST.csv`;
      let body = CSV_BOM + csvHeader(columns);
      for (const row of subscribers) body += csvRow(columns, row);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Total-Rows', String(total));
      res.setHeader('X-Exported-Rows', String(subscribers.length));
      logPortalFlow(req, 'Newsletter subscribers CSV exported', {
        layer: LAYER,
        summary: { total, exported: subscribers.length, fileName },
      });
      return res.send(body);
    } catch (err) {
      return serverError(req, res, 'Failed to export newsletter subscribers', err);
    }
  };

  return { subscribe, getStats, listSubscribers, getSubscriber, exportCsv };
}

module.exports = { makeControllers };

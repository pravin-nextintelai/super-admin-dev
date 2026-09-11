/**
 * Contact enquiries ("Contact Jurinex" form) — controllers.
 *
 *   Public  : POST /api/public/contact                → submitEnquiry
 *   Marketing admin (/api/admin/contact-enquiries)   → stats / meta / list / export / detail /
 *                                                      update / contact-log / notes / delete
 *
 * All timestamps are returned as UTC ISO plus an `*_ist` object (Asia/Kolkata).
 */
const Joi = require('joi');
const logger = require('../config/logger');
const { logPortalFlow } = require('../utils/portalAdminLog');
const sendEmail = require('../utils/sendEmail');
const { CSV_BOM, csvHeader, csvRow } = require('../utils/csv');
const { formatIST, humanizeDuration, IST_TIMEZONE } = require('../utils/time');
const { getClientIp } = require('../middleware/publicRateLimit.middleware');
const svc = require('../services/contactEnquiryService');
const emails = require('../utils/contactEnquiryEmails');

const LAYER = 'CONTACT_ENQUIRY';
const MAX_EXPORT_ROWS = 5000;
const DUPLICATE_WINDOW_MINUTES = 2;

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

function actorFromReq(req) {
  if (req.user) {
    return { id: req.user.id ?? null, email: req.user.email || null, role: req.user.role || null };
  }
  // Static ADMIN_TOKEN (Postman / test runner) — no admin identity.
  return { id: null, email: null, role: 'admin-token' };
}

function idParam(req) {
  const id = Number.parseInt(req.params.id, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseStatuses(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return { statuses: [] };
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set();
  for (const part of parts) {
    if (part === 'all') return { statuses: [] };
    if (part === 'open') {
      svc.OPEN_STATUSES.forEach((s) => out.add(s));
    } else if (svc.STATUSES.includes(part)) {
      out.add(part);
    } else {
      return { error: `Unknown status "${part}". Allowed: all, open, ${svc.STATUSES.join(', ')}` };
    }
  }
  return { statuses: [...out] };
}

function serverError(req, res, message, err) {
  logger.errorWithContext(message, err, { requestId: req.requestId, layer: LAYER });
  return fail(req, res, 500, 'INTERNAL_ERROR', message);
}

// ── Public submission ────────────────────────────────────────────────────────

/** Accept the field names the website form is likely to send (snake / camel / label-ish). */
function normalizePublicPayload(body = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = body[k];
      if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) return v;
    }
    return undefined;
  };
  return {
    first_name: pick('first_name', 'firstName', 'name', 'first'),
    last_name: pick('last_name', 'lastName', 'surname', 'sur_name', 'lastname'),
    email: pick('email', 'email_address', 'emailAddress'),
    mobile_number: pick('mobile_number', 'mobileNumber', 'mobile', 'phone', 'phone_number', 'phoneNumber', 'contact_number'),
    organisation_name: pick(
      'organisation_name', 'organisationName', 'organization_name', 'organizationName',
      'organisation', 'organization', 'company', 'firm', 'firm_name'
    ),
    topic: pick('topic', 'subject', 'what_is_this_about', 'whatIsThisAbout', 'about', 'enquiry_type', 'enquiryType', 'category'),
    message: pick('message', 'additional_details', 'additionalDetails', 'details', 'notes', 'description'),
    marketing_consent: pick('marketing_consent', 'marketingConsent', 'consent', 'promotional_consent', 'promotionalConsent', 'agree'),
    page_url: pick('page_url', 'pageUrl', 'source_url', 'sourceUrl', 'url'),
    source: pick('source'),
    honeypot: pick('website', 'company_website', 'fax', 'hp', '_honey'),
  };
}

const submitSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(100).required().label('Name'),
  last_name: Joi.string().trim().min(1).max(100).required().label('Surname'),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).required().label('Email'),
  mobile_number: Joi.string()
    .trim()
    .pattern(/^\+?[0-9][0-9\s\-().]{6,24}$/)
    .max(32)
    .required()
    .label('Mobile number')
    .messages({ 'string.pattern.base': '"Mobile number" must contain 7–25 digits and may start with +' }),
  organisation_name: Joi.string().trim().max(255).allow('', null).label('Organisation name'),
  topic: Joi.string().trim().max(64).allow('', null).label('What is this about'),
  message: Joi.string().trim().max(5000).allow('', null).label('Additional details'),
  marketing_consent: Joi.boolean()
    .truthy('yes', 'on', '1', 'true', 'Y', 1)
    .falsy('no', 'off', '0', 'false', 'N', '', 0)
    .default(false),
  page_url: Joi.string().trim().max(2048).allow('', null),
  source: Joi.string().trim().max(64).allow('', null),
  honeypot: Joi.any(),
});

async function notifyAsync(req, enquiry) {
  const notifyTo = String(process.env.CONTACT_NOTIFY_EMAIL || '').trim();
  const ackEnabled = String(process.env.CONTACT_ACK_EMAIL_ENABLED || '').trim().toLowerCase() === 'true';
  if (!notifyTo && !ackEnabled) return;

  const portalBase = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  const portalUrl = portalBase ? `${portalBase}/dashboard/contact-enquiries?ref=${encodeURIComponent(enquiry.reference_no)}` : null;

  if (notifyTo) {
    try {
      const mail = emails.buildInternalNotificationEmail(enquiry, portalUrl);
      await sendEmail({ email: notifyTo, subject: mail.subject, html: mail.html, text: mail.text });
      logger.info('Contact enquiry: internal notification sent', {
        requestId: req.requestId, layer: LAYER, summary: { id: enquiry.id, to: notifyTo },
      });
    } catch (err) {
      logger.errorWithContext('Contact enquiry: internal notification failed', err, { requestId: req.requestId, layer: LAYER });
    }
  }
  if (ackEnabled) {
    try {
      const mail = emails.buildAcknowledgementEmail(enquiry);
      await sendEmail({ email: enquiry.email, subject: mail.subject, html: mail.html, text: mail.text });
      logger.info('Contact enquiry: acknowledgement sent', {
        requestId: req.requestId, layer: LAYER, summary: { id: enquiry.id, to: enquiry.email },
      });
    } catch (err) {
      logger.errorWithContext('Contact enquiry: acknowledgement failed', err, { requestId: req.requestId, layer: LAYER });
    }
  }
}

// ── Admin query schemas ──────────────────────────────────────────────────────

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const listSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100),
  pageSize: Joi.number().integer().min(1).max(100),
  status: Joi.string().trim().max(120).default('all'),
  topic: Joi.string().trim().max(64).allow(''),
  priority: Joi.string().trim().lowercase().valid(...svc.PRIORITIES),
  consent: Joi.boolean().truthy('1', 'yes').falsy('0', 'no'),
  assigned: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim().lowercase().valid('me', 'unassigned', 'any')),
  search: Joi.string().trim().max(120).allow(''),
  from: Joi.string().trim().pattern(dateRe).messages({ 'string.pattern.base': '"from" must be YYYY-MM-DD (IST calendar date)' }),
  to: Joi.string().trim().pattern(dateRe).messages({ 'string.pattern.base': '"to" must be YYYY-MM-DD (IST calendar date)' }),
  sort: Joi.string().trim().lowercase().valid(...svc.SORT_OPTIONS).default('newest'),
});

const updateSchema = Joi.object({
  status: Joi.string().trim().lowercase().valid(...svc.STATUSES),
  priority: Joi.string().trim().lowercase().valid(...svc.PRIORITIES),
  assigned_to: Joi.number().integer().min(1).allow(null),
  note: Joi.string().trim().max(5000).allow('', null),
}).or('status', 'priority', 'assigned_to', 'note');

const contactLogSchema = Joi.object({
  channel: Joi.string().trim().lowercase().valid(...svc.CONTACT_CHANNELS).required(),
  outcome: Joi.string().trim().lowercase().valid(...svc.CONTACT_OUTCOMES).default('connected'),
  note: Joi.string().trim().max(5000).allow('', null),
  contacted_at: Joi.date().iso().max('now').messages({ 'date.max': '"contacted_at" cannot be in the future' }),
  set_status: Joi.string().trim().lowercase().valid(...svc.STATUSES),
});

const noteSchema = Joi.object({
  note: Joi.string().trim().min(1).max(5000).required(),
});

// ── Factory ──────────────────────────────────────────────────────────────────

function makeControllers(pool) {
  /**
   * Resolve list filters from req.query (shared by list + export).
   * Returns { error } or { filters, sort, page, limit, applied }.
   */
  function resolveListQuery(req, { forExport = false } = {}) {
    const { error, value: q } = validate(listSchema, req.query);
    if (error) return { error };

    const st = parseStatuses(q.status);
    if (st.error) return { error: [st.error] };

    if (q.assigned === 'me' && !req.user?.id) {
      return { error: ['"assigned=me" requires a dashboard login (JWT), not the static admin token'] };
    }
    if (q.from && q.to && q.from > q.to) return { error: ['"from" must be on or before "to"'] };

    const filters = {
      statuses: st.statuses,
      topic: q.topic || undefined,
      priority: q.priority,
      consent: q.consent,
      assigned: q.assigned === 'any' ? undefined : q.assigned,
      search: q.search || undefined,
      from: q.from,
      to: q.to,
    };
    const limit = forExport ? MAX_EXPORT_ROWS : q.limit || q.pageSize || 20;
    const page = forExport ? 1 : q.page;

    return {
      filters,
      sort: q.sort,
      page,
      limit,
      applied: {
        status: st.statuses.length ? st.statuses : 'all',
        topic: filters.topic || null,
        priority: filters.priority || null,
        consent: typeof filters.consent === 'boolean' ? filters.consent : null,
        assigned: q.assigned ?? null,
        search: filters.search || null,
        from: filters.from || null,
        to: filters.to || null,
        sort: q.sort,
        timezone: IST_TIMEZONE,
      },
    };
  }

  // POST /api/public/contact
  const submitEnquiry = async (req, res) => {
    try {
      const normalized = normalizePublicPayload(req.body);
      const ip = getClientIp(req);
      const userAgent = String(req.headers['user-agent'] || '').slice(0, 1000);

      // Honeypot: bots fill hidden fields. Pretend success, store nothing.
      if (normalized.honeypot !== undefined && String(normalized.honeypot).trim() !== '') {
        logger.warn('Contact enquiry: honeypot triggered, submission dropped', {
          requestId: req.requestId, layer: LAYER, summary: { ip },
        });
        return res.status(202).json({ success: true, data: { accepted: true } });
      }

      const { error, value } = validate(submitSchema, normalized);
      if (error) {
        logger.warn('Contact enquiry: validation failed', { requestId: req.requestId, layer: LAYER, summary: { ip, errors: error.join('; ') } });
        return fail(req, res, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', error);
      }

      // Double-submit protection (same person, same message, within a couple of minutes).
      const dup = await svc.findRecentDuplicate(pool, {
        email: value.email,
        mobile_number: value.mobile_number,
        message: value.message,
        withinMinutes: DUPLICATE_WINDOW_MINUTES,
      });
      if (dup) {
        logger.info('Contact enquiry: duplicate submission suppressed', {
          requestId: req.requestId, layer: LAYER, summary: { ip, existingId: dup.id, reference_no: dup.reference_no },
        });
        return res.status(200).json({
          success: true,
          data: {
            id: dup.id,
            reference_no: dup.reference_no,
            duplicate: true,
            submitted_at: new Date(dup.created_at).toISOString(),
            submitted_at_ist: formatIST(dup.created_at),
            message: 'We already have your message. A member of the Jurinex team will be in touch within one working day.',
          },
        });
      }

      const row = await svc.createEnquiry(pool, {
        ...value,
        organisation_name: value.organisation_name || null,
        topic: value.topic || null,
        message: value.message || null,
        page_url: value.page_url || null,
        ip_address: ip,
        user_agent: userAgent,
      });
      const enquiry = svc.serializeEnquiry(row);

      logger.flow('Contact enquiry submitted', {
        requestId: req.requestId,
        layer: LAYER,
        level: 'info',
        summary: {
          id: enquiry.id,
          reference_no: enquiry.reference_no,
          email: enquiry.email,
          topic: enquiry.topic,
          consent: enquiry.marketing_consent,
          submitted_at_ist: enquiry.submitted_at_ist?.display,
          ip,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: enquiry.id,
          reference_no: enquiry.reference_no,
          duplicate: false,
          submitted_at: enquiry.submitted_at,
          submitted_at_ist: enquiry.submitted_at_ist,
          message: `Thank you, ${enquiry.first_name}. A member of the Jurinex team will reply within one working day.`,
        },
      });

      setImmediate(() => notifyAsync(req, enquiry));
    } catch (err) {
      return serverError(req, res, 'Could not save your message. Please try again or email connect@jurinex.ai.', err);
    }
  };

  // GET /api/admin/contact-enquiries/stats
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
          open: t.open,
          new: t.new,
          contacted: t.contacted,
          in_progress: t.in_progress,
          converted: t.converted,
          closed: t.closed,
          spam: t.spam,
          today: t.today,
          yesterday: t.yesterday,
          last_7_days: t.last_7_days,
          last_30_days: t.last_30_days,
          this_month: t.this_month,
          with_marketing_consent: t.with_marketing_consent,
          open_unassigned: t.open_unassigned,
          new_older_than_24h: t.new_older_than_24h,
          ever_contacted: t.ever_contacted,
          conversion_rate_pct: t.total ? Math.round((t.converted / t.total) * 1000) / 10 : 0,
        },
        response_time: {
          avg_first_response_minutes: t.avg_first_response_minutes ?? null,
          avg_first_response_display: t.avg_first_response_minutes != null ? humanizeDuration(t.avg_first_response_minutes * 60000) : null,
          avg_first_response_minutes_30d: t.avg_first_response_minutes_30d ?? null,
          avg_first_response_display_30d: t.avg_first_response_minutes_30d != null ? humanizeDuration(t.avg_first_response_minutes_30d * 60000) : null,
          target_minutes: 24 * 60,
          target_display: '1 working day',
        },
        by_status: svc.STATUSES.map((status) => ({ status, label: svc.STATUS_LABELS[status], count: t[status] || 0 })),
        by_topic: s.by_topic,
        daily_trend: s.daily_trend,
        recent_new: s.recent_new.map((r) => svc.serializeEnquiry(r, { now })),
      };

      logPortalFlow(req, 'Contact enquiry stats loaded', {
        layer: LAYER,
        summary: { total: t.total, open: t.open, new: t.new, today: t.today, avgFirstResponseMin: t.avg_first_response_minutes ?? null },
      });
      return res.json({ success: true, data });
    } catch (err) {
      return serverError(req, res, 'Failed to load contact enquiry stats', err);
    }
  };

  // GET /api/admin/contact-enquiries/meta
  const getMeta = async (req, res) => {
    try {
      const [used, admins] = await Promise.all([svc.getTopicCounts(pool), svc.getAssignableAdmins(pool)]);
      return res.json({
        success: true,
        data: {
          timezone: IST_TIMEZONE,
          statuses: svc.STATUSES.map((v) => ({ value: v, label: svc.STATUS_LABELS[v], open: svc.OPEN_STATUSES.includes(v) })),
          priorities: svc.PRIORITIES.map((v) => ({ value: v, label: svc.PRIORITY_LABELS[v] })),
          contact_channels: svc.CONTACT_CHANNELS.map((v) => ({ value: v, label: svc.CONTACT_CHANNEL_LABELS[v] })),
          contact_outcomes: svc.CONTACT_OUTCOMES.map((v) => ({ value: v, label: svc.CONTACT_OUTCOME_LABELS[v] })),
          topics: { suggested: svc.SUGGESTED_TOPICS, used },
          sort_options: svc.SORT_OPTIONS,
          assignable_admins: admins,
          permissions: {
            can_delete: !req.user || ['super-admin', 'admin'].includes(req.user.role),
          },
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load contact enquiry metadata', err);
    }
  };

  // GET /api/admin/contact-enquiries
  const listEnquiries = async (req, res) => {
    try {
      const q = resolveListQuery(req);
      if (q.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', q.error);

      const now = new Date();
      const { rows, total } = await svc.listEnquiries(
        pool,
        { filters: q.filters, sort: q.sort, page: q.page, limit: q.limit },
        { currentAdminId: req.user?.id }
      );
      const enquiries = rows.map((r) => svc.serializeEnquiry(r, { now }));

      logPortalFlow(req, 'Contact enquiries list loaded', {
        layer: LAYER,
        summary: { total, page: q.page, limit: q.limit, returned: enquiries.length, ...q.applied },
        table: enquiries.slice(0, 8).map((e) => ({
          ref: e.reference_no,
          name: e.full_name,
          topic: e.topic,
          status: e.status,
          submitted_ist: e.submitted_at_ist?.display,
        })),
      });

      return res.json({
        success: true,
        data: {
          enquiries,
          pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
          filters: q.applied,
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load contact enquiries', err);
    }
  };

  // GET /api/admin/contact-enquiries/export  (CSV, same filters as the list)
  const exportCsv = async (req, res) => {
    try {
      const q = resolveListQuery(req, { forExport: true });
      if (q.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', q.error);

      const now = new Date();
      const { rows, total } = await svc.listEnquiries(
        pool,
        { filters: q.filters, sort: q.sort, page: 1, limit: MAX_EXPORT_ROWS },
        { currentAdminId: req.user?.id }
      );
      const enquiries = rows.map((r) => svc.serializeEnquiry(r, { now }));

      const columns = [
        { header: 'Reference', key: 'reference_no' },
        { header: 'Submitted (IST)', get: (e) => e.submitted_at_ist?.display || '' },
        { header: 'Submitted date (IST)', get: (e) => e.submitted_at_ist?.iso.slice(0, 10) || '' },
        { header: 'Submitted time (IST)', get: (e) => e.submitted_at_ist?.time24 || '' },
        { header: 'Name', key: 'first_name' },
        { header: 'Surname', key: 'last_name' },
        { header: 'Email', key: 'email' },
        { header: 'Mobile', key: 'mobile_number' },
        { header: 'Organisation', key: 'organisation_name' },
        { header: 'What is this about', key: 'topic' },
        { header: 'Additional details', key: 'message' },
        { header: 'Marketing consent', get: (e) => (e.marketing_consent ? 'Yes' : 'No') },
        { header: 'Status', key: 'status_label' },
        { header: 'Priority', key: 'priority_label' },
        { header: 'Assigned to', get: (e) => e.assigned_to?.name || e.assigned_to?.email || '' },
        { header: 'First contacted (IST)', get: (e) => e.first_contacted_at_ist?.display || '' },
        { header: 'First contacted by', get: (e) => e.first_contacted_by?.name || '' },
        { header: 'First response time', get: (e) => e.first_response_time || '' },
        { header: 'Last contacted (IST)', get: (e) => e.last_contacted_at_ist?.display || '' },
        { header: 'Last channel', get: (e) => e.last_contact_channel_label || '' },
        { header: 'Contact attempts', key: 'contact_attempts' },
        { header: 'Closed (IST)', get: (e) => e.closed_at_ist?.display || '' },
        { header: 'Source', key: 'source' },
        { header: 'Page URL', key: 'page_url' },
        { header: 'Submitted (UTC)', key: 'submitted_at' },
      ];

      const stamp = formatIST(now);
      const fileName = `contact-enquiries-${stamp.iso.slice(0, 10)}-${stamp.time24.replace(':', '')}-IST.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Total-Rows', String(total));
      res.setHeader('X-Exported-Rows', String(enquiries.length));

      let out = CSV_BOM + csvHeader(columns);
      for (const e of enquiries) out += csvRow(columns, e);

      logPortalFlow(req, 'Contact enquiries exported to CSV', {
        layer: LAYER,
        summary: { exported: enquiries.length, total, truncated: total > enquiries.length, fileName, ...q.applied },
      });
      return res.send(out);
    } catch (err) {
      return serverError(req, res, 'Failed to export contact enquiries', err);
    }
  };

  // GET /api/admin/contact-enquiries/:id
  const getEnquiry = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Enquiry id must be a positive integer');

      const row = await svc.getEnquiryById(pool, id);
      if (!row) return fail(req, res, 404, 'NOT_FOUND', 'Enquiry not found');
      const activities = await svc.getActivities(pool, id);

      const enquiry = svc.serializeEnquiry(row);
      logPortalFlow(req, 'Contact enquiry detail loaded', {
        layer: LAYER,
        summary: { id, reference_no: enquiry.reference_no, status: enquiry.status, activities: activities.length },
      });
      return res.json({
        success: true,
        data: { enquiry, activities: activities.map(svc.serializeActivity), timezone: IST_TIMEZONE },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load contact enquiry', err);
    }
  };

  // PATCH /api/admin/contact-enquiries/:id   { status?, priority?, assigned_to?, note? }
  const updateEnquiry = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Enquiry id must be a positive integer');

      const { error, value } = validate(updateSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid update payload', error);

      const changes = {
        status: value.status,
        priority: value.priority,
        assigned_to: value.assigned_to,
        note: value.note ? value.note : undefined,
      };

      let result;
      try {
        result = await svc.updateEnquiry(pool, id, changes, actorFromReq(req));
      } catch (e) {
        if (e.code === 'INVALID_ASSIGNEE') return fail(req, res, 400, 'INVALID_ASSIGNEE', e.message);
        throw e;
      }
      if (!result) return fail(req, res, 404, 'NOT_FOUND', 'Enquiry not found');

      const enquiry = svc.serializeEnquiry(result.row);
      logPortalFlow(req, 'Contact enquiry updated', {
        layer: LAYER,
        summary: { id, reference_no: enquiry.reference_no, changes: result.changes.map((c) => `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join('; ') || 'none' },
      });
      return res.json({
        success: true,
        data: { enquiry, changes: result.changes, message: result.changes.length ? 'Enquiry updated' : 'No changes' },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to update contact enquiry', err);
    }
  };

  // POST /api/admin/contact-enquiries/:id/contact-log   { channel, outcome?, note?, contacted_at?, set_status? }
  const logContact = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Enquiry id must be a positive integer');

      const { error, value } = validate(contactLogSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid contact log payload', error);

      const result = await svc.logContact(pool, id, value, actorFromReq(req));
      if (!result) return fail(req, res, 404, 'NOT_FOUND', 'Enquiry not found');

      const enquiry = svc.serializeEnquiry(result.row);
      logPortalFlow(req, 'Contact enquiry: contact logged', {
        layer: LAYER,
        summary: {
          id,
          reference_no: enquiry.reference_no,
          channel: value.channel,
          outcome: value.outcome,
          contacted_at_ist: formatIST(value.contacted_at || new Date())?.display,
          status: `${result.previous_status} → ${enquiry.status}`,
          attempts: enquiry.contact_attempts,
          firstResponse: enquiry.first_response_time,
        },
      });
      return res.json({
        success: true,
        data: {
          enquiry,
          message: `Contact via ${svc.CONTACT_CHANNEL_LABELS[value.channel]} logged at ${enquiry.last_contacted_at_ist?.display}`,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to log contact attempt', err);
    }
  };

  // POST /api/admin/contact-enquiries/:id/notes   { note }
  const addNote = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Enquiry id must be a positive integer');

      const { error, value } = validate(noteSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid note payload', error);

      const row = await svc.addNote(pool, id, value.note, actorFromReq(req));
      if (!row) return fail(req, res, 404, 'NOT_FOUND', 'Enquiry not found');

      const activities = await svc.getActivities(pool, id);
      logPortalFlow(req, 'Contact enquiry: note added', { layer: LAYER, summary: { id, length: value.note.length } });
      return res.json({
        success: true,
        data: { enquiry: svc.serializeEnquiry(row), activities: activities.map(svc.serializeActivity), message: 'Note added' },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to add note', err);
    }
  };

  // DELETE /api/admin/contact-enquiries/:id
  const deleteEnquiry = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Enquiry id must be a positive integer');

      const deleted = await svc.deleteEnquiry(pool, id);
      if (!deleted) return fail(req, res, 404, 'NOT_FOUND', 'Enquiry not found');

      logPortalFlow(req, 'Contact enquiry deleted', { layer: LAYER, level: 'warn', summary: { id, reference_no: deleted.reference_no } });
      return res.json({ success: true, data: { id: deleted.id, reference_no: deleted.reference_no, message: 'Enquiry deleted' } });
    } catch (err) {
      return serverError(req, res, 'Failed to delete contact enquiry', err);
    }
  };

  return {
    submitEnquiry,
    getStats,
    getMeta,
    listEnquiries,
    exportCsv,
    getEnquiry,
    updateEnquiry,
    logContact,
    addNote,
    deleteEnquiry,
  };
}

module.exports = { makeControllers, normalizePublicPayload };

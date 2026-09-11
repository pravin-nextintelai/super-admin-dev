/**
 * Marketing offers & events.
 *   Public : GET  /api/public/promos/header
 *            GET  /api/public/promos
 *            POST /api/public/promos/:id/book
 *   Admin  : /api/admin/promos
 */
const Joi = require('joi');
const logger = require('../config/logger');
const { logPortalFlow } = require('../utils/portalAdminLog');
const { formatIST, IST_TIMEZONE } = require('../utils/time');
const svc = require('../services/marketingPromoService');

const LAYER = 'MARKETING_PROMO';
const KINDS = ['offer', 'event'];
const STATUSES = ['draft', 'active', 'paused'];

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

function idParam(req, name = 'id') {
  const id = Number.parseInt(req.params[name], 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const isoDate = Joi.string().isoDate().allow(null, '');
const slotSchema = Joi.object({
  id: Joi.number().integer().min(1),
  label: Joi.string().trim().max(128).allow('', null),
  starts_at: Joi.string().isoDate().required(),
  ends_at: isoDate,
  seat_capacity: Joi.number().integer().min(0).allow(null),
  seats_booked: Joi.number().integer().min(0),
});

const upsertSchema = Joi.object({
  kind: Joi.string().trim().lowercase().valid(...KINDS).required(),
  status: Joi.string().trim().lowercase().valid(...STATUSES).default('draft'),
  badge: Joi.string().trim().max(64).allow('', null),
  title: Joi.string().trim().min(1).max(255).required(),
  subtitle: Joi.string().trim().max(500).allow('', null),
  cta_label: Joi.string().trim().max(64).allow('', null),
  cta_url: Joi.string().trim().max(2048).allow('', null),
  background_color: Joi.string().trim().max(32).allow('', null),
  text_color: Joi.string().trim().max(32).allow('', null),
  show_on_header: Joi.boolean().default(true),
  priority: Joi.number().integer().min(0).max(999).default(0),
  starts_at: isoDate,
  ends_at: isoDate,
  location: Joi.string().trim().max(255).allow('', null),
  slots: Joi.array().items(slotSchema).max(24).default([]),
});

const listSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  kind: Joi.string().trim().lowercase().valid(...KINDS),
  status: Joi.string().trim().lowercase().valid(...STATUSES),
  search: Joi.string().trim().max(120).allow(''),
});

const bookSchema = Joi.object({
  slot_id: Joi.number().integer().min(1),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).allow('', null),
  name: Joi.string().trim().max(120).allow('', null),
});

function emptyToNull(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return v;
}

function makeControllers(pool) {
  const getHeader = async (req, res) => {
    try {
      const now = new Date();
      const { rows, slotsByPromo } = await svc.listHeaderPromos(pool);
      const items = rows.map((r) => svc.serializePromo(r, slotsByPromo.get(r.id) || [], { now, publicView: true }));
      return res.json({
        success: true,
        data: {
          items,
          header: items[0] || null,
          timezone: IST_TIMEZONE,
          generated_at: now.toISOString(),
          generated_at_ist: formatIST(now),
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load header offers', err);
    }
  };

  const listPublic = async (req, res) => {
    try {
      const now = new Date();
      const { rows, slotsByPromo } = await svc.listHeaderPromos(pool);
      const items = rows.map((r) => svc.serializePromo(r, slotsByPromo.get(r.id) || [], { now, publicView: true }));
      return res.json({ success: true, data: { items, timezone: IST_TIMEZONE } });
    } catch (err) {
      return serverError(req, res, 'Failed to load offers', err);
    }
  };

  const bookPublic = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Valid id is required');
      const { error, value } = validate(bookSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid booking details', error);
      const result = await svc.bookSeat(pool, {
        promoId: id,
        slotId: value.slot_id,
        email: value.email || null,
        name: value.name || null,
      });
      const promo = svc.serializePromo(result.row, result.slots, { publicView: true });
      logger.flow('Promo seat booked', {
        requestId: req.requestId, layer: LAYER, level: 'info',
        summary: { promoId: id, slotId: result.booked_slot.id, email: value.email || null },
      });
      return res.status(201).json({
        success: true,
        data: {
          promo,
          booked_slot: promo.slots.find((s) => s.id === result.booked_slot.id),
          message: 'Seat booked.',
        },
      });
    } catch (err) {
      if (err.statusCode) return fail(req, res, err.statusCode, err.code || 'BOOKING_ERROR', err.message);
      return serverError(req, res, 'Could not book a seat', err);
    }
  };

  const getStats = async (req, res) => {
    try {
      const totals = await svc.getStats(pool);
      logPortalFlow(req, 'Marketing promo stats loaded', { layer: LAYER, summary: totals });
      return res.json({ success: true, data: { totals, timezone: IST_TIMEZONE } });
    } catch (err) {
      return serverError(req, res, 'Failed to load promo stats', err);
    }
  };

  const listAdmin = async (req, res) => {
    try {
      const { error, value } = validate(listSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const now = new Date();
      const { rows, slotsByPromo, total } = await svc.listPromos(pool, value);
      const items = rows.map((r) => svc.serializePromo(r, slotsByPromo.get(r.id) || [], { now }));
      logPortalFlow(req, 'Marketing promos list loaded', {
        layer: LAYER,
        summary: { total, page: value.page, returned: items.length, kind: value.kind || null, status: value.status || null },
      });
      return res.json({
        success: true,
        data: {
          items,
          pagination: { page: value.page, limit: value.limit, total, totalPages: Math.max(1, Math.ceil(total / value.limit) || 1) },
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load offers and events', err);
    }
  };

  const getAdmin = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Valid id is required');
      const found = await svc.getPromoById(pool, id);
      if (!found) return fail(req, res, 404, 'NOT_FOUND', 'Offer or event not found');
      return res.json({ success: true, data: svc.serializePromo(found.row, found.slots) });
    } catch (err) {
      return serverError(req, res, 'Failed to load offer', err);
    }
  };

  const createAdmin = async (req, res) => {
    try {
      const { error, value } = validate(upsertSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Please check the form fields.', error);
      const result = await svc.createPromo(pool, {
        ...value,
        badge: emptyToNull(value.badge),
        subtitle: emptyToNull(value.subtitle),
        cta_label: emptyToNull(value.cta_label),
        cta_url: emptyToNull(value.cta_url),
        starts_at: emptyToNull(value.starts_at),
        ends_at: emptyToNull(value.ends_at),
        location: emptyToNull(value.location),
        created_by: req.user?.id || null,
      });
      const promo = svc.serializePromo(result.row, result.slots);
      logPortalFlow(req, 'Marketing promo created', {
        layer: LAYER,
        summary: { id: promo.id, kind: promo.kind, status: promo.status, title: promo.title, slots: promo.slots.length },
      });
      return res.status(201).json({ success: true, data: promo });
    } catch (err) {
      return serverError(req, res, 'Could not create offer or event', err);
    }
  };

  const updateAdmin = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Valid id is required');
      const { error, value } = validate(upsertSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Please check the form fields.', error);
      const result = await svc.updatePromo(pool, id, {
        ...value,
        badge: emptyToNull(value.badge),
        subtitle: emptyToNull(value.subtitle),
        cta_label: emptyToNull(value.cta_label),
        cta_url: emptyToNull(value.cta_url),
        starts_at: emptyToNull(value.starts_at),
        ends_at: emptyToNull(value.ends_at),
        location: emptyToNull(value.location),
      });
      if (!result) return fail(req, res, 404, 'NOT_FOUND', 'Offer or event not found');
      const promo = svc.serializePromo(result.row, result.slots);
      logPortalFlow(req, 'Marketing promo updated', {
        layer: LAYER,
        summary: { id: promo.id, kind: promo.kind, status: promo.status, live: promo.live },
      });
      return res.json({ success: true, data: promo });
    } catch (err) {
      return serverError(req, res, 'Could not update offer or event', err);
    }
  };

  const patchStatus = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Valid id is required');
      const { error, value } = validate(Joi.object({ status: Joi.string().valid(...STATUSES).required() }), req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid status', error);
      const result = await svc.setStatus(pool, id, value.status);
      if (!result) return fail(req, res, 404, 'NOT_FOUND', 'Offer or event not found');
      const promo = svc.serializePromo(result.row, result.slots);
      logPortalFlow(req, 'Marketing promo status changed', { layer: LAYER, summary: { id, status: value.status, live: promo.live } });
      return res.json({ success: true, data: promo });
    } catch (err) {
      return serverError(req, res, 'Could not change status', err);
    }
  };

  const removeAdmin = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Valid id is required');
      const deleted = await svc.deletePromo(pool, id);
      if (!deleted) return fail(req, res, 404, 'NOT_FOUND', 'Offer or event not found');
      logPortalFlow(req, 'Marketing promo deleted', { layer: LAYER, level: 'warn', summary: { id } });
      return res.json({ success: true, data: { id } });
    } catch (err) {
      return serverError(req, res, 'Could not delete offer or event', err);
    }
  };

  return {
    getHeader, listPublic, bookPublic,
    getStats, listAdmin, getAdmin, createAdmin, updateAdmin, patchStatus, removeAdmin,
  };
}

module.exports = { makeControllers };

/**
 * Marketing offers & events (website header bar).
 * Auth / Main DB: marketing_promos + marketing_promo_slots + marketing_promo_bookings.
 */
const fs = require('fs');
const path = require('path');
const { IST_TIMEZONE, formatIST, humanizeDuration } = require('../utils/time');

async function ensureMarketingPromoSchema(pool) {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', 'create_marketing_promos_tables.sql'),
    'utf8'
  );
  await pool.query(sql);
}

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function remainingOf(capacity, booked) {
  if (capacity == null) return null;
  return Math.max(0, Number(capacity) - Number(booked || 0));
}

function serializeSlot(row) {
  if (!row) return null;
  const capacity = row.seat_capacity == null ? null : Number(row.seat_capacity);
  const booked = Number(row.seats_booked || 0);
  const remaining = remainingOf(capacity, booked);
  return {
    id: row.id,
    promo_id: row.promo_id,
    label: row.label || null,
    starts_at: iso(row.starts_at),
    starts_at_ist: formatIST(row.starts_at),
    ends_at: iso(row.ends_at),
    ends_at_ist: formatIST(row.ends_at),
    seat_capacity: capacity,
    seats_booked: booked,
    seats_remaining: remaining,
    sold_out: remaining === 0,
  };
}

function serializePromo(row, slots = [], { now = new Date(), publicView = false } = {}) {
  if (!row) return null;
  const serializedSlots = slots.map(serializeSlot);
  const totalCap = serializedSlots.reduce((n, s) => (s.seat_capacity == null ? n : n + s.seat_capacity), 0);
  const hasCap = serializedSlots.some((s) => s.seat_capacity != null);
  const totalBooked = serializedSlots.reduce((n, s) => n + s.seats_booked, 0);
  const remaining = hasCap ? Math.max(0, totalCap - totalBooked) : null;
  const endsAt = row.ends_at ? new Date(row.ends_at) : null;
  const live = isLive(row, now);

  const payload = {
    id: row.id,
    kind: row.kind,
    status: row.status,
    badge: row.badge || null,
    title: row.title,
    subtitle: row.subtitle || null,
    cta_label: row.cta_label || null,
    cta_url: row.cta_url || null,
    background_color: row.background_color || '#0F766E',
    text_color: row.text_color || '#FFFFFF',
    show_on_header: Boolean(row.show_on_header),
    priority: Number(row.priority || 0),
    starts_at: iso(row.starts_at),
    starts_at_ist: formatIST(row.starts_at),
    ends_at: iso(row.ends_at),
    ends_at_ist: formatIST(row.ends_at),
    deadline_label: endsAt ? `Ends ${formatIST(row.ends_at)?.display}` : null,
    ends_in: endsAt && endsAt > now ? humanizeDuration(endsAt.getTime() - now.getTime()) : null,
    expired: Boolean(endsAt && endsAt <= now),
    live,
    location: row.location || null,
    seats: {
      capacity: hasCap ? totalCap : null,
      booked: totalBooked,
      remaining,
      sold_out: remaining === 0,
    },
    slots: serializedSlots,
    timezone: IST_TIMEZONE,
  };

  if (!publicView) {
    payload.created_by = row.created_by || null;
    payload.created_at = iso(row.created_at);
    payload.created_at_ist = formatIST(row.created_at);
    payload.updated_at = iso(row.updated_at);
    payload.updated_at_ist = formatIST(row.updated_at);
  }
  return payload;
}

function isLive(row, now = new Date()) {
  if (row.status !== 'active' || !row.show_on_header) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) <= now) return false;
  return true;
}

async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function getSlots(db, promoId) {
  const { rows } = await db.query(
    `SELECT * FROM marketing_promo_slots WHERE promo_id = $1 ORDER BY starts_at ASC, id ASC`,
    [promoId]
  );
  return rows;
}

async function replaceSlots(db, promoId, slots = []) {
  await db.query('DELETE FROM marketing_promo_slots WHERE promo_id = $1', [promoId]);
  const out = [];
  for (const slot of slots) {
    const { rows } = await db.query(
      `INSERT INTO marketing_promo_slots (promo_id, label, starts_at, ends_at, seat_capacity, seats_booked)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0))
       RETURNING *`,
      [
        promoId,
        slot.label || null,
        slot.starts_at,
        slot.ends_at || null,
        slot.seat_capacity == null || slot.seat_capacity === '' ? null : Number(slot.seat_capacity),
        Number(slot.seats_booked || 0),
      ]
    );
    out.push(rows[0]);
  }
  return out;
}

async function getPromoById(db, id) {
  const { rows } = await db.query('SELECT * FROM marketing_promos WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const slots = await getSlots(db, id);
  return { row: rows[0], slots };
}

async function listPromos(pool, { kind, status, search, page = 1, limit = 20 } = {}) {
  const where = [];
  const values = [];
  const p = (v) => { values.push(v); return `$${values.length}`; };
  if (kind) where.push(`kind = ${p(kind)}`);
  if (status) where.push(`status = ${p(status)}`);
  if (search) {
    const like = p(`%${String(search).replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(`(title ILIKE ${like} OR COALESCE(badge,'') ILIKE ${like} OR COALESCE(subtitle,'') ILIKE ${like})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM marketing_promos ${whereSql}`, values);
  const total = countRes.rows[0]?.total || 0;
  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];
  const { rows } = await pool.query(
    `SELECT * FROM marketing_promos ${whereSql}
     ORDER BY priority DESC, updated_at DESC, id DESC
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );
  const ids = rows.map((r) => r.id);
  let slotsByPromo = new Map();
  if (ids.length) {
    const slotRes = await pool.query(
      `SELECT * FROM marketing_promo_slots WHERE promo_id = ANY($1::int[]) ORDER BY starts_at ASC, id ASC`,
      [ids]
    );
    for (const s of slotRes.rows) {
      if (!slotsByPromo.has(s.promo_id)) slotsByPromo.set(s.promo_id, []);
      slotsByPromo.get(s.promo_id).push(s);
    }
  }
  return { rows, slotsByPromo, total };
}

async function listHeaderPromos(pool) {
  const { rows } = await pool.query(
    `SELECT * FROM marketing_promos
     WHERE status = 'active'
       AND show_on_header = TRUE
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at > NOW())
     ORDER BY priority DESC, id DESC
     LIMIT 8`
  );
  const ids = rows.map((r) => r.id);
  let slotsByPromo = new Map();
  if (ids.length) {
    const slotRes = await pool.query(
      `SELECT * FROM marketing_promo_slots WHERE promo_id = ANY($1::int[]) ORDER BY starts_at ASC, id ASC`,
      [ids]
    );
    for (const s of slotRes.rows) {
      if (!slotsByPromo.has(s.promo_id)) slotsByPromo.set(s.promo_id, []);
      slotsByPromo.get(s.promo_id).push(s);
    }
  }
  return { rows, slotsByPromo };
}

async function createPromo(pool, data) {
  return withTransaction(pool, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO marketing_promos
         (kind, status, badge, title, subtitle, cta_label, cta_url,
          background_color, text_color, show_on_header, priority,
          starts_at, ends_at, location, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        data.kind,
        data.status || 'draft',
        data.badge || null,
        data.title,
        data.subtitle || null,
        data.cta_label || null,
        data.cta_url || null,
        data.background_color || '#0F766E',
        data.text_color || '#FFFFFF',
        data.show_on_header !== false,
        Number(data.priority || 0),
        data.starts_at || null,
        data.ends_at || null,
        data.location || null,
        data.created_by || null,
      ]
    );
    const slots = Array.isArray(data.slots) ? await replaceSlots(client, rows[0].id, data.slots) : [];
    return { row: rows[0], slots };
  });
}

async function updatePromo(pool, id, data) {
  return withTransaction(pool, async (client) => {
    const existing = await getPromoById(client, id);
    if (!existing) return null;
    const e = existing.row;
    const { rows } = await client.query(
      `UPDATE marketing_promos SET
         kind = $1, status = $2, badge = $3, title = $4, subtitle = $5,
         cta_label = $6, cta_url = $7, background_color = $8, text_color = $9,
         show_on_header = $10, priority = $11, starts_at = $12, ends_at = $13,
         location = $14, updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        data.kind ?? e.kind,
        data.status ?? e.status,
        data.badge !== undefined ? data.badge : e.badge,
        data.title ?? e.title,
        data.subtitle !== undefined ? data.subtitle : e.subtitle,
        data.cta_label !== undefined ? data.cta_label : e.cta_label,
        data.cta_url !== undefined ? data.cta_url : e.cta_url,
        data.background_color || e.background_color,
        data.text_color || e.text_color,
        data.show_on_header !== undefined ? Boolean(data.show_on_header) : e.show_on_header,
        data.priority !== undefined ? Number(data.priority) : e.priority,
        data.starts_at !== undefined ? data.starts_at : e.starts_at,
        data.ends_at !== undefined ? data.ends_at : e.ends_at,
        data.location !== undefined ? data.location : e.location,
        id,
      ]
    );
    let slots = existing.slots;
    if (Array.isArray(data.slots)) {
      slots = await replaceSlots(client, id, data.slots);
    }
    return { row: rows[0], slots };
  });
}

async function setStatus(pool, id, status) {
  const { rows } = await pool.query(
    `UPDATE marketing_promos SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!rows[0]) return null;
  const slots = await getSlots(pool, id);
  return { row: rows[0], slots };
}

async function deletePromo(pool, id) {
  const { rows } = await pool.query('DELETE FROM marketing_promos WHERE id = $1 RETURNING id', [id]);
  return rows[0] || null;
}

async function bookSeat(pool, { promoId, slotId, email, name }) {
  return withTransaction(pool, async (client) => {
    const promoRes = await client.query('SELECT * FROM marketing_promos WHERE id = $1 FOR UPDATE', [promoId]);
    const promo = promoRes.rows[0];
    if (!promo) {
      const err = new Error('Offer or event not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (!isLive(promo)) {
      const err = new Error('This offer or event is not currently available');
      err.statusCode = 409;
      err.code = 'NOT_LIVE';
      throw err;
    }

    let slot;
    if (slotId) {
      const r = await client.query(
        'SELECT * FROM marketing_promo_slots WHERE id = $1 AND promo_id = $2 FOR UPDATE',
        [slotId, promoId]
      );
      slot = r.rows[0];
    } else {
      const r = await client.query(
        'SELECT * FROM marketing_promo_slots WHERE promo_id = $1 ORDER BY starts_at ASC, id ASC FOR UPDATE',
        [promoId]
      );
      slot = r.rows.find((s) => remainingOf(s.seat_capacity, s.seats_booked) !== 0) || r.rows[0];
    }
    if (!slot) {
      const err = new Error('No time slot is configured for this event');
      err.statusCode = 400;
      err.code = 'NO_SLOT';
      throw err;
    }
    const remaining = remainingOf(slot.seat_capacity, slot.seats_booked);
    if (remaining === 0) {
      const err = new Error('This time slot is fully booked');
      err.statusCode = 409;
      err.code = 'SOLD_OUT';
      throw err;
    }
    const upd = await client.query(
      `UPDATE marketing_promo_slots SET seats_booked = seats_booked + 1 WHERE id = $1 RETURNING *`,
      [slot.id]
    );
    await client.query(
      `INSERT INTO marketing_promo_bookings (promo_id, slot_id, email, name) VALUES ($1,$2,$3,$4)`,
      [promoId, slot.id, email || null, name || null]
    );
    const slots = await getSlots(client, promoId);
    return { row: promo, slots, booked_slot: upd.rows[0] };
  });
}

async function getStats(pool) {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE kind = 'offer')::int AS offers,
      COUNT(*) FILTER (WHERE kind = 'event')::int AS events,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
      COUNT(*) FILTER (WHERE status = 'active' AND show_on_header AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW()))::int AS live_on_header
    FROM marketing_promos
  `);
  return rows[0];
}

module.exports = {
  IST_TIMEZONE,
  ensureMarketingPromoSchema,
  serializePromo,
  listPromos,
  listHeaderPromos,
  getPromoById,
  createPromo,
  updatePromo,
  setStatus,
  deletePromo,
  bookSeat,
  getStats,
};

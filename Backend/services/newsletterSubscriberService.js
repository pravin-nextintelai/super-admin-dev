/**
 * Newsletter subscribers — Auth / Main DB table newsletter_subscribers.
 * Timestamps leave this module as UTC ISO plus an `*_ist` object (Asia/Kolkata).
 */
const fs = require('fs');
const path = require('path');
const {
  IST_TIMEZONE,
  formatIST,
  istDayStart,
  istDayEndExclusive,
  humanizeDuration,
} = require('../utils/time');

async function ensureNewsletterSubscriberSchema(pool) {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', 'create_newsletter_subscribers_table.sql'),
    'utf8'
  );
  await pool.query(sql);
}

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function serializeSubscriber(row, { now = new Date() } = {}) {
  if (!row) return null;
  const subscribedAt = row.subscribed_at ? new Date(row.subscribed_at) : null;
  return {
    id: row.id,
    email: row.email,
    ip_address: row.ip_address || null,
    browser: row.browser || null,
    os: row.os || null,
    device_type: row.device_type || null,
    user_agent: row.user_agent || null,
    source: row.source || 'website_newsletter',
    page_url: row.page_url || null,
    subscribed_at: iso(row.subscribed_at),
    subscribed_at_ist: formatIST(row.subscribed_at),
    subscribed_ago: subscribedAt ? humanizeDuration(now.getTime() - subscribedAt.getTime()) : null,
    created_at: iso(row.created_at),
    created_at_ist: formatIST(row.created_at),
    timezone: IST_TIMEZONE,
  };
}

function buildFilters(f = {}) {
  const where = [];
  const values = [];
  const p = (v) => {
    values.push(v);
    return `$${values.length}`;
  };

  if (f.search) {
    const like = p(`%${escapeLike(f.search.trim())}%`);
    where.push(`(
      ns.email ILIKE ${like}
      OR COALESCE(ns.ip_address, '') ILIKE ${like}
      OR COALESCE(ns.browser, '') ILIKE ${like}
      OR COALESCE(ns.os, '') ILIKE ${like}
    )`);
  }
  if (f.device_type) {
    where.push(`LOWER(COALESCE(ns.device_type, '')) = LOWER(${p(f.device_type)})`);
  }
  if (f.source) {
    where.push(`LOWER(COALESCE(ns.source, '')) = LOWER(${p(f.source)})`);
  }
  if (f.from) {
    const start = istDayStart(f.from);
    if (start) where.push(`ns.subscribed_at >= ${p(start)}`);
  }
  if (f.to) {
    const end = istDayEndExclusive(f.to);
    if (end) where.push(`ns.subscribed_at < ${p(end)}`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

function sortSql(sort) {
  switch (sort) {
    case 'oldest':
      return 'ns.subscribed_at ASC, ns.id ASC';
    case 'email_asc':
      return 'LOWER(ns.email) ASC, ns.subscribed_at DESC';
    case 'email_desc':
      return 'LOWER(ns.email) DESC, ns.subscribed_at DESC';
    case 'newest':
    default:
      return 'ns.subscribed_at DESC, ns.id DESC';
  }
}

async function listSubscribers(pool, { filters = {}, sort = 'newest', page = 1, limit = 20 } = {}) {
  const { whereSql, values } = buildFilters(filters);
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM newsletter_subscribers ns ${whereSql}`,
    values
  );
  const total = countRes.rows[0]?.total || 0;
  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];
  const { rows } = await pool.query(
    `SELECT * FROM newsletter_subscribers ns ${whereSql}
     ORDER BY ${sortSql(sort)}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );
  return { rows, total };
}

async function getSubscriberById(pool, id) {
  const { rows } = await pool.query('SELECT * FROM newsletter_subscribers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByEmail(pool, email) {
  const { rows } = await pool.query(
    'SELECT * FROM newsletter_subscribers WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return rows[0] || null;
}

async function createSubscriber(pool, data) {
  const { rows } = await pool.query(
    `INSERT INTO newsletter_subscribers
       (email, ip_address, browser, os, device_type, user_agent, source, page_url)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE(NULLIF($7, ''), 'website_newsletter'), $8)
     RETURNING *`,
    [
      data.email,
      data.ip_address || null,
      data.browser || null,
      data.os || null,
      data.device_type || null,
      data.user_agent || null,
      data.source || null,
      data.page_url || null,
    ]
  );
  return rows[0];
}

async function getStats(pool) {
  const { rows } = await pool.query(`
    WITH ist AS (
      SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date AS today
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE (ns.subscribed_at AT TIME ZONE 'Asia/Kolkata')::date = ist.today
      )::int AS today,
      COUNT(*) FILTER (
        WHERE (ns.subscribed_at AT TIME ZONE 'Asia/Kolkata')::date = ist.today - 1
      )::int AS yesterday,
      COUNT(*) FILTER (
        WHERE ns.subscribed_at >= ((ist.today - 6)::timestamp AT TIME ZONE 'Asia/Kolkata')
      )::int AS last_7_days,
      COUNT(*) FILTER (
        WHERE DATE_TRUNC('month', ns.subscribed_at AT TIME ZONE 'Asia/Kolkata')
            = DATE_TRUNC('month', ist.today)
      )::int AS this_month,
      COUNT(DISTINCT ns.ip_address) FILTER (WHERE ns.ip_address IS NOT NULL)::int AS unique_ips
    FROM newsletter_subscribers ns, ist
  `);

  const trend = await pool.query(`
    WITH days AS (
      SELECT generate_series(
               (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 13,
               (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
               INTERVAL '1 day'
             )::date AS day
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
           to_char(d.day, 'DD Mon')     AS label,
           COUNT(ns.id)::int            AS subscribed
    FROM days d
    LEFT JOIN newsletter_subscribers ns
      ON (ns.subscribed_at AT TIME ZONE 'Asia/Kolkata')::date = d.day
    GROUP BY d.day
    ORDER BY d.day
  `);

  const devices = await pool.query(`
    SELECT COALESCE(NULLIF(TRIM(device_type), ''), 'unknown') AS device_type,
           COUNT(*)::int AS count
    FROM newsletter_subscribers
    GROUP BY 1
    ORDER BY count DESC
  `);

  return {
    totals: rows[0],
    daily_trend: trend.rows,
    by_device: devices.rows,
  };
}

module.exports = {
  IST_TIMEZONE,
  ensureNewsletterSubscriberSchema,
  serializeSubscriber,
  listSubscribers,
  getSubscriberById,
  findByEmail,
  createSubscriber,
  getStats,
};

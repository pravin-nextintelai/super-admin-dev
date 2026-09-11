/**
 * Contact enquiries — data access + business rules.
 *
 * Backing tables (Auth / Main DB): contact_enquiries, contact_enquiry_activities
 * (see migrations/create_contact_enquiries_tables.sql).
 *
 * Every timestamp leaves this module twice: the raw UTC ISO string and an
 * `*_ist` object rendered in Asia/Kolkata (see utils/time.js → formatIST).
 */
const fs = require('fs');
const path = require('path');
const {
  IST_TIMEZONE,
  formatIST,
  istDateString,
  istDayStart,
  istDayEndExclusive,
  humanizeDuration,
} = require('../utils/time');

// ── Vocabulary ───────────────────────────────────────────────────────────────

const STATUSES = ['new', 'contacted', 'in_progress', 'converted', 'closed', 'spam'];
const OPEN_STATUSES = ['new', 'contacted', 'in_progress'];
const CLOSED_STATUSES = ['converted', 'closed', 'spam'];
const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  in_progress: 'In progress',
  converted: 'Converted',
  closed: 'Closed',
  spam: 'Spam',
};

const PRIORITIES = ['low', 'normal', 'high'];
const PRIORITY_LABELS = { low: 'Low', normal: 'Normal', high: 'High' };

const CONTACT_CHANNELS = ['call', 'email', 'whatsapp', 'sms', 'meeting', 'other'];
const CONTACT_CHANNEL_LABELS = {
  call: 'Phone call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  meeting: 'Meeting',
  other: 'Other',
};

const CONTACT_OUTCOMES = [
  'connected',
  'no_answer',
  'busy',
  'callback_requested',
  'wrong_number',
  'email_sent',
  'not_interested',
  'other',
];
const CONTACT_OUTCOME_LABELS = {
  connected: 'Connected',
  no_answer: 'No answer',
  busy: 'Busy',
  callback_requested: 'Callback requested',
  wrong_number: 'Wrong number',
  email_sent: 'Email sent',
  not_interested: 'Not interested',
  other: 'Other',
};

// Mirrors the "What is this about?" dropdown on jurinex.ai/contact. Free text is
// still accepted, so the admin filter also lists whatever values actually arrived.
const SUGGESTED_TOPICS = [
  'Product walkthrough / demo',
  'Pricing & plans',
  'Onboarding',
  'Data security & compliance',
  'Partnership',
  'Support',
  'Other',
];

const SORT_OPTIONS = [
  'newest',
  'oldest',
  'name_asc',
  'name_desc',
  'status',
  'priority',
  'last_contacted',
  'awaiting_longest',
];

const ASSIGNABLE_ROLES = ['super-admin', 'admin', 'marketing-admin'];

const ACTIVITY_TYPES = [
  'submitted',
  'status_changed',
  'priority_changed',
  'assigned',
  'contact_logged',
  'note_added',
];

// ── Schema ───────────────────────────────────────────────────────────────────

async function ensureContactEnquirySchema(pool) {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', 'create_contact_enquiries_tables.sql'),
    'utf8'
  );
  await pool.query(sql);
}

// ── Serialisation ────────────────────────────────────────────────────────────

const BASE_SELECT = `
  SELECT ce.*,
         aa.name  AS assigned_to_name,
         aa.email AS assigned_to_email,
         fc.name  AS first_contacted_by_name,
         lc.name  AS last_contacted_by_name
  FROM contact_enquiries ce
  LEFT JOIN super_admins aa ON aa.id = ce.assigned_to
  LEFT JOIN super_admins fc ON fc.id = ce.first_contacted_by
  LEFT JOIN super_admins lc ON lc.id = ce.last_contacted_by
`;

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isNaN(ms) ? null : Math.max(0, Math.round(ms / 60000));
}

function buildReferenceNo(id, createdAt) {
  const day = (istDateString(createdAt) || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `CE-${day}-${String(id).padStart(5, '0')}`;
}

function serializeEnquiry(row, { now = new Date() } = {}) {
  if (!row) return null;
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const firstResponseMinutes = minutesBetween(row.created_at, row.first_contacted_at);
  const awaitingFirstContact = !row.first_contacted_at && OPEN_STATUSES.includes(row.status);

  return {
    id: row.id,
    reference_no: row.reference_no,

    first_name: row.first_name,
    last_name: row.last_name,
    full_name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim(),
    email: row.email,
    mobile_number: row.mobile_number,
    organisation_name: row.organisation_name || null,

    topic: row.topic || null,
    message: row.message || null,

    marketing_consent: Boolean(row.marketing_consent),
    consent_given_at: iso(row.consent_given_at),
    consent_given_at_ist: formatIST(row.consent_given_at),

    submitted_at: iso(row.created_at),
    submitted_at_ist: formatIST(row.created_at),
    submitted_ago: createdAt ? humanizeDuration(now.getTime() - createdAt.getTime()) : null,

    status: row.status,
    status_label: STATUS_LABELS[row.status] || row.status,
    priority: row.priority,
    priority_label: PRIORITY_LABELS[row.priority] || row.priority,

    assigned_to: row.assigned_to
      ? { id: row.assigned_to, name: row.assigned_to_name || null, email: row.assigned_to_email || null }
      : null,

    first_contacted_at: iso(row.first_contacted_at),
    first_contacted_at_ist: formatIST(row.first_contacted_at),
    first_contacted_by: row.first_contacted_by
      ? { id: row.first_contacted_by, name: row.first_contacted_by_name || null }
      : null,
    last_contacted_at: iso(row.last_contacted_at),
    last_contacted_at_ist: formatIST(row.last_contacted_at),
    last_contacted_by: row.last_contacted_by
      ? { id: row.last_contacted_by, name: row.last_contacted_by_name || null }
      : null,
    last_contact_channel: row.last_contact_channel || null,
    last_contact_channel_label: row.last_contact_channel
      ? CONTACT_CHANNEL_LABELS[row.last_contact_channel] || row.last_contact_channel
      : null,
    contact_attempts: Number(row.contact_attempts || 0),

    first_response_minutes: firstResponseMinutes,
    first_response_time: firstResponseMinutes === null ? null : humanizeDuration(firstResponseMinutes * 60000),
    awaiting_first_contact: awaitingFirstContact,
    awaiting_for: awaitingFirstContact && createdAt ? humanizeDuration(now.getTime() - createdAt.getTime()) : null,

    status_changed_at: iso(row.status_changed_at),
    status_changed_at_ist: formatIST(row.status_changed_at),
    closed_at: iso(row.closed_at),
    closed_at_ist: formatIST(row.closed_at),
    updated_at: iso(row.updated_at),
    updated_at_ist: formatIST(row.updated_at),

    source: row.source,
    page_url: row.page_url || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,

    timezone: IST_TIMEZONE,
  };
}

function serializeActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    enquiry_id: row.enquiry_id,
    activity_type: row.activity_type,
    from_value: row.from_value || null,
    to_value: row.to_value || null,
    channel: row.channel || null,
    channel_label: row.channel ? CONTACT_CHANNEL_LABELS[row.channel] || row.channel : null,
    outcome: row.outcome || null,
    outcome_label: row.outcome ? CONTACT_OUTCOME_LABELS[row.outcome] || row.outcome : null,
    note: row.note || null,
    occurred_at: iso(row.occurred_at),
    occurred_at_ist: formatIST(row.occurred_at),
    actor: {
      id: row.actor_admin_id ?? null,
      email: row.actor_email || null,
      role: row.actor_role || null,
      name: row.actor_name || null,
    },
    recorded_at: iso(row.created_at),
    recorded_at_ist: formatIST(row.created_at),
  };
}

// ── Filters / sorting ────────────────────────────────────────────────────────

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * @param {object} f  { statuses, topic, priority, consent, assigned, search, from, to }
 * @param {object} ctx { currentAdminId }
 */
function buildFilters(f = {}, ctx = {}) {
  const where = [];
  const values = [];
  const p = (v) => {
    values.push(v);
    return `$${values.length}`;
  };

  if (Array.isArray(f.statuses) && f.statuses.length) {
    where.push(`ce.status = ANY(${p(f.statuses)}::text[])`);
  }
  if (f.topic) {
    where.push(`LOWER(COALESCE(ce.topic, '')) = LOWER(${p(f.topic)})`);
  }
  if (f.priority) {
    where.push(`ce.priority = ${p(f.priority)}`);
  }
  if (typeof f.consent === 'boolean') {
    where.push(`ce.marketing_consent = ${p(f.consent)}`);
  }
  if (f.assigned === 'unassigned') {
    where.push('ce.assigned_to IS NULL');
  } else if (f.assigned === 'me') {
    if (ctx.currentAdminId) where.push(`ce.assigned_to = ${p(ctx.currentAdminId)}`);
  } else if (Number.isInteger(f.assigned)) {
    where.push(`ce.assigned_to = ${p(f.assigned)}`);
  }
  if (f.search) {
    const like = p(`%${escapeLike(f.search.trim())}%`);
    where.push(`(
      (ce.first_name || ' ' || ce.last_name) ILIKE ${like}
      OR ce.email ILIKE ${like}
      OR ce.mobile_number ILIKE ${like}
      OR COALESCE(ce.organisation_name, '') ILIKE ${like}
      OR COALESCE(ce.reference_no, '') ILIKE ${like}
      OR COALESCE(ce.topic, '') ILIKE ${like}
      OR COALESCE(ce.message, '') ILIKE ${like}
    )`);
  }
  if (f.from) {
    const start = istDayStart(f.from);
    if (start) where.push(`ce.created_at >= ${p(start)}`);
  }
  if (f.to) {
    const end = istDayEndExclusive(f.to);
    if (end) where.push(`ce.created_at < ${p(end)}`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

function sortSql(sort) {
  switch (sort) {
    case 'oldest':
      return 'ce.created_at ASC, ce.id ASC';
    case 'name_asc':
      return 'LOWER(ce.first_name) ASC, LOWER(ce.last_name) ASC, ce.created_at DESC';
    case 'name_desc':
      return 'LOWER(ce.first_name) DESC, LOWER(ce.last_name) DESC, ce.created_at DESC';
    case 'status':
      return `array_position(ARRAY['new','contacted','in_progress','converted','closed','spam']::text[], ce.status), ce.created_at DESC`;
    case 'priority':
      return `array_position(ARRAY['high','normal','low']::text[], ce.priority), ce.created_at DESC`;
    case 'last_contacted':
      return 'ce.last_contacted_at DESC NULLS LAST, ce.created_at DESC';
    case 'awaiting_longest':
      return '(ce.first_contacted_at IS NOT NULL) ASC, ce.created_at ASC';
    case 'newest':
    default:
      return 'ce.created_at DESC, ce.id DESC';
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function listEnquiries(pool, { filters = {}, sort = 'newest', page = 1, limit = 20 } = {}, ctx = {}) {
  const { whereSql, values } = buildFilters(filters, ctx);

  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM contact_enquiries ce ${whereSql}`, values);
  const total = countRes.rows[0]?.total || 0;

  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];
  const { rows } = await pool.query(
    `${BASE_SELECT} ${whereSql}
     ORDER BY ${sortSql(sort)}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  return { rows, total };
}

async function getEnquiryById(db, id) {
  const { rows } = await db.query(`${BASE_SELECT} WHERE ce.id = $1`, [id]);
  return rows[0] || null;
}

async function getActivities(pool, enquiryId) {
  const { rows } = await pool.query(
    `SELECT act.*, a.name AS actor_name
     FROM contact_enquiry_activities act
     LEFT JOIN super_admins a ON a.id = act.actor_admin_id
     WHERE act.enquiry_id = $1
     ORDER BY act.occurred_at DESC, act.id DESC`,
    [enquiryId]
  );
  return rows;
}

async function findRecentDuplicate(pool, { email, mobile_number, message, withinMinutes = 2 }) {
  const { rows } = await pool.query(
    `SELECT id, reference_no, created_at
     FROM contact_enquiries
     WHERE LOWER(email) = LOWER($1)
       AND mobile_number = $2
       AND COALESCE(message, '') = COALESCE($3, '')
       AND created_at >= NOW() - ($4::int * INTERVAL '1 minute')
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, mobile_number, message || '', withinMinutes]
  );
  return rows[0] || null;
}

async function getStats(pool) {
  const [totalsRes, trendRes, topicsRes, recentRes] = await Promise.all([
    pool.query(`
      WITH ist AS (SELECT (NOW() AT TIME ZONE 'Asia/Kolkata') AS now_local)
      SELECT
        COUNT(*)::int                                                                 AS total,
        COUNT(*) FILTER (WHERE ce.status = 'new')::int                                AS new,
        COUNT(*) FILTER (WHERE ce.status = 'contacted')::int                          AS contacted,
        COUNT(*) FILTER (WHERE ce.status = 'in_progress')::int                        AS in_progress,
        COUNT(*) FILTER (WHERE ce.status = 'converted')::int                          AS converted,
        COUNT(*) FILTER (WHERE ce.status = 'closed')::int                             AS closed,
        COUNT(*) FILTER (WHERE ce.status = 'spam')::int                               AS spam,
        COUNT(*) FILTER (WHERE ce.status = ANY($1::text[]))::int                      AS open,
        COUNT(*) FILTER (WHERE (ce.created_at AT TIME ZONE 'Asia/Kolkata')::date = ist.now_local::date)::int        AS today,
        COUNT(*) FILTER (WHERE (ce.created_at AT TIME ZONE 'Asia/Kolkata')::date = ist.now_local::date - 1)::int    AS yesterday,
        COUNT(*) FILTER (WHERE (ce.created_at AT TIME ZONE 'Asia/Kolkata')::date >= ist.now_local::date - 6)::int   AS last_7_days,
        COUNT(*) FILTER (WHERE (ce.created_at AT TIME ZONE 'Asia/Kolkata')::date >= ist.now_local::date - 29)::int  AS last_30_days,
        COUNT(*) FILTER (WHERE (ce.created_at AT TIME ZONE 'Asia/Kolkata')::date >= date_trunc('month', ist.now_local)::date)::int AS this_month,
        COUNT(*) FILTER (WHERE ce.marketing_consent)::int                             AS with_marketing_consent,
        COUNT(*) FILTER (WHERE ce.assigned_to IS NULL AND ce.status = ANY($1::text[]))::int AS open_unassigned,
        COUNT(*) FILTER (WHERE ce.status = 'new' AND ce.created_at < NOW() - INTERVAL '24 hours')::int AS new_older_than_24h,
        COUNT(*) FILTER (WHERE ce.first_contacted_at IS NOT NULL)::int                AS ever_contacted,
        ROUND(AVG(EXTRACT(EPOCH FROM (ce.first_contacted_at - ce.created_at)) / 60)
              FILTER (WHERE ce.first_contacted_at IS NOT NULL))::int                  AS avg_first_response_minutes,
        ROUND(AVG(EXTRACT(EPOCH FROM (ce.first_contacted_at - ce.created_at)) / 60)
              FILTER (WHERE ce.first_contacted_at IS NOT NULL
                        AND ce.created_at >= NOW() - INTERVAL '30 days'))::int        AS avg_first_response_minutes_30d
      FROM contact_enquiries ce, ist
    `, [OPEN_STATUSES]),

    pool.query(`
      WITH days AS (
        SELECT generate_series(
                 (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 13,
                 (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
                 INTERVAL '1 day'
               )::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD')                                   AS date,
             to_char(d.day, 'DD Mon')                                       AS label,
             COUNT(ce.id)::int                                              AS submitted,
             COUNT(ce.id) FILTER (WHERE ce.marketing_consent)::int          AS with_consent,
             COUNT(ce.id) FILTER (WHERE ce.first_contacted_at IS NOT NULL)::int AS contacted
      FROM days d
      LEFT JOIN contact_enquiries ce
        ON (ce.created_at AT TIME ZONE 'Asia/Kolkata')::date = d.day
      GROUP BY d.day
      ORDER BY d.day
    `),

    getTopicCounts(pool),

    pool.query(`${BASE_SELECT} WHERE ce.status = 'new' ORDER BY ce.created_at DESC LIMIT 5`),
  ]);

  return {
    totals: totalsRes.rows[0],
    daily_trend: trendRes.rows,
    by_topic: topicsRes,
    recent_new: recentRes.rows,
  };
}

async function getTopicCounts(pool) {
  const { rows } = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(ce.topic), ''), 'Not specified') AS topic,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE ce.status = ANY($1::text[]))::int AS open
     FROM contact_enquiries ce
     GROUP BY 1
     ORDER BY count DESC, topic ASC
     LIMIT 25`,
    [OPEN_STATUSES]
  );
  return rows;
}

async function getAssignableAdmins(pool) {
  const { rows } = await pool.query(
    `SELECT a.id, a.name, a.email, r.name AS role
     FROM super_admins a
     JOIN admin_roles r ON r.id = a.role_id
     WHERE r.name = ANY($1::text[])
       AND COALESCE(a.is_blocked, FALSE) = FALSE
     ORDER BY CASE r.name WHEN 'marketing-admin' THEN 0 ELSE 1 END, a.name`,
    [ASSIGNABLE_ROLES]
  );
  return rows;
}

// ── Writes ───────────────────────────────────────────────────────────────────

async function insertActivity(db, a) {
  await db.query(
    `INSERT INTO contact_enquiry_activities
       (enquiry_id, activity_type, from_value, to_value, channel, outcome, note, occurred_at,
        actor_admin_id, actor_email, actor_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), $9, $10, $11)`,
    [
      a.enquiry_id,
      a.activity_type,
      a.from_value ?? null,
      a.to_value ?? null,
      a.channel ?? null,
      a.outcome ?? null,
      a.note ?? null,
      a.occurred_at ?? null,
      a.actor?.id ?? null,
      a.actor?.email ?? null,
      a.actor?.role ?? null,
    ]
  );
}

async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Store a public form submission. Returns the full row (with reference_no).
 */
async function createEnquiry(pool, data) {
  return withTransaction(pool, async (client) => {
    const ins = await client.query(
      `INSERT INTO contact_enquiries
         (first_name, last_name, email, mobile_number, organisation_name, topic, message,
          marketing_consent, consent_given_at, source, page_url, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               $8::boolean, CASE WHEN $8::boolean THEN NOW() ELSE NULL END,
               COALESCE(NULLIF($9, ''), 'website_contact_form'), $10, $11, $12)
       RETURNING *`,
      [
        data.first_name,
        data.last_name,
        data.email,
        data.mobile_number,
        data.organisation_name || null,
        data.topic || null,
        data.message || null,
        Boolean(data.marketing_consent),
        data.source || null,
        data.page_url || null,
        data.ip_address || null,
        data.user_agent || null,
      ]
    );
    const row = ins.rows[0];
    const referenceNo = buildReferenceNo(row.id, row.created_at);
    await client.query('UPDATE contact_enquiries SET reference_no = $1 WHERE id = $2', [referenceNo, row.id]);

    await insertActivity(client, {
      enquiry_id: row.id,
      activity_type: 'submitted',
      to_value: 'new',
      note: data.page_url ? `Submitted from ${data.page_url}` : 'Submitted from website contact form',
      occurred_at: row.created_at,
      actor: { id: null, email: null, role: 'website' },
    });

    return getEnquiryById(client, row.id);
  });
}

/**
 * Apply status / priority / assignment changes with an audit trail.
 * Returns { row, changes } or null if the enquiry does not exist.
 * Throws { code: 'INVALID_ASSIGNEE' } when assigned_to is not an assignable admin.
 */
async function updateEnquiry(pool, id, changes, actor) {
  return withTransaction(pool, async (client) => {
    const cur = await client.query('SELECT * FROM contact_enquiries WHERE id = $1 FOR UPDATE', [id]);
    const row = cur.rows[0];
    if (!row) return null;

    const sets = [];
    const values = [];
    const p = (v) => {
      values.push(v);
      return `$${values.length}`;
    };
    const applied = [];

    if (changes.status !== undefined && changes.status !== row.status) {
      sets.push(`status = ${p(changes.status)}`, 'status_changed_at = NOW()');
      if (changes.status === 'contacted' && !row.first_contacted_at) {
        sets.push(
          'first_contacted_at = NOW()',
          `first_contacted_by = ${p(actor?.id ?? null)}`,
          'last_contacted_at = NOW()',
          `last_contacted_by = ${p(actor?.id ?? null)}`
        );
      }
      if (CLOSED_STATUSES.includes(changes.status)) {
        sets.push('closed_at = COALESCE(closed_at, NOW())');
      } else {
        sets.push('closed_at = NULL');
      }
      await insertActivity(client, {
        enquiry_id: id,
        activity_type: 'status_changed',
        from_value: row.status,
        to_value: changes.status,
        note: changes.note || null,
        actor,
      });
      applied.push({ field: 'status', from: row.status, to: changes.status });
    }

    if (changes.priority !== undefined && changes.priority !== row.priority) {
      sets.push(`priority = ${p(changes.priority)}`);
      await insertActivity(client, {
        enquiry_id: id,
        activity_type: 'priority_changed',
        from_value: row.priority,
        to_value: changes.priority,
        note: applied.length ? null : changes.note || null,
        actor,
      });
      applied.push({ field: 'priority', from: row.priority, to: changes.priority });
    }

    if (changes.assigned_to !== undefined && changes.assigned_to !== row.assigned_to) {
      let toLabel = 'Unassigned';
      if (changes.assigned_to !== null) {
        const adm = await client.query(
          `SELECT a.id, a.name, a.email FROM super_admins a
           JOIN admin_roles r ON r.id = a.role_id
           WHERE a.id = $1 AND r.name = ANY($2::text[])`,
          [changes.assigned_to, ASSIGNABLE_ROLES]
        );
        if (!adm.rows.length) {
          const err = new Error('assigned_to must be the id of a marketing-admin or super-admin');
          err.code = 'INVALID_ASSIGNEE';
          throw err;
        }
        toLabel = adm.rows[0].name || adm.rows[0].email || String(changes.assigned_to);
      }
      let fromLabel = 'Unassigned';
      if (row.assigned_to) {
        const prev = await client.query('SELECT name, email FROM super_admins WHERE id = $1', [row.assigned_to]);
        fromLabel = prev.rows[0]?.name || prev.rows[0]?.email || String(row.assigned_to);
      }
      sets.push(`assigned_to = ${p(changes.assigned_to)}`);
      await insertActivity(client, {
        enquiry_id: id,
        activity_type: 'assigned',
        from_value: fromLabel,
        to_value: toLabel,
        note: applied.length ? null : changes.note || null,
        actor,
      });
      applied.push({ field: 'assigned_to', from: row.assigned_to, to: changes.assigned_to });
    }

    if (!applied.length && changes.note) {
      await insertActivity(client, { enquiry_id: id, activity_type: 'note_added', note: changes.note, actor });
      applied.push({ field: 'note', to: changes.note });
    }

    if (sets.length) {
      sets.push('updated_at = NOW()');
      values.push(id);
      await client.query(`UPDATE contact_enquiries SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
    } else if (applied.length) {
      await client.query('UPDATE contact_enquiries SET updated_at = NOW() WHERE id = $1', [id]);
    }

    return { row: await getEnquiryById(client, id), changes: applied };
  });
}

/**
 * Record that the team reached out (call / email / WhatsApp …).
 * Sets first_contacted_at on the first attempt, bumps contact_attempts, and moves
 * a `new` enquiry to `contacted` unless `set_status` says otherwise.
 */
async function logContact(pool, id, { channel, outcome, note, contacted_at, set_status }, actor) {
  return withTransaction(pool, async (client) => {
    const cur = await client.query('SELECT * FROM contact_enquiries WHERE id = $1 FOR UPDATE', [id]);
    const row = cur.rows[0];
    if (!row) return null;

    const at = contacted_at ? new Date(contacted_at) : new Date();
    const newStatus = set_status || (row.status === 'new' ? 'contacted' : row.status);
    const actorId = actor?.id ?? null;

    await client.query(
      `UPDATE contact_enquiries SET
         first_contacted_at   = LEAST(COALESCE(first_contacted_at, $2::timestamptz), $2::timestamptz),
         first_contacted_by   = CASE WHEN first_contacted_at IS NULL OR $2::timestamptz < first_contacted_at
                                     THEN $3::int ELSE first_contacted_by END,
         last_contacted_at    = GREATEST(COALESCE(last_contacted_at, $2::timestamptz), $2::timestamptz),
         last_contacted_by    = CASE WHEN last_contacted_at IS NULL OR $2::timestamptz >= last_contacted_at
                                     THEN $3::int ELSE last_contacted_by END,
         last_contact_channel = CASE WHEN last_contacted_at IS NULL OR $2::timestamptz >= last_contacted_at
                                     THEN $4::text ELSE last_contact_channel END,
         contact_attempts     = contact_attempts + 1,
         status               = $5::text,
         status_changed_at    = CASE WHEN status <> $5::text THEN NOW() ELSE status_changed_at END,
         closed_at            = CASE WHEN $5::text = ANY($6::text[]) THEN COALESCE(closed_at, NOW()) ELSE NULL END,
         updated_at           = NOW()
       WHERE id = $1`,
      [id, at, actorId, channel, newStatus, CLOSED_STATUSES]
    );

    await insertActivity(client, {
      enquiry_id: id,
      activity_type: 'contact_logged',
      from_value: row.status,
      to_value: newStatus,
      channel,
      outcome: outcome || null,
      note: note || null,
      occurred_at: at,
      actor,
    });

    return { row: await getEnquiryById(client, id), previous_status: row.status };
  });
}

async function addNote(pool, id, note, actor) {
  return withTransaction(pool, async (client) => {
    const cur = await client.query('SELECT id FROM contact_enquiries WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows.length) return null;
    await insertActivity(client, { enquiry_id: id, activity_type: 'note_added', note, actor });
    await client.query('UPDATE contact_enquiries SET updated_at = NOW() WHERE id = $1', [id]);
    return getEnquiryById(client, id);
  });
}

async function deleteEnquiry(pool, id) {
  const { rows } = await pool.query('DELETE FROM contact_enquiries WHERE id = $1 RETURNING id, reference_no', [id]);
  return rows[0] || null;
}

module.exports = {
  // vocab
  STATUSES,
  OPEN_STATUSES,
  CLOSED_STATUSES,
  STATUS_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABELS,
  CONTACT_OUTCOMES,
  CONTACT_OUTCOME_LABELS,
  SUGGESTED_TOPICS,
  SORT_OPTIONS,
  ASSIGNABLE_ROLES,
  ACTIVITY_TYPES,
  // schema
  ensureContactEnquirySchema,
  // serialisation
  serializeEnquiry,
  serializeActivity,
  buildReferenceNo,
  // reads
  listEnquiries,
  getEnquiryById,
  getActivities,
  findRecentDuplicate,
  getStats,
  getTopicCounts,
  getAssignableAdmins,
  // writes
  createEnquiry,
  updateEnquiry,
  logContact,
  addNote,
  deleteEnquiry,
};

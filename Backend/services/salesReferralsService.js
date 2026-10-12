/**
 * Sales Referrals — owners, referral codes and workspace attribution (Auth / Main DB).
 *
 * Tables (see migrations/create_sales_referrals_tables.sql):
 *   sales_owners, referral_codes, tenant_referrals, tenant_referral_history
 *
 * Workspaces in this database are the `firms` table (there is no `tenants` table), so every
 * "tenantId" in this module is a firms.id. Admin ids (super_admins.id) are integers.
 *
 * All timestamps are returned as ISO-8601 strings with the IST offset (2026-10-09T16:12:00+05:30).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { formatIST } = require('../utils/time');

const CODE_RE = /^[A-Z0-9-]{6,20}$/;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0, O, 1, I, L
const SUGGEST_ATTEMPTS = 20;
const REFRESH_ATTEMPTS = 10;
const MAX_CODES_ON_CREATE = 10;

// ── Errors ───────────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const notFoundOwner = () => new ApiError(404, 'SALES_OWNER_NOT_FOUND', 'This sales owner no longer exists.');
const notFoundCode = () => new ApiError(404, 'REFERRAL_CODE_NOT_FOUND', 'This code no longer exists.');
const notFoundTenant = () => new ApiError(404, 'TENANT_NOT_FOUND', 'This workspace no longer exists.');

/** Map a Postgres unique violation (23505) to the spec's 409 codes. */
function mapUniqueViolation(err, field) {
  if (!err || err.code !== '23505') return null;
  if (err.constraint === 'sales_owners_name_lower_key') {
    return new ApiError(409, 'SALES_OWNER_NAME_TAKEN', 'A sales owner with this name already exists.', { field: 'name' });
  }
  if (err.constraint === 'referral_codes_code_key') {
    return new ApiError(409, 'REFERRAL_CODE_TAKEN', 'Already in use. Pick another code.', field ? { field } : undefined);
  }
  return null;
}

// ── Schema ───────────────────────────────────────────────────────────────────

async function ensureSalesReferralsSchema(pool) {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'create_sales_referrals_tables.sql'), 'utf8');
  await pool.query(sql);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ts = (v) => (v ? formatIST(v)?.iso ?? null : null);

function normalizeCode(raw) {
  return String(raw ?? '').trim().toUpperCase();
}

function isValidCode(code) {
  return CODE_RE.test(code);
}

function normalizeLabel(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

/**
 * Build the code prefix from an owner name (spec A9):
 * split on camel case and non-alphanumerics; initials when several words, else first 4 letters;
 * letters only, upper case, max 4, padded to 2 with "JX".
 */
function codePrefix(ownerName) {
  const spaced = String(ownerName || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  const words = spaced.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let prefix;
  if (words.length > 1) prefix = words.map((w) => w[0]).join('');
  else prefix = (words[0] || '').slice(0, 4);
  prefix = prefix.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
  if (prefix.length < 2) prefix = (prefix + 'JX').slice(0, 2);
  return prefix;
}

function randomSuffix(len = 4) {
  let s = '';
  for (let i = 0; i < len; i += 1) s += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  return s;
}

function generateCandidate(ownerName) {
  return `${codePrefix(ownerName)}-${randomSuffix(4)}`;
}

async function codesExisting(db, codes) {
  if (!codes.length) return new Set();
  const { rows } = await db.query('SELECT code FROM referral_codes WHERE code = ANY($1::text[])', [codes]);
  return new Set(rows.map((r) => r.code));
}

async function adminNames(db, ids) {
  const clean = [...new Set(ids.filter((v) => v !== null && v !== undefined).map(Number).filter(Number.isInteger))];
  if (!clean.length) return new Map();
  const { rows } = await db.query('SELECT id, name, email FROM super_admins WHERE id = ANY($1::int[])', [clean]);
  return new Map(rows.map((r) => [Number(r.id), r.name || r.email || `admin#${r.id}`]));
}

function adminRef(id, names) {
  if (id === null || id === undefined) return null;
  return { id: Number(id), name: names.get(Number(id)) || `admin#${id}` };
}

// ── Serializers ──────────────────────────────────────────────────────────────

function serializeCode(row, { withOwner = false } = {}) {
  if (!row) return null;
  const out = {
    id: row.id,
    ownerId: row.owner_id,
    code: row.code,
    label: row.label ?? null,
    active: Boolean(row.active),
    replacedByCode: row.replaced_by_code ?? null,
    createdAt: ts(row.created_at),
    updatedAt: ts(row.updated_at),
  };
  if (withOwner) out.owner = { id: row.owner_id, name: row.owner_name, internal: Boolean(row.owner_internal) };
  return out;
}

function serializeCodeShort(row) {
  if (!row) return null;
  return { id: row.id, code: row.code, label: row.label ?? null, active: Boolean(row.active) };
}

function serializeOwnerRef(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, internal: Boolean(row.internal) };
}

function serializeOwner(row, codes, names) {
  const codeList = codes.map((c) => ({
    id: c.id,
    code: c.code,
    label: c.label ?? null,
    active: Boolean(c.active),
    replacedByCode: c.replaced_by_code ?? null,
    createdAt: ts(c.created_at),
  }));
  return {
    id: row.id,
    name: row.name,
    internal: Boolean(row.internal),
    notes: row.notes ?? null,
    createdAt: ts(row.created_at),
    createdBy: adminRef(row.created_by, names),
    updatedAt: ts(row.updated_at),
    updatedBy: adminRef(row.updated_by, names),
    codeCounts: { active: codeList.filter((c) => c.active).length, total: codeList.length },
    codes: codeList,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

const CODE_SELECT = `
  SELECT rc.*, rep.code AS replaced_by_code,
         so.name AS owner_name, so.internal AS owner_internal
  FROM referral_codes rc
  JOIN sales_owners so ON so.id = rc.owner_id
  LEFT JOIN referral_codes rep ON rep.id = rc.replaced_by_code_id`;

async function loadCode(db, codeId, { forUpdate = false } = {}) {
  if (forUpdate) {
    // FOR UPDATE cannot be combined with the LEFT JOIN on the nullable side; lock the row first.
    const lock = await db.query('SELECT id FROM referral_codes WHERE id = $1 FOR UPDATE', [codeId]);
    if (!lock.rows.length) return null;
  }
  const { rows } = await db.query(`${CODE_SELECT} WHERE rc.id = $1`, [codeId]);
  return rows[0] || null;
}

async function loadOwnerRow(db, ownerId) {
  const { rows } = await db.query('SELECT * FROM sales_owners WHERE id = $1', [ownerId]);
  return rows[0] || null;
}

async function loadOwnerCodes(db, ownerId) {
  const { rows } = await db.query(
    `SELECT rc.*, rep.code AS replaced_by_code
     FROM referral_codes rc
     LEFT JOIN referral_codes rep ON rep.id = rc.replaced_by_code_id
     WHERE rc.owner_id = $1
     ORDER BY rc.active DESC, rc.created_at DESC, rc.code ASC`,
    [ownerId]
  );
  return rows;
}

// ── A3 / A2 / A1 — owners ────────────────────────────────────────────────────

async function getOwner(pool, ownerId) {
  const owner = await loadOwnerRow(pool, ownerId);
  if (!owner) throw notFoundOwner();
  const codes = await loadOwnerCodes(pool, ownerId);
  const names = await adminNames(pool, [owner.created_by, owner.updated_by]);
  return serializeOwner(owner, codes, names);
}

/**
 * A1 — create owner + 1..10 codes in one transaction.
 * `input` is already Joi-validated: { name, internal, notes?, codes: [{code,label?}] }.
 */
async function createOwner(pool, input, actorId) {
  const name = String(input.name).trim();
  const notes = normalizeLabelLong(input.notes);

  if (!Array.isArray(input.codes) || input.codes.length < 1 || input.codes.length > MAX_CODES_ON_CREATE) {
    throw new ApiError(400, 'TOO_MANY_CODES', 'Add 1 to 10 codes.', { field: 'codes', count: input.codes ? input.codes.length : 0 });
  }

  const codes = input.codes.map((c, i) => {
    const code = normalizeCode(c.code);
    if (!isValidCode(code)) {
      throw new ApiError(400, 'REFERRAL_CODE_INVALID_FORMAT', 'Use A–Z, 0–9 and "-", 6–20 characters.', { field: `codes[${i}].code`, value: c.code });
    }
    return { code, label: normalizeLabel(c.label) };
  });

  const seen = new Map();
  codes.forEach((c, i) => {
    if (seen.has(c.code)) {
      throw new ApiError(400, 'REFERRAL_CODE_DUPLICATE_IN_REQUEST', `Same as code ${seen.get(c.code) + 1}.`, {
        field: `codes[${i}].code`, value: c.code, duplicateOf: `codes[${seen.get(c.code)}].code`,
      });
    }
    seen.set(c.code, i);
  });

  const nameTaken = await pool.query('SELECT id FROM sales_owners WHERE lower(name) = lower($1)', [name]);
  if (nameTaken.rows.length) throw new ApiError(409, 'SALES_OWNER_NAME_TAKEN', 'A sales owner with this name already exists.', { field: 'name', value: name });

  const existing = await codesExisting(pool, codes.map((c) => c.code));
  const takenIdx = codes.findIndex((c) => existing.has(c.code));
  if (takenIdx >= 0) {
    throw new ApiError(409, 'REFERRAL_CODE_TAKEN', 'Already in use. Pick another code.', { field: `codes[${takenIdx}].code`, value: codes[takenIdx].code });
  }

  const client = await pool.connect();
  let ownerId;
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO sales_owners (name, internal, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4) RETURNING id`,
      [name, Boolean(input.internal), notes, actorId]
    );
    ownerId = ins.rows[0].id;
    for (const c of codes) {
      await client.query(
        `INSERT INTO referral_codes (owner_id, code, label, active, created_by, updated_by)
         VALUES ($1, $2, $3, TRUE, $4, $4)`,
        [ownerId, c.code, c.label, actorId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const mapped = mapUniqueViolation(err, 'codes[].code');
    if (mapped) throw mapped;
    throw err;
  } finally {
    client.release();
  }
  return getOwner(pool, ownerId);
}

function normalizeLabelLong(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

/** A2 — update name / internal / notes. */
async function updateOwner(pool, ownerId, input, actorId) {
  const owner = await loadOwnerRow(pool, ownerId);
  if (!owner) throw notFoundOwner();
  const name = String(input.name).trim();
  const notes = input.notes === undefined ? owner.notes : normalizeLabelLong(input.notes);

  const clash = await pool.query('SELECT id FROM sales_owners WHERE lower(name) = lower($1) AND id <> $2', [name, ownerId]);
  if (clash.rows.length) throw new ApiError(409, 'SALES_OWNER_NAME_TAKEN', 'A sales owner with this name already exists.', { field: 'name', value: name });

  try {
    await pool.query(
      `UPDATE sales_owners SET name = $1, internal = $2, notes = $3, updated_by = $4, updated_at = NOW() WHERE id = $5`,
      [name, Boolean(input.internal), notes, actorId, ownerId]
    );
  } catch (err) {
    const mapped = mapUniqueViolation(err);
    if (mapped) throw mapped;
    throw err;
  }
  return getOwner(pool, ownerId);
}

// ── A4..A8 — codes ───────────────────────────────────────────────────────────

/** A4 — add one code to an owner (no cap). */
async function addCode(pool, ownerId, input, actorId) {
  const owner = await loadOwnerRow(pool, ownerId);
  if (!owner) throw notFoundOwner();
  const code = normalizeCode(input.code);
  if (!isValidCode(code)) {
    throw new ApiError(400, 'REFERRAL_CODE_INVALID_FORMAT', 'Use A–Z, 0–9 and "-", 6–20 characters.', { field: 'code', value: input.code });
  }
  const existing = await codesExisting(pool, [code]);
  if (existing.has(code)) throw new ApiError(409, 'REFERRAL_CODE_TAKEN', 'Already in use. Pick another code.', { field: 'code', value: code });

  let id;
  try {
    const ins = await pool.query(
      `INSERT INTO referral_codes (owner_id, code, label, active, created_by, updated_by)
       VALUES ($1, $2, $3, TRUE, $4, $4) RETURNING id`,
      [ownerId, code, normalizeLabel(input.label), actorId]
    );
    id = ins.rows[0].id;
  } catch (err) {
    const mapped = mapUniqueViolation(err, 'code');
    if (mapped) throw mapped;
    throw err;
  }
  return serializeCode(await loadCode(pool, id));
}

/** A5 — label only. */
async function updateCodeLabel(pool, codeId, input, actorId) {
  const row = await loadCode(pool, codeId);
  if (!row) throw notFoundCode();
  await pool.query('UPDATE referral_codes SET label = $1, updated_by = $2, updated_at = NOW() WHERE id = $3', [normalizeLabel(input.label), actorId, codeId]);
  return serializeCode(await loadCode(pool, codeId));
}

/** A6 — idempotent deactivate. */
async function deactivateCode(pool, codeId, actorId) {
  const row = await loadCode(pool, codeId);
  if (!row) throw notFoundCode();
  if (!row.active) return serializeCode(row);
  await pool.query('UPDATE referral_codes SET active = FALSE, updated_by = $1, updated_at = NOW() WHERE id = $2', [actorId, codeId]);
  return serializeCode(await loadCode(pool, codeId));
}

/** A7 — idempotent activate; refreshed codes stay retired. */
async function activateCode(pool, codeId, actorId) {
  const row = await loadCode(pool, codeId);
  if (!row) throw notFoundCode();
  if (row.replaced_by_code_id) {
    throw new ApiError(409, 'REFERRAL_CODE_REPLACED', "This code was refreshed and can't be reactivated.", { replacedByCode: row.replaced_by_code });
  }
  if (row.active) return serializeCode(row);
  await pool.query('UPDATE referral_codes SET active = TRUE, updated_by = $1, updated_at = NOW() WHERE id = $2', [actorId, codeId]);
  return serializeCode(await loadCode(pool, codeId));
}

/** A8 — retire a code and issue a replacement (one transaction, row locked). */
async function refreshCode(pool, codeId, actorId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const old = await loadCode(client, codeId, { forUpdate: true });
    if (!old) throw notFoundCode();
    if (!old.active) throw new ApiError(409, 'REFERRAL_CODE_NOT_ACTIVE', 'Only active codes can be refreshed.');

    let newId = null;
    for (let attempt = 0; attempt < REFRESH_ATTEMPTS && !newId; attempt += 1) {
      const candidate = generateCandidate(old.owner_name);
      await client.query('SAVEPOINT new_code');
      try {
        const ins = await client.query(
          `INSERT INTO referral_codes (owner_id, code, label, active, created_by, updated_by)
           VALUES ($1, $2, $3, TRUE, $4, $4) RETURNING id`,
          [old.owner_id, candidate, old.label, actorId]
        );
        newId = ins.rows[0].id;
        await client.query('RELEASE SAVEPOINT new_code');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT new_code');
        if (err.code !== '23505') throw err;
      }
    }
    if (!newId) throw new ApiError(503, 'CODE_SUGGESTION_FAILED', "Couldn't generate a code. Try again.");

    await client.query(
      `UPDATE referral_codes SET active = FALSE, replaced_by_code_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
      [newId, actorId, codeId]
    );
    const oldRow = await loadCode(client, codeId);
    const newRow = await loadCode(client, newId);
    await client.query('COMMIT');
    return { oldCode: serializeCode(oldRow), newCode: serializeCode(newRow) };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ── A9 / A10 / A11 — suggest, availability, search ──────────────────────────

async function suggestCodes(pool, { ownerName, ownerId, count = 1, exclude = [] }) {
  let name = ownerName;
  if (ownerId) {
    const owner = await loadOwnerRow(pool, ownerId);
    if (!owner) throw notFoundOwner();
    name = owner.name;
  }
  const excluded = new Set(exclude.map(normalizeCode).filter(Boolean));
  const suggestions = [];
  for (let n = 0; n < count; n += 1) {
    let found = null;
    for (let attempt = 0; attempt < SUGGEST_ATTEMPTS && !found; attempt += 1) {
      const candidate = generateCandidate(name);
      if (excluded.has(candidate) || suggestions.includes(candidate)) continue;
      const existing = await codesExisting(pool, [candidate]);
      if (!existing.has(candidate)) found = candidate;
    }
    if (!found) throw new ApiError(503, 'CODE_SUGGESTION_FAILED', "Couldn't generate a code. Try again.");
    suggestions.push(found);
  }
  return { suggestions };
}

async function checkAvailability(pool, rawCode) {
  const code = normalizeCode(rawCode);
  if (!isValidCode(code)) return { code, status: 'INVALID_FORMAT' };
  const existing = await codesExisting(pool, [code]);
  return { code, status: existing.has(code) ? 'TAKEN' : 'AVAILABLE' };
}

async function searchCodes(pool, { search, includeInactive = true, limit = 20 }) {
  const params = [];
  const where = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(rc.code ILIKE $${params.length} OR so.name ILIKE $${params.length})`);
  }
  if (!includeInactive) where.push('rc.active = TRUE');
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT rc.id, rc.code, rc.label, rc.active, so.id AS owner_id, so.name AS owner_name, so.internal AS owner_internal
     FROM referral_codes rc
     JOIN sales_owners so ON so.id = rc.owner_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY lower(so.name) ASC, rc.active DESC, rc.code ASC
     LIMIT $${params.length}`,
    params
  );
  const groups = [];
  const byOwner = new Map();
  for (const r of rows) {
    let g = byOwner.get(r.owner_id);
    if (!g) {
      g = { owner: { id: r.owner_id, name: r.owner_name, internal: Boolean(r.owner_internal) }, codes: [] };
      byOwner.set(r.owner_id, g);
      groups.push(g);
    }
    g.codes.push(serializeCodeShort(r));
  }
  return { groups };
}

// ── A16 / A17 — workspace referral ──────────────────────────────────────────

const REFERRAL_SELECT = `
  SELECT tr.tenant_id, tr.code_id, tr.source, tr.signed_up_at, tr.set_by, tr.set_at, tr.reason,
         rc.code, rc.label AS code_label, rc.active AS code_active,
         so.id AS owner_id, so.name AS owner_name, so.internal AS owner_internal
  FROM tenant_referrals tr
  LEFT JOIN referral_codes rc ON rc.id = tr.code_id
  LEFT JOIN sales_owners so ON so.id = rc.owner_id`;

async function buildReferralBlock(db, tenantId) {
  const { rows } = await db.query(`${REFERRAL_SELECT} WHERE tr.tenant_id = $1`, [tenantId]);
  const r = rows[0];
  if (!r) {
    return { referredBy: 'DIRECT', tracked: false, code: null, owner: null, source: null, signedUpAt: null, setBy: null, setAt: null, reason: null };
  }
  const names = await adminNames(db, [r.set_by]);
  const admin = r.source === 'ADMIN';
  return {
    referredBy: r.code_id ? 'CODE' : 'DIRECT',
    tracked: true,
    code: r.code_id ? { id: r.code_id, code: r.code, label: r.code_label ?? null, active: Boolean(r.code_active) } : null,
    owner: r.code_id ? { id: r.owner_id, name: r.owner_name, internal: Boolean(r.owner_internal) } : null,
    source: r.source,
    signedUpAt: ts(r.signed_up_at),
    setBy: admin ? adminRef(r.set_by, names) : null,
    setAt: admin ? ts(r.set_at) : null,
    reason: admin ? r.reason ?? null : null,
  };
}

async function loadTenant(db, tenantId) {
  const { rows } = await db.query('SELECT id, firm_name, admin_user_id, created_at FROM firms WHERE id = $1', [tenantId]);
  return rows[0] || null;
}

async function getTenantReferral(pool, tenantId) {
  const tenant = await loadTenant(pool, tenantId);
  if (!tenant) throw notFoundTenant();
  return { tenantId: tenant.id, firmName: tenant.firm_name, referral: await buildReferralBlock(pool, tenantId) };
}

/** A17 helper — referral block for a user: the user's workspace is resolved through firms / firm_users. */
async function getUserReferral(pool, userId) {
  const { rows } = await pool.query(
    `SELECT f.id, f.firm_name
     FROM firms f
     WHERE f.admin_user_id = $1
     UNION ALL
     SELECT f.id, f.firm_name
     FROM firm_users fu JOIN firms f ON f.id = fu.firm_id
     WHERE fu.user_id = $1
     LIMIT 1`,
    [userId]
  );
  const tenant = rows[0];
  if (!tenant) {
    return { userId, tenantId: null, firmName: null, referral: { referredBy: 'DIRECT', tracked: false, code: null, owner: null, source: null, signedUpAt: null, setBy: null, setAt: null, reason: null } };
  }
  return { userId, tenantId: tenant.id, firmName: tenant.firm_name, referral: await buildReferralBlock(pool, tenant.id) };
}

/** A16 — set / change a workspace's referral code (one transaction, history kept). */
async function setTenantReferral(pool, tenantId, input, actorId) {
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 5) throw new ApiError(400, 'REASON_REQUIRED', 'Please give a reason.', { field: 'reason', min: 5 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenant = await loadTenant(client, tenantId);
    if (!tenant) throw notFoundTenant();
    const code = await loadCode(client, input.codeId);
    if (!code) throw notFoundCode();

    const prev = await client.query('SELECT code_id, source FROM tenant_referrals WHERE tenant_id = $1 FOR UPDATE', [tenantId]);
    const previous = prev.rows[0] || null;

    await client.query(
      `INSERT INTO tenant_referrals (tenant_id, code_id, source, signed_up_at, set_by, set_at, reason)
       VALUES ($1, $2, 'ADMIN', COALESCE($3::timestamptz, NOW()), $4, NOW(), $5)
       ON CONFLICT (tenant_id) DO UPDATE
         SET code_id = EXCLUDED.code_id,
             source  = 'ADMIN',
             set_by  = EXCLUDED.set_by,
             set_at  = NOW(),
             reason  = EXCLUDED.reason`,
      [tenantId, code.id, tenant.created_at, actorId, reason]
    );
    await client.query(
      `INSERT INTO tenant_referral_history (tenant_id, previous_code_id, new_code_id, previous_source, reason, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, previous ? previous.code_id : null, code.id, previous ? previous.source : null, reason, actorId]
    );
    const block = await buildReferralBlock(client, tenantId);
    await client.query('COMMIT');
    return {
      tenantId,
      firmName: tenant.firm_name,
      previous: previous ? { codeId: previous.code_id, source: previous.source } : null,
      referral: block,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  ApiError,
  CODE_RE,
  MAX_CODES_ON_CREATE,
  ensureSalesReferralsSchema,
  normalizeCode,
  isValidCode,
  codePrefix,
  generateCandidate,
  serializeOwnerRef,
  serializeCodeShort,
  loadOwnerRow,
  loadCode,
  getOwner,
  createOwner,
  updateOwner,
  addCode,
  updateCodeLabel,
  deactivateCode,
  activateCode,
  refreshCode,
  suggestCodes,
  checkAvailability,
  searchCodes,
  getTenantReferral,
  getUserReferral,
  setTenantReferral,
};

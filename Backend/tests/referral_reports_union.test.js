#!/usr/bin/env node
/**
 * Sales Referrals — FIRM + SOLO union tests (reports + tenant referral dispatch).
 *
 * Runs against Auth_DB (DATABASE_URL) inside ONE transaction that is always rolled back, so no
 * fixture row survives. Fixture sign-ups are dated in January 2001 and every report is filtered
 * to that window, so live rows never affect the assertions.
 *
 * Usage:  npm run test:referral-reports
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const assert = require('assert');
const crypto = require('crypto');
const { Pool } = require('pg');
const reports = require('../services/referralReportsService');
const svc = require('../services/salesReferralsService');

const DAY1 = { from: '2001-01-01', to: '2001-01-01' }; // 1 firm + 1 solo, both via code
const ALL = { from: '2001-01-01', to: '2001-01-03' };  // + 1 direct firm + 1 direct solo
const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push({ name, pass: true }); console.log(`  ✅ ${name}`); }
  catch (err) { results.push({ name, pass: false, err }); console.log(`  ❌ ${name}\n     ${err.message}`); }
};
const tag = crypto.randomBytes(3).toString('hex').toUpperCase();

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DB_URL });
  const client = await pool.connect();
  // Service writes use pool.connect() + BEGIN/COMMIT; inside our outer transaction those become
  // savepoints so nothing can commit.
  const rawQuery = client.query.bind(client);
  let sp = 0;
  const savepointQuery = (text, params) => {
    const t = typeof text === 'string' ? text.trim().toUpperCase() : '';
    if (t === 'BEGIN') { sp += 1; return rawQuery(`SAVEPOINT sp${sp}`); }
    if (t === 'COMMIT') return rawQuery(`RELEASE SAVEPOINT sp${sp}`);
    if (t === 'ROLLBACK') return rawQuery(`ROLLBACK TO SAVEPOINT sp${sp}`);
    return rawQuery(text, params);
  };
  const fakePool = { query: rawQuery, connect: async () => ({ query: savepointQuery, release() {} }) };

  try {
    await rawQuery('BEGIN');
    await svc.ensureSalesReferralsSchema({ query: rawQuery }); // user_referral_history (IF NOT EXISTS)

    // ── Fixtures ────────────────────────────────────────────────────────────
    const owner = (await rawQuery(`INSERT INTO sales_owners (name, internal) VALUES ($1, TRUE) RETURNING id, name`, [`__union_test_${tag}`])).rows[0];
    const code = (await rawQuery(`INSERT INTO referral_codes (owner_id, code, label) VALUES ($1, $2, 'union test') RETURNING id, code`, [owner.id, `UNT-${tag}`])).rows[0];
    const code2 = (await rawQuery(`INSERT INTO referral_codes (owner_id, code, label) VALUES ($1, $2, 'union test 2') RETURNING id, code`, [owner.id, `UNU-${tag}`])).rows[0];
    const mkUser = async (label, accountType) =>
      (await rawQuery(`INSERT INTO users (email, username, account_type, approval_status, is_active) VALUES ($1, $2, $3, 'APPROVED', TRUE) RETURNING id`,
        [`__union_${label}_${tag}@example.com`, `Union ${label} ${tag}`, accountType])).rows[0].id;
    const mkFirm = async (label, adminUserId) =>
      (await rawQuery(`INSERT INTO firms (firm_name, firm_type, registering_advocate_name, email, mobile, admin_user_id, approval_status)
                       VALUES ($1, 'LLP', 'Adv Test', $2, '0000000000', $3, 'APPROVED') RETURNING id::text AS id`,
        [`__Union Firm ${label} ${tag}`, `__union_firm_${label}_${tag}@example.com`, adminUserId])).rows[0].id;

    const soloId = await mkUser('solo', 'SOLO');
    const firmId = await mkFirm('A', await mkUser('firmadmin', 'FIRM_ADMIN'));
    const soloDirectId = await mkUser('solodirect', 'SOLO');
    const firmDirectId = await mkFirm('B', await mkUser('firmadmin2', 'FIRM_ADMIN'));

    await rawQuery(`INSERT INTO tenant_referrals (tenant_id, code_id, source, signed_up_at) VALUES ($1, $2, 'SIGNUP', '2001-01-01T10:00:00+05:30')`, [firmId, code.id]);
    await rawQuery(`INSERT INTO user_referrals (user_id, code_id, source, signed_up_at) VALUES ($1, $2, 'SIGNUP', '2001-01-01T11:00:00+05:30')`, [soloId, code.id]);
    await rawQuery(`INSERT INTO tenant_referrals (tenant_id, code_id, source, signed_up_at) VALUES ($1, NULL, 'SIGNUP', '2001-01-03T10:00:00+05:30')`, [firmDirectId]);
    await rawQuery(`INSERT INTO user_referrals (user_id, code_id, source, signed_up_at) VALUES ($1, NULL, 'SIGNUP', '2001-01-03T11:00:00+05:30')`, [soloDirectId]);

    console.log('\n── Sales Referrals: FIRM + SOLO union ──');

    await test('summary counts 1 firm + 1 solo sign-up: totalSignups 2, viaCode 2, byTenantType {FIRM:1, SOLO:1}', async () => {
      const s = await reports.summary(client, DAY1);
      assert.strictEqual(s.totalSignups, 2);
      assert.strictEqual(s.viaCode, 2);
      assert.strictEqual(s.direct, 0);
      assert.deepStrictEqual(s.byTenantType, { FIRM: 1, SOLO: 1 });
      assert.strictEqual(s.free.total, 2);
    });

    await test('Direct rows (code_id NULL) in both tables are counted in direct', async () => {
      const s = await reports.summary(client, ALL);
      assert.strictEqual(s.totalSignups, 4);
      assert.strictEqual(s.viaCode, 2);
      assert.strictEqual(s.direct, 2);
      assert.deepStrictEqual(s.byTenantType, { FIRM: 2, SOLO: 2 });
      const o = await reports.ownersTable(client, ALL);
      assert.strictEqual(o.direct.signups, 2);
      const d = await reports.signups(client, { direct: true, ...ALL });
      assert.strictEqual(d.totalItems, 2);
      assert.deepStrictEqual(d.items.map((i) => i.tenantType).sort(), ['FIRM', 'SOLO']);
    });

    await test('owners table and per-code breakdown count both tables', async () => {
      const o = await reports.ownersTable(client, ALL);
      const row = o.owners.find((x) => x.id === owner.id);
      assert.ok(row, 'owner row present');
      assert.strictEqual(row.signups, 2);
      const c = await reports.ownerCodes(client, owner.id, ALL);
      assert.strictEqual(c.totals.signups, 2);
      assert.strictEqual(c.codes.find((x) => x.id === code.id).signups, 2);
      assert.strictEqual(c.codes.find((x) => x.id === code2.id).signups, 0);
    });

    await test('signups list contains both with tenantType; tenantType=SOLO filter returns only the solo row', async () => {
      const all = await reports.signups(client, { codeId: code.id, ...DAY1 });
      assert.strictEqual(all.totalItems, 2);
      assert.deepStrictEqual(all.items.map((i) => i.tenantType).sort(), ['FIRM', 'SOLO']);
      assert.deepStrictEqual(all.statusCounts, { all: 2, free: 2, paid: 0, lapsed: 0 });
      const firm = all.items.find((i) => i.tenantType === 'FIRM');
      assert.strictEqual(firm.tenantId, firmId);
      assert.strictEqual(firm.seats, 1);
      const solo = await reports.signups(client, { codeId: code.id, tenantType: 'SOLO', ...DAY1 });
      assert.strictEqual(solo.totalItems, 1);
      assert.strictEqual(solo.items[0].tenantType, 'SOLO');
      assert.strictEqual(solo.items[0].tenantId, String(soloId));
      assert.strictEqual(solo.items[0].firmName, `Union solo ${tag}`);
      assert.strictEqual(solo.items[0].seats, 1);
      assert.strictEqual(solo.items[0].source, 'SIGNUP');
      const bySource = await reports.signups(client, { ownerId: owner.id, source: 'ADMIN', ...ALL });
      assert.strictEqual(bySource.totalItems, 0);
    });

    await test('tenants/{uuid}/referral and tenants/{integer}/referral both resolve; unknown id → 404', async () => {
      const f = await svc.getTenantReferral(client, firmId);
      assert.strictEqual(f.tenantType, 'FIRM');
      assert.strictEqual(f.referral.tracked, true);
      assert.strictEqual(f.referral.code.id, code.id);
      const s = await svc.getTenantReferral(client, String(soloId));
      assert.strictEqual(s.tenantType, 'SOLO');
      assert.strictEqual(s.tenantId, String(soloId));
      assert.strictEqual(s.referral.referredBy, 'CODE');
      assert.strictEqual(s.referral.source, 'SIGNUP');
      const u = await svc.getUserReferral(client, soloId);
      assert.strictEqual(u.tenantType, 'SOLO');
      assert.strictEqual(u.referral.code.code, code.code);
      for (const bad of ['00000000-0000-0000-0000-000000000000', '2147483000', 'not-an-id']) {
        await assert.rejects(() => svc.getTenantReferral(client, bad), (e) => e.statusCode === 404 && e.code === 'TENANT_NOT_FOUND', `404 for ${bad}`);
      }
    });

    await test('admin override re-attributes a solo user (user_referrals + user_referral_history)', async () => {
      const r = await svc.setTenantReferral(fakePool, String(soloDirectId), { codeId: code2.id, reason: 'Union test override' }, null);
      assert.strictEqual(r.tenantType, 'SOLO');
      assert.strictEqual(r.referral.source, 'ADMIN');
      assert.strictEqual(r.referral.code.id, code2.id);
      assert.deepStrictEqual(r.previous, { codeId: null, source: 'SIGNUP' });
      const h = await rawQuery('SELECT previous_code_id, new_code_id, previous_source FROM user_referral_history WHERE user_id = $1', [soloDirectId]);
      assert.strictEqual(h.rows.length, 1);
      assert.strictEqual(h.rows[0].new_code_id, code2.id);
      const s = await reports.summary(client, ALL);
      assert.strictEqual(s.viaCode, 3);
      assert.strictEqual(s.direct, 1);
      const rf = await svc.setTenantReferral(fakePool, firmDirectId, { codeId: code2.id, reason: 'Union test firm override' }, null);
      assert.strictEqual(rf.tenantType, 'FIRM');
      const hf = await rawQuery('SELECT new_code_id FROM tenant_referral_history WHERE tenant_id = $1', [firmDirectId]);
      assert.strictEqual(hf.rows.length, 1);
    });
  } catch (err) {
    console.error('Fixture setup failed:', err.message);
    results.push({ name: 'fixture setup', pass: false, err });
  } finally {
    await rawQuery('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed (all fixture rows rolled back)`);
  process.exit(failed ? 1 : 0);
})();

// Idempotent seed: creates (or updates) Marketing Admin + Finance Admin test logins.
// Usage: node Backend/migrations/seed_marketing_and_finance_test_admins.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DB_URL });

const ACCOUNTS = [
  {
    name: 'Marketing Admin',
    email: 'marketing.admin@jurinex.dev',
    password: 'Marketing@1234',
    role_name: 'marketing-admin',
  },
  {
    name: 'Finance Admin',
    email: 'finance.admin@jurinex.dev',
    password: 'Finance@1234',
    role_name: 'finance-admin',
  },
];

(async () => {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO admin_roles (name) VALUES ('marketing-admin'), ('finance-admin')
       ON CONFLICT (name) DO NOTHING`
    );

    const created = [];
    for (const account of ACCOUNTS) {
      const roleRes = await client.query('SELECT id FROM admin_roles WHERE name = $1', [account.role_name]);
      if (!roleRes.rows.length) {
        throw new Error(`Role "${account.role_name}" is missing from admin_roles`);
      }
      const roleId = roleRes.rows[0].id;
      const hashed = await bcrypt.hash(account.password, 10);

      const existing = await client.query('SELECT id, email, role FROM super_admins WHERE LOWER(email) = LOWER($1)', [
        account.email,
      ]);

      if (existing.rows.length) {
        await client.query(
          `UPDATE super_admins
           SET name = $1, password = $2, role = $3, role_id = $4
           WHERE id = $5`,
          [account.name, hashed, account.role_name, roleId, existing.rows[0].id]
        );
        created.push({ ...account, id: existing.rows[0].id, action: 'updated' });
      } else {
        const seq = await client.query(`SELECT pg_get_serial_sequence('super_admins', 'id') AS sequence_name`);
        const sequenceName = seq.rows[0]?.sequence_name;
        if (sequenceName) {
          await client.query(
            `SELECT setval($1::regclass, COALESCE((SELECT MAX(id) FROM super_admins), 0) + 1, false)`,
            [sequenceName]
          );
        }
        const inserted = await client.query(
          `INSERT INTO super_admins (name, email, password, role, role_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [account.name, account.email, hashed, account.role_name, roleId]
        );
        created.push({ ...account, id: inserted.rows[0].id, action: 'inserted' });
      }
    }

    console.log('✅ Test admins ready:');
    for (const row of created) {
      console.log(`  [${row.action}] id=${row.id}  ${row.role_name}  ${row.email}  /  ${row.password}`);
    }
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();

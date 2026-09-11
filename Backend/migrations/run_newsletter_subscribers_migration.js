// Creates newsletter_subscribers in the Auth / Main DB.
// Idempotent — safe to re-run.
// Usage: node Backend/migrations/run_newsletter_subscribers_migration.js
//    or: npm run migrate:newsletter-subscribers
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { ensureNewsletterSubscriberSchema } = require('../services/newsletterSubscriberService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DB_URL });

(async () => {
  try {
    console.log('🔄 Running newsletter_subscribers migration...');
    await ensureNewsletterSubscriberSchema(pool);

    const { rows } = await pool.query(
      `SELECT table_name, COUNT(column_name)::int AS columns
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'newsletter_subscribers'
       GROUP BY table_name`
    );
    console.log('✅ newsletter_subscribers migration completed. Tables present:');
    rows.forEach((r) => console.log(`   - ${r.table_name} (${r.columns} columns)`));
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

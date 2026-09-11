// Creates contact_enquiries + contact_enquiry_activities in the Auth / Main DB.
// Idempotent — safe to re-run.
// Usage: node Backend/migrations/run_contact_enquiries_migration.js
//    or: npm run migrate:contact-enquiries
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { ensureContactEnquirySchema } = require('../services/contactEnquiryService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DB_URL });

(async () => {
  try {
    console.log('🔄 Running contact_enquiries migration...');
    await ensureContactEnquirySchema(pool);

    const { rows } = await pool.query(
      `SELECT table_name, COUNT(column_name)::int AS columns
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('contact_enquiries', 'contact_enquiry_activities')
       GROUP BY table_name ORDER BY table_name`
    );
    console.log('✅ contact_enquiries migration completed. Tables present:');
    rows.forEach((r) => console.log(`   - ${r.table_name} (${r.columns} columns)`));
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

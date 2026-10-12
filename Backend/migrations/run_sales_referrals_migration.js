const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { ensureSalesReferralsSchema } = require('../services/salesReferralsService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DB_URL });

(async () => {
  try {
    console.log('🔄 Running sales_referrals migration...');
    await ensureSalesReferralsSchema(pool);
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('sales_owners','referral_codes','tenant_referrals','tenant_referral_history')
       ORDER BY table_name`
    );
    console.log('✅ sales_referrals migration completed:', rows.map((r) => r.table_name).join(', '));
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

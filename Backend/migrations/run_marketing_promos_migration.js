const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { ensureMarketingPromoSchema } = require('../services/marketingPromoService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DB_URL });

(async () => {
  try {
    console.log('🔄 Running marketing_promos migration...');
    await ensureMarketingPromoSchema(pool);
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('marketing_promos','marketing_promo_slots','marketing_promo_bookings')
       ORDER BY table_name`
    );
    console.log('✅ marketing_promos migration completed:', rows.map((r) => r.table_name).join(', '));
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

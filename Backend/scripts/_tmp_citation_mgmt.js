const { Pool } = require('pg');
require('dotenv').config();

(async () => {
  const pool = new Pool({ connectionString: process.env.CITATION_DB_URL, max: 1, connectionTimeoutMillis: 10000 });
  try {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public'
        AND (table_name ILIKE '%agent%' OR table_name ILIKE '%log%' OR table_name ILIKE '%hitl%' OR table_name ILIKE '%citation%')
      ORDER BY table_name
    `);
    console.log('=== matching tables ===');
    console.log(tables.rows.map(r => r.table_name).join('\n'));

    const agentLogsExists = tables.rows.some(r => r.table_name === 'agent_logs');
    if (agentLogsExists) {
      const cols = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='agent_logs' ORDER BY ordinal_position
      `);
      console.log('\n=== agent_logs columns ===');
      console.log(cols.rows);

      const names = await pool.query(`
        SELECT agent_name, COUNT(*)::int AS c, MAX(created_at) AS last_seen
        FROM agent_logs
        GROUP BY agent_name
        ORDER BY c DESC
        LIMIT 30
      `);
      console.log('\n=== agent_logs by name ===');
      console.log(JSON.stringify(names.rows, null, 2));

      const total = await pool.query(`SELECT COUNT(*)::int AS c FROM agent_logs`);
      console.log('total agent_logs rows:', total.rows[0].c);
    }

    const hitlTables = tables.rows.filter(r => r.table_name.includes('hitl') || r.table_name.includes('task'));
    console.log('\n=== hitl-like tables ===', hitlTables.map(r => r.table_name));
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
})();

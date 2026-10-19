/**
 * Process entry point: validates env, opens DB pools, starts HTTP, then runs schema bootstrap.
 * `node server.js` at the repo root delegates here.
 */
require('dotenv').config();
const { JWT_SECRET } = require('./config/env');

if (!JWT_SECRET) {
  console.error('❌ Fatal: JWT_SECRET not set. Check Backend/.env');
  process.exit(1);
}
const missingDbVars = ['DATABASE_URL', 'DOCDB_URL'].filter((k) => !process.env[k]);
if (missingDbVars.length) {
  console.error(`❌ Fatal: ${missingDbVars.join(', ')} not set. Check Backend/.env`);
  process.exit(1);
}

// --- Database connections ---
const pool = require('./infrastructure/database/connections/db');            // Main / Auth DB
const docPool = require('./infrastructure/database/connections/docDB');      // Secret Manager / Document DB
const draftPool = require('./infrastructure/database/connections/draftDB');
const paymentPool = require('./infrastructure/database/connections/payment_DB');
const citationPool = require('./infrastructure/database/connections/citationDB');
const citationAnalyticsPool = require('./infrastructure/database/connections/citationAnalyticsDB');
const sequelize = require('./infrastructure/database/sequelize');

// --- Sequelize models (registered for sequelize.sync) ---
require('./infrastructure/database/modelRegistry');

const { createApp } = require('./app');
const bootstrap = require('./infrastructure/database/bootstrap');
const { ensureContactEnquirySchema } = require('./modules/marketing/contactEnquiry.service');
const { ensureNewsletterSubscriberSchema } = require('./modules/marketing/newsletterSubscriber.service');
const { ensureMarketingPromoSchema } = require('./modules/marketing/marketingPromo.service');
const { ensureSalesReferralsSchema } = require('./modules/referrals/salesReferrals.service');
const { ensureReconciliationSchema } = require('./modules/payments/reconciliation.service');
const { recoverStuckDocuments } = require('./modules/ai-analysis/aiDocument.controller');
const { attachAgentLiveTestSocket } = require('./modules/jurinex-voice/tests/agentLiveTest.socket');
const jobs = require('./jobs');

const pools = { pool, docPool, draftPool, paymentPool, citationPool, citationAnalyticsPool };
const app = createApp(pools);

const startServer = async () => {
  try {
    // Start listening immediately so Cloud Run startup probe passes
    const PORT = process.env.PORT || 4000;
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 SERVER STARTED SUCCESSFULLY');
      console.log('='.repeat(60));
      console.log(`🌐 Server running on port: ${PORT}`);
      console.log(`📊 Main Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'Connected'}`);
      console.log(`📄 docDB Database: ${process.env.DOCDB_URL?.split('@')[1]?.split('/')[1] || 'Connected'}`);
      console.log('='.repeat(60) + '\n');
    });

    attachAgentLiveTestSocket(server, { pool });

    // Run DB initialization after port is open (avoids Cloud Run startup probe timeout)
    await sequelize.sync({ alter: true });
    console.log('✅ Sequelize Database synced!');

    // Ensure secret_manager.role_id column exists (safe to run multiple times)
    await docPool.query(`ALTER TABLE secret_manager ADD COLUMN IF NOT EXISTS role_id UUID DEFAULT NULL`).catch(() => {});

    // Initialize system_prompts, agent_prompts, llm_models, and llm_model_parameters tables
    await bootstrap.initializeSystemPromptsTable();
    await bootstrap.initializeAgentPromptsTable();
    await bootstrap.initializeLlmModelsTable();
    await bootstrap.initializeLlmModelParametersTable();
    await bootstrap.initializeLlmChatConfigTable();
    await bootstrap.initializeSummarizationChatConfigTable();
    await bootstrap.initializeSupportWorkspaceSchema();
    await bootstrap.initializeSupportPrioritiesTable();
    await bootstrap.initializeAIDocumentTables();
    await ensureReconciliationSchema(paymentPool)
      .then(() => console.log('✅ reconciliation tables ready (Payment DB)'))
      .catch((e) => console.error('❌ Error initializing reconciliation tables:', e.message));
    await ensureContactEnquirySchema(pool)
      .then(() => console.log('✅ contact_enquiries tables ready (Main DB)'))
      .catch((e) => console.error('❌ Error initializing contact_enquiries tables:', e.message));
    await ensureNewsletterSubscriberSchema(pool)
      .then(() => console.log('✅ newsletter_subscribers table ready (Main DB)'))
      .catch((e) => console.error('❌ Error initializing newsletter_subscribers table:', e.message));
    await ensureMarketingPromoSchema(pool)
      .then(() => console.log('✅ marketing_promos tables ready (Main DB)'))
      .catch((e) => console.error('❌ Error initializing marketing_promos tables:', e.message));
    await ensureSalesReferralsSchema(pool)
      .then(() => console.log('✅ sales_referrals tables ready (Main DB)'))
      .catch((e) => console.error('❌ Error initializing sales_referrals tables:', e.message));
    await recoverStuckDocuments();
    await jobs.startJobs({ pools }).then((n) => console.log(`✅ background jobs started (${n})`));

    const shutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received. Closing server...`);
      server.close(async () => {
        console.log('🛑 HTTP server closed.');
        try { await pool.end(); console.log('✅ Main PostgreSQL pool closed.'); } catch (e) { console.error('❌ Error closing main pool:', e); }
        try { await docPool.end(); console.log('✅ docDB PostgreSQL pool closed.'); } catch (e) { console.error('❌ Error closing docDB pool:', e); }
        try {
          await citationPool.end();
          await citationAnalyticsPool.end();
          console.log('✅ Citation PostgreSQL pool closed.');
        } catch (e) { console.error('❌ Error closing citation pool:', e); }
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (err) => { console.error('❌ Unhandled Rejection:', err); });
    process.on('uncaughtException', (err) => { console.error('❌ Uncaught Exception:', err); shutdown('Uncaught Exception'); });
  } catch (err) {
    console.error('❌ Startup Error:', err);
    process.exit(1);
  }
};

startServer();

module.exports = { app, pools };

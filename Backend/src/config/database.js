/**
 * Database connections facade. Each pool is required lazily so importing this file does not open
 * connections to databases a script doesn't need.
 *
 *   mainPool              DATABASE_URL               users, firms, admins, referrals, marketing, support queries
 *   docPool               DOCDB_URL                  secret manager, prompts, LLM config, chatbot, error/audit logs
 *   draftPool             DRAFT_DB_URL               templates, agent prompts
 *   paymentPool           PAYMENT_DB_URL             plans, subscriptions, payments, invoices, reconciliation
 *   citationPool          CITATION_DB_URL            citation pipeline
 *   citationAnalyticsPool CITATION_ANALYTICS_DB_URL  citation usage/cost analytics
 *   aiDocumentPool        AI_DOCUMENT_DB_URL         AI document processing / chatbot
 *   supportSequelize      SUPPORT_DATABASE_URL       support workspace (Sequelize)
 *   sequelize             DATABASE_URL               Sequelize instance for the Main DB models
 */
const LOADERS = {
  mainPool: () => require('../infrastructure/database/connections/db'),
  docPool: () => require('../infrastructure/database/connections/docDB'),
  draftPool: () => require('../infrastructure/database/connections/draftDB'),
  paymentPool: () => require('../infrastructure/database/connections/payment_DB'),
  citationPool: () => require('../infrastructure/database/connections/citationDB'),
  citationAnalyticsPool: () => require('../infrastructure/database/connections/citationAnalyticsDB'),
  aiDocumentPool: () => require('../infrastructure/database/connections/aiDocumentDB'),
  supportSequelize: () => require('../infrastructure/database/connections/supportSequelize'),
  sequelize: () => require('../infrastructure/database/sequelize'),
};

const database = {};
for (const [name, load] of Object.entries(LOADERS)) {
  Object.defineProperty(database, name, { enumerable: true, get: load });
}

module.exports = Object.freeze(database);

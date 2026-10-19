const express = require('express');

// Read-only analytics aggregates across multiple DBs. Pools are singletons (same as other routes).
const paymentPool = require('../../infrastructure/database/connections/payment_DB');
const docPool = require('../../infrastructure/database/connections/docDB');
const draftPool = require('../../infrastructure/database/connections/draftDB');
const citationPool = require('../../infrastructure/database/connections/citationDB');
const { protect, authorize } = require('../../shared/middleware/authenticate');

// authPool (Main/Auth DB) is passed in by server.js — used for auth + users/firms lookups.
module.exports = (authPool) => {
  const router = express.Router();
  const pools = { authPool, paymentPool, docPool, draftPool, citationPool };

  // Same guard the working /api/users admin endpoints use, so the existing dashboard token works.
  router.use(protect(authPool), authorize(['user-admin', 'super-admin', 'account-admin', 'finance-admin']));

  // Hot-reload controller so edits apply without restarting `npm start`.
  const load = () => {
    const p = require.resolve('./userAnalytics.controller');
    delete require.cache[p];
    return require(p);
  };

  // Mounted at /api/admin/user-analytics
  router.get('/users/:userId/analytics',   (req, res) => load().getUserAnalytics(req, res, pools));
  router.get('/users/:userId/storage',     (req, res) => load().getUserStorage(req, res, pools));
  router.get('/users/:userId/token-usage', (req, res) => load().getUserTokenTimeseries(req, res, pools));
  router.get('/users/:userId/ai-usage',    (req, res) => load().getUserAiUsage(req, res, pools));
  router.get('/firms/:firmId/analytics',   (req, res) => load().getFirmAnalytics(req, res, pools));

  return router;
};

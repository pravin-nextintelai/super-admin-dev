const express = require('express');

const paymentPool = require('../../infrastructure/database/connections/payment_DB');
const { protect, authorize } = require('../../shared/middleware/authenticate');

/**
 * Finance Admin → Users & Plans.
 * Mounted at /api/admin/users-plans. These are the same handlers as /api/admin/plan-analytics/subscribers
 * (one implementation, two paths) so the older screen keeps working.
 *
 *   GET /                                   paginated users (+ `view=transactions` for one row per paid payment)
 *   GET /export                             CSV of everything matching the filters (same columns as the table)
 *   GET /filters                            facet lists (plans, top-up plans, sales owners, owner types, statuses)
 *   GET /:userId                            profile + attribution + subscriptions + every payment (GST) + refunds + packs
 *   GET /:userId/transactions               complete transaction history
 *   GET /:userId/invoices                   legacy flat invoice/receipt list
 *   GET /:userId/payments/:paymentId/invoice|receipt   PDF download
 */
module.exports = (authPool) => {
  const router = express.Router();
  const pools = { authPool, paymentPool };

  router.use(protect(authPool), authorize(['user-admin', 'super-admin', 'account-admin', 'finance-admin']));

  const load = () => {
    const p = require.resolve('./planAnalytics.controller');
    delete require.cache[p];
    return require(p);
  };

  router.get('/export', (req, res) => load().exportSubscribers(req, res, pools));
  router.get('/filters', (req, res) => load().getSubscriberFilters(req, res, pools));
  router.get('/:userId/transactions', (req, res) => load().getSubscriberTransactions(req, res, pools));
  router.get('/:userId/invoices', (req, res) => load().getSubscriberInvoices(req, res, pools));
  router.get('/:userId/payments/:paymentId/:doc', (req, res) => load().downloadSubscriberDocument(req, res, pools));
  router.get('/:userId', (req, res) => load().getSubscriberDetail(req, res, pools));
  router.get('/', (req, res) => load().getSubscribers(req, res, pools));

  return router;
};

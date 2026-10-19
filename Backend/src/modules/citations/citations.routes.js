const express = require('express');
const adminAuthMiddleware = require('../../shared/middleware/adminAuth');

// Repos
const OverviewRepo = require('./overview.repository');
const HitlRepo = require('./hitl.repository');
const PipelineRepo = require('./pipeline.repository');
const RoutesdbRepo = require('./routesdb.repository');
const BusinessRepo = require('./business.repository');
const AnalyticsRepo = require('./analytics.repository');
const RateCardRepo = require('./rate_card.repository');

// Services
const OverviewService = require('./overview.service');
const HitlService = require('./hitl.service');
const PipelineService = require('./pipeline.service');
const RoutesdbService = require('./routesdb.service');
const BusinessService = require('./business.service');
const AnalyticsService = require('./analytics.service');
const RateCardService = require('./rate_card.service');

// Controllers
const OverviewController = require('./overview.controller');
const HitlController = require('./hitl.controller');
const PipelineController = require('./pipeline.controller');
const RoutesdbController = require('./routesdb.controller');
const BusinessController = require('./business.controller');
const AnalyticsController = require('./analytics.controller');
const RateCardController = require('./rate_card.controller');

// Route factories
const overviewRoutes = require('./overview.routes');
const hitlRoutes = require('./hitl.routes');
const pipelineRoutes = require('./pipeline.routes');
const pipelineAgentsRoutes = require('./pipeline_agents.routes');
const routesdbRoutes = require('./routesdb.routes');
const businessRoutes = require('./business.routes');
const analyticsRoutes = require('./analytics.routes');

/**
 * Wire up all citation admin routes.
 * @param {Pool} citationPool - Citation DB pool (citation_db)
 * @param {Pool} authPool - Auth DB pool (for auth middleware and user enrichment fallback)
 * @param {Pool} docPool - docDB pool (preferred source for user profile enrichment)
 * @param {Pool} costPool - Citation Analytics cost DB pool (citationTest). Analytics tab only.
 */
module.exports = (citationPool, authPool, docPool, costPool = null) => {
    const router = express.Router();

    // Apply auth middleware (accepts ADMIN_TOKEN or JWT from dashboard)
    router.use(adminAuthMiddleware(authPool));

    // --- Overview ---
    const overviewRepo = new OverviewRepo(citationPool);
    const overviewService = new OverviewService(overviewRepo);
    const overviewController = new OverviewController(overviewService);
    router.use('/overview', overviewRoutes(overviewController));

    // --- HITL ---
    const hitlRepo = new HitlRepo(citationPool);
    const hitlService = new HitlService(hitlRepo);
    const hitlController = new HitlController(hitlService);
    router.use('/hitl', hitlRoutes(hitlController));

    // --- Pipeline ---
    const pipelineRepo = new PipelineRepo(citationPool);
    const pipelineService = new PipelineService(pipelineRepo);
    const pipelineController = new PipelineController(pipelineService);
    router.use('/pipeline', pipelineRoutes(pipelineController));

    // --- Pipeline Agents (dynamic) ---
    router.use('/pipeline', pipelineAgentsRoutes(citationPool));

    // --- Routes & DB ---
    const routesdbRepo = new RoutesdbRepo(citationPool);
    const routesdbService = new RoutesdbService(routesdbRepo);
    const routesdbController = new RoutesdbController(routesdbService);
    router.use('/routesdb', routesdbRoutes(routesdbController));

    // --- Business ---
    const businessRepo = new BusinessRepo(citationPool);
    const businessService = new BusinessService(businessRepo, authPool);
    const businessController = new BusinessController(businessService);
    router.use('/business', businessRoutes(businessController));

    // --- Analytics (citation_usage_events @ citationTest) ---
    // NOTE: uses costPool, NOT citationPool. Never fall back to citationPool here — that
    // would query a non-existent table against citation_db, which this feature must not touch.
    const analyticsRepo = new AnalyticsRepo(costPool);
    const analyticsService = new AnalyticsService(analyticsRepo, docPool, authPool);
    const analyticsController = new AnalyticsController(analyticsService);

    const rateCardRepo = new RateCardRepo(costPool);
    const rateCardService = new RateCardService(rateCardRepo);
    const rateCardController = new RateCardController(rateCardService);

    router.use('/analytics', analyticsRoutes(analyticsController, rateCardController));

    return router;
};

const express = require('express');
const adminAuthMiddleware = require('../../shared/middleware/adminAuth');

const UsersRepo = require('./usersAdmin.repository');
const UsersService = require('./usersAdmin.service');
const UsersController = require('./usersAdmin.controller');

/**
 * Wire up user management routes.
 * @param {Pool} authPool - Auth DB pool
 */
module.exports = (authPool) => {
    const router = express.Router();

    // Apply auth middleware (accepts ADMIN_TOKEN or JWT from dashboard)
    router.use(adminAuthMiddleware(authPool));

    // Wire DI
    const usersRepo = new UsersRepo(authPool);
    const usersService = new UsersService(usersRepo);
    const usersController = new UsersController(usersService);

    // GET /api/admin/users
    router.get('/', usersController.listUsers);

    // GET /api/admin/users/stats
    router.get('/stats', usersController.getUserStats);

    // GET /api/admin/users/pending
    router.get('/pending', usersController.getPendingApprovals);

    // POST /api/admin/users/:id/approve
    router.post('/:id/approve', usersController.approveUser);

    // POST /api/admin/users/:id/block
    router.post('/:id/block', usersController.blockUser);

    // POST /api/admin/users/:id/unblock
    router.post('/:id/unblock', usersController.unblockUser);

    return router;
};

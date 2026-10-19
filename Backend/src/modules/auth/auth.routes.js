
const express = require('express');
const { protect } = require('../../shared/middleware/authenticate');

module.exports = (pool) => {
  const router = express.Router();
  const { loginAdmin } = require('./auth.controller')(pool);

  router.post('/login', loginAdmin);

  router.get('/dashboard', protect(pool), (req, res) => {
    res.status(200).json({
      message: `Hello Admin ${req.user.id}`,
      user: req.user
    });
  });

  return router;
};
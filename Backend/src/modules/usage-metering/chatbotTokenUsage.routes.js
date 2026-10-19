const express = require('express');
const adminAuth = require('../../shared/middleware/adminAuth');
const { getStats, getStream } = require('./chatbotTokenUsage.controller');

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);

  // Standard REST endpoint — requires Bearer token in Authorization header
  r.get('/stats', auth, getStats);

  // SSE stream — token passed as ?token= because EventSource cannot send headers
  r.get('/stream', getStream);

  return r;
};

module.exports = router;

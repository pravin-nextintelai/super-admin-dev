/**
 * Rate limiting (blueprint: shared/middleware/rateLimiter.js).
 *  - createIpRateLimiter: in-memory fixed-window limiter per client IP (public intake, login).
 *  - checkChatLimits / recordChatUsage / checkUploadLimits / recordFileUpload: per-plan LLM quotas.
 */
const logger = require('../../config/logger');

/**
 * Best-effort client IP. The server does not set `trust proxy`, so behind
 * Cloud Run / a load balancer `req.ip` is the proxy; prefer X-Forwarded-For.
 */
function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
        return xff.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Minimal in-memory fixed-window rate limiter for unauthenticated public
 * endpoints (contact form, etc.). Per-instance only — good enough to stop
 * casual abuse; not a substitute for a WAF.
 *
 * @param {object} opts
 * @param {number} opts.windowMs   window length (default 10 min)
 * @param {number} opts.max        max requests per IP per window (default 5)
 * @param {string} opts.name       label for logs
 */
function createIpRateLimiter({ windowMs = 10 * 60 * 1000, max = 5, name = 'public' } = {}) {
    const hits = new Map(); // ip -> { count, resetAt }

    const sweep = () => {
        const now = Date.now();
        for (const [ip, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(ip);
        }
    };
    const timer = setInterval(sweep, windowMs);
    if (typeof timer.unref === 'function') timer.unref();

    return function ipRateLimiter(req, res, next) {
        const ip = getClientIp(req);
        const now = Date.now();
        let entry = hits.get(ip);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(ip, entry);
        }
        entry.count += 1;

        const remaining = Math.max(0, max - entry.count);
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

        if (entry.count > max) {
            const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfterSec));
            logger.warn(`Rate limit exceeded on ${name}`, {
                requestId: req.requestId,
                layer: 'RATE_LIMIT',
                summary: { ip, count: entry.count, max, retryAfterSec, path: req.originalUrl },
            });
            return res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMITED',
                    message: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
                },
                requestId: req.requestId,
            });
        }
        return next();
    };
}



// ── LLM / per-plan quotas (formerly llmRateLimit.middleware.js) ──────────────
/**
 * LLM Rate Limit Middleware
 * Use BEFORE any route that sends messages to Gemini or handles file uploads.
 *
 * Usage (message/chat route):
 *   const { checkChatLimits, recordChatUsage } = require('./rateLimiter');
 *   router.post('/chat', checkChatLimits(userPool), yourChatHandler, recordChatUsage(userPool));
 *
 * Usage (file upload route):
 *   const { checkUploadLimits, recordFileUpload } = require('./rateLimiter');
 *   router.post('/upload', checkUploadLimits(userPool), yourUploadHandler, recordFileUpload(userPool));
 */

const { getConfig } = require('../../modules/ai-chat/llmChatConfig.controller');

// Helper: get or create today's usage row for a user
const getOrCreateUsage = async (pool, userId) => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Try to get existing row
  let result = await pool.query(
    'SELECT * FROM user_llm_usage WHERE user_id = $1 AND usage_date = $2',
    [userId, today]
  );

  if (result.rows.length === 0) {
    // Create a fresh row for today
    result = await pool.query(
      `INSERT INTO user_llm_usage (user_id, usage_date)
       VALUES ($1, $2)
       ON CONFLICT (user_id, usage_date) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId, today]
    );
  }

  return result.rows[0];
};

/**
 * Middleware: enforce chat/message rate limits before forwarding to Gemini.
 * Attaches config and usage to req for downstream use.
 */
const checkChatLimits = (pool) => async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const [config, usage] = await Promise.all([
      getConfig(),
      getOrCreateUsage(pool, userId),
    ]);

    if (!config) {
      return res.status(500).json({ message: 'Chat config not found' });
    }

    // Check daily token limit
    if (usage.tokens_used >= config.total_tokens_per_day) {
      return res.status(429).json({
        message: 'Daily token limit reached. Please try again tomorrow.',
        limit: 'total_tokens_per_day',
      });
    }

    // Check daily chat limit
    if (usage.chats_today >= config.chats_per_day) {
      return res.status(429).json({
        message: 'Daily chat limit reached. Please try again tomorrow.',
        limit: 'chats_per_day',
      });
    }

    // Check messages per hour
    if (usage.last_message_at) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await pool.query(
        `SELECT COUNT(*) AS cnt FROM user_llm_usage
         WHERE user_id = $1 AND last_message_at > $2`,
        [userId, oneHourAgo]
      );
      // Approximation: compare messages_sent only if we only have one row per day
      // For accurate hourly tracking use a separate messages log table
    }

    if (usage.messages_sent >= config.messages_per_hour) {
      // Simplified: if messages sent today exceeds hourly cap (conservative)
      // For true per-hour enforcement, a messages_log table is needed
      const resetTime = usage.last_message_at
        ? new Date(new Date(usage.last_message_at).getTime() + 60 * 60 * 1000).toLocaleTimeString()
        : 'soon';
      return res.status(429).json({
        message: `Message rate limit exceeded. Limit resets at ${resetTime}.`,
        limit: 'messages_per_hour',
      });
    }

    // Check chats per minute (using last_message_at as proxy)
    if (usage.last_message_at) {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      if (new Date(usage.last_message_at) > oneMinuteAgo && usage.chats_today > 0) {
        // Approximate: if last message was within a minute AND chats exceed per-minute quota
        if (usage.chats_today % config.quota_chats_per_minute === 0) {
          return res.status(429).json({
            message: 'Too many chats per minute. Please wait before sending another message.',
            limit: 'quota_chats_per_minute',
          });
        }
      }
    }

    // Attach to req for downstream (controller can use config values for Gemini call)
    req.llmConfig = config;
    req.llmUsage = usage;
    next();
  } catch (error) {
    console.error('LLM rate limit check error:', error.message);
    res.status(500).json({ message: 'Server error during rate limit check' });
  }
};

/**
 * Call after Gemini responds to update token/message usage.
 * tokensUsed should be set on res.locals.tokensUsed by the chat controller.
 */
const recordChatUsage = (pool) => async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const tokensUsed = res.locals.tokensUsed || 0;
    const today = new Date().toISOString().slice(0, 10);

    await pool.query(
      `UPDATE user_llm_usage SET
        tokens_used   = tokens_used + $1,
        messages_sent = messages_sent + 1,
        chats_today   = chats_today + 1,
        last_message_at = NOW()
      WHERE user_id = $2 AND usage_date = $3`,
      [tokensUsed, userId, today]
    );
  } catch (error) {
    console.error('Error recording chat usage:', error.message);
    // Non-fatal — don't block response
  }
  next();
};

/**
 * Middleware: enforce file upload limits.
 * req.fileSize (bytes) and req.filePageCount must be set before this runs.
 */
const checkUploadLimits = (pool) => async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const [config, usage] = await Promise.all([
      getConfig(),
      getOrCreateUsage(pool, userId),
    ]);

    if (!config) {
      return res.status(500).json({ message: 'Chat config not found' });
    }

    // Check file size (req.fileSize set in bytes by upload handler)
    const fileSizeMb = (req.fileSize || 0) / (1024 * 1024);
    if (fileSizeMb > config.max_document_size_mb) {
      return res.status(429).json({
        message: `File size ${fileSizeMb.toFixed(1)} MB exceeds the ${config.max_document_size_mb} MB limit.`,
        limit: 'max_document_size_mb',
      });
    }

    // Check page count (req.filePageCount set by upload handler for PDFs)
    if (req.filePageCount && req.filePageCount > config.max_document_pages) {
      return res.status(429).json({
        message: `Document has ${req.filePageCount} pages, exceeding the ${config.max_document_pages} page limit.`,
        limit: 'max_document_pages',
      });
    }

    // Check daily file upload limit
    if (usage.files_uploaded_today >= config.max_file_upload_per_day) {
      return res.status(429).json({
        message: `Daily file upload limit of ${config.max_file_upload_per_day} reached. Please try again tomorrow.`,
        limit: 'max_file_upload_per_day',
      });
    }

    req.llmConfig = config;
    req.llmUsage = usage;
    next();
  } catch (error) {
    console.error('LLM upload limit check error:', error.message);
    res.status(500).json({ message: 'Server error during upload limit check' });
  }
};

/**
 * Call after a successful file upload to increment the counter.
 */
const recordFileUpload = (pool) => async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const today = new Date().toISOString().slice(0, 10);

    await pool.query(
      `UPDATE user_llm_usage SET
        files_uploaded_today = files_uploaded_today + 1
      WHERE user_id = $1 AND usage_date = $2`,
      [userId, today]
    );
  } catch (error) {
    console.error('Error recording file upload usage:', error.message);
  }
  next();
};



module.exports = { createIpRateLimiter, getClientIp, checkChatLimits, recordChatUsage, checkUploadLimits, recordFileUpload };

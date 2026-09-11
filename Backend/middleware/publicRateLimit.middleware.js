const logger = require('../config/logger');

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

module.exports = { createIpRateLimiter, getClientIp };

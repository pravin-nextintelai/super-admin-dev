/** HTTP-aware error: `statusCode` + machine-readable `code` (+ optional `details`), rendered by the module error handlers. */
class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

module.exports = ApiError;

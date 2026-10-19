# shared/validators
Cross-module Joi schemas. Module-specific request schemas stay next to their controller (e.g. `modules/referrals/salesReferrals.controller.js`); promote a schema here when a second module needs it. Request validation middleware: `shared/middleware/validateRequest.js`.

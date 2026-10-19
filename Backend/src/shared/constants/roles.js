/** Admin roles known to the dashboard (super-admin passes every `authorize([...])` check). */
const ROLES = Object.freeze({
  SUPER_ADMIN: 'super-admin',
  USER_ADMIN: 'user-admin',
  ACCOUNT_ADMIN: 'account-admin',
  FINANCE_ADMIN: 'finance-admin',
  MARKETING_ADMIN: 'marketing-admin',
  SUPPORT_ADMIN: 'support-admin',
  LEGACY_ADMIN: 'admin',
});

const FINANCE_ROLES = Object.freeze([ROLES.SUPER_ADMIN, ROLES.ACCOUNT_ADMIN, ROLES.FINANCE_ADMIN]);

module.exports = { ROLES, FINANCE_ROLES, ALL_ROLES: Object.freeze(Object.values(ROLES)) };

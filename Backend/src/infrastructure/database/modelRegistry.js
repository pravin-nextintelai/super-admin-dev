/**
 * Sequelize model registry (blueprint: infrastructure/database/modelRegistry.js).
 * Requiring this file registers every Sequelize model so `sequelize.sync()` sees them.
 * (Most of the backend uses raw `pg` queries; only templates and support use Sequelize.)
 */
const models = {
  Template: require('../../modules/templates/template.model'),
  UserTemplateUsage: require('../../modules/templates/userTemplateUsage.model'),
  SupportQuery: require('../../modules/support/supportQuery.model'),
  SupportPriority: require('../../modules/support/supportPriority.model'),
  SupportAdminProfile: require('../../modules/support/supportAdminProfile.model'),
};

module.exports = models;

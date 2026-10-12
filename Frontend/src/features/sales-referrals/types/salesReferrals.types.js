// Sales Referral Codes — shared enums and JSDoc typedefs.
// Shapes follow docs/sales-referrals-admin-api.md (section 9 = what the backend actually returns).

/** @typedef {'FREE' | 'PAID' | 'LAPSED'} PlanStatus */
export const PLAN_STATUS = Object.freeze({ FREE: 'FREE', PAID: 'PAID', LAPSED: 'LAPSED' });

/** @typedef {'ALL' | 'INTERNAL' | 'OUTSOURCED'} OwnerTypeFilter */
export const OWNER_TYPE_FILTER = Object.freeze({ ALL: 'ALL', INTERNAL: 'INTERNAL', OUTSOURCED: 'OUTSOURCED' });

/** @typedef {'ALL' | 'FREE' | 'PAID' | 'LAPSED'} PlanStatusFilter */

/** A10 availability result. @typedef {'AVAILABLE' | 'TAKEN' | 'INVALID_FORMAT'} CodeAvailabilityStatus */
export const CODE_AVAILABILITY = Object.freeze({ AVAILABLE: 'AVAILABLE', TAKEN: 'TAKEN', INVALID_FORMAT: 'INVALID_FORMAT' });

/** Public signup-side check (lives in the signup auth service). @typedef {'VALID' | 'INVALID' | 'INACTIVE'} ReferralCodeCheckResult */
export const REFERRAL_CHECK = Object.freeze({ VALID: 'VALID', INVALID: 'INVALID', INACTIVE: 'INACTIVE' });

/** A13 sort keys. */
export const OWNER_SORT_KEYS = Object.freeze(['name', 'signups', 'free', 'paid', 'lapsed', 'paidPercent']);

/**
 * Inclusive signup-date window, `YYYY-MM-DD` or null (= open), evaluated in Asia/Kolkata.
 * @typedef {{ from: string | null, to: string | null }} DateRange
 */

/**
 * @typedef {object} ReferralCode
 * @property {string} id
 * @property {string} [ownerId]
 * @property {string} code               upper case
 * @property {string | null} label
 * @property {boolean} active
 * @property {string | null} replacedByCode   code text of the replacement when refreshed
 * @property {string} createdAt
 * @property {string} [updatedAt]
 */

/**
 * A3 / A1 / A2 response.
 * @typedef {object} SalesOwner
 * @property {string} id
 * @property {string} name
 * @property {boolean} internal
 * @property {string | null} notes
 * @property {string} createdAt
 * @property {{ id: number | null, name: string } | null} [createdBy]
 * @property {string} [updatedAt]
 * @property {{ active: number, total: number }} [codeCounts]
 * @property {ReferralCode[]} codes
 */

/**
 * @typedef {object} SignupMix
 * @property {number} signups
 * @property {number} free
 * @property {number} paid
 * @property {number} lapsed
 * @property {number} paidPercent   round(paid × 100 / signups)
 */

/**
 * A12 response.
 * @typedef {object} ReferralSummary
 * @property {string | null} trackingSince
 * @property {number} totalSignups
 * @property {number} viaCode
 * @property {number} direct
 * @property {{ total: number, viaCode: number }} free
 * @property {{ total: number, viaCode: number }} paid
 * @property {{ total: number, viaCode: number }} lapsed
 * @property {number} paidPercent
 */

/**
 * A13 owner row.
 * @typedef {SignupMix & {
 *   id: string, name: string, internal: boolean, createdAt: string,
 *   codes: { active: number, total: number },
 * }} OwnerReportRow
 */

/**
 * A13 response.
 * @typedef {object} OwnersReport
 * @property {number} ownerCountAll   owners ignoring filters (0 = empty state)
 * @property {number} [codeCountAll]
 * @property {OwnerReportRow[]} owners
 * @property {SignupMix | null} direct   null when `type` is not ALL
 */

/**
 * A14 code row.
 * @typedef {SignupMix & {
 *   id: string, code: string, label: string | null, active: boolean, replacedByCode: string | null,
 * }} CodeReportRow
 */

/**
 * A14 response.
 * @typedef {object} OwnerCodesReport
 * @property {{ id: string, name: string, internal: boolean }} owner
 * @property {SignupMix} totals
 * @property {CodeReportRow[]} codes
 */

/**
 * A15 item.
 * @typedef {object} SignupRow
 * @property {string} tenantId
 * @property {string} firmName
 * @property {string | null} ownerEmail
 * @property {boolean} ownerAccountDeleted
 * @property {string} signedUpAt
 * @property {string | null} code
 * @property {PlanStatus} planStatus
 * @property {number} seats
 * @property {boolean} emailVerified
 * @property {'SIGNUP' | 'ADMIN'} source
 */

/**
 * A15 response (`page` is 0-based).
 * @typedef {object} SignupsPage
 * @property {{ type: 'CODE' | 'OWNER' | 'DIRECT', code: ReferralCode | null, owner: { id: string, name: string, internal: boolean } | null }} scope
 * @property {{ all: number, free: number, paid: number, lapsed: number }} statusCounts
 * @property {SignupRow[]} items
 * @property {number} page
 * @property {number} size
 * @property {number} totalItems
 * @property {number} totalPages
 */

/**
 * A16 / A17 referral block.
 * @typedef {object} ReferralBlock
 * @property {'CODE' | 'DIRECT'} referredBy
 * @property {boolean} tracked
 * @property {ReferralCode | null} code
 * @property {{ id: string, name: string, internal: boolean } | null} owner
 * @property {'SIGNUP' | 'ADMIN' | null} source
 * @property {string | null} signedUpAt
 * @property {{ id: number | null, name: string } | null} setBy
 * @property {string | null} setAt
 * @property {string | null} reason
 */

/**
 * A17 response.
 * @typedef {object} WorkspaceReferral
 * @property {string} tenantId
 * @property {string} firmName
 * @property {ReferralBlock} referral
 */

/**
 * A11 response group.
 * @typedef {{ owner: { id: string, name: string, internal: boolean }, codes: ReferralCode[] }} CodePickerGroup
 */

/**
 * Customer signup payload (signup-side service). `referralCode` must stay out of the request until
 * that backend accepts it — see signup/useReferralCode.js.
 * @typedef {object} RegisterPayload
 * @property {string} name
 * @property {string} email
 * @property {string} password
 * @property {string} [referralCode]
 */

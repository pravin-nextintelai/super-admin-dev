// "All referral data" page — enums and JSDoc typedefs.
// Data comes from GET /api/admin/onboarded-users (docs/ONBOARDED_USERS_API.md); the service maps the
// backend's snake_case objects to the camelCase rows below so components stay simple.

/** @typedef {import('./salesReferrals.types').PlanStatus} PlanStatus */
/** @typedef {import('./salesReferrals.types').DateRange} DateRange */

/** @typedef {'INTERNAL' | 'OUTSOURCED'} OwnerType */
export const OWNER_TYPE = Object.freeze({ INTERNAL: 'INTERNAL', OUTSOURCED: 'OUTSOURCED' });

/** Onboarding channel (`onboarding.channel`). SELF = direct signup. @typedef {'SELF' | 'INTERNAL' | 'OUTSOURCED'} Channel */
export const CHANNEL = Object.freeze({ SELF: 'SELF', INTERNAL: 'INTERNAL', OUTSOURCED: 'OUTSOURCED' });

/** `onboarding.source`: how the referral code got attached. @typedef {'SIGNUP' | 'ADMIN'} Attribution */
export const ATTRIBUTION = Object.freeze({ SIGNUP: 'SIGNUP', ADMIN: 'ADMIN' });

/** @typedef {'ALL' | 'FREE' | 'PAID' | 'LAPSED'} PlanStatusFilter */
export const PLAN_STATUS_FILTER = Object.freeze({ ALL: 'ALL', FREE: 'FREE', PAID: 'PAID', LAPSED: 'LAPSED' });

/** Timeline event types returned by GET /:userId (`timeline[].type`). @typedef {'SIGNUP' | 'SUBSCRIPTION' | 'SUBSCRIPTION_CANCELLED' | 'PAYMENT' | 'TOKEN_TOPUP' | 'STORAGE_ADDON'} TimelineEventType */
export const EVENT_TYPE = Object.freeze({
  SIGNUP: 'SIGNUP',
  SUBSCRIPTION: 'SUBSCRIPTION',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  PAYMENT: 'PAYMENT',
  TOKEN_TOPUP: 'TOKEN_TOPUP',
  STORAGE_ADDON: 'STORAGE_ADDON',
});

/** @typedef {'users' | 'history'} ExportKind  — `mode` of GET /export */
export const EXPORT_KIND = Object.freeze({ USERS: 'users', HISTORY: 'history' });

/** @typedef {'FILTERED' | 'ALL'} ExportScope */
export const EXPORT_SCOPE = Object.freeze({ FILTERED: 'FILTERED', ALL: 'ALL' });

export const REFERRAL_DATA_PAGE_SIZE = 10;

/**
 * One row of the "By user" table (mapped from a list `users[]` item).
 * @typedef {object} ReferralUserRow
 * @property {number} userId
 * @property {string} userEmail
 * @property {string} userName
 * @property {string | null} phone
 * @property {string | null} accountType        SOLO | FIRM_ADMIN | FIRM_USER
 * @property {string | null} domainRole
 * @property {string | null} approvalStatus
 * @property {boolean} isActive                  active and not blocked
 * @property {boolean} isBlocked
 * @property {{ id: string, name: string, type: string | null, role: string | null, city: string | null, state: string | null } | null} workspace
 * @property {string | null} organisation
 * @property {string | null} firmName            workspace name, else organisation
 * @property {Channel} channel
 * @property {string} channelLabel
 * @property {string | null} ownerId             null = Direct (SELF)
 * @property {string | null} ownerName
 * @property {OwnerType | null} ownerType
 * @property {string | null} code
 * @property {string | null} codeLabel
 * @property {boolean | null} codeActive
 * @property {'user' | 'workspace' | null} referralLevel
 * @property {Attribution | null} attribution    `onboarding.source`
 * @property {string | null} attributionSetAt
 * @property {string | null} attributionReason
 * @property {string} signedUpAt                 users.created_at (UTC ISO)
 * @property {string | null} lastLoginAt
 * @property {PlanStatus} planStatus
 * @property {string | null} activePlanName
 * @property {string | null} currentPlanName     active plan, else current subscription plan
 * @property {{ planName: string | null, status: string | null, startDate: string | null, endDate: string | null, isExpired: boolean | null, price: number | null, intervalMonths: number | null } | null} currentSubscription
 * @property {number} subscriptions
 * @property {string[]} planNames
 * @property {number} purchaseCount              captured subscription payments
 * @property {number} topupCount                 completed token top-ups
 * @property {number} storageAddonCount          completed storage add-ons
 * @property {number} totalPaidInr               subscriptions + top-ups + storage
 * @property {number} subscriptionPaid
 * @property {number} topupPaid
 * @property {number} storagePaid
 * @property {string | null} firstPurchaseAt     first captured payment
 * @property {string | null} lastPurchaseAt      last captured payment
 * @property {number | null} lastPaymentAmount
 */

/**
 * One timeline event (mapped from `timeline[]`).
 * @typedef {object} TimelineEvent
 * @property {string} id
 * @property {TimelineEventType} type
 * @property {string} occurredAt
 * @property {string} title
 * @property {string | null} detail
 * @property {number | null} amountInr
 * @property {string | null} currency
 * @property {string | null} status           active / cancelled / captured / failed / completed / pending …
 * @property {number | string | null} refId
 */

/** A paid event joined with its user (rows of the "Payments" tab). @typedef {TimelineEvent & { user: ReferralUserRow }} ReferralPaymentRow */

/**
 * Filters shared by every call on the page. `page` is 1-based.
 * @typedef {object} ReferralDataFilters
 * @property {DateRange} dateRange            onboarding date window (users.created_at, IST days)
 * @property {string} [ownerId]               sales_owners.id
 * @property {string} [code]                  referral code text
 * @property {'ALL' | OwnerType} ownerType    INTERNAL → channel=internal, OUTSOURCED → channel=outsourced
 * @property {PlanStatusFilter} planStatus
 * @property {boolean} includeDirect          false → channel excludes SELF
 * @property {string} [search]
 * @property {number} page
 * @property {number} pageSize
 */

export const DEFAULT_REFERRAL_DATA_FILTERS = Object.freeze({
  dateRange: { from: null, to: null },
  ownerId: undefined,
  code: undefined,
  ownerType: 'ALL',
  planStatus: PLAN_STATUS_FILTER.ALL,
  includeDirect: true,
  search: '',
  page: 1,
  pageSize: REFERRAL_DATA_PAGE_SIZE,
});

/**
 * Summary cards (GET /summary with the page filters, status filter included).
 * @typedef {object} ReferralDataSummary
 * @property {number} users
 * @property {number} viaCode                 INTERNAL + OUTSOURCED
 * @property {number} direct                  SELF
 * @property {number} paidNow
 * @property {number} free
 * @property {number} lapsed
 * @property {number} withWorkspace
 * @property {number} payments                captured subscription payments
 * @property {number} totalPaidInr
 * @property {number} subscriptionPaid
 * @property {number} topupPaid
 * @property {number} storagePaid
 * @property {number} paidRatePct
 * @property {boolean} truncated
 */

/** @typedef {{ all: number, free: number, paid: number, lapsed: number }} StatusCounts */

/**
 * @typedef {object} ReferralUsersPage
 * @property {ReferralUserRow[]} items
 * @property {number} page
 * @property {number} size
 * @property {number} totalItems
 * @property {number} totalPages
 * @property {boolean} truncated
 */

/**
 * GET /:userId mapped.
 * @typedef {object} UserHistory
 * @property {number} userId
 * @property {ReferralUserRow} user
 * @property {TimelineEvent[]} events          oldest first
 * @property {object[]} subscriptions
 * @property {object[]} payments
 * @property {object[]} topups
 * @property {object[]} storageAddons
 * @property {{ totalGb: number, fileCount: number } | null} storage
 * @property {{ level: string, changedAt: string, previousCode: string | null, newCode: string | null, reason: string | null, changedBy: string | null }[]} referralHistory
 */

/** Owner + codes for the filter selects (from GET /meta). @typedef {{ id: string, name: string, internal: boolean, codes: { id: string, code: string, label: string | null, active: boolean }[] }} ReferralDataOwner */

/** @typedef {{ blob: Blob, fileName: string, rowCount: number | null }} CsvExportResult */

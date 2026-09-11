# Super Admin Portal — Admin Roles Guide

> **Last updated:** 11 September 2026  
> **Status:** Current with the Marketing Admin + Finance Admin rollout (roles, APIs, UI, test logins, and end-to-end logs) and the Marketing **Contact Enquiries** backend (website contact form → IST timeline).

This is the source of truth for **portal** administrator roles in `super-admin-dev`. It is not the Jurinex end-user app.

---

## Contents

1. [What this portal is](#1-what-this-portal-is)
2. [Test credentials (dev)](#2-test-credentials-dev)
3. [Role catalog](#3-role-catalog)
4. [Access matrix](#4-access-matrix)
5. [Marketing Admin](#5-marketing-admin)
6. [Finance Admin](#6-finance-admin)
7. [Login contract](#7-login-contract)
8. [Plan analytics API](#8-plan-analytics-api)
9. [Implementation map](#9-implementation-map)
10. [QA checklist](#10-qa-checklist)
11. [Troubleshooting](#11-troubleshooting)
12. [End-to-end console logs](#12-end-to-end-console-logs)

---

## 1. What this portal is

| Piece | Local URL |
|---|---|
| Frontend login | `http://localhost:3001/login` |
| Backend login | `POST http://localhost:4000/api/auth/login` |
| Auth database | `Auth_DB` → `super_admins` + `admin_roles` |

Login looks up the email in `super_admins`, **inner-joins** `admin_roles` for the role name, then issues a JWT `{ id, role }`. The frontend stores `token`, `userRole`, `userEmail`, and `userName` in `localStorage`.

A **404 Admin not found** means that email is not in `super_admins` (or has no matching `admin_roles` row). Regular Jurinex `users` cannot log in here.

```
Browser  →  POST /api/auth/login
              ↓
         super_admins  JOIN  admin_roles
              ↓
         JWT { id, role }  →  localStorage.userRole
              ↓
         Sidebar  +  RequireRole  +  API protect()/authorize()
```

**Role Management** in the sidebar is **not** this list. That page is for Jurinex **app / prompt** roles (token limits). Portal logins are only `super_admins` + `admin_roles`.

---

## 2. Test credentials (dev)

Seeded into `Auth_DB.super_admins`. Use them at **http://localhost:3001/login**.

| Role | Name | Email | Password | Lands on |
|---|---|---|---|---|
| **Marketing Admin** | Marketing Admin | `marketing.admin@jurinex.dev` | `Marketing@1234` | `/dashboard/demo-bookings` |
| **Finance Admin** | Finance Admin | `finance.admin@jurinex.dev` | `Finance@1234` | `/dashboard/subscriptions/users` |

**How to test**

1. Backend: `cd Backend && npm start` (or `npm run dev`).
2. Frontend: `cd Frontend && npm run dev`.
3. Open `http://localhost:3001/login`.
4. Log in with a row above. Confirm the sidebar matches [§4](#4-access-matrix).

Re-seed roles and reset these two passwords (idempotent):

```bash
cd Backend
node migrations/seed_marketing_admin_role.js
node migrations/seed_finance_admin_role.js
node migrations/seed_marketing_and_finance_test_admins.js
```

> Dev/test only. Rotate or delete these accounts before any production use.

---

## 3. Role catalog

Portal roles live in `admin_roles`. Create Admin fails with `Invalid role` if the slug is missing from that table.

| Role slug | Label | Purpose | Home after login |
|---|---|---|---|
| `super-admin` | Super Admin | Full portal, including creating other admins | `/dashboard` |
| `user-admin` | User Admin | Jurinex users, firms, per-user analytics, content | `/dashboard/users` |
| `account-admin` | Account Admin | Create / edit / delete subscription plans | `/dashboard/subscriptions` |
| `finance-admin` | Finance Admin | **Read-only** money: subscriptions, paid users, amounts, income | `/dashboard/subscriptions/users` |
| `marketing-admin` | Marketing Admin | Demo bookings, website contact enquiries, newsletter subscribers + AI chatbot documents | `/dashboard/demo-bookings` |
| `support-admin` | Support Admin | Support workspace / tickets | `/dashboard/support` |

Legacy slug `admin` still passes `RequireRole` like super-admin.

---

## 4. Access matrix

Super Admin can open every page. Other roles:

| Page | Path | Super | User | Account | **Finance** | **Marketing** | Support |
|---|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | ✓ | redirected to users | redirected to subscriptions | redirected to users & plans | redirected to demos | redirected to support |
| User Management | `/dashboard/users` | ✓ | ✓ | | | | |
| User / firm analytics | `/dashboard/users/:id/analytics` | ✓ | ✓ | ✓ (from Users & Plans) | ✓ (from plan / users drill-in) | | |
| Admin Management | `/dashboard/admins` | ✓ | | | | | |
| Prompt / LLM / Templates / Roles / Voice / Judgements / Citations | various | ✓ | | | | | |
| AI Chatbot | `/dashboard/documents` | ✓ | | | | ✓ | |
| Demo Bookings | `/dashboard/demo-bookings` | ✓ | | | | ✓ **home** | |
| Contact Enquiries | `/dashboard/contact-enquiries` | ✓ | | | | ✓ | |
| Newsletter Subscribers | `/dashboard/newsletter-subscribers` | ✓ | | | | ✓ | |
| Offers & Events | `/dashboard/offers-events` | ✓ | | | | ✓ | |
| Subscription catalog | `/dashboard/subscriptions` | ✓ | | ✓ (edit) | ✓ **view only** | | |
| Plan Analytics | `/dashboard/subscriptions/analytics` | ✓ | | ✓ | ✓ | | |
| Users & Plans | `/dashboard/subscriptions/users` | ✓ | | ✓ | ✓ **home** | | |
| Support | `/dashboard/support` | ✓ | | | | | ✓ |
| Settings | `/dashboard/settings` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Finance Admin **cannot** add, edit, delete, or toggle plans. Account Admin still can. Sidebar shows **Plan Analytics** as its own item for super / account / finance.

---

## 5. Marketing Admin

Handles product demos and chatbot knowledge documents. No users, money, or plan CRUD.

| Sidebar | Behaviour |
|---|---|
| **Demo Bookings** | Default home. Stats, booking list, status, invite email, delete |
| **Contact Enquiries** | "Contact Jurinex" website form submissions. KPI cards (today / month in IST, awaiting contact, avg first response), filterable list with IST submission time, detail drawer with contact tracking, "Log a contact" form (call / email / WhatsApp / SMS / meeting with IST time), status / priority / assignee, internal notes, activity timeline, server CSV export. Delete is hidden for marketing (super-admin only). |
| **Newsletter Subscribers** | Website newsletter sign-ups from `newsletter_subscribers`. List shows **email, IP address, browser, OS, device, and subscribed time (IST)**. Search, device / date filters, detail drawer (full user agent + page URL), CSV export. |
| **Offers & Events** | Create header-bar **offers** (badge, copy, CTA, IST deadline) and **events** (time slots + seat capacity / booked seats). Active items are fetched by the user website above the header via `GET /api/public/promos/header`. |
| **AI Chatbot** | Upload / list / delete chatbot documents, config |
| **Settings** | Profile / logout |

Demo, contact-enquiry and chatbot routes use `adminAuth.middleware.js`, which allows `marketing-admin`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/demo/stats` | Booking counts by status |
| `GET` | `/api/admin/demo/bookings` | Paginated bookings |
| `PATCH` | `/api/admin/demo/bookings/:id/status` | Update status |
| `POST` | `/api/admin/demo/bookings/:id/send-invite` | Send invite |
| `DELETE` | `/api/admin/demo/bookings/:id` | Delete booking |
| `GET` / `POST` / `DELETE` | `/api/admin/documents…` | Chatbot document pipeline |
| `GET` / `PUT` | `/api/admin/chatbot-config` | Chatbot model / voice |
| `GET` | `/api/admin/contact-enquiries/stats` | KPI totals (today / 7d / month in IST), response time, by-status, by-topic, 14-day trend |
| `GET` | `/api/admin/contact-enquiries/meta` | Dropdown values + assignable admins |
| `GET` | `/api/admin/contact-enquiries` | Paginated list; filters `status`, `topic`, `priority`, `consent`, `assigned`, `search`, `from`/`to` (IST days), `sort` |
| `GET` | `/api/admin/contact-enquiries/export` | CSV with IST columns (same filters) |
| `GET` | `/api/admin/contact-enquiries/:id` | Enquiry + activity timeline |
| `PATCH` | `/api/admin/contact-enquiries/:id` | Change `status` / `priority` / `assigned_to`, optional `note` |
| `POST` | `/api/admin/contact-enquiries/:id/contact-log` | Record a call / email / WhatsApp / SMS / meeting with the IST time it happened |
| `POST` | `/api/admin/contact-enquiries/:id/notes` | Internal note |
| `DELETE` | `/api/admin/contact-enquiries/:id` | **Super-admin only** (marketing marks `spam` / `closed`) |
| `GET` | `/api/admin/newsletter-subscribers/stats` | Totals (today / 7d / month IST, unique IPs) |
| `GET` | `/api/admin/newsletter-subscribers` | Paginated list; filters `search`, `device_type`, `from`/`to` (IST days), `sort` |
| `GET` | `/api/admin/newsletter-subscribers/export` | CSV with IP, browser, OS, IST time |
| `GET` | `/api/admin/newsletter-subscribers/:id` | One subscriber (full user agent) |
| `POST` | `/api/public/newsletter` | Website form (no auth). Captures IP, browser, OS, device, user agent, page URL. Unique email. |
| `GET` | `/api/admin/promos/stats` | Offer / event counts + live-on-header |
| `GET` | `/api/admin/promos` | Paginated offers & events |
| `POST` | `/api/admin/promos` | Create offer or event (slots, seats, IST deadline) |
| `PUT` | `/api/admin/promos/:id` | Update |
| `PATCH` | `/api/admin/promos/:id/status` | `active` / `draft` / `paused` |
| `DELETE` | `/api/admin/promos/:id` | Remove |
| `GET` | `/api/public/promos/header` | Active header bar item(s) for jurinex.ai (no auth) |
| `POST` | `/api/public/promos/:id/book` | Book an event seat (optional `slot_id`, email) |

**Contact enquiries — how it works**

- The website posts to `POST /api/public/contact` (no auth, own CORS via `CONTACT_FORM_ALLOWED_ORIGINS`, 5 submissions / IP / 10 min, honeypot field `website`, 2-minute duplicate guard). Rows land in `contact_enquiries` (Auth DB) with reference `CE-YYYYMMDD-NNNNN` (IST date).
- Every timestamp comes back as UTC **and** as an `*_ist` object (`display: "Fri, 11 Sep 2026, 02:35 PM IST"`), so the tab never needs to convert time zones.
- "When did we contact them?" = `first_contacted_at_ist` / `last_contacted_at_ist`, set by the contact-log endpoint (or by moving status to `contacted`). `first_response_time` shows submitted → first contact.
- Optional emails: `CONTACT_NOTIFY_EMAIL` (alert to the marketing inbox), `CONTACT_ACK_EMAIL_ENABLED=true` (acknowledgement to the visitor). Both off unless set.
- Full request / response samples: [Backend/documentation.md → H) Contact Enquiries](../Backend/documentation.md#h-contact-enquiries-marketing).

Create more: Super Admin → **Admin Management** → Create Admin → **Marketing Admin**.

---

## 6. Finance Admin

Sees **who paid** and **how much**. Does not change plans, users, or demos.

| Sidebar | Behaviour |
|---|---|
| **Users & Plans** | Default home. All monthly + top-up + add-on buyers, filters, CSV export |
| **Plan Analytics** | Totals + per-plan tables + drill-in to buyers |
| **Subscription Management** | Catalog only (`canMutate === false`) |
| **Settings** | Profile / logout |

KPI cards on Plan Analytics come from `GET /api/admin/plan-analytics/summary` → `data.totals`.

| KPI | Meaning | Source (Payment DB) |
|---|---|---|
| **Total subscriptions** | All `user_subscriptions` rows | `user_subscriptions` |
| **Paid users** | Distinct users with a successful payment | `payments` ∪ `user_token_topup_purchases` ∪ `user_storage_addon_purchases` |
| **Plan revenue** | Successful subscription payments | `payments` status in `captured`, `paid`, `success`, `succeeded`, `completed` |
| **Total income** | Plan + topup + add-on | those three tables |

Each monthly plan also has `subscribers`, `active_subscribers`, `paid_users`, and `revenue`. Click a plan for buyers, then **Analytics** for that user’s billing page (`/dashboard/users/:id/analytics`).

Create more: Super Admin → **Admin Management** → Create Admin → **Finance Admin**.

---

## 7. Login contract

`POST /api/auth/login`

```json
{
  "success": true,
  "token": "<jwt>",
  "admin": {
    "id": 19,
    "name": "Finance Admin",
    "email": "finance.admin@jurinex.dev",
    "role": "finance-admin"
  }
}
```

Landing paths (`Frontend/src/App.jsx` `ROLE_HOME` and `LoginPage.jsx`):

| `role` | Path |
|---|---|
| `super-admin` | `/dashboard` |
| `user-admin` | `/dashboard/users` |
| `account-admin` | `/dashboard/subscriptions` |
| `finance-admin` | `/dashboard/subscriptions/users` |
| `marketing-admin` | `/dashboard/demo-bookings` |
| `support-admin` | `/dashboard/support` |

---

## 8. Plan analytics API

Mounted at `/api/admin/plan-analytics`. Roles: `super-admin`, `user-admin`, `account-admin`, `finance-admin`.

| Method | Path |
|---|---|
| `GET` | `/summary` |
| `GET` | `/subscribers` |
| `GET` | `/subscribers/export` |
| `GET` | `/monthly/:planId/subscribers` |
| `GET` | `/topup/:planId/buyers` |
| `GET` | `/addon/:planId/buyers` |

`GET /subscribers` is the paginated Users & Plans list (monthly subscribers plus top-up / add-on-only buyers). Query: `page`, `pageSize` (max 50), `planId`, `topupPlanId`, `addonPlanId`, `month` (`YYYY-MM`), `day` (`YYYY-MM-DD`, overrides month), `search` (username/email), optional `status` (`active`, `topup_only`, `pack_only`, …). Response includes `data.rows`, `data.total`, and `data.filters` (`plans`, `topupPlans`, `addonPlans`, `statuses`). Rows include pack names, `paid_total`, and `last_paid_at`.

`GET /subscribers/export` downloads a UTF-8 CSV (BOM + IST dates) of **all matching rows** (same filters, not just the current page). Open in Excel. No filters = full list. Filters = only those rows. Cap 10,000 rows.

User billing drill-in: `/api/admin/user-analytics/*` allows `super-admin`, `user-admin`, `account-admin`, `finance-admin`.

Example `data.totals` from `/summary`:

```json
{
  "currency": "INR",
  "total_subscriptions": 24,
  "active_subscribers": 20,
  "paid_users": 11,
  "monthly_revenue": 148851,
  "topup_revenue": 490,
  "addon_revenue": 1144,
  "total_income": 150485
}
```

Numbers are live from Payment DB; they change as payments land.

---

## 9. Implementation map

### Backend

| Piece | File |
|---|---|
| Login + landing in logs | `Backend/controllers/authController.js` |
| JWT + `authorize()` | `Backend/middleware/authMiddleware.js` |
| `/api/admin/*` JWT allow-list (includes finance + marketing) | `Backend/middleware/adminAuth.middleware.js` |
| Structured portal logs helper | `Backend/utils/portalAdminLog.js` |
| Plan analytics + totals | `Backend/controllers/planAnalyticsController.js` |
| Analytics route roles | `Backend/routes/planAnalyticsRoutes.js`, `userAnalyticsRoutes.js` |
| Demo bookings | `Backend/controllers/demoController.js` |
| Contact enquiries (admin API) | `Backend/routes/contactEnquiryRoutes.js`, `Backend/controllers/contactEnquiryController.js`, `Backend/services/contactEnquiryService.js` |
| Contact form public intake | `Backend/routes/publicContactRoutes.js`, `Backend/middleware/publicRateLimit.middleware.js` |
| Newsletter subscribers (admin API) | `Backend/routes/newsletterSubscriberRoutes.js`, `Backend/controllers/newsletterSubscriberController.js`, `Backend/services/newsletterSubscriberService.js` |
| Newsletter public intake | `Backend/routes/publicNewsletterRoutes.js` (`POST /api/public/newsletter`) |
| Newsletter table | `Backend/migrations/create_newsletter_subscribers_table.sql` (`npm run migrate:newsletter-subscribers`) |
| Offers & events (admin API) | `Backend/routes/marketingPromoRoutes.js`, `Backend/controllers/marketingPromoController.js`, `Backend/services/marketingPromoService.js` |
| Offers public header | `Backend/routes/publicPromoRoutes.js` (`GET /api/public/promos/header`) |
| Contact enquiry tables + IST helpers | `Backend/migrations/create_contact_enquiries_tables.sql` (`npm run migrate:contact-enquiries`), `Backend/utils/time.js` (`formatIST`), `Backend/utils/contactEnquiryEmails.js` |
| Role seeds | `Backend/migrations/seed_marketing_admin_role.js`, `seed_finance_admin_role.js` |
| Test logins | `Backend/migrations/seed_marketing_and_finance_test_admins.js` |

### Frontend

| Piece | File |
|---|---|
| Create / edit role dropdowns | `Frontend/src/components/auth/Admins/CreateAdmin.jsx`, `AdminManagement.jsx` |
| Route guard + home | `Frontend/src/App.jsx` (`ROLE_HOME`, `RequireRole`) |
| Sidebar (incl. Plan Analytics + Users & Plans) | `Frontend/src/pages/dashboard/Sidebar.jsx` |
| Login landing + `[AuthLogin]` logs | `Frontend/src/components/auth/LoginPage.jsx` |
| Income KPIs | `Frontend/src/pages/dashboard/PlanAnalytics.jsx` |
| Users & Plans list | `Frontend/src/pages/dashboard/FinanceSubscribers.jsx` |
| Finance view-only catalog | `Frontend/src/pages/dashboard/SubscriptionManagement.jsx` (`canMutate`) |
| Marketing Contact Enquiries tab | `Frontend/src/pages/dashboard/ContactEnquiries.jsx`, `Frontend/src/services/contactEnquiryApi.js` |
| Marketing Newsletter Subscribers tab | `Frontend/src/pages/dashboard/NewsletterSubscribers.jsx`, `Frontend/src/services/newsletterSubscriberApi.js` |
| Marketing Offers & Events tab | `Frontend/src/pages/dashboard/MarketingPromos.jsx`, `Frontend/src/services/promoApi.js` |
| User-site header bar | `Frontend/src/components/SitePromoBanner.jsx` (Landing + Login; jurinex.ai should call the same public API) |
| Debug logger | `Frontend/src/utils/debugLogger.js` |

---

## 10. QA checklist

**Marketing Admin** (`marketing.admin@jurinex.dev` / `Marketing@1234`)

- [ ] Login succeeds and opens Demo Bookings
- [ ] Sidebar: Demo Bookings, Contact Enquiries, Newsletter Subscribers, Offers & Events, AI Chatbot, Settings only
- [ ] Bookings load; status / invite work
- [ ] Contact Enquiries tab: KPI cards load, rows show "Submitted (IST)", drawer opens, "Log a contact" stamps first contacted time, no Delete button
- [ ] Newsletter Subscribers tab: list shows email, IP, browser, OS, device, subscribed time (IST); drawer shows full user agent
- [ ] Offers & Events: create an active offer with IST deadline; it appears above the header on `/` (logged out)
- [ ] `GET /api/public/promos/header` returns the live offer; `GET /api/admin/promos` returns `200` for marketing-admin
- [ ] `GET /api/admin/newsletter-subscribers` returns `200` with `subscribed_at_ist.display`
- [ ] `GET /api/admin/contact-enquiries/stats` and list return `200` with `submitted_at_ist.display` in IST
- [ ] `POST /api/admin/contact-enquiries/:id/contact-log` sets `first_contacted_at_ist`; `DELETE` returns `403` for marketing
- [ ] `/dashboard/users` and `/dashboard/subscriptions` redirect away
- [ ] `/dashboard/admins` is blocked
- [ ] Backend shows `AUTH_LOGIN` then `DEMO_ADMIN`; browser shows `[AuthLogin]` + `[DemoManagement]`

**Finance Admin** (`finance.admin@jurinex.dev` / `Finance@1234`)

- [ ] Login succeeds and opens Plan Analytics
- [ ] Top cards: Total subscriptions, Paid users, Plan revenue, Total income
- [ ] Monthly / topup / add-on tabs; click a plan to see buyers
- [ ] Subscription Management is view-only (no Add / Edit / Delete)
- [ ] Sidebar has no Users, Admins, Prompts, Demos
- [ ] User Analytics from a buyer row loads
- [ ] Backend shows `PLAN_ANALYTICS`; browser shows `[PlanAnalytics]` + `[AnalyticsApi]`

**Super Admin**

- [ ] Create Admin offers Marketing Admin and Finance Admin
- [ ] Admin Management edit dropdown includes both roles

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Login `404 Admin not found` | Email not in `super_admins` (or inner join to `admin_roles` failed) | Use [§2](#2-test-credentials-dev) or create the admin in Admin Management |
| Login `401 Invalid credentials` | Wrong password | Re-run `seed_marketing_and_finance_test_admins.js` |
| Analytics page opens but 403 | JWT role not on plan-analytics allow-list | Confirm `finance-admin` in `planAnalyticsRoutes.js`; restart backend |
| Create Admin → `Invalid role` | Missing `admin_roles` row | Run the marketing / finance role seed scripts |
| Finance can still edit plans | Stale frontend | Restart Vite; confirm `canMutate` in Subscription Management |
| Marketing cannot load demos | Role not in `adminAuth` allow-list | Confirm `marketing-admin` in `adminAuth.middleware.js` |
| No browser logs | Groups are collapsed | Open DevTools → Console; expand `[AuthLogin]` / `[PlanAnalytics]` |

---

## 12. End-to-end console logs

Passwords and JWT bodies are never printed. Login logs `password: '[hidden]'` only.

**Backend** (terminal running `npm start`): layers `AUTH_LOGIN`, `AUTH`, `PLAN_ANALYTICS`, `DEMO_ADMIN`, `CONTACT_ENQUIRY`, `PORTAL_ADMIN`. Finance/marketing JWT grant logs are `info`; other roles stay `debug`.

| Stage | What you should see |
|---|---|
| Login | `Admin login attempt` → `lookup complete` → `success` with `role` + `landingPath` |
| JWT / authorize | `Admin JWT accepted` and `Authorization granted` |
| Finance analytics | `Plan analytics summary loaded` with totals + monthly table |
| Finance drill-in | `monthly subscribers` / `topup buyers` / `addon buyers` loaded |
| Users & Plans list | `Plan analytics subscribers list loaded` with filters + rowCount |
| Marketing demos | `Demo booking stats loaded`, `Demo bookings list loaded`, status / invite |
| Marketing contact enquiries | `Contact enquiry submitted` (website), `Contact enquiry stats loaded`, `Contact enquiries list loaded`, `Contact enquiry: contact logged` with `contacted_at_ist` |
| Marketing newsletter | `Newsletter subscriber saved` (website), `Newsletter subscriber stats loaded`, `Newsletter subscribers list loaded` |

**Browser** (F12): `[AuthLogin]`, `[RequireRole]`, `[Sidebar]`, `[PlanAnalytics]`, `[FinanceSubscribers]`, `[AnalyticsApi]`, `[SubscriptionManagement]`, `[DemoManagement]`, `[ContactEnquiries]`, `[CreateAdmin]`.

Collapsed groups contain Summary / Input / Output / Metrics / table.

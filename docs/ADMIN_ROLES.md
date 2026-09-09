# Super Admin Portal — Admin Roles Guide

> **Last updated:** 7 September 2026  
> **Status:** Current with the Marketing Admin + Finance Admin rollout (roles, APIs, UI, test logins, and end-to-end logs).

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
| **Finance Admin** | Finance Admin | `finance.admin@jurinex.dev` | `Finance@1234` | `/dashboard/subscriptions/analytics` |

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
| `finance-admin` | Finance Admin | **Read-only** money: subscriptions, paid users, amounts, income | `/dashboard/subscriptions/analytics` |
| `marketing-admin` | Marketing Admin | Demo bookings + AI chatbot documents | `/dashboard/demo-bookings` |
| `support-admin` | Support Admin | Support workspace / tickets | `/dashboard/support` |

Legacy slug `admin` still passes `RequireRole` like super-admin.

---

## 4. Access matrix

Super Admin can open every page. Other roles:

| Page | Path | Super | User | Account | **Finance** | **Marketing** | Support |
|---|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | ✓ | redirected to users | redirected to subscriptions | redirected to analytics | redirected to demos | redirected to support |
| User Management | `/dashboard/users` | ✓ | ✓ | | | | |
| User / firm analytics | `/dashboard/users/:id/analytics` | ✓ | ✓ | ✓ (from Users & Plans) | ✓ (from plan / users drill-in) | | |
| Admin Management | `/dashboard/admins` | ✓ | | | | | |
| Prompt / LLM / Templates / Roles / Voice / Judgements / Citations | various | ✓ | | | | | |
| AI Chatbot | `/dashboard/documents` | ✓ | | | | ✓ | |
| Demo Bookings | `/dashboard/demo-bookings` | ✓ | | | | ✓ **home** | |
| Subscription catalog | `/dashboard/subscriptions` | ✓ | | ✓ (edit) | ✓ **view only** | | |
| Plan Analytics | `/dashboard/subscriptions/analytics` | ✓ | | ✓ | ✓ **home** | | |
| Users & Plans | `/dashboard/subscriptions/users` | ✓ | | ✓ | ✓ | | |
| Support | `/dashboard/support` | ✓ | | | | | ✓ |
| Settings | `/dashboard/settings` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Finance Admin **cannot** add, edit, delete, or toggle plans. Account Admin still can. Sidebar shows **Plan Analytics** as its own item for super / account / finance.

---

## 5. Marketing Admin

Handles product demos and chatbot knowledge documents. No users, money, or plan CRUD.

| Sidebar | Behaviour |
|---|---|
| **Demo Bookings** | Default home. Stats, booking list, status, invite email, delete |
| **AI Chatbot** | Upload / list / delete chatbot documents, config |
| **Settings** | Profile / logout |

Demo and chatbot routes use `adminAuth.middleware.js`, which allows `marketing-admin`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/demo/stats` | Booking counts by status |
| `GET` | `/api/admin/demo/bookings` | Paginated bookings |
| `PATCH` | `/api/admin/demo/bookings/:id/status` | Update status |
| `POST` | `/api/admin/demo/bookings/:id/send-invite` | Send invite |
| `DELETE` | `/api/admin/demo/bookings/:id` | Delete booking |
| `GET` / `POST` / `DELETE` | `/api/admin/documents…` | Chatbot document pipeline |
| `GET` / `PUT` | `/api/admin/chatbot-config` | Chatbot model / voice |

Create more: Super Admin → **Admin Management** → Create Admin → **Marketing Admin**.

---

## 6. Finance Admin

Sees **who paid** and **how much**. Does not change plans, users, or demos.

| Sidebar | Behaviour |
|---|---|
| **Plan Analytics** | Default home. Totals + per-plan tables + drill-in to buyers |
| **Users & Plans** | All monthly-plan subscribers with search and plan / month / day filters |
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
| `finance-admin` | `/dashboard/subscriptions/analytics` |
| `marketing-admin` | `/dashboard/demo-bookings` |
| `support-admin` | `/dashboard/support` |

---

## 8. Plan analytics API

Mounted at `/api/admin/plan-analytics`. Roles: `super-admin`, `user-admin`, `account-admin`, `finance-admin`.

| Method | Path |
|---|---|
| `GET` | `/summary` |
| `GET` | `/subscribers` |
| `GET` | `/monthly/:planId/subscribers` |
| `GET` | `/topup/:planId/buyers` |
| `GET` | `/addon/:planId/buyers` |

`GET /subscribers` is the paginated Users & Plans list. Query: `page`, `pageSize` (max 50), `planId`, `topupPlanId` (bought that top-up pack), `month` (`YYYY-MM`), `day` (`YYYY-MM-DD`, overrides month), `search` (username/email), optional `status`. Response includes `data.rows`, `data.total`, `data.filters.plans`, and `data.filters.topupPlans`.

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
| Debug logger | `Frontend/src/utils/debugLogger.js` |

---

## 10. QA checklist

**Marketing Admin** (`marketing.admin@jurinex.dev` / `Marketing@1234`)

- [ ] Login succeeds and opens Demo Bookings
- [ ] Sidebar: Demo Bookings, AI Chatbot, Settings only
- [ ] Bookings load; status / invite work
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

**Backend** (terminal running `npm start`): layers `AUTH_LOGIN`, `AUTH`, `PLAN_ANALYTICS`, `DEMO_ADMIN`, `PORTAL_ADMIN`. Finance/marketing JWT grant logs are `info`; other roles stay `debug`.

| Stage | What you should see |
|---|---|
| Login | `Admin login attempt` → `lookup complete` → `success` with `role` + `landingPath` |
| JWT / authorize | `Admin JWT accepted` and `Authorization granted` |
| Finance analytics | `Plan analytics summary loaded` with totals + monthly table |
| Finance drill-in | `monthly subscribers` / `topup buyers` / `addon buyers` loaded |
| Users & Plans list | `Plan analytics subscribers list loaded` with filters + rowCount |
| Marketing demos | `Demo booking stats loaded`, `Demo bookings list loaded`, status / invite |

**Browser** (F12): `[AuthLogin]`, `[RequireRole]`, `[Sidebar]`, `[PlanAnalytics]`, `[FinanceSubscribers]`, `[AnalyticsApi]`, `[SubscriptionManagement]`, `[DemoManagement]`, `[CreateAdmin]`.

Collapsed groups contain Summary / Input / Output / Metrics / table.

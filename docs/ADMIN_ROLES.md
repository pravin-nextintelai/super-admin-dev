# Super Admin Portal — Admin Roles Guide

> **Scope:** How portal admin roles work in **super-admin-dev**, what Marketing Admin and
> Finance Admin can see, which APIs they hit, and how to log in with the seeded test accounts.

---

## 1. What this portal is

This is the **JuriNex Super Admin Portal**. It is not the user-facing Jurinex app.

- **Frontend:** `http://localhost:3001` (login at `/login`)
- **Backend:** `http://localhost:4000` (`POST /api/auth/login`)
- **Auth database:** `Auth_DB` → `super_admins` + `admin_roles`

Login looks up the email in `super_admins`, joins `admin_roles` for the role name, then issues a JWT. A 404 on login means the email is **not** in `super_admins` (regular Jurinex users cannot log in here).

```
Browser  →  POST /api/auth/login
              ↓
         super_admins  JOIN  admin_roles
              ↓
         JWT { id, role }  →  localStorage.userRole
              ↓
         Sidebar + RequireRole + API authorize()
```

---

## 2. Test credentials (dev)

These rows were inserted into `Auth_DB.super_admins`. Use them on **http://localhost:3001/login**.

| Role | Name | Email | Password | Lands on |
|---|---|---|---|---|
| **Marketing Admin** | Marketing Admin | `marketing.admin@jurinex.dev` | `Marketing@1234` | Demo Bookings |
| **Finance Admin** | Finance Admin | `finance.admin@jurinex.dev` | `Finance@1234` | Plan Analytics |

**How to test**

1. Start backend (`Backend` → `npm start`) and frontend.
2. Open `http://localhost:3001/login`.
3. Log in with one of the rows above.
4. Confirm the sidebar only shows that role’s pages (see §4).

To re-seed or reset passwords:

```bash
cd Backend
node migrations/seed_marketing_and_finance_test_admins.js
```

The script is idempotent: it inserts the role rows if missing, then inserts or updates these two accounts.

> Dev/test only. Rotate or delete these accounts before any production use.

---

## 3. Role catalog

Portal roles live in `admin_roles`. Creating an admin from **Admin Management** fails with `Invalid role` if the name is not in that table.

| Role slug | Label | Purpose |
|---|---|---|
| `super-admin` | Super Admin | Full portal, including creating other admins |
| `user-admin` | User Admin | Jurinex users, firms, per-user analytics, content |
| `account-admin` | Account Admin | Create / edit / delete subscription plans |
| `finance-admin` | Finance Admin | **Read-only** subscriptions + paid users, amounts, total income |
| `marketing-admin` | Marketing Admin | Demo bookings + AI chatbot documents |
| `support-admin` | Support Admin | Support workspace / tickets |

**Role Management** in the sidebar is **not** this list. That page is for Jurinex **app / prompt** roles (token limits). Portal logins are only `super_admins` + `admin_roles`.

---

## 4. Access matrix

Super Admin can open every page. Other roles are limited as below.

| Page | Path | Super | User | Account | **Finance** | **Marketing** | Support |
|---|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | ✓ | ✓ | ✓ | home → analytics | home → demos | home → support |
| User Management | `/dashboard/users` | ✓ | ✓ | | | | |
| User / firm analytics | `/dashboard/users/:id/analytics` | ✓ | ✓ | | ✓ (from plan drill-in) | | |
| Admin Management | `/dashboard/admins` | ✓ | | | | | |
| Prompt / LLM / Templates / Roles / Voice / Judgements / Citations | various | ✓ | | | | | |
| AI Chatbot | `/dashboard/documents` | ✓ | | | | ✓ | |
| Demo Bookings | `/dashboard/demo-bookings` | ✓ | | | | ✓ | |
| Subscription catalog | `/dashboard/subscriptions` | ✓ | | ✓ (edit) | ✓ **view only** | | |
| Plan Analytics | `/dashboard/subscriptions/analytics` | ✓ | | ✓ | ✓ **home** | | |
| Support | `/dashboard/support` | ✓ | | | | | ✓ |
| Settings | `/dashboard/settings` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Finance Admin **cannot** add, edit, delete, or toggle plans. Account Admin still can.

---

## 5. Marketing Admin

### What they do

Handle product demos and chatbot knowledge documents. They do not see users, money, or plan CRUD.

### UI

| Item | Behaviour |
|---|---|
| **Demo Bookings** | Default home. Stats, booking list, status, invite email, delete |
| **AI Chatbot** | Upload / list / delete chatbot documents, config |
| **Settings** | Own profile / logout |

### APIs (JWT after login)

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

### Create more marketing admins

Super Admin → **Admin Management** → Create Admin → role **Marketing Admin**.

---

## 6. Finance Admin

### What they do

See **how much money came in** and **who paid**. They do not change plans, users, or demos.

### UI

| Item | Behaviour |
|---|---|
| **Plan Analytics** | Default home. Totals + per-plan tables + drill-in to buyers |
| **Subscription Management** | Catalog only (no Add / Edit / Delete / toggle) |
| **Settings** | Own profile / logout |

### KPIs on Plan Analytics

`GET /api/admin/plan-analytics/summary` returns `data.totals`:

| KPI | Meaning | Source (Payment DB) |
|---|---|---|
| **Total subscriptions** | All `user_subscriptions` rows | `user_subscriptions` |
| **Paid users** | Distinct users with a successful payment | `payments` ∪ topup ∪ add-on purchases |
| **Plan revenue** | Successful subscription payments | `payments` (`captured` / `paid` / `success` / `succeeded` / `completed`) |
| **Total income** | Plan + topup + add-on revenue | `payments` + `user_token_topup_purchases` + `user_storage_addon_purchases` |

Per monthly plan also includes `subscribers`, `active_subscribers`, `paid_users`, and `revenue`.

Click a plan to list buyers. **Analytics** on a row opens that user’s billing/usage page (`/dashboard/users/:id/analytics`) — finance is allowed there (read-only).

### APIs

| Method | Path | Who |
|---|---|---|
| `GET` | `/api/admin/plan-analytics/summary` | `finance-admin`, `account-admin`, `user-admin`, `super-admin` |
| `GET` | `/api/admin/plan-analytics/monthly/:planId/subscribers` | same |
| `GET` | `/api/admin/plan-analytics/topup/:planId/buyers` | same |
| `GET` | `/api/admin/plan-analytics/addon/:planId/buyers` | same |
| `GET` | `/api/admin/user-analytics/users/:userId/analytics` | `finance-admin`, `user-admin`, `super-admin` |
| `GET` | `/api/admin/monthly-plans` (and topup / addon) | catalog (finance should only **read**) |

### Create more finance admins

Super Admin → **Admin Management** → Create Admin → role **Finance Admin**.

---

## 7. Login response shape

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

The frontend stores `token`, `userRole`, `userEmail`, `userName` in `localStorage`, then routes:

| `role` | Landing path |
|---|---|
| `marketing-admin` | `/dashboard/demo-bookings` |
| `finance-admin` | `/dashboard/subscriptions/analytics` |
| `account-admin` | `/dashboard/subscriptions` |
| `user-admin` | `/dashboard/users` |
| `support-admin` | `/dashboard/support` |
| `super-admin` | `/dashboard` |

---

## 8. Implementation map

### Backend

| Piece | File |
|---|---|
| Login query | `Backend/controllers/authController.js` |
| JWT + `authorize()` | `Backend/middleware/authMiddleware.js` |
| `/api/admin/*` JWT allow-list | `Backend/middleware/adminAuth.middleware.js` |
| Plan analytics + totals | `Backend/controllers/planAnalyticsController.js` |
| Analytics route roles | `Backend/routes/planAnalyticsRoutes.js`, `userAnalyticsRoutes.js` |
| Role seed | `Backend/migrations/seed_marketing_admin_role.js`, `seed_finance_admin_role.js` |
| Test logins | `Backend/migrations/seed_marketing_and_finance_test_admins.js` |

### Frontend

| Piece | File |
|---|---|
| Create / edit role dropdowns | `Frontend/src/components/auth/Admins/CreateAdmin.jsx`, `AdminManagement.jsx` |
| Route guard + home | `Frontend/src/App.jsx` (`ROLE_HOME`, `RequireRole`) |
| Sidebar | `Frontend/src/pages/dashboard/Sidebar.jsx` |
| Login landing | `Frontend/src/components/auth/LoginPage.jsx` |
| Income KPIs | `Frontend/src/pages/dashboard/PlanAnalytics.jsx` |
| Finance view-only catalog | `Frontend/src/pages/dashboard/SubscriptionManagement.jsx` (`canMutate`) |

---

## 9. QA checklist

**Marketing Admin** (`marketing.admin@jurinex.dev` / `Marketing@1234`)

- [ ] Login succeeds and opens Demo Bookings
- [ ] Sidebar shows Demo Bookings, AI Chatbot, Settings only
- [ ] Bookings load; status / invite still work
- [ ] Direct URL `/dashboard/users` or `/dashboard/subscriptions` redirects away
- [ ] Direct URL `/dashboard/admins` is blocked

**Finance Admin** (`finance.admin@jurinex.dev` / `Finance@1234`)

- [ ] Login succeeds and opens Plan Analytics
- [ ] Top cards show Total subscriptions, Paid users, Plan revenue, Total income
- [ ] Monthly / topup / add-on tabs load; click a plan to see buyers
- [ ] Subscription Management is view-only (no Add / Edit / Delete)
- [ ] Sidebar has no Users, Admins, Prompts, Demos
- [ ] User Analytics from a buyer row loads (amounts / payments)

**Super Admin**

- [ ] Create Admin offers Marketing Admin and Finance Admin
- [ ] Admin Management edit dropdown includes both roles

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Login `404 Admin not found` | Email not in `super_admins` | Use the table in §2, or create the admin in Admin Management |
| Login `401 Invalid credentials` | Wrong password | Re-run the seed script to reset the test passwords |
| Login works but analytics is empty / 403 | JWT role not allowed on the API | Confirm `finance-admin` is in `planAnalyticsRoutes` authorize list; restart backend |
| Create Admin → `Invalid role` | Missing `admin_roles` row | `node migrations/seed_finance_admin_role.js` (and marketing seed) |
| Finance can still edit plans | Old frontend bundle | Restart Vite; confirm `canMutate` in Subscription Management |
| Marketing cannot load demos | Token not sent or role not in `adminAuth` | Confirm `marketing-admin` is in `adminAuth.middleware.js` `allowedRoles` |

# database/

- `migrations/` — SQL files and their `run_*.js` runners. Apply with `npm run migrate:<name>` (see `package.json` → scripts) or run the SQL with `psql`. All DDL is idempotent.
- `seeders/` — `seed_*.js` scripts for roles, plans and test admins (`npm run seed:finance-admin-role`, `npm run seed:marketing-admin-role`, or `node database/seeders/<file>`).

Runners load `Backend/.env` themselves (`dotenv` with an explicit path), so they can be executed from any working directory.

Full table/pool reference: [docs/backend/database.md](../../docs/backend/database.md).

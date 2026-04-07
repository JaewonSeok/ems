# LMS (Learning Management System)

This repository is currently set to **Milestone 03: Dashboard**.

## 1) Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL 14+ (required for later milestones)

## 2) Environment setup
```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

## 3) Install dependencies
```bash
cd client
npm install
cd ../server
npm install
```

## 4) Frontend (Vite)
Use port `3001` to avoid port `3000` conflicts.

```bash
cd client
npm run dev -- --port 3001
```

- Frontend URL: `http://localhost:3001`
- Vite proxy: `/api` -> `http://localhost:4000`

## 5) Backend (Express)
```bash
cd server
npm run dev
```

- Backend URL: `http://localhost:4000`
- Health endpoint: `GET /api/health`

## 6) Prisma migration + seed (for auth verification)
```bash
cd server
npx prisma migrate deploy
npm run prisma:seed
```

Seed users:
- `admin@company.com` / `ADMIN001` (ADMIN)
- `user1@company.com` / `EMP001` (USER)

## 7) Health check
```bash
curl -sS http://localhost:4000/api/health
```

Expected response:
```json
{"status":"ok","service":"ems-server"}
```

## 8) Build and lint
```bash
cd client
npm run lint
npm run build

cd ../server
npm run lint
npm run build
```

## 9) Current scope limits
Milestone 03 includes:
- login / refresh / logout / change-password
- JWT auth middleware and role guard middleware
- reset-password endpoint (`PUT /api/users/:id/reset-password`, ADMIN only)
- frontend auth state + token refresh + protected routes
- ADMIN dashboard endpoints:
  - `GET /api/dashboard/summary`
  - `GET /api/dashboard/monthly-hours`
  - `GET /api/dashboard/category-count`
  - `GET /api/dashboard/department-summary`
- `/dashboard` page with KPI cards, monthly bar chart, category donut, department summary table
- local-only dashboard demo seed endpoint:
  - `POST /api/dashboard/demo-seed`
  - enabled only when `ENABLE_DASHBOARD_DEMO_SEED=true` and `NODE_ENV!=production`

Not implemented yet:
- CRUD logic
- upload/import logic
- statistics logic

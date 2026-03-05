# AGENTS.md - EMS Codex Working Rules

## Project identity
- Product: EMS (Education Management System)
- Primary users: ADMIN, USER
- Key domains: authentication, dashboard, external training, internal training, internal lecture, certification, all records, user management, bulk upload, statistics
- Default language for UI and docs: Korean
- Default timezone/locale: Asia/Seoul, ko-KR

## Source of truth
- Read `docs/PRD.md` before starting any non-trivial task.
- Use `docs/PLANS.md` as the active execution plan and keep it current.
- If implementation and PRD differ, follow the PRD unless the repo already contains a documented decision in `docs/DECISIONS.md`.

## Working style
- Make the smallest safe change that satisfies the current task.
- Do not refactor unrelated code.
- Do not rename files, routes, environment variables, database tables, or API contracts unless the current task explicitly requires it.
- Prefer boring, readable code over clever abstractions.
- Reuse existing patterns before creating new ones.
- When scope is unclear, choose the narrower implementation and record the assumption.

## Architecture guardrails
- Assume a split repo/app structure unless the repo clearly says otherwise:
  - `client/` for React + TypeScript + Vite frontend
  - `server/` for Node.js + Express + TypeScript backend
- Keep frontend and backend concerns separate.
- Put shared API/data contracts in a clearly documented shared location only when both sides already need the same types.
- Keep feature code grouped by domain where practical.

## EMS-specific guardrails
- Respect role separation:
  - ADMIN: global dashboard, approval actions, user management, bulk upload, full statistics
  - USER: self-service views and personal records only
- Protect server endpoints with authentication and role checks.
- Do not expose ADMIN-only data in USER views.
- Treat uploaded files and imported Excel data as potentially sensitive.
- Never log passwords, tokens, raw personal data, or full spreadsheet rows to console.
- For bulk upload/import work:
  - validate headers
  - validate required fields
  - report row-level failures clearly
  - do not silently coerce invalid business data
- For statistics work:
  - document the aggregation basis
  - make empty-state behavior explicit
  - avoid hard-coding year/month assumptions

## Database and API rules
- For schema changes:
  - update Prisma schema/migrations together
  - update seed data if needed
  - update relevant docs in `README.md` or `docs/`
- Keep API routes, request/response shapes, and validation aligned.
- Prefer explicit validation at the edge for request params, query strings, body, and uploaded files.
- If adding a dependency, explain why the existing stack is insufficient.

## Frontend rules
- Keep pages usable with loading, error, and empty states.
- Forms must show field-level validation messages where practical.
- Tables should handle search/filter/sort/pagination in a predictable way.
- Use Korean labels by default unless the repo already standardizes English.

## Verification rules
After each meaningful change, run only the smallest relevant checks:
- frontend change: client lint and/or build
- backend change: server lint/test/build as available
- full-flow change: minimum end-to-end smoke path for the affected feature

If a required command fails because setup is incomplete, say exactly what blocked verification.

## Required output format for Codex
At the end of each task, provide:
1. What changed
2. Why it changed
3. Files touched
4. Verification run
5. Open risks / follow-ups

## Planning rules
- Keep `docs/PLANS.md` updated:
  - mark current phase
  - mark current task
  - mark completed items
  - record blockers
- Record non-obvious assumptions or tradeoffs in `docs/DECISIONS.md`.

## Stop conditions
Stop and ask for confirmation if:
- the task requires destructive data migration
- the task requires a new external service or paid dependency
- the task changes authentication, authorization, or production deployment strategy
- the task is larger than one focused milestone and needs re-planning

# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Crestfield Bank App

### Artifacts
- `artifacts/sterling-crest` — React + Vite frontend (Crestfield Bank UI)
- `artifacts/api-server` — Express 5 API + WebSocket + Telegram bots

### Auth & Test User
- JWT auth via `Authorization: Bearer <token>` (token stored client-side as `scb_token` in localStorage).
- Test user: `bob@test.com` / `Test1234!`.

### Transaction Passcode
A 4–6 digit passcode required for sensitive actions. Backed by `users.pin_hash` (bcrypt).

- Status flag: `GET /users/me` returns `hasPin: !!user.pinHash`.
- `POST /users/set-pin` body `{ pin, confirmPin, currentPin? }` — if user already has a PIN, `currentPin` is **required and verified server-side** (401 if wrong) before the new PIN is written. Frontend at `/settings` Passcode tab shows a Current Passcode input automatically when `user.hasPin === true`.
- `POST /users/verify-pin` body `{ pin }` — generic verifier.
- Transfer enforcement: `POST /transactions/transfer` requires `pin` only if `user.pinHash` exists (so users can transfer before setting a passcode, but if they have one it's mandatory). Also validates: `amount` is a finite positive number ≤ 1,000,000, recipient exists & is not the sender & has `status === "active"`, and `note` (a.k.a. `description`) is required.
- Frontend `/transfer` page conditionally renders the passcode input based on `user.hasPin`. When the user has no passcode set, a "Set up a transaction passcode" prompt links them to `/settings`.

### KYC / Tier Naming
KYC levels are surfaced to the user as **Tier 1 / Tier 2 / Tier 3** (level 0/1/2 internally). Sidebar label: "Tier Verification".

### Gift Card Submissions
`POST /giftcards/redeem` body `{ cardType, cardNumber, declaredValue, pin?, frontImage, backImage }`. Both front and back images required. Plaintext PIN is **not** stored in the user-facing transaction note; it is only forwarded to the admin Telegram alert (admin needs it to redeem the card).

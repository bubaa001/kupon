# Security posture and database hardening

Verified against the hosted project on 2026-11-09. This note records the deployed
baseline and the remaining database-access risk; it is not a claim that the
remaining hardening has already shipped.

## Deployed baseline

- Vercel project `kupon` is a Next.js app. Its latest deployment at the time of
  review was `READY`, built from commit `cf5c093` on `main`.
- The app uses a custom `kupon_session` JWT cookie. Server-side guards verify the
  token, reload the user, check `sessionVersion`, and enforce role and tenant
  checks in application code.
- Supabase project `kupon` is active on PostgreSQL 17.11 in `eu-central-1`.
- The database migrations recorded by Supabase include: revoking public access
  to the RLS event-trigger helper, shared rate-limit storage, revoking Data API
  table/sequence access for `anon` and `authenticated`, session-version logout
  revocation, foreign-key indexes, ledger invariants, and the security-posture
  note.
- RLS is enabled on the application tables. The Supabase security advisor reports
  no policies on 26 tables (including `_prisma_migrations`). This is currently
  fail-closed for roles subject to RLS; it is not tenant isolation for the app.
- Supabase Data API roles have no application-table grants. The application
  currently bypasses the Data API and uses Prisma over a direct Postgres
  connection.

## Remaining high-risk gap

The app's database session is `postgres`, which has `BYPASSRLS`, `CREATEROLE`,
`CREATEDB`, and replication privileges. RLS therefore does not constrain Prisma
queries. A leak or misuse of the database URL can expose or change all app data
and database objects available to that role.

The app's authorization checks reduce normal request risk, but they are not a
database boundary. A tenant policy that trusts an ordinary custom Postgres
setting such as `kupon.university_id` would not solve this: a client connected
with the database credential can set that value itself. Do not deploy blanket
`USING (true)` policies or treat a caller-supplied tenant setting as verified
identity.

## Safe hardening sequence

1. Add a database-verifiable request identity. The app currently signs custom
   HS256 sessions; the database must verify the signature and required claims
   before a policy treats the identity as trusted. Keep verification material
   and helper objects inaccessible to the runtime role, and validate issuer,
   audience, expiry, user ID, role, and session revocation as appropriate.
2. Map each table to explicit read/write rules based on its real owner and
   relationships. Cover public sign-in/onboarding flows, tenant users, students,
   vendors and their staff, orders, payments, ledger, support, invitations,
   uploads, audit records, and operational queues. Keep platform-wide actions
   behind narrowly scoped server-side operations.
3. Exercise every Prisma query path with missing, valid, expired, revoked, and
   cross-tenant identities. Include nested Prisma transactions and public auth
   flows; a missed context must fail closed without breaking sign-in or payment
   state transitions.
4. Create a dedicated runtime role with no `BYPASSRLS`, `CREATEROLE`, `CREATEDB`,
   or replication privileges. Grant only the table, sequence, and function
   privileges the app requires. Keep migration ownership on a separate
   deployment-only credential.
5. Validate against a disposable Supabase branch and a Vercel Preview deployment
   before changing the live `DATABASE_URL`. Verify security advisors, cross-
   tenant denial, authentication, checkout, verification, support/admin flows,
   and rollback. Rotate the previous database credential after a successful
   cutover.

## Current verification limits

- The latest Vercel deployment is ready, but that only verifies the deployed
  commit's build; it does not prove row-level database authorization.
- TypeScript checking of the local checkout passed during this review.
- A local Next production build could not complete in this Windows environment:
  it failed with `EPERM` while creating generated `.next` output directories,
  including after clearing only that build cache. This is an environment
  permission failure, not a reported TypeScript or application compile error.
- No database role, policy, credential, or live environment setting was changed
  during this review.

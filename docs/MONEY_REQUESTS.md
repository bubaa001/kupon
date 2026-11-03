# Money requests: withdrawals vs order refunds

Kupon has two different money-return products that used to be collapsed into one
mislabelled "refund" flow. They now share one audited `RefundRequest` table (via a
`kind` discriminator) but have **separate student APIs/pages, separate admin queues,
separate transaction types, separate ledger journals, separate audit events and
separate pending counts**. No button labelled "refund" moves money out to mobile money.

| | WITHDRAWAL | REFUND |
| --- | --- | --- |
| What it is | Student cashes out available wallet balance to mobile money | Money returned for one specific paid + vendor-verified order |
| `RefundRequest.kind` | `WITHDRAWAL` (default, so legacy rows stay valid) | `REFUND` |
| Order link | none (`orderId` null) | required (`orderId` + original PAYMENT `transactionId`) |
| Money leaves the platform? | Yes — payout rail (Snippe mock in dev) | No — re-credited to the student wallet |
| Wallet effect on approval | −amount | +order.total |
| Transaction type | `WITHDRAWAL` | `REFUND` |
| Student page | `/student/withdrawals` ("Cash out") | `/student/refunds` ("Order refunds") |
| Student API | `GET/POST /api/student/withdrawals` | `GET/POST /api/student/refunds` |
| Admin page | `/admin/withdrawals` | `/admin/refunds` |
| Admin API | `GET /api/admin/withdrawals`, `PATCH /api/admin/withdrawals/[id]` | `GET /api/admin/refunds`, `PATCH /api/admin/refunds/[id]` |
| Audit events | `WITHDRAWAL_APPROVED`, `WITHDRAWAL_REJECTED`, `WITHDRAWAL_PAYOUT_FAILED` | `ORDER_REFUND_APPROVED`, `ORDER_REFUND_REJECTED` |
| Dashboard card | "Pending withdrawals" (own count + amount) | "Pending order refunds" (own count + amount) |

Pending student-order **cancellation is a third, unrelated flow** owned by the orders
workstream: a PENDING order (vendor has not verified the coupon) is cancelled and
auto-reversed. It is never a REFUND request and never appears in either queue.

## Schema

`RefundRequest` (prisma/schema.prisma) gained:

- `kind String @default("WITHDRAWAL")` — `WITHDRAWAL | REFUND`. The default keeps every
  pre-migration row valid and maps it to the semantics it actually had (a cash-out).
- `orderId String?` + `transactionId String?` — REFUND only; relations to `Order`
  (`"OrderRefundRequests"`) and the original `Transaction` (`"RefundOriginalTransaction"`).
- `payoutTransactionId`, `payoutReference`, `payoutStatus` — the money movement that
  settled the request (WITHDRAWAL payout rail; REFUND reversal transaction).
- Indexes: `(universityId, status, createdAt)`, `(universityId, kind, status, createdAt)`,
  `(studentId)`, `(studentId, kind, status)`, `(orderId)`.

## State machines

### WITHDRAWAL (`kind = WITHDRAWAL`, no order)

```
(none) --student POST /api/student/withdrawals--> PENDING
PENDING --admin reject--> REJECTED                 (no money moves)
PENDING --admin approve--> APPROVED                (wallet debited exactly once,
                                                    WITHDRAWAL txn + journal,
                                                    payoutStatus PENDING -> SETTLED)
APPROVED + payout failure --> PENDING again        (compensating re-credit, audit
                                                    WITHDRAWAL_PAYOUT_FAILED)
```

A student may have at most one PENDING withdrawal at a time (checked on create).
Creating a request never touches the wallet. `eligibleAmount` is the full wallet
balance only while no withdrawal is pending and the balance is at least
`MIN_WITHDRAWAL` (TZS 1,000).

### ORDER REFUND (`kind = REFUND`, orderId required)

```
(none) --student POST /api/student/refunds { orderId, reason }--> PENDING
PENDING --admin reject--> REJECTED                 (order/payment untouched)
PENDING --admin approve--> APPROVED                (wallet re-credited with order.total,
                                                    vendor pending/fees reversed,
                                                    REFUND txn + journal)
```

Creation requires: the order belongs to the student, `order.status = VERIFIED`,
`order.transactionId` is a SETTLED `PAYMENT`, and no PENDING/APPROVED refund request
already exists for that order. `PENDING` orders are rejected with a message pointing
the student at coupon cancellation; `CANCELLED` orders were already reversed.

## Approval money movement

### Withdrawal approval (`lib/payments/withdrawal.ts`)

One interactive Prisma transaction:

1. `updateMany({ where: { id, kind: 'WITHDRAWAL', status: 'PENDING' }, data: { status:
   'APPROVED', reviewedBy, reviewedAt, payoutStatus: 'PENDING' } })` — the conditional
   claim.
2. Conditional wallet debit (`debitWallet` — `UPDATE ... WHERE balance >= amount`).
3. Create `Transaction { type: 'WITHDRAWAL', status: 'PENDING' }`.
4. `postJournal` — debit `STUDENT_WALLET`, credit `CASH_TRUST`.

If the debit fails, the claim rolls back with the transaction. Then the payout rail
(`getPaymentProvider().initiateWithdrawal`, idempotency key = request reference) is
called; on success the transaction is marked `SETTLED`, the request stores
`payoutTransactionId/payoutReference/payoutStatus`, and `WITHDRAWAL_APPROVED` is
audited. If the rail throws, a compensating transaction re-credits the wallet, posts
the reverse journal, fails the transaction, returns the request to `PENDING` and audits
`WITHDRAWAL_PAYOUT_FAILED`.

### Order-refund approval (`lib/payments/order-refund.ts`)

One interactive Prisma transaction:

1. Conditional claim `PENDING -> APPROVED`.
2. Second guard: no other APPROVED REFUND request for the same order.
3. Credit the wallet with `order.total` (`creditWallet` — wallet + cached
   `StudentProfile.walletBalance`).
4. Decrement the vendor's cached pending balance by the payment's `vendorSettlement`
   (may go negative only if the vendor was already settled — a real clawback).
5. Create `Transaction { type: 'REFUND', status: 'SETTLED' }`.
6. `postJournal` reverses the exact split booked on the original payment:
   debit `VENDOR_PENDING`, `UNIVERSITY_REVENUE`, `AGGREGATOR_PAYABLE`,
   `PLATFORM_REVENUE`; credit `STUDENT_WALLET`. If the stored split is unusable the
   split is recomputed with `calcPaymentFees` and the fallback is recorded in metadata.
7. Store the refund transaction on the request and audit `ORDER_REFUND_APPROVED`.

There is no external payout and no provider call: the money returns to the wallet. If
anything throws, the whole transaction (claim included) rolls back and the request
remains `PENDING`.

## Concurrency / exactly-once

- **Two admins, one request**: `updateMany` with `{ status: 'PENDING' }` is the claim.
  Exactly one call matches; the loser gets `409 CONFLICT` and the UI asks for a refresh.
  The claim lives inside the same transaction as the money movement, so the money can
  never move without the request being claimed.
- **Student wallet debit** is conditional (`balance >= amount`), so two concurrent
  cash-outs cannot overdraw the wallet.
- **Order refunds** additionally re-check that no other refund for the order is
  APPROVED, and creation blocks a second PENDING/APPROVED request per order.
- Payouts must use the withdrawal reference as an idempotency key at the aggregator
  (documented in `lib/payments/types.ts`); the mock rail settles synchronously.

## Compatibility / migration notes

- Existing `RefundRequest` rows have no `kind`; the schema default makes them
  `WITHDRAWAL`, which matches what the old flow actually did (wallet debit + payout).
- `lib/payments/types.ts` removed the misnamed `initiateRefund()` and replaced it with
  `initiateWithdrawal()` (payout leg only). No route calls `initiateRefund` any more.
- `refundRequestSchema` in `lib/validators` is kept (deprecated) so old clients do not
  crash; `/api/student/refunds` now requires `{ orderId, reason }` and
  `/api/student/withdrawals` accepts `{ amount, reason }`.
- The legacy `GET /api/student/refunds` payload (`requests, balance, eligibleAmount,
  hasPending`) was replaced by `{ requests, refundableOrders, balance }`.
- `/api/admin/dashboard` still returns the legacy `stats.pendingRefunds`, which now
  aggregates both kinds. The admin dashboard page intentionally does NOT use it: it
  reads split counts from the two `?summaryOnly=1` queue endpoints.

## Assumptions / follow-ups for the Lead

- A migration (`prisma db push` / migrate) must run before the running server can use
  the new columns. `pnpm prisma generate` updated the client types but the running dev
  server held the Windows query-engine DLL, so the engine copy step failed — re-run it
  after stopping/restarting the server for the final build.
- Vendor pending clawback can make `Vendor.pendingBalance` negative when a refunded
  order had already been settled to the vendor. The ledger is correct; the cached
  balance is the amount the vendor owes back.
- Out-of-scope read paths still aggregate both kinds and may need a follow-up:
  `/api/admin/dashboard` `stats.pendingRefunds`, `/api/admin/reports` refund leakage,
  `/api/admin/students/[id]` `refunds` list, `/api/super-admin/health` (pendingRefunds),
  `/api/student/profile` (pending refunds stat), plus the admin audit label map
  (`app/admin/_components/format.ts`) which will humanise the new actions but has no
  bespoke labels yet.

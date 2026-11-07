# Kupon API contracts (MVP)

All responses use the envelope:

```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": { "message": "Human readable", "code": "MACHINE_CODE", "details": {} } }
```

Auth is an httpOnly `kupon_session` JWT cookie. Every API route calls
`requireApiUser([...roles])`; every tenant-scoped query must pass through
`resolveTenantScope()` (admin) or `assertTenant()`.

## Existing / shared

| Method | Route | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/universities` | public | Active tenants for the login picker |
| POST | `/api/auth/request-otp` | public | `{ phone, universityId }` → demoOtp in DEMO_MODE |
| POST | `/api/auth/verify-otp` | public | `{ phone, code, universityId }` → sets cookie |
| POST | `/api/auth/vendor-login` | public | `{ code, pin }` → sets cookie |
| POST | `/api/auth/staff-login` | public | `{ phone, password }` → sets cookie |
| GET | `/api/auth/me` | any | `{ user }` |
| POST | `/api/auth/logout` | any | clears cookie |
| GET | `/api/auth/google/start?universityId=&role=student\|vendor` | public | Redirects to Google OAuth; sets 10-minute `kupon_google_state` cookie |
| GET | `/api/auth/callback/google` | public | Verifies state + code. Existing student/vendor → session cookie; new student → `/signup/google` ticket; new vendor → `/vendor-apply` ticket |
| POST | `/api/auth/google/signup` | Google signup ticket cookie | `{ name, phone, studentId, course?, year, confirm:true }` → creates student profile + session cookie |
| POST | `/api/auth/google/vendor-apply` | Google vendor ticket cookie | `{ ownerName, businessName, phone, description, confirm:true }` → creates PENDING vendor + session cookie, redirects `/vendor-pending` |

## Student (role STUDENT)

Base path `/api/student`. All endpoints derive the student from the session —
**never accept a studentId from the client**.

| Method | Route | Body / Query | Data |
| --- | --- | --- | --- |
| GET | `/dashboard` | — | `{ student, stats: { todaySpent, weekSpent, mealsThisWeek, couponsUsed }, recentTransactions: Tx[], pendingOrders: OrderView[] }` |
| GET | `/checkout` | — | `{ student, orders: OrderView[], vendors: [{ id, code, name, description }], vendorLoadError }` — compact scan-screen bootstrap; active campus vendors load alongside active orders |
| GET | `/profile` | — | `{ student, university, stats: { mealsCount, totalSpent, transactionsCount, pendingRefunds, pendingCoupons } }` |
| GET | `/wallet` | STUDENT | Disabled (`WALLET_DISABLED`). Students have no Kupon wallet. |
| GET | `/transactions` | `range=today\|week\|month` (default month), optional `type`, `status` | `{ transactions: Tx[], counts: { total, settled, pending, failed }, totalIn, totalOut }` |
| POST/GET | `/topup` | — | Disabled. Cafeteria orders are paid individually; no wallet top-ups. |
| POST/GET | `/payment-token` | — | Disabled. Counter charges from student wallets are not supported. |
| GET/POST | `/withdrawals` | — | Disabled. Students have no withdrawable Kupon wallet balance. |
| GET/POST | `/refunds` | — | Legacy refund records may remain; test-only orders cannot be refunded into a wallet. Use cafeteria credit/support requests for current orders. |

`MoneyRequest` shape: `{ id, reference, kind: 'WITHDRAWAL'|'REFUND', amount, reason, status:
'PENDING'|'APPROVED'|'REJECTED', adminNote, createdAt, reviewedAt, payoutStatus, payoutReference,
orderId, orderReference, orderStatus, orderTotal, vendorName, itemSummary }`.

`RefundableOrder` shape: `{ id, reference, total, itemCount, vendorName, vendorCode, itemSummary,
createdAt, verifiedAt, refundRequestStatus: 'NONE'|'PENDING'|'APPROVED', refundRequestReference }`.

**No student wallet.** Legacy wallet endpoints and wallet payment codes are disabled. Credit
issued for an unfulfilled order is cafeteria-specific and isolated from real-money ledgers.

`Tx` shape: `{ id, reference, amount, type, status, createdAt, vendor?: { name, code }, channel, metadataSummary }`.
Resolve vendor name by joining `vendor`. Never return full phone numbers of other users.

## Vendor (role VENDOR)

Base path `/api/vendor`. Vendor identity comes from the session, not a query param.

| Method | Route | Body / Query | Data |
| --- | --- | --- | --- |
| GET | `/stats` | — | `{ todaySales, transactionCount, topItems:[{name,orders,revenue,emoji}], pendingBalance, totalSettled, recentSales: [] }` |
| POST | `/scan` | `{ token?, code? }` | `{ student:{ name, studentNumber, course, walletBalance, university }, token:{ code, expiresAt }, expiresIn }` |
| POST | `/charge` | `{ token?, code?, amount, note? }` | `{ transaction:{ id, reference, amount, status, createdAt }, balance, studentName, studentNumber, vendor }` — uses `chargeWithToken()` |
| GET | `/sales` | `range=today\|week\|month` | `{ summary:{ gross, transactions, average, netSettlement, fees }, topItems, payments: [] }` |
| GET | `/menu` | — | `{ items: MenuItem[], summary:{ total, available, hidden } }` |
| POST | `/menu` | multipart upload then `{ name, price, category, description?, imageUrl, available? }` | `{ item }` — imageUrl is required; live immediately (`approvalStatus: 'APPROVED'`); admins vet vendors, not dishes |
| POST | `/menu/upload` | multipart `file` (JPG/PNG/WebP, ≤5 MB; client resizes phone photos first) | `{ url, size, type }` — returns `/api/uploads/food/<filename>`; local disk in MVP, object storage in production |
| GET | `/api/uploads/food/[filename]` | public | Streams an uploaded food photo with an immutable cache header; required because runtime writes are not in Next's public static manifest |
| PATCH | `/menu/[id]` | partial item fields incl. `available`/`imageUrl` | `{ item }` — cannot edit another vendor's item |
| DELETE | `/menu/[id]` | — | `{ deleted: true }` |
| GET | `/settlement` | — | `{ pendingBalance, totalSettled, payouts: [], recentPayments: [] }` |
| POST | `/settlement` | `{ amount? }` | mock payout request → `{ settlement, pendingBalance }` (only if >0) |

## Admin (roles ADMIN, SUPER_ADMIN)

Base path `/api/admin`. ADMIN is locked to their own university. SUPER_ADMIN may pass
`universityId` to scope, otherwise sees all. Use `resolveTenantScope()`, `tenantWhere()`.

| Method | Route | Body / Query | Data |
| --- | --- | --- | --- |
| GET | `/dashboard` | — | `{ stats:{ revenueToday, transactionsToday, activeStudents, pendingRefunds, pendingRefundAmount }, chart:[{date,label,revenue,transactions,profit}], topMeals:[{name,orders,revenue,emoji}], liveFeed: Tx[] }`. `pendingRefunds` here is LEGACY and aggregates both request kinds; the admin dashboard page reads the split counts from `/withdrawals?summaryOnly=1` and `/refunds?summaryOnly=1` instead. |
| GET | `/transactions` | `q,status,type,range,page,pageSize` | `{ rows, total, page, pageSize, summary:{ gross, fees, net, count } }` |
| GET | `/transactions/export` | same filters + `format=csv` | CSV attachment |
| GET | `/vendors` | `q,status` | `{ vendors:[{..., salesToday, transactionsToday, pendingBalance}], summary }` — status can be `PENDING`, `ACTIVE`, `SUSPENDED` |
| POST | `/vendors` | vendorSchema | `{ vendor }` — creates User(role VENDOR) + Vendor; bcrypt PIN |
| PATCH | `/vendors/[id]` | `{ status: 'PENDING'\|'ACTIVE'\|'SUSPENDED' }` | `{ vendor }` — approve/suspend/reactivate; audit log (PENDING→ACTIVE logs `VENDOR_APPROVED`) |
| GET | `/students` | `q,page` | `{ students:[{ id, name, studentId, phone (masked), course, balance, university }], total }` |
| GET | `/students/[id]` | — | `{ student (incl. email, googleLinked), transactions, refunds, audit }` |
| POST | `/students/[id]/google-link` | `{ email: string \| null }` | Pre-link/unlink a student's Google email for OTP fallback; audit-logged |
| POST | `/students/[id]/adjust` | `{ type:'CREDIT'\|'DEBIT', amount, reason }` | `{ balance, reference }` — call `adjustStudentWallet()` |
| GET | `/refunds` | `status?, summaryOnly?` | `{ requests:[MoneyRequest], summary }` — REFUND kind only; each row carries order + original payment reference |
| PATCH | `/refunds/[id]` | `{ decision:'APPROVED'\|'REJECTED', adminNote? }` | `{ kind:'REFUND', request, refund?: { transactionReference, balance, orderReference } }` — approval reverses the order payment/ledger exactly once; audit `ORDER_REFUND_APPROVED` / `ORDER_REFUND_REJECTED` |
| GET | `/withdrawals` | `status?, summaryOnly?` | `{ requests:[MoneyRequest & { student }], summary }` — WITHDRAWAL kind only |
| PATCH | `/withdrawals/[id]` | `{ decision:'APPROVED'\|'REJECTED', adminNote? }` | `{ kind:'WITHDRAWAL', request, payout?: { reference, status, provider, balance, transactionReference } }` — approval debits the wallet once, books a WITHDRAWAL transaction + balanced journal and pays out; audit `WITHDRAWAL_APPROVED` / `WITHDRAWAL_REJECTED` / `WITHDRAWAL_PAYOUT_FAILED` |
| ~~`/menu`~~ | retired | Food approval was removed: admins approve/suspend vendors, not menu items. |
| GET | `/settings` | — | `{ university, invoices, ledger:{ debits, credits, balanced } }` |
| PATCH | `/settings` | `{ name?, city?, paymentRouteCode?, brandColor? }` | `{ university }` — SUPER only can change route? ADMIN may edit name/city; route change audit |
| GET | `/reports` | `range=today\|7d\|30d\|mtd` | `{ summary, daily[], fees:{platform,aggregator,university,net}, leakage, topVendors }` |
| GET | `/audit` | `limit?` | `{ logs }` |

## Super admin (role SUPER_ADMIN)

Base path `/api/super-admin`.

| Method | Route | Data |
| --- | --- | --- |
| GET | `/overview` | `{ universities:[{id,name,code,routeCode,students,vendors,revenueToday,monthlyRevenue,status,saasFee,lastInvoice}], platform:{...}, chart }` |
| GET/POST | `/tenants` | list / onboard `universitySchema` (creates University + ADMIN user + first SaaS invoice) |
| PATCH | `/tenants/[id]` | `{ status?, paymentRouteCode?, saasFee? }` audit |
| GET | `/revenue` | `{ grossVolume, transactionFees, platformNet, saasRevenue, aggregatorCosts, universityRevenue, series, perTenant }` |
| GET | `/health` | `{ uptimePercent, successRate, avgLatencyMs, ledgerBalanced, failedToday, pendingRefunds, services[], incidents[] }` |

## Meal orders / coupons (student-scans-vendor flow)

The primary purchase flow is: student scans the vendor's counter QR → sees the approved
available menu → chooses meals → pays directly by mobile money → receives a meal coupon
only after gateway confirmation. The vendor sees the incoming order and verifies the coupon
(QR scan or fallback code); the student coupon polls and updates to VERIFIED.

Shared DTOs live in `lib/orders/types.ts`. The signed coupon QR is returned only to the
owning student after the payment gateway confirms the mobile-money payment. Verification
is a redemption step; it does not initiate or collect payment.

| Method | Route | Role | Body / Query | Data |
| --- | --- | --- | --- | --- |
| GET | `/api/vendor/qr` | VENDOR | — | `{ payload, vendor:{id,name,code,description}, university:{name,code}, menuHint }` |
| POST | `/api/student/vendor-scan` | STUDENT | `{ token?, code? }` | `{ vendor:{id,name,code,description,universityId,universityName}, student:{name,studentId,cafeteriaCreditBalance}, items: MenuItem[] }` |
| GET | `/api/student/vendors` | STUDENT | — | `{ vendors:[{ id, code, name, description }] }` — active vendors in the student's university, used by the scanner fallback |
| POST | `/api/student/orders` | STUDENT | `{ vendorId, items:[{menuItemId,quantity}], useCredit?, note? }` | `{ order: OrderView, transactionId, payment:{ status, message, demo:true } }` (201); no provider is contacted |
| GET | `/api/student/orders` | STUDENT | `?id=` or `?status=PENDING\|VERIFIED\|ALL` | `{ orders: OrderView[], active: OrderView \| null }` |
| GET | `/api/vendor/orders` | VENDOR | `?status=PENDING\|VERIFIED\|ALL` | `{ orders: OrderView[], counts:{pending,verified,today} }` |
| POST | `/api/vendor/orders/[id]/verify` | VENDOR | `{ token? , code? }` (one required) | `{ order: OrderView, message }` |
| POST | `/api/vendor/orders/scan/verify` | VENDOR | `{ token? , code? }` (one required) | Scan-first coupon verification; `KPN:C:<code>` or legacy signed token |
| POST | `/api/vendor/charge` | VENDOR | — | Disabled (`WALLET_DISABLED`). Use order coupon verification, not student-wallet charges. |

**QR payloads.** New QR codes are short pointers, not signed JWTs: vendor `KPN:V:V-UDSM-001`, coupon `KPN:C:123456`. They render at 224 px (vendor compact 196 px), level Q, with a 4-module quiet zone. Legacy signed QR tokens remain accepted by the scan endpoints. The server still enforces vendor, tenant, expiry and single-use status.

`OrderView` includes `id, reference, status: PAYMENT_PENDING|PAYMENT_FAILED|PENDING|VERIFIED|CANCELLED, total, itemCount,
couponCode, couponToken, note, createdAt, verifiedAt, expiresAt, vendor, student, items`.
`items` are snapshots `{ id, name, price, quantity, emoji, imageUrl }`.

Order placement starts a payment-pending, test-only transaction. Finance advances its recorded
state through the internal Kupon test API; this does not contact a mobile-money provider, collect
cash, or increase real vendor balances. Test cafeteria credit is held in an account separate from
any future live credit and can only be used by test orders. Test-only orders cannot be refunded
into the legacy wallet. The coupon is issued only after a Finance user records a test confirmation.
Vendor verification uses a conditional status transition, so a coupon can only be redeemed once.

| Method | Route | Role | Data |
| --- | --- | --- | --- |
| GET | `/api/finance/test-payments` | FINANCE | Recent test-only payment transactions with ordered lifecycle events |
| POST | `/api/finance/test-payments/[reference]` | FINANCE | `{ stage:'RECEIVED'\|'CONFIRMED'\|'FAILED'\|'EXPIRED', note? }` — records an auditable test transition |
| GET/POST | `/api/student/credit-requests` | STUDENT | Cafeteria-scoped credit balances, cases and tickets; POST `{ orderId, reason }` for an unfulfilled active coupon |
| GET/POST | `/api/vendor/credit-requests` | VENDOR | Cafeteria cases; POST `{ orderId, reason }` for closing-time review |
| PATCH | `/api/vendor/credit-requests/[id]` | VENDOR | `{ decision:'ACCEPT'\|'REJECT', note? }` — approved credit is scoped to its source order's test or live ledger |
| GET | `/api/finance/requests` | FINANCE | Pending cafeteria-credit cases and escalation tickets |
| PATCH | `/api/finance/requests/credits/[id]` | FINANCE | `{ decision:'APPROVE'\|'REJECT', note? }` |
| POST | `/api/student/credit-requests/[id]/escalate` | STUDENT | `{ reason }` — opens a ticket and records a TZS 1,500 test-only vendor charge; no cash moves |

## USSD (paused — offline payments not supported)

`POST /api/ussd` returns `404 USSD_DISABLED`. The legacy browser simulator and wallet-based
USSD flows are disabled. A future real mobile-money integration must use a trusted telco session
and verified provider callbacks, not a browser-supplied phone number or PIN.

## UI rules

- Use `StudentShell`, `VendorShell`, `DashboardShell` from `components/layout`.
- Every page starts with `PageHeader` and ends with a real empty state when data is empty.
- Use `Skeleton` while loading, `toast` (sonner) for actions, `Dialog` for forms.
- No `alert()`; no dead buttons; no lorem ipsum.
- Mobile-first: no horizontal scrolling at 375px. Tables get an overflow wrapper.
- Currency must use `formatTZS()`; money display uses tabular numerals.
- Role pages must be server-guarded in their layouts via `requirePageUser(['ROLE'])`.
- Never call `prisma` from a client component.

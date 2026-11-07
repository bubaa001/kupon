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
| POST | `/api/auth/google/signup` | Google signup ticket cookie | `{ name, phone, studentId, course?, year, confirm:true }` → creates zero-balance wallet + session cookie |
| POST | `/api/auth/google/vendor-apply` | Google vendor ticket cookie | `{ ownerName, businessName, phone, description, confirm:true }` → creates PENDING vendor + session cookie, redirects `/vendor-pending` |

## Student (role STUDENT)

Base path `/api/student`. All endpoints derive the student from the session —
**never accept a studentId from the client**.

| Method | Route | Body / Query | Data |
| --- | --- | --- | --- |
| GET | `/wallet` | — | `{ student: { name, studentId, course, year, phone, university: { name, code } }, balance, stats: { todaySpent, weekSpent, mealsThisWeek, totalTopUps }, recentTransactions: Tx[] }` |
| GET | `/transactions` | `range=today\|week\|month` (default month), optional `type`, `status` | `{ transactions: Tx[], counts: { total, settled, pending, failed }, totalIn, totalOut }` |
| POST | `/topup` | `{ amount: 1000..500000, paymentMethod?: 'mobile_money'\|'card', network?: 'M-PESA'\|'TIGO_PESA'\|'AIRTEL_MONEY'\|'HALOTEL', phone? }` | `{ transactionId, reference, status:'PENDING', routeCode, message, aggregatorFee, checkoutUrl? }` — card checkouts redirect to the provider; wallet credit still requires provider confirmation |
| GET | `/topup?id=` | id | `{ transaction: { id, reference, amount, status, network, createdAt, settledAt }, balance }` — lazily settles stale mock top-ups |
| POST | `/payment-token` | `{}` | `{ tokenId, token, code, expiresAt, expiresIn:120, student:{name,studentId}, balance }` |
| GET | `/payment-token?id=` | tokenId | `{ status:'ACTIVE'\|'USED'\|'EXPIRED', expiresAt, transaction?: { vendor, amount, status, createdAt } }` |
| GET | `/withdrawals` | — | `{ requests: MoneyRequest[], balance, eligibleAmount, hasPending, minAmount }` — WITHDRAWAL kind only |
| POST | `/withdrawals` | `{ amount: 1000..500000, reason }` | `{ request, message }` — files a cash-out request; no money moves until admin approval |
| GET | `/refunds` | — | `{ requests: MoneyRequest[], refundableOrders: RefundableOrder[], balance }` — REFUND kind only |
| POST | `/refunds` | `{ orderId, reason }` | `{ request, message }` — refund of one VERIFIED order; amount is the order total (server-derived) |
| GET | `/profile` | — | `{ student, stats, university, wallet }` |

`MoneyRequest` shape: `{ id, reference, kind: 'WITHDRAWAL'|'REFUND', amount, reason, status:
'PENDING'|'APPROVED'|'REJECTED', adminNote, createdAt, reviewedAt, payoutStatus, payoutReference,
orderId, orderReference, orderStatus, orderTotal, vendorName, itemSummary }`.

`RefundableOrder` shape: `{ id, reference, total, itemCount, vendorName, vendorCode, itemSummary,
createdAt, verifiedAt, refundRequestStatus: 'NONE'|'PENDING'|'APPROVED', refundRequestReference }`.

**Withdrawal vs refund (non-negotiable).** A withdrawal cashes out available wallet balance to
mobile money; it has no order and is never created by `/refunds`. An order refund reverses one
paid, vendor-verified order back into the wallet; it is never created by `/withdrawals`. Pending
orders are not refundable — the student cancels the coupon (auto-reversal). Creating either
request moves no money; only admin approval in the matching admin queue does, exactly once.

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
available menu → chooses meals → pays from wallet → receives a signed meal coupon with
order ID and status. The vendor sees the incoming order and verifies the coupon (QR scan
or 6-digit code); the student coupon polls and animates to VERIFIED.

Shared DTOs live in `lib/orders/types.ts`. The signed coupon QR is a JWT returned only to
the owning student. A coupon is a redemption proof; the wallet is debited once when the
order is placed and verification never moves money again.

| Method | Route | Role | Body / Query | Data |
| --- | --- | --- | --- | --- |
| GET | `/api/vendor/qr` | VENDOR | — | `{ payload, vendor:{id,name,code,description}, university:{name,code}, menuHint }` |
| POST | `/api/student/vendor-scan` | STUDENT | `{ token?, code? }` | `{ vendor:{id,name,code,description,universityId,universityName}, student:{name,studentId,walletBalance}, items: MenuItem[] }` |
| GET | `/api/student/vendors` | STUDENT | — | `{ vendors:[{ id, code, name, description }] }` — active vendors in the student's university, used by the scanner fallback |
| POST | `/api/student/orders` | STUDENT | `{ vendorId, items:[{menuItemId,quantity}], note? }` | `{ order: OrderView, balance, transactionId }` (201) |
| GET | `/api/student/orders` | STUDENT | `?id=` or `?status=PENDING\|VERIFIED\|ALL` | `{ orders: OrderView[], active: OrderView \| null }` |
| GET | `/api/vendor/orders` | VENDOR | `?status=PENDING\|VERIFIED\|ALL` | `{ orders: OrderView[], counts:{pending,verified,today} }` |
| POST | `/api/vendor/orders/[id]/verify` | VENDOR | `{ token? , code? }` (one required) | `{ order: OrderView, message }` |
| POST | `/api/vendor/orders/scan/verify` | VENDOR | `{ token? , code? }` (one required) | Scan-first coupon verification; `KPN:C:<code>` or legacy signed token |

**QR payloads.** New QR codes are short pointers, not signed JWTs: vendor `KPN:V:V-UDSM-001`, coupon `KPN:C:123456`. They render at 224 px (vendor compact 196 px), level Q, with a 4-module quiet zone. Legacy signed QR tokens remain accepted by the scan endpoints. The server still enforces vendor, tenant, expiry and single-use status.

`OrderView` includes `id, reference, status: PENDING|VERIFIED|CANCELLED, total, itemCount,
couponCode, couponToken, note, createdAt, verifiedAt, expiresAt, vendor, student, items`.
`items` are snapshots `{ id, name, price, quantity, emoji, imageUrl }`.

Order placement is atomic: conditional wallet debit + vendor pending credit + fee split +
balanced ledger + PENDING order. Vendor verification uses a conditional status transition,
so a coupon can only be redeemed once.

## USSD (paused — offline payments not supported)

`POST /api/ussd` returns `404 USSD_DISABLED` while `NEXT_PUBLIC_USSD_ENABLED=false`. The implementation is retained in the codebase for a later release. When enabled, `{ action:'balance'\|'pay'\|'topup', phone, vendorCode?, amount?, pin?, universityId? }`

- `balance`: returns `{ studentName, balance, university }` (simulation only; production
  must trust the telco USSD session, never a browser payload).
- `pay`: `chargeViaUssd()`; requires PIN `1234` in the demo.
- `topup`: `getPaymentProvider().initiateTopUp()`; returns pending reference.
Rate limited hard. Response includes `sms` strings for the phone terminal log.

## UI rules

- Use `StudentShell`, `VendorShell`, `DashboardShell` from `components/layout`.
- Every page starts with `PageHeader` and ends with a real empty state when data is empty.
- Use `Skeleton` while loading, `toast` (sonner) for actions, `Dialog` for forms.
- No `alert()`; no dead buttons; no lorem ipsum.
- Mobile-first: no horizontal scrolling at 375px. Tables get an overflow wrapper.
- Currency must use `formatTZS()`; money display uses tabular numerals.
- Role pages must be server-guarded in their layouts via `requirePageUser(['ROLE'])`.
- Never call `prisma` from a client component.

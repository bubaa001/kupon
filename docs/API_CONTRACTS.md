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
| POST | `/api/auth/vendor-password-login` | public | `{ phone, password }` → vendor session cookie |
| POST | `/api/vendor/applications` | public, rate-limited | multipart form with `{ ownerName, nidaNumber, email, phone, businessName, universityName, institutionPhone, confirm:true, tinDocument }` → pending application; accepts a PDF/JPG/PNG TIN/TRA document up to 5 MB; no external document links or pre-approval Google sign-in |
| POST | `/api/auth/vendor-activate` | Google-approved-application ticket | `{ password }` → creates the approved vendor account and session |
| POST | `/api/auth/staff-login` | public | `{ identifier, password }` (or legacy `{ phone, password }`) → sets cookie; identifier accepts a username or Tanzanian phone number |
| POST | `/api/auth/bootstrap-super-admin` | public, one-time | Requires configured `SUPER_ADMIN_SETUP_TOKEN`; creates the first super-admin and signs it in |
| GET | `/api/auth/staff-invites/:token` | public, token-bound | Returns non-secret invitation details if the invite is active |
| POST | `/api/auth/staff-invites/:token` | public, token-bound | `{ password }` → atomically accepts a single-use invite and creates a scoped account |
| GET | `/api/auth/me` | any | `{ user }` |
| POST | `/api/auth/logout` | any | clears cookie |
| GET | `/api/auth/google/start?universityId=&role=student\|vendor\|staff` | public | Redirects to Google OAuth; only student sign-in requires a selected campus. Vendor sign-in activates an approved application |
| GET | `/api/auth/callback/google` | public | Verifies state + code. Students can sign up; vendors must have an approved application matching their verified Google email; staff must match an existing account |
| POST | `/api/auth/google/signup` | Google signup ticket cookie | `{ name, phone, studentId, course?, year, confirm:true }` → creates student profile + session cookie |
| GET | `/api/super-admin/vendor-applications` | SUPER_ADMIN | `{ applications, requests, universities }` → pending legacy vendor accounts, new pre-auth applications, and available campuses |
| PATCH | `/api/super-admin/vendor-requests/:id` | SUPER_ADMIN | `{ decision, universityId?, physicalSiteVerified?, note? }` → approves/rejects application; approval assigns the campus and enables Google activation. Platform admins provision new institutions under `/super-admin/tenants` before assigning them. |
| GET | `/api/super-admin/vendor-requests/:id/tin-document` | SUPER_ADMIN | Downloads the applicant's private TIN/TRA document; never served from the public food-image route |

## Student (role STUDENT)

Base path `/api/student`. All endpoints derive the student from the session —
**never accept a studentId from the client**.

| Method | Route | Body / Query | Data |
| --- | --- | --- | --- |
| GET | `/dashboard` | — | `{ student, stats: { todaySpent, weekSpent, mealsThisWeek, couponsUsed }, recentTransactions: Tx[], pendingOrders: OrderView[] }` |
| GET | `/checkout` | — | `{ student, orders: OrderView[], vendors: [{ id, code, name, description }], vendorLoadError }` — compact scan-screen bootstrap; active campus vendors load alongside active orders |
| GET | `/profile` | — | `{ student, university, stats: { mealsCount, totalSpent, transactionsCount, pendingCreditRequests, pendingCoupons } }` |
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
| GET | `/team` | — | `{ accounts:[...], invites:[...] }` — only this vendor's STAFF/FINANCE accounts and pending invites |
| POST | `/team` | `{ name, email, phone, role:'STAFF'\|'FINANCE' }` | Creates a one-time, seven-day invitation scoped to the signed-in vendor; returns the link once |
| PATCH | `/application` | Rejected vendor session | Resubmits required business details; clears the rejection and returns the application to platform review |
| POST | `/menu` | multipart upload then `{ name, price, category, description?, imageUrl, available? }` | `{ item }` — imageUrl is required; live immediately (`approvalStatus: 'APPROVED'`); admins vet vendors, not dishes |
| POST | `/menu/upload` | multipart `file` (JPG/PNG/WebP, ≤5 MB; client resizes phone photos first) | `{ url, size, type }` — returns `/api/uploads/food/<filename>`; local disk in MVP, object storage in production |
| GET | `/api/uploads/food/[filename]` | public | Streams an uploaded food photo with an immutable cache header; required because runtime writes are not in Next's public static manifest |
| PATCH | `/menu/[id]` | partial item fields incl. `available`/`imageUrl` | `{ item }` — cannot edit another vendor's item |
| DELETE | `/menu/[id]` | — | `{ deleted: true }` |
| GET | `/settlement` | — | `{ pendingBalance, totalSettled, payouts: [], recentPayments: [] }` |
| POST | `/settlement` | `{ amount? }` | mock payout request → `{ settlement, pendingBalance }` (only if >0) |

Vendor owners may invite STAFF and FINANCE accounts for their own cafeteria. Platform admins can also
issue scoped invitations. Invitees set a password when accepting; Google sign-in is available only
when the verified Google email matches the invited email. Finance users can view test-payment events and support cases but cannot approve
cafeteria credit or confirm payments. Vendor staff can verify coupons and change item availability, but
cannot edit prices or access vendor money/account controls.

## Cafeteria staff (role STAFF)

Staff accounts are created by a university admin, cafeteria owner or platform admin and are linked to exactly one active
vendor. Login is at `/staff/login`.

| Method | Route | Body / Query | Data |
| --- | --- | --- | --- |
| GET | `/api/vendor/orders` | `?status=PENDING\|VERIFIED\|ALL` | Assigned cafeteria's orders only |
| POST | `/api/vendor/orders/[id]/verify` | `{ token? , code? }` | Single-use coupon verification for the assigned cafeteria |
| POST | `/api/vendor/orders/scan/verify` | `{ token? , code? }` | Scan-first coupon verification for the assigned cafeteria |
| GET | `/api/staff/menu` | — | `{ items:[{id,name,category,emoji,available}] }` |
| PATCH | `/api/staff/menu/[id]` | `{ available:boolean }` | Changes availability only; price and menu details are owner-managed |

## Admin (roles ADMIN, SUPER_ADMIN)

Base path `/api/admin`. ADMIN is locked to their own university. SUPER_ADMIN may pass
`universityId` to scope, otherwise sees all. Use `resolveTenantScope()`, `tenantWhere()`.

| Method | Route | Body / Query | Data |
| --- | --- | --- | --- |
| GET | `/dashboard` | — | `{ stats:{ revenueToday, transactionsToday, activeStudents, pendingRefunds, pendingRefundAmount }, chart:[{date,label,revenue,transactions,profit}], topMeals:[{name,orders,revenue,emoji}], liveFeed: Tx[] }`. `pendingRefunds` here is LEGACY and aggregates both request kinds; the admin dashboard page reads the split counts from `/withdrawals?summaryOnly=1` and `/refunds?summaryOnly=1` instead. |
| GET | `/transactions` | `q,status,type,range,page,pageSize` | `{ rows, total, page, pageSize, summary:{ gross, fees, net, count } }` |
| GET | `/transactions/export` | same filters + `format=csv` | CSV attachment |
| GET | `/vendors` | `q,status` | `{ vendors:[{..., salesToday, transactionsToday, pendingBalance}], summary }` — status can be `PENDING`, `ACTIVE`, `SUSPENDED` |
| POST | `/vendors` | — | Retired (`403`); new applicants use the public `/api/vendor/applications` flow |
| PATCH | `/vendors/[id]` | `{ status: 'ACTIVE'\|'SUSPENDED' }` | `{ vendor }` — suspend/reactivate an already-approved cafeteria; pending applications cannot be approved here |
| GET | `/team` | — | `{ vendors, accounts }` — active cafeterias and scoped STAFF/FINANCE accounts for this university |
| POST | `/team` | `{ name, phone, password, role:'STAFF'\|'FINANCE', vendorId }` | Creates a scoped account for an active cafeteria in the admin's university; bcrypt password and audit log |
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
| GET | `/credit-requests` | `{ requests: CreditRequest[] }` — only cases awaiting platform-admin review |
| PATCH | `/credit-requests/[id]` | `{ decision:'APPROVE'\|'REJECT', note? }` — approval issues cafeteria-specific credit; no cash refund |
| GET | `/finance-users` | `{ vendors:[{id,name,code,university}] }` active vendor choices for team account creation |
| POST | `/finance-users` | `{ name, phone, password, role:'FINANCE'\|'STAFF', vendorId? }` creates a scoped account; STAFF requires an active vendor; FINANCE may be platform-wide |
| GET | `/vendor-applications` | Pending applications with owner, university and registration-document details |
| PATCH | `/vendor-applications/[id]` | `{ decision:'APPROVE'\|'REJECT', physicalSiteVerified?, note? }`; approval requires complete documents and physical-site confirmation; rejection requires a note so the owner can resubmit |
| GET | `/revenue` | `{ grossVolume, transactionFees, platformNet, saasRevenue, aggregatorCosts, universityRevenue, series, perTenant }` |
| GET | `/health` | `{ uptimePercent, successRate, avgLatencyMs, ledgerBalanced, failedToday, pendingRefunds, services[], incidents[] }` |

## Meal orders / coupons (student-scans-vendor flow)

The primary purchase flow is: student scans the vendor's counter QR → sees today's available menu →
chooses meals → sees the food total and 2.5% test collection fee → checks out through Kupon's internal
test gateway. The test payment is automatically recorded as received and confirmed; no provider is
contacted and no real money moves. Vendors may auto-accept every order, or manually accept requests
before a coupon is issued. Students receive a meal coupon only after payment confirmation and, when
required, cafeteria acceptance. Cafeteria staff redeem the coupon by QR scan or fallback code.

Shared DTOs live in `lib/orders/types.ts`. The coupon QR is returned only to the owning student after
test payment confirmation and any required cafeteria acceptance. Verification is a redemption step;
it does not initiate or collect payment.

| Method | Route | Role | Body / Query | Data |
| --- | --- | --- | --- | --- |
| GET | `/api/vendor/qr` | VENDOR, STAFF | — | `{ payload, vendor:{id,name,code,description}, university:{name,code}, menuHint }`, scoped to the account's cafeteria |
| POST | `/api/student/vendor-scan` | STUDENT | `{ token?, code? }` | `{ vendor:{id,name,code,description,universityId,universityName}, student:{name,studentId,cafeteriaCreditBalance}, items: MenuItem[] }` |
| GET | `/api/student/vendors` | STUDENT | — | `{ vendors:[{ id, code, name, description }] }` — active vendors in the student's university, used by the scanner fallback |
| POST | `/api/student/orders` | STUDENT | `{ vendorId, items:[{menuItemId,quantity}], useCredit?, note? }` | `{ order: OrderView, transactionId, payment:{ status, message, demo:true, requiresAcceptance } }` (201); internal test gateway only |
| GET | `/api/student/orders` | STUDENT | `?id=` or `?status=PAYMENT_PENDING\|PAYMENT_FAILED\|AWAITING_ACCEPTANCE\|PENDING\|VERIFIED\|CANCELLED\|ALL` | `{ orders: OrderView[], active: OrderView \| null }` |
| GET | `/api/vendor/orders` | VENDOR, STAFF | `?status=AWAITING_ACCEPTANCE\|PENDING\|VERIFIED\|ALL` | `{ orders: OrderView[], counts:{awaitingAcceptance,pending,verified,today} }`, scoped to the account's cafeteria |
| POST | `/api/vendor/orders/[id]/accept` | VENDOR, STAFF | — | Accepts a paid request and issues its coupon; single-use conditional transition |
| POST | `/api/vendor/orders/accept-all` | VENDOR, STAFF | — | Accepts all eligible paid requests without open credit cases |
| POST | `/api/vendor/orders/[id]/unavailable` | VENDOR, STAFF | `{ reason }` | Reports an unfulfilled request to the platform-admin credit queue |
| POST | `/api/vendor/orders/[id]/verify` | VENDOR, STAFF | `{ token? , code? }` (one required) | `{ order: OrderView, message }`, scoped to the account's cafeteria |
| POST | `/api/vendor/orders/scan/verify` | VENDOR, STAFF | `{ token? , code? }` (one required) | Scan-first coupon verification; `KPN:C:<code>` or legacy signed token, scoped to the account's cafeteria |
| POST | `/api/vendor/charge` | VENDOR | — | Disabled (`WALLET_DISABLED`). Use order coupon verification, not student-wallet charges. |

**QR payloads.** New QR codes are short pointers, not signed JWTs: vendor `KPN:V:V-CAMPUS-001`, coupon `KPN:C:123456`. They render at 224 px (vendor compact 196 px), level Q, with a 4-module quiet zone. Legacy signed QR tokens remain accepted by the scan endpoints. The server still enforces vendor, tenant, expiry and single-use status.

`OrderView` includes `id, reference, status: PAYMENT_PENDING|PAYMENT_FAILED|AWAITING_ACCEPTANCE|PENDING|VERIFIED|CANCELLED|EXPIRED,
total, itemCount, couponCode, couponToken, paymentTest, paymentStage, amountPaid, apiFee, kuponFee,
creditApplied, note, createdAt, verifiedAt, expiresAt, vendor, student, items`.
`items` are snapshots `{ id, name, price, quantity, emoji, imageUrl }`.

Order placement starts a payment-pending, test-only transaction. The internal gateway records
`INITIATED → RECEIVED → CONFIRMED` automatically. The 2.5% test collection fee is shown to the
student; Kupon's 1% transaction share is deducted from the vendor's food total. Neither fee moves
real money in this build. Finance can inspect payment events but cannot confirm payments or approve
credit. Cafeteria credit is campus-vendor scoped, separately recorded, and issued only after
platform-admin approval. Vendor verification uses a conditional status transition, so a coupon can
only be redeemed once.

| Method | Route | Role | Data |
| --- | --- | --- | --- |
| GET | `/api/finance/test-payments` | FINANCE | Read-only test-only payment events; vendor-created Finance users are scoped to their cafeteria |
| POST | `/api/finance/test-payments/[reference]` | FINANCE | Disabled (`410 PAYMENT_GATEWAY_AUTOMATIC`); test payment transitions are automatic |
| GET/POST | `/api/student/credit-requests` | STUDENT | Cafeteria-scoped credit balances, cases and tickets; students can see approved credit balances; POST `{ orderId, reason }` for an unfulfilled active coupon |
| GET/POST | `/api/vendor/credit-requests` | VENDOR | Cafeteria cases; POST `{ orderId, reason }` for closing-time review |
| PATCH | `/api/vendor/credit-requests/[id]` | VENDOR | `{ decision:'ACCEPT'\|'REJECT', note? }` — approved credit is scoped to its source order's test or live ledger |
| GET | `/api/finance/requests` | FINANCE | Finalized credit history and scoped escalation tickets; no credit decisions |
| PATCH | `/api/finance/requests/credits/[id]` | FINANCE | Retired (`410 PLATFORM_ADMIN_REVIEW_REQUIRED`) |
| POST | `/api/student/credit-requests/[id]/escalate` | STUDENT | `{ reason }` — opens a ticket and records a TZS 1,500 test-only cafeteria charge; no cash moves |

When a student reports an unfulfilled paid order, the cafeteria can reject the request or forward it
for platform-admin review. A staff report of unavailable food also enters that review queue. Approval
cancels the affected order, records the cafeteria charge, and issues student credit usable only at
that cafeteria; it is not a wallet balance or cash refund. Vendor withdrawals are simulated, require
at least TZS 50,000, and record a TZS 2,000 fee (TZS 1,500 API + TZS 500 Kupon).

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

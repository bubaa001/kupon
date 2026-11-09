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
| POST | `/api/auth/request-otp` | public | `{ phone, universityId }` → demoOtp only in non-production DEMO_MODE; unavailable in production while SMS provider is mock |
| POST | `/api/auth/verify-otp` | public | `{ phone, code, universityId }` → sets cookie |
| POST | `/api/auth/vendor-login` | public | `{ code, pin }` → sets cookie |
| POST | `/api/auth/vendor-password-login` | public | `{ identifier, password }` where identifier is vendor email or legacy phone number; vendor passwords are at least 8 characters → vendor session cookie |
| POST | `/api/vendor/applications` | public, rate-limited | multipart form with `{ ownerName, nidaNumber, email, phone, businessName, universityName, institutionPhone, confirm:true, tinDocument }` → pending application; contact phone may already belong to a Kupon account because vendors sign in with their verified email; accepts a PDF/JPG/PNG TIN/TRA document up to 5 MB; no external document links or pre-approval Google sign-in |
| POST | `/api/auth/vendor-activate` | Google-approved-application ticket | `{ password }` (at least 8 characters, chosen by the vendor owner) → creates the approved vendor account and session; manual vendor sign-in uses the verified email and password, while the application phone remains contact information |
| POST | `/api/auth/staff-login` | public | `{ identifier, password }` (or legacy `{ phone, password }`) → sets cookie; identifier accepts a username or Tanzanian phone number |
| POST | `/api/auth/bootstrap-super-admin` | public, one-time | Requires configured `SUPER_ADMIN_SETUP_TOKEN`; creates the first super-admin and signs it in |
| GET | `/api/auth/staff-invites/:token` | public, token-bound | Returns non-secret invitation details if the invite is active |
| POST | `/api/auth/staff-invites/:token` | public, token-bound | `{ password }` → atomically accepts a single-use invite and creates a scoped account |
| GET | `/api/auth/me` | any | `{ user }` |
| POST | `/api/auth/logout` | any | clears cookie |
| GET | `/api/auth/google/start?universityId=&role=student\|vendor\|staff` | public | Redirects to Google OAuth; only student sign-in requires a selected campus. Vendor sign-in activates an approved application |
| GET | `/api/auth/callback/google` | public | Verifies state + code. Students can sign up; vendors must have an approved application matching their verified Google email; staff must match an existing account |
| POST | `/api/auth/google/signup` | Google signup ticket cookie | `{ name, phone, studentId, course?, year, confirm:true }` → creates profile outside production; production enrollment is closed until roster verification is configured |
| GET | `/api/super-admin/vendor-applications` | SUPER_ADMIN | `{ applications, requests, rejectedApplications, rejectedRequests, universities }` → pending and rejected vendor applications plus available campuses; rejection notes are stored for review and are not emailed automatically |
| PATCH | `/api/super-admin/vendor-requests/:id` | SUPER_ADMIN | `{ decision:'APPROVE'\|'REJECT'\|'REOPEN', universityId?, physicalSiteVerified?, note? }` → approves/rejects or returns a rejected application to the review queue; approval assigns the campus and enables Google activation. Platform admins provision new institutions under `/super-admin/tenants` before assigning them. |
| DELETE | `/api/super-admin/vendor-requests/:id` | SUPER_ADMIN | Permanently deletes a rejected application and its private TIN/TRA upload; writes an audit record |
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
| GET | `/menu` | — | `{ items: MenuItem[], summary:{ total, available, hidden } }`; owner views catalog and current staff-reported availability |
| GET | `/team` | — | `{ accounts:[...], invites:[...] }` — only this vendor's STAFF/FINANCE accounts and pending invites |
| POST | `/team` | `{ name, email, phone, role:'STAFF'\|'FINANCE' }` | Creates a one-time, seven-day invitation scoped to the signed-in vendor; returns the link once |
| PATCH | `/application` | Rejected vendor session | Resubmits required business details; clears the rejection and returns the application to platform review |
| POST | `/menu` | multipart upload then `{ name, price, category, description?, imageUrl, autoAccept? }` | `{ item }` — imageUrl is required; new dishes start unavailable until staff mark them in stock |
| POST | `/menu/upload` | Vendor or assigned cafeteria staff; multipart `file` (JPG/PNG/WebP, ≤5 MB; client resizes phone photos first) | `{ url, size, type }` — returns `/api/uploads/food/<filename>`; stored in PostgreSQL |
| GET | `/api/uploads/food/[filename]` | public | Streams an uploaded food photo with an immutable cache header; required because runtime writes are not in Next's public static manifest |
| PATCH | `/menu/[id]` | `{ name?, price?, category?, description?, imageUrl?, autoAccept? }` | `{ item }` — owner edits catalog details; daily availability is staff-only |
| DELETE | `/menu/[id]` | — | `{ deleted: true }` |
| GET | `/settlement` | — | `{ pendingBalance, totalSettled, payouts: [], recentPayments: [] }` |
| POST | `/settlement` | `{ amount? }` | mock payout request → `{ settlement, pendingBalance }` (only if >0) |

Vendor owners may invite STAFF and FINANCE accounts for their own cafeteria. Platform admins can also
issue scoped invitations. Invitees set a password when accepting; Google sign-in is available only
when the verified Google email matches the invited email. Finance users review scoped credit/support
cases and may record admin-authorized, capped emergency test settlements; they cannot confirm
payments. Owners manage the menu catalog, prices, staff, analytics, transactions, and case
oversight remotely. Staff manage the on-site menu, food availability, meal requests, and coupon
verification; menu changes are limited to their assigned cafeteria.

## Cafeteria staff (role STAFF)

Staff accounts are created by a university admin, cafeteria owner or platform admin and are linked to exactly one active
vendor. Login is at `/staff/login`.

| Method | Route | Body / Query | Data |
| --- | --- | --- | --- |
| GET | `/api/vendor/orders` | `?status=AWAITING_ACCEPTANCE\|AWAITING_PAYMENT\|PENDING\|VERIFIED\|ALL` | Assigned cafeteria's requests and orders |
| POST | `/api/vendor/orders/[id]/accept` | — | Accepts a request and moves it to `AWAITING_PAYMENT`; no payment is initiated |
| POST | `/api/vendor/orders/[id]/unavailable` | `{ reason }` | Declines an unpaid request or sends an eligible paid order to Finance for credit review |
| POST | `/api/vendor/orders/[id]/verify` | `{ token? , code? }` | Single-use coupon verification for the assigned cafeteria |
| POST | `/api/vendor/orders/scan/verify` | `{ token? , code? }` | Scan-first coupon verification for the assigned cafeteria |
| GET | `/api/staff/menu` | — | `{ items:MenuItem[], summary, operations }` — same full menu records and dashboard data as the owner menu |
| POST | `/api/staff/menu` | `{ name, price, category, description?, imageUrl }` | Adds a food to the assigned cafeteria's menu and makes it available immediately |
| PATCH | `/api/staff/menu/[id]` | `{ name?, price?, category?, description?, imageUrl?, available?, autoAccept? }` | Edits a cafeteria menu item or updates its daily stock/acceptance settings |
| DELETE | `/api/staff/menu/[id]` | — | Removes a food from the assigned cafeteria's menu; historical order item snapshots remain intact |
| PATCH | `/api/staff/menu/auto-accept` | `{ enabled:boolean }` | Sets automatic acceptance for incoming requests across the cafeteria's items |

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
| GET | `/finance-users` | `{ vendors, accounts, emergencyWithdrawals }` active vendor choices, Finance accounts and recent emergency settlement audit entries |
| POST | `/finance-users` | `{ name, phone, password, role:'FINANCE'\|'STAFF', vendorId? }` creates a scoped account; STAFF requires an active vendor; FINANCE may be platform-wide |
| PATCH | `/finance-users` | `{ userId, emergencyWithdrawalLimit }` grants or changes a cafeteria-scoped Finance user's per-withdrawal emergency limit; `0` disables access; audited |
| GET | `/vendor-applications` | Pending applications with owner, university and registration-document details |
| PATCH | `/vendor-applications/[id]` | `{ decision:'APPROVE'\|'REJECT'\|'REOPEN', physicalSiteVerified?, note? }`; reopening returns a rejected legacy vendor account to the review queue; approval requires complete documents and physical-site confirmation; rejection requires a note |
| DELETE | `/vendor-applications/[id]` | Permanently deletes a rejected legacy vendor account and records the action; blocked if the account has staff or operational records |
| GET | `/revenue` | `{ grossVolume, transactionFees, platformNet, saasRevenue, aggregatorCosts, universityRevenue, series, perTenant }` |
| GET | `/health` | `{ uptimePercent, successRate, avgLatencyMs, ledgerBalanced, failedToday, pendingRefunds, services[], incidents[] }` |

## Meal orders / coupons (student-scans-vendor flow)

The student scans a cafeteria QR, sees the items staff have marked available, and submits a request
without being charged. Cafeteria staff can accept or decline requests, or enable automatic acceptance
for incoming requests. Approval moves the order to `AWAITING_PAYMENT`; the student must then
explicitly pay through Kupon. Only a confirmed payment (including an order fully covered by that
cafeteria's credit) issues a coupon. Staff redeem the coupon once by QR scan or fallback code.
Requests declined before payment are cancelled without charge.

The current payment rail is an internal test-gateway simulation. It does not contact a mobile-money
provider or move real money.

Shared DTOs live in `lib/orders/types.ts`. The coupon QR is returned only to the owning student after
test payment confirmation and any required cafeteria acceptance. Verification is a redemption step;
it does not initiate or collect payment.

| Method | Route | Role | Body / Query | Data |
| --- | --- | --- | --- | --- |
| GET | `/api/vendor/qr` | VENDOR, STAFF | — | `{ payload, vendor:{id,name,code,description}, university:{name,code}, menuHint }`, scoped to the account's cafeteria |
| POST | `/api/student/vendor-scan` | STUDENT | `{ token?, code? }` | `{ vendor:{id,name,code,description,universityId,universityName}, student:{name,studentId,cafeteriaCreditBalance}, items: MenuItem[] }` |
| GET | `/api/student/vendors` | STUDENT | — | `{ vendors:[{ id, code, name, description }] }` — active vendors in the student's university, used by the scanner fallback |
| POST | `/api/student/orders` | STUDENT | `{ vendorId, items:[{menuItemId,quantity}], useCredit?, note? }` | `{ order: OrderView, transactionId:null, payment:{ status, message, demo:true, amountCharged:0, requiresAcceptance } }` (201); creates an unpaid request and saves the cafeteria-credit preference for later payment |
| POST | `/api/student/orders/[id]/pay` | STUDENT | `{ useCredit?:boolean }` | Starts test payment only for an approved `AWAITING_PAYMENT` order; returns payment state and updated order |
| GET | `/api/student/orders` | STUDENT | `?id=` or `?status=AWAITING_ACCEPTANCE\|AWAITING_PAYMENT\|PAYMENT_PENDING\|PAYMENT_FAILED\|PENDING\|VERIFIED\|CANCELLED\|ALL` | `{ orders: OrderView[], active: OrderView \| null }` |
| GET | `/api/vendor/orders` | VENDOR, STAFF | `?status=AWAITING_ACCEPTANCE\|AWAITING_PAYMENT\|PENDING\|VERIFIED\|ALL` | `{ orders: OrderView[], counts:{awaitingAcceptance,awaitingPayment,pending,verified,today} }`, scoped to the account's cafeteria |
| POST | `/api/vendor/orders/[id]/accept` | VENDOR, STAFF | — | Accepts an unpaid request and moves it to `AWAITING_PAYMENT`; student pays afterward |
| POST | `/api/vendor/orders/accept-all` | VENDOR, STAFF | — | Accepts eligible requests; students still pay individually |
| POST | `/api/vendor/orders/[id]/unavailable` | VENDOR, STAFF | `{ reason }` | Cancels an unpaid request or creates a Finance credit case for an eligible paid order |
| POST | `/api/vendor/orders/[id]/verify` | VENDOR, STAFF | `{ token? , code? }` (one required) | `{ order: OrderView, message }`, scoped to the account's cafeteria |
| POST | `/api/vendor/orders/scan/verify` | VENDOR, STAFF | `{ token? , code? }` (one required) | Scan-first coupon verification; `KPN:C:<code>` or legacy signed token, scoped to the account's cafeteria |
| POST | `/api/vendor/charge` | VENDOR | — | Disabled (`WALLET_DISABLED`). Use order coupon verification, not student-wallet charges. |

**QR payloads.** New QR codes are short pointers, not signed JWTs: vendor `KPN:V:V-CAMPUS-001`, coupon `KPN:C:123456`. They render at 224 px (vendor compact 196 px), level Q, with a 4-module quiet zone. Legacy signed QR tokens remain accepted by the scan endpoints. The server still enforces vendor, tenant, expiry and single-use status.

`OrderView` includes `id, reference, status: AWAITING_ACCEPTANCE|AWAITING_PAYMENT|PAYMENT_PENDING|PAYMENT_FAILED|PENDING|VERIFIED|CANCELLED|EXPIRED,
total, itemCount, couponCode, couponToken, paymentTest, paymentStage, amountPaid, apiFee, kuponFee,
creditApplied, useCafeteriaCredit, note, createdAt, verifiedAt, expiresAt, vendor, student, items`.
`items` are snapshots `{ id, name, price, quantity, emoji, imageUrl }`.

Order placement does not create a transaction. The student initiates payment only after cafeteria
approval; the internal test gateway then records `INITIATED → RECEIVED → CONFIRMED` automatically.
The 2.5% test collection fee and Kupon's 1% transaction share are recorded but do not move real
money. Finance cannot confirm payments. Finance decisions on assigned-cafeteria credit cases require
a note and are visible to platform admins. Credit is cafeteria-scoped and separately recorded.
Vendor verification uses a conditional status transition, so a coupon can only be redeemed once.

| Method | Route | Role | Data |
| --- | --- | --- | --- |
| GET | `/api/finance/test-payments` | FINANCE | Read-only test-only payment events; vendor-created Finance users are scoped to their cafeteria |
| POST | `/api/finance/test-payments/[reference]` | FINANCE | Disabled (`410 PAYMENT_GATEWAY_AUTOMATIC`); test payment transitions are automatic |
| GET/POST | `/api/student/credit-requests` | STUDENT | Cafeteria-scoped credit balances, cases and tickets; students can see approved credit balances; POST `{ orderId, reason }` for an unfulfilled active coupon |
| GET/POST | `/api/vendor/credit-requests` | VENDOR | Cafeteria cases; POST `{ orderId, reason }` for closing-time review |
| PATCH | `/api/vendor/credit-requests/[id]` | VENDOR | `{ decision:'ACCEPT'\|'REJECT', note? }` — approved credit is scoped to its source order's test or live ledger |
| GET | `/api/finance/requests` | FINANCE | Credit case history, scoped escalation tickets, and (for assigned accounts) pending balance plus emergency withdrawal limit |
| PATCH | `/api/finance/requests/credits/[id]` | FINANCE | `{ decision:'APPROVE'\|'REJECT', note }` — required note; approval issues cafeteria-specific credit; platform admin can see the outcome |
| POST | `/api/finance/withdrawals` | Cafeteria-scoped FINANCE | `{ amount, reason }` — records an emergency test settlement within the account's admin-authorized limit; rate-limited and audit-logged; does not send money |
| POST | `/api/student/credit-requests/[id]/escalate` | STUDENT | `{ reason }` — opens a ticket and records a TZS 1,500 test-only cafeteria charge; no cash moves |

When a student reports an unfulfilled paid order, the cafeteria can reject the request or forward it
to Finance. A staff report of unavailable food also enters Finance review. Finance approval cancels
the affected order, records the cafeteria charge, and issues student credit usable only at that
cafeteria; it is not a wallet balance or cash refund. Vendor withdrawals are simulated, require at
least TZS 50,000, and record a TZS 2,000 fee (TZS 1,500 API + TZS 500 Kupon). A platform admin may
grant assigned Finance accounts an emergency withdrawal limit per request; the limit is revocable,
and each request requires a reason. The admin can review the resulting audit entries.

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

# Kupon orders, credit, and cafeteria settlements

Kupon records cafeteria orders and payment events. Students do not have a Kupon
wallet. The cafeteria owner manages the business remotely; staff run daily
availability and order operations on site.

## Student request, cafeteria approval, and payment

1. The student scans a cafeteria QR, browses items staff have marked available,
   and submits a food request. Submitting a request does not charge the student.
2. Requests wait for cafeteria staff unless staff have enabled automatic
   acceptance for all incoming requests (or the selected items are configured for
   auto-accept). Staff may also approve or decline individual requests.
3. Once approved, the order moves to `AWAITING_PAYMENT`. The student must
   explicitly pay through Kupon before a meal coupon is issued. A request declined
   before payment is cancelled without charge.
4. Payment is currently an internal test-gateway simulation. It does not contact
   a mobile-money provider or move real money. When the test payment is confirmed,
   Kupon issues the coupon QR and fallback code. Staff scan/redeem the coupon once
   and hand over the food.

Credit already issued by the originating cafeteria can be applied when the
student pays. It is not cash, cannot be withdrawn, and is not a general-purpose
wallet. The student's choice to use cafeteria credit is saved with the unpaid
request and can still be changed when resuming an approved order.

## Roles and responsibilities

- Owners manage the menu catalog, prices, staff accounts, business analytics,
  transactions, and oversight of credit cases. They do not need to be on site to
  run daily stock or coupon operations.
- Cafeteria staff mark items available/unavailable for the day, accept or decline
  student requests, redeem coupons, and report unavailable paid orders.
- Finance reviews cafeteria credit cases and escalation/support cases for its
  assigned cafeteria. Approval or rejection requires a written note; platform
  admins can see the case, decision, reviewer, and note.
- Platform admins oversee Finance decisions and may grant an assigned Finance
  account a per-withdrawal emergency settlement limit, or revoke it by setting
  the limit to zero.

## Cafeteria credit and case handling

- A student can request credit for a paid order that the cafeteria has not
  fulfilled. Cafeteria staff/owners can decline the claim or forward it to Finance.
- An unavailable-food report on an unpaid request cancels it without charge. A
  report on a paid order creates a Finance credit case.
- Finance may approve or reject a case, with a required note. Approval cancels
  the order and issues credit tied to the originating cafeteria; the platform
  admin can review the decision and note.
- Escalation tickets record a TZS 1,500 test-only cafeteria charge. They do not
  issue a cash refund.
- Credit changes, decisions, and order cancellations are written to the audit
  trail. Conditional database updates prevent duplicate decisions and issuance.

## Cafeteria settlements

Vendors may request a simulated settlement when their pending balance reaches at
least TZS 50,000. Kupon records a TZS 2,000 fee split into TZS 1,500 API and TZS
500 Kupon, then updates the vendor's test balance. No mobile-money or bank payout
is sent by this build.

A platform admin may grant a scoped Finance user an emergency limit. The limit
applies to each withdrawal, cannot exceed the assigned cafeteria's pending
balance, and must be accompanied by a reason. The request, reviewer, amount, and
reason are audit-logged and visible to the platform admin. Emergency settlements
also remain test simulations: no real funds are sent.

## Legacy wallet flows

Legacy student wallet, top-up, wallet-charge, and student cash-out APIs are
disabled. Old database records may remain for compatibility, but they are not
part of the current meal-order or cafeteria-credit flow.

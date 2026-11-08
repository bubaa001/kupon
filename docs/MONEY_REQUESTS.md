# Kupon payments and cafeteria credit

Kupon records cafeteria orders and payment events. Students do not have a Kupon
wallet, and Finance does not approve or confirm student checkouts.

## Student checkout

1. The student scans a cafeteria QR and orders from today's available menu.
2. Checkout shows the food total, any cafeteria credit applied, the 2.5% test
   collection fee, and the total to confirm.
3. Kupon's internal test gateway records `INITIATED → RECEIVED → CONFIRMED`
   automatically. It does not contact a mobile-money provider or move real money.
4. Food configured for auto-accept proceeds directly to coupon issuance. Other
   orders wait for the cafeteria to accept them. A coupon is not redeemable until
   it is issued, and staff can redeem it only once.

Kupon's 1% transaction share is recorded separately from the student's 2.5%
checkout fee. These are test records, not real collection or payout amounts.

## Cafeteria credit

- A student can request credit for a paid order that the cafeteria has not fulfilled.
- The cafeteria may reject the request or forward it to the platform-admin queue.
- Staff may also report an unavailable item; that report goes directly to platform
  admin review.
- Platform admins approve or reject forwarded reports. Approval cancels the order,
  records the cafeteria charge, and issues credit tied to the originating cafeteria.
- The student can see the available credit and use it only at that cafeteria. It is
  not cash, cannot be withdrawn, and is not a general-purpose wallet.
- A further-review support ticket records a TZS 1,500 test-only cafeteria charge.
  It does not issue a cash refund.

Credit changes, decisions, and order cancellations are written to the audit trail.
Conditional database updates prevent duplicate decisions and duplicate issuance.

## Cafeteria withdrawal

Vendors may request a simulated settlement when their pending balance reaches at
least TZS 50,000. Kupon records a TZS 2,000 fee split into TZS 1,500 API and TZS 500
Kupon, then updates the vendor's test balance. No mobile-money or bank payout is
sent by this build.

## Legacy wallet flows

Legacy student wallet, top-up, wallet-charge, and student cash-out APIs are disabled.
Old database records may remain for compatibility, but they are not part of the
current meal-order or cafeteria-credit flow.

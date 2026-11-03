# Kupon screenshots

Captured from the production build (`pnpm build && pnpm start`) against the deterministic seed.

| File | Screen |
| --- | --- |
| `01-landing-desktop.png` | Marketing landing, desktop |
| `02-login-desktop.png` | Public student/vendor login (Google; no staff tab, no hardcoded demo cards) |
| `03-student-home-mobile.png` | Student wallet home at 375px |
| `04-student-topup-mobile.png` | Mobile-money top-up flow |
| `05-student-pay-mobile.png` | Animated meal coupon with order ID, code, QR and live status |
| `06-student-history-mobile.png` | Transaction history filters |
| `07-student-refunds-mobile.png` | Refund request guard and status |
| `08-vendor-home-mobile.png` | Vendor till home |
| `09-vendor-scan-mobile.png` | Vendor order desk and coupon verification |
| `10-vendor-menu-mobile.png` | Vendor menu management |
| `11-admin-dashboard-desktop.png` | University admin dashboard |
| `12-admin-transactions-desktop.png` | Transactions with export |
| `13-admin-reports-desktop.png` | Profit & loss and leakage report |
| `14-admin-dashboard-mobile.png` | Admin dashboard at 375px |
| `15-super-overview-desktop.png` | Platform overview |
| `16-super-tenants-desktop.png` | Tenant portfolio |
| `17-super-revenue-desktop.png` | Platform revenue waterfall |
| `18-super-health-desktop.png` | System health and ledger invariant |
| `20-landing-mobile.png` | Marketing landing at 375px |
| `21-student-menu-mobile.png` | Photo-led student food menu with quantity controls |
| `22-student-cart-mobile.png` | Sticky cart and review state |
| `23-vendor-add-dish-mobile.png` | Live-preview add-dish dialog |
| `24-vendor-student-preview-mobile.png` | Vendor "preview as student" mode |
| `25-google-signup-mobile.png` | Google-first student signup (no SMS OTP) |
| `26-vendor-apply-mobile.png` | Google-first vendor application for admin approval |
| `27-login-vendor-mobile.png` | Vendor tab: Google sign-in and application entry |
| `28-staff-login-desktop.png` | Separate staff entrance at `/staff/login` (not linked from the public landing) |
| `29-vendor-photo-upload-mobile.png` | Vendor's required food-photo upload (no emoji fallback) |

Regenerate with:

```bash
pnpm dev              # or pnpm build && pnpm start
pnpm screenshots      # set CHROME_PATH if Chrome is not in the default Windows path
pnpm screenshots:flow # interactive menu/cart, add-dish, preview, Google signup, vendor apply/login, staff login
pnpm audit:mobile     # checks every route at 375px for horizontal overflow
```

Screenshots are captured with `prefers-reduced-motion` emulation. The camera scanner falls back
gracefully in headless Chrome, which is why the scan screen shows the manual-code fallback.

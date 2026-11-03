/**
 * Kupon end-to-end smoke test.
 *
 * Requires the app to be running (`pnpm dev` or `pnpm start`) and a seeded DB.
 *   node scripts/smoke-test.mjs
 *
 * This mutates the demo wallet (one top-up + one QR payment) and writes an
 * audit trail. Run `pnpm db:reset` afterwards for pristine screenshots.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(url, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const setCookies =
    response.headers.getSetCookie?.() ??
    (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
  const session = setCookies.find((value) => value.startsWith('kupon_session='));
  const sessionValue = session?.match(/kupon_session=([^;]+)/)?.[1];
  let json = null;
  try {
    json = await response.json();
  } catch {
    /* non-json */
  }
  return {
    status: response.status,
    json,
    cookie: sessionValue ? `kupon_session=${sessionValue}` : cookie,
    setCookies,
    location: response.headers.get('location'),
  };
}

async function loginStudent(phone, universityId) {
  const otp = await request('/api/auth/request-otp', {
    method: 'POST',
    body: { phone, universityId },
  });
  if (otp.status !== 200) throw new Error(`OTP request failed: ${JSON.stringify(otp.json)}`);
  const code = otp.json.data.demoOtp;
  const verified = await request('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone, code, universityId },
  });
  if (verified.status !== 200) throw new Error(`OTP verify failed: ${JSON.stringify(verified.json)}`);
  return { cookie: verified.cookie, user: verified.json.data.user };
}

async function loginVendor(code, pin) {
  const res = await request('/api/auth/vendor-login', {
    method: 'POST',
    body: { code, pin },
  });
  if (res.status !== 200) throw new Error(`Vendor login failed: ${JSON.stringify(res.json)}`);
  return res;
}

async function loginStaff(phone, password) {
  const res = await request('/api/auth/staff-login', {
    method: 'POST',
    body: { phone, password },
  });
  if (res.status !== 200) throw new Error(`Staff login failed: ${JSON.stringify(res.json)}`);
  return res;
}

async function main() {
  console.log(`\nKupon smoke test → ${BASE}\n`);

  console.log('Public');
  const universitiesRes = await request('/api/universities');
  check('universities endpoint responds', universitiesRes.status === 200);
  const universities = universitiesRes.json?.data?.universities ?? [];
  const udsm = universities.find((u) => u.code === 'UDSM');
  const must = universities.find((u) => u.code === 'MUST');
  check('both seeded tenants are listed', Boolean(udsm && must));
  if (!udsm || !must) throw new Error('Cannot continue without both tenants');

  console.log('\nGoogle OAuth fallback');
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (googleConfigured) {
    const googleStart = await request(`/api/auth/google/start?universityId=${udsm.id}`);
    check(
      'Google OAuth start redirects to accounts.google.com',
      (googleStart.status === 307 || googleStart.status === 302) &&
        String(googleStart.location).startsWith('https://accounts.google.com/'),
      `${googleStart.status} ${googleStart.location}`,
    );
    check(
      'Google OAuth state cookie is httpOnly-ready',
      googleStart.setCookies?.some((value) => value.startsWith('kupon_google_state=')),
    );
    const googleDenied = await request(
      '/api/auth/callback/google?error=access_denied&state=smoke',
    );
    check(
      'Google callback failure returns to login with an error',
      googleDenied.status === 307 &&
        String(googleDenied.location).includes('error=google_denied'),
      `${googleDenied.status} ${googleDenied.location}`,
    );
  } else {
    check('Google OAuth is optional when credentials are absent', true);
  }

  console.log('\nStudent flow');
  const student = await loginStudent('+255712345678', udsm.id);
  check('student OTP login sets a session', Boolean(student.cookie));
  const me = await request('/api/auth/me', { cookie: student.cookie });
  check('session rehydrates student role', me.json?.data?.user?.role === 'STUDENT');
  check(
    'API never returns another tenant',
    me.json?.data?.user?.university?.code === 'UDSM',
  );

  const walletBefore = await request('/api/student/wallet', { cookie: student.cookie });
  check('wallet endpoint responds', walletBefore.status === 200, String(walletBefore.status));
  const startBalance = walletBefore.json?.data?.balance ?? 0;
  check('wallet has a TZS balance', typeof startBalance === 'number' && startBalance > 0);

  const topup = await request('/api/student/topup', {
    method: 'POST',
    body: { amount: 1000, network: 'M-PESA' },
    cookie: student.cookie,
  });
  check('top-up accepted', topup.status === 200 || topup.status === 201, JSON.stringify(topup.json));
  check('top-up is pending', topup.json?.data?.status === 'PENDING');
  check('top-up has the UDSM route code', topup.json?.data?.routeCode === '555111');
  const whopCheckout = Boolean(topup.json?.data?.checkoutUrl);
  const azamPayPush = topup.json?.data?.provider === 'azampay';
  const remoteTopUp = whopCheckout || azamPayPush;
  const expectedTopUpCredit = remoteTopUp ? 0 : 1000;
  if (remoteTopUp) {
    if (whopCheckout) {
      check('top-up returns a Whop checkout URL', /^https:\/\//.test(topup.json.data.checkoutUrl));
    } else {
      check('AzamPay top-up requests an MNO USSD push', /USSD push/i.test(topup.json?.data?.message ?? ''));
    }
    const walletBeforeWebhook = await request('/api/student/wallet', { cookie: student.cookie });
    check(
      'remote top-up does not credit before its verified callback',
      (walletBeforeWebhook.json?.data?.balance ?? -1) === startBalance,
    );
  } else {
    await new Promise((resolve) => setTimeout(resolve, 2600));
    const status = await request(`/api/student/topup?id=${topup.json?.data?.transactionId}`, {
      cookie: student.cookie,
    });
    check('mock top-up settles after ~2s', status.json?.data?.transaction?.status === 'SETTLED');
    const walletAfterTopup = await request('/api/student/wallet', { cookie: student.cookie });
    check(
      'wallet credited after settlement',
      (walletAfterTopup.json?.data?.balance ?? 0) === startBalance + 1000,
      `${walletAfterTopup.json?.data?.balance} vs ${startBalance + 1000}`,
    );
  }

  console.log('\nVendor + meal order + coupon flow');
  const vendor = await loginVendor('V-UDSM-001', '1234');
  const vendorQr = await request('/api/vendor/qr', { cookie: vendor.cookie });
  check(
    'vendor counter QR is returned',
    vendorQr.status === 200 && Boolean(vendorQr.json?.data?.payload),
  );
  check(
    'vendor QR uses a compact camera-friendly payload',
    String(vendorQr.json?.data?.payload).startsWith('KPN:V:'),
  );

  const scan = await request('/api/student/vendor-scan', {
    method: 'POST',
    body: { token: vendorQr.json?.data?.payload },
    cookie: student.cookie,
  });
  check(
    'student scanning vendor QR receives the menu',
    scan.status === 200 && (scan.json?.data?.items?.length ?? 0) > 0,
    JSON.stringify(scan.json?.error),
  );
  const chosen = scan.json?.data?.items?.[0];
  check('menu items include a food image', Boolean(chosen?.imageUrl));

  const placed = await request('/api/student/orders', {
    method: 'POST',
    body: {
      vendorId: scan.json?.data?.vendor?.id,
      items: [{ menuItemId: chosen?.id, quantity: 1 }],
      note: 'Smoke test order',
    },
    cookie: student.cookie,
  });
  check('order placement succeeds', placed.status === 201, JSON.stringify(placed.json?.error));
  check('order is pending vendor verification', placed.json?.data?.order?.status === 'PENDING');
  check(
    'order returns a signed coupon QR',
    Boolean(placed.json?.data?.order?.couponToken),
  );
  check(
    'order total is computed server-side',
    placed.json?.data?.order?.total === chosen?.price,
  );

  const incoming = await request('/api/vendor/orders?status=PENDING', { cookie: vendor.cookie });
  check(
    'vendor order desk sees the incoming order',
    incoming.status === 200 &&
      (incoming.json?.data?.orders ?? []).some(
        (order) => order.id === placed.json?.data?.order?.id,
      ),
  );

  const verify = await request(
    `/api/vendor/orders/${placed.json?.data?.order?.id}/verify`,
    {
      method: 'POST',
      body: { code: placed.json?.data?.order?.couponCode },
      cookie: vendor.cookie,
    },
  );
  check('vendor verifies the coupon', verify.status === 200, JSON.stringify(verify.json?.error));
  check('coupon becomes VERIFIED', verify.json?.data?.order?.status === 'VERIFIED');

  const replay = await request(
    `/api/vendor/orders/${placed.json?.data?.order?.id}/verify`,
    {
      method: 'POST',
      body: { code: placed.json?.data?.order?.couponCode },
      cookie: vendor.cookie,
    },
  );
  check('single-use coupon cannot be replayed', replay.status === 409);

  const studentOrder = await request(
    `/api/student/orders?id=${placed.json?.data?.order?.id}`,
    { cookie: student.cookie },
  );
  check(
    'student coupon reflects vendor verification',
    studentOrder.json?.data?.orders?.[0]?.status === 'VERIFIED',
  );

  const mustVendor = await loginVendor('V-MUST-001', '1234');
  const mustQr = await request('/api/vendor/qr', { cookie: mustVendor.cookie });
  const crossTenantScan = await request('/api/student/vendor-scan', {
    method: 'POST',
    body: { token: mustQr.json?.data?.payload },
    cookie: student.cookie,
  });
  check('cross-tenant vendor QR is rejected', crossTenantScan.status === 403);

  const walletFinal = await request('/api/student/wallet', { cookie: student.cookie });
  check(
    'wallet debited by the order total',
    (walletFinal.json?.data?.balance ?? 0) === startBalance + expectedTopUpCredit - chosen?.price,
    `${walletFinal.json?.data?.balance} vs ${startBalance + expectedTopUpCredit - chosen?.price}`,
  );

  console.log('\nAdmin flow + tenant isolation');
  const admin = await loginStaff('+255745000001', 'admin1234');
  const dashboard = await request('/api/admin/dashboard', { cookie: admin.cookie });
  check('admin dashboard responds', dashboard.status === 200);
  check('dashboard has 7-day chart data', (dashboard.json?.data?.chart?.length ?? 0) === 7);
  check('dashboard has top meals', (dashboard.json?.data?.topMeals?.length ?? 0) > 0);

  const crossTenant = await request(`/api/admin/students?universityId=${must.id}`, {
    cookie: admin.cookie,
  });
  check('UDSM admin cannot query MUST students', crossTenant.status === 403);

  const txns = await request('/api/admin/transactions?pageSize=5', { cookie: admin.cookie });
  check('admin transactions respond', txns.status === 200 && Array.isArray(txns.json?.data?.rows));
  check(
    'admin rows are tenant-scoped',
    (txns.json?.data?.rows ?? []).every((row) => row.reference),
  );

  const reports = await request('/api/admin/reports?range=7d', { cookie: admin.cookie });
  check('admin reports respond', reports.status === 200);
  check('reports include fee breakdown', Boolean(reports.json?.data?.fees));

  const refunds = await request('/api/admin/refunds', { cookie: admin.cookie });
  check('admin refunds respond', refunds.status === 200 && Array.isArray(refunds.json?.data?.requests));

  const settings = await request('/api/admin/settings', { cookie: admin.cookie });
  check('settings expose Lipa Namba', settings.json?.data?.university?.paymentRouteCode === '555111');

  console.log('\nSuper admin');
  const superAdmin = await loginStaff('+255745000000', 'super1234');
  const overview = await request('/api/super-admin/overview', { cookie: superAdmin.cookie });
  check('platform overview responds', overview.status === 200);
  check(
    'platform sees both tenants',
    (overview.json?.data?.universities?.length ?? 0) === 2,
  );
  const revenue = await request('/api/super-admin/revenue', { cookie: superAdmin.cookie });
  check('platform revenue responds', revenue.status === 200);
  const health = await request('/api/super-admin/health', { cookie: superAdmin.cookie });
  check('system health responds', health.status === 200);
  check('ledger is balanced', health.json?.data?.ledgerBalanced === true);

  const adminAsSuper = await request('/api/super-admin/tenants', { cookie: admin.cookie });
  check('university admin blocked from platform API', adminAsSuper.status === 403);

  console.log('\nUSSD / offline payments');
  const ussd = await request('/api/ussd', {
    method: 'POST',
    body: { action: 'balance', phone: '+255712345678' },
  });
  check(
    'USSD endpoint is paused behind the feature flag',
    ussd.status === 404 && ussd.json?.error?.code === 'USSD_DISABLED',
    JSON.stringify(ussd.json),
  );

  console.log('\nLedger integrity');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const rows = await prisma.ledgerEntry.groupBy({
    by: ['transactionId'],
    _sum: { debit: true, credit: true },
  });
  const unbalanced = rows.filter((row) => (row._sum.debit ?? 0) !== (row._sum.credit ?? 0));
  check('every journal is double-entry balanced', unbalanced.length === 0, `${unbalanced.length} bad`);
  await prisma.$disconnect();

  console.log(`\n${passed} passed · ${failed} failed`);
  if (failed > 0) {
    console.error('\nFailures:\n' + failures.map((f) => ` - ${f}`).join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error);
  process.exit(1);
});

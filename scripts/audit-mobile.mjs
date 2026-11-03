/**
 * Mobile viewport audit: navigates every authenticated route at 375px and
 * reports horizontal overflow plus the widest offending elements.
 *   node scripts/audit-mobile.mjs
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function api(pathname, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = (response.headers.getSetCookie?.() ?? []).find((v) => v.startsWith('kupon_session=')) ?? '';
  return {
    token: raw.split(';')[0].replace('kupon_session=', ''),
    json: await response.json().catch(() => null),
  };
}

async function studentSession() {
  const uni = await api('/api/universities');
  const udsm = uni.json.data.universities.find((u) => u.code === 'UDSM');
  const otp = await api('/api/auth/request-otp', {
    method: 'POST',
    body: { phone: '+255712345678', universityId: udsm.id },
  });
  const verify = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone: '+255712345678', code: otp.json.data.demoOtp, universityId: udsm.id },
  });
  return verify.token;
}

async function staffSession(phone, password) {
  return (await api('/api/auth/staff-login', { method: 'POST', body: { phone, password } })).token;
}
async function vendorSession() {
  return (await api('/api/auth/vendor-login', { method: 'POST', body: { code: 'V-UDSM-001', pin: '1234' } })).token;
}

async function main() {
  const sessions = {
    student: await studentSession(),
    vendor: await vendorSession(),
    admin: await staffSession('+255745000001', 'admin1234'),
    super: await staffSession('+255745000000', 'super1234'),
  };
  const routes = [
    ['student', '/student'],
    ['student', '/student/topup'],
    ['student', '/student/pay'],
    ['student', '/student/history'],
    ['student', '/student/refunds'],
    ['student', '/student/profile'],
    ['vendor', '/vendor'],
    ['vendor', '/vendor/scan'],
    ['vendor', '/vendor/sales'],
    ['vendor', '/vendor/menu'],
    ['vendor', '/vendor/settlement'],
    ['admin', '/admin'],
    ['admin', '/admin/transactions'],
    ['admin', '/admin/reports'],
    ['admin', '/admin/vendors'],
    ['admin', '/admin/students'],
    ['admin', '/admin/refunds'],
    ['admin', '/admin/menu'],
    ['admin', '/admin/settings'],
    ['super', '/super-admin'],
    ['super', '/super-admin/tenants'],
    ['super', '/super-admin/revenue'],
    ['super', '/super-admin/health'],
  ];

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const issues = [];

  for (const [role, route] of routes) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setCookie({ name: 'kupon_session', value: sessions[role], url: BASE });
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await new Promise((resolve) => setTimeout(resolve, 700));
      const result = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const clientWidth = document.documentElement.clientWidth;
        const offenders = [];
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > clientWidth + 2 && rect.left >= -2 && getComputedStyle(el).position !== 'fixed') {
            const parentRect = el.parentElement?.getBoundingClientRect();
            if (!parentRect || parentRect.width <= clientWidth + 2) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className?.toString?.() ?? '').slice(0, 120),
                width: Math.round(rect.width),
                text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50),
              });
            }
          }
        }
        return { docWidth, clientWidth, offenders: offenders.slice(0, 6) };
      });
      const overflow = result.docWidth > result.clientWidth + 1;
      console.log(
        `${overflow ? '✗' : '✓'} ${route.padEnd(26)} client=${result.clientWidth} scroll=${result.docWidth}${
          overflow ? '  OVERFLOW' : ''
        }`,
      );
      if (overflow) {
        issues.push({ route, ...result });
        for (const offender of result.offenders) {
          console.log(`    ${offender.tag}.${offender.cls} w=${offender.width} "${offender.text}"`);
        }
      }
    } catch (error) {
      console.log(`⚠ ${route} failed: ${error.message}`);
      issues.push({ route, error: error.message });
    }
    await context.close();
  }
  await browser.close();
  console.log(`\n${issues.length} page(s) with issues.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Capture Kupon product screenshots with the locally installed Chrome.
 * Requires `pnpm dev` (or `pnpm start`) on port 3000.
 *
 *   pnpm screenshots
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000';
const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join(process.cwd(), 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

async function api(pathname, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const raw = setCookies.find((value) => value.startsWith('kupon_session=')) ?? '';
  const token = raw.split(';')[0].replace('kupon_session=', '');
  const json = await response.json().catch(() => null);
  return { token, json, status: response.status };
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
  const result = await api('/api/auth/staff-login', {
    method: 'POST',
    body: { phone, password },
  });
  return result.token;
}

async function vendorSession() {
  const result = await api('/api/auth/vendor-login', {
    method: 'POST',
    body: { code: 'V-UDSM-001', pin: '1234' },
  });
  return result.token;
}

async function main() {
  const [student, vendor, admin, superAdmin] = await Promise.all([
    studentSession(),
    vendorSession(),
    staffSession('+255745000001', 'admin1234'),
    staffSession('+255745000000', 'super1234'),
  ]);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  });

  const errors = [];

  async function capture({ name, url, token, mobile = false, fullPage = true }) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${name}: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));

    if (mobile) {
      await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    } else {
      await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1.5 });
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

    if (token) {
      await page.setCookie({
        name: 'kupon_session',
        value: token,
        url: BASE,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      });
    }

    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 45_000 });
    await page.evaluate(() => document.fonts?.ready);
    await new Promise((resolve) => setTimeout(resolve, 900));

    // Walk the page once so native lazy-loaded food photos are painted before
    // the full-page screenshot, then return to the top.
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let position = 0;
        const step = 500;
        const timer = window.setInterval(() => {
          window.scrollTo(0, position);
          position += step;
          if (position >= document.documentElement.scrollHeight) {
            window.clearInterval(timer);
            resolve();
          }
        }, 45);
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((resolve) => setTimeout(resolve, 500));

    const overlay = await page.evaluate(() =>
      document.body.innerText.includes('Unhandled Runtime Error'),
    );
    if (overlay) errors.push(`${name}: dev error overlay visible`);
    await page.screenshot({
      path: path.join(OUT, `${name}.png`),
      fullPage,
    });
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
    }));
    console.log(
      `  ✓ ${name}.png  ${metrics.clientWidth}w × ${metrics.height}h  scrollWidth=${metrics.width}${
        metrics.width > metrics.clientWidth ? '  ⚠ HORIZONTAL OVERFLOW' : ''
      }`,
    );
    await context.close();
    return metrics;
  }

  const shots = [
    { name: '01-landing-desktop', url: '/' },
    { name: '02-login-desktop', url: '/login' },
    { name: '03-student-home-mobile', url: '/student', token: student, mobile: true },
    { name: '04-student-topup-mobile', url: '/student/topup', token: student, mobile: true },
    { name: '05-student-pay-mobile', url: '/student/pay', token: student, mobile: true },
    { name: '06-student-history-mobile', url: '/student/history', token: student, mobile: true },
    { name: '07-student-refunds-mobile', url: '/student/refunds', token: student, mobile: true },
    { name: '08-vendor-home-mobile', url: '/vendor', token: vendor, mobile: true },
    { name: '09-vendor-scan-mobile', url: '/vendor/scan', token: vendor, mobile: true },
    { name: '10-vendor-menu-mobile', url: '/vendor/menu', token: vendor, mobile: true },
    { name: '11-admin-dashboard-desktop', url: '/admin', token: admin },
    { name: '12-admin-transactions-desktop', url: '/admin/transactions', token: admin },
    { name: '13-admin-reports-desktop', url: '/admin/reports', token: admin },
    { name: '14-admin-dashboard-mobile', url: '/admin', token: admin, mobile: true },
    { name: '15-super-overview-desktop', url: '/super-admin', token: superAdmin },
    { name: '16-super-tenants-desktop', url: '/super-admin/tenants', token: superAdmin },
    { name: '17-super-revenue-desktop', url: '/super-admin/revenue', token: superAdmin },
    { name: '18-super-health-desktop', url: '/super-admin/health', token: superAdmin },
    { name: '20-landing-mobile', url: '/', mobile: true },
  ];

  const only = process.env.ONLY ? process.env.ONLY.split(',').map((value) => value.trim()) : null;
  console.log('Capturing Kupon screenshots…');
  for (const shot of shots) {
    if (only && !only.some((value) => shot.name.includes(value))) continue;
    try {
      await capture(shot);
    } catch (error) {
      errors.push(`${shot.name}: ${error.message}`);
      console.warn(`  ⚠ ${shot.name} failed: ${error.message}`);
    }
  }

  await browser.close();

  if (errors.length > 0) {
    console.warn(`\n${errors.length} browser console/page errors:`);
    for (const error of [...new Set(errors)].slice(0, 20)) console.warn(`  - ${error}`);
  } else {
    console.log('\nNo browser console errors.');
  }
  console.log(`\nSaved ${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} screenshots to screenshots/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

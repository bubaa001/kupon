/**
 * Capture the interactive product-design states that the main screenshot pass
 * cannot reach: student food menu, cart, vendor add-dish dialog and the vendor
 * "preview as student" mode.
 *
 *   node scripts/screenshots-flow.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { SignJWT } from 'jose';
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
  const raw =
    (response.headers.getSetCookie?.() ?? []).find((value) => value.startsWith('kupon_session=')) ??
    '';
  return {
    cookie: raw.split(';')[0].replace('kupon_session=', ''),
    json: await response.json().catch(() => null),
  };
}

async function studentSession() {
  const uni = await api('/api/universities');
  const udsm = uni.json.data.universities.find((university) => university.code === 'UDSM');
  const otp = await api('/api/auth/request-otp', {
    method: 'POST',
    body: { phone: '+255712345678', universityId: udsm.id },
  });
  const verified = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone: '+255712345678', code: otp.json.data.demoOtp, universityId: udsm.id },
  });
  return verified.cookie;
}

async function vendorSession() {
  return (
    await api('/api/auth/vendor-login', {
      method: 'POST',
      body: { code: 'V-UDSM-001', pin: '1234' },
    })
  ).cookie;
}

async function paintLazyImages(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let position = 0;
      const timer = window.setInterval(() => {
        window.scrollTo(0, position);
        position += 450;
        if (position >= document.documentElement.scrollHeight) {
          window.clearInterval(timer);
          resolve();
        }
      }, 40);
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((resolve) => setTimeout(resolve, 450));
}

async function main() {
  const [student, vendor] = await Promise.all([studentSession(), vendorSession()]);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  });

  async function pageFor(cookie) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setCookie({ name: 'kupon_session', value: cookie, url: BASE });
    return { page, context };
  }

  const studentPage = await pageFor(student);
  await studentPage.page.goto(`${BASE}/student/pay`, { waitUntil: 'networkidle2' });
  await new Promise((resolve) => setTimeout(resolve, 900));
  await studentPage.page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((element) =>
      element.textContent?.includes('New order'),
    );
    button?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await studentPage.page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((element) =>
      element.textContent?.includes('Mama Asha Café'),
    );
    button?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 1600));
  await paintLazyImages(studentPage.page);
  // Let the "menu loaded" toast clear so it does not cover the page header in
  // the full-page screenshot.
  await new Promise((resolve) => setTimeout(resolve, 4200));
  await studentPage.page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((resolve) => setTimeout(resolve, 400));
  await studentPage.page.screenshot({
    path: path.join(OUT, '21-student-menu-mobile.png'),
    fullPage: true,
  });

  await studentPage.page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(
      (element) => element.textContent?.trim() === 'Add to order',
    );
    button?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await studentPage.page.screenshot({
    path: path.join(OUT, '22-student-cart-mobile.png'),
    fullPage: true,
  });
  console.log('  ✓ 21-student-menu-mobile.png / 22-student-cart-mobile.png');
  await studentPage.context.close();

  const vendorPage = await pageFor(vendor);
  await vendorPage.page.goto(`${BASE}/vendor/menu`, { waitUntil: 'networkidle2' });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await vendorPage.page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((element) =>
      element.textContent?.trim().startsWith('Add dish'),
    );
    button?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
  await vendorPage.page.screenshot({
    path: path.join(OUT, '23-vendor-add-dish-mobile.png'),
    fullPage: false,
  });
  await vendorPage.page.evaluate(() => {
    document.querySelector('[data-photo-upload]')?.scrollIntoView({ block: 'center' });
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await vendorPage.page.screenshot({
    path: path.join(OUT, '29-vendor-photo-upload-mobile.png'),
    fullPage: false,
  });
  console.log('  ✓ 29-vendor-photo-upload-mobile.png');
  await vendorPage.page.keyboard.press('Escape');
  await new Promise((resolve) => setTimeout(resolve, 500));
  await vendorPage.page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((element) =>
      element.textContent?.includes('Preview as student'),
    );
    button?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
  await paintLazyImages(vendorPage.page);
  await vendorPage.page.screenshot({
    path: path.join(OUT, '24-vendor-student-preview-mobile.png'),
    fullPage: true,
  });
  console.log('  ✓ 23-vendor-add-dish-mobile.png / 24-vendor-student-preview-mobile.png');
  await vendorPage.context.close();

  // Google signup page. A local signed ticket reproduces the state the Google
  // callback hands over; no account is created by this screenshot.
  const envLines = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  const env = Object.fromEntries(
    envLines
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"|"$/g, '')];
      }),
  );
  const universities = await api('/api/universities');
  const udsm = universities.json.data.universities.find((university) => university.code === 'UDSM');
  const ticket = await new SignJWT({
    email: 'jina.fulani@gmail.com',
    name: 'Jina Fulani',
    universityId: udsm.id,
    emailVerified: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('screenshot-google-signup')
    .setIssuer('kupon-google-signup')
    .setAudience('kupon-signup')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  const signupPage = await pageFor('');
  await signupPage.page.setCookie({ name: 'kupon_google_signup', value: ticket, url: BASE });
  await signupPage.page.goto(`${BASE}/signup/google`, { waitUntil: 'networkidle2' });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await signupPage.page.screenshot({
    path: path.join(OUT, '25-google-signup-mobile.png'),
    fullPage: true,
  });
  console.log('  ✓ 25-google-signup-mobile.png');
  await signupPage.context.close();

  const vendorTicket = await new SignJWT({
    email: 'mama.asha@gmail.com',
    name: 'Asha Mwinyi',
    universityId: udsm.id,
    emailVerified: true,
    kind: 'vendor',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('screenshot-google-vendor')
    .setIssuer('kupon-google-vendor')
    .setAudience('kupon-vendor-apply')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  const vendorApplyPage = await pageFor('');
  await vendorApplyPage.page.setCookie({
    name: 'kupon_google_vendor',
    value: vendorTicket,
    url: BASE,
  });
  await vendorApplyPage.page.goto(`${BASE}/vendor-apply`, { waitUntil: 'networkidle2' });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await vendorApplyPage.page.screenshot({
    path: path.join(OUT, '26-vendor-apply-mobile.png'),
    fullPage: true,
  });
  console.log('  ✓ 26-vendor-apply-mobile.png');
  await vendorApplyPage.context.close();

  const vendorLoginPage = await pageFor('');
  await vendorLoginPage.page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const tabs = await vendorLoginPage.page.$$('[role="tab"]');
  await tabs[1]?.click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await vendorLoginPage.page.screenshot({
    path: path.join(OUT, '27-login-vendor-mobile.png'),
    fullPage: true,
  });
  console.log('  ✓ 27-login-vendor-mobile.png');
  await vendorLoginPage.context.close();

  const staffContext = await browser.createBrowserContext();
  const staffPage = await staffContext.newPage();
  await staffPage.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await staffPage.goto(`${BASE}/staff/login`, { waitUntil: 'networkidle2' });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await staffPage.screenshot({
    path: path.join(OUT, '28-staff-login-desktop.png'),
    fullPage: true,
  });
  console.log('  ✓ 28-staff-login-desktop.png');
  await staffContext.close();

  await browser.close();
  console.log('Saved interactive design screenshots to screenshots/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

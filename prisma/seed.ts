/* eslint-disable no-console */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays, setHours, setMinutes, startOfMonth, subMonths } from 'date-fns';

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'file:./dev.db';

const prisma = new PrismaClient();

// Deterministic PRNG so the demo dashboard looks the same on every seed.
let rngState = 20261102;
function rand() {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}
function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}
function money(value: number) {
  return Math.round(value);
}

const PLATFORM_PERCENT = 2.5;
const AGGREGATOR_PERCENT = 1.5;
const UNIVERSITY_SHARE = 20;

function fees(amount: number) {
  const platformFee = money((amount * PLATFORM_PERCENT) / 100);
  const rawAggregator = money((amount * AGGREGATOR_PERCENT) / 100);
  const universityRevenue = money((platformFee * UNIVERSITY_SHARE) / 100);
  const aggregatorFee = Math.min(rawAggregator, Math.max(0, platformFee - universityRevenue));
  const platformNet = Math.max(0, platformFee - universityRevenue - aggregatorFee);
  return {
    platformFee,
    aggregatorFee,
    universityRevenue,
    platformNet,
    vendorSettlement: amount - platformFee,
  };
}

function ref(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Local food illustrations generated for the menu + coupon hero image. */
const FOOD_IMAGES: Record<string, string> = {
  'Ugali & Nyama': '/food/ugali-nyama.svg',
  'Chips Mayai': '/food/chips-mayai.svg',
  'Pilau Beef': '/food/photos/pilau-nyama.jpg',
  'Pilau Kuku': '/food/photos/pilau-nyama.jpg',
  'Wali Maharage': '/food/wali-maharage.svg',
  'Chapati & Mchicha': '/food/chapati-mchicha.svg',
  'Kuku Kwa Chipsi': '/food/photos/grilled-chicken.jpg',
  'Wali Kuku': '/food/photos/chicken-platter.jpg',
  'Ndizi Nyama': '/food/photos/ndizi-nyama.jpg',
  Mishkaki: '/food/mishkaki.svg',
  'Mchemsho wa Samaki': '/food/samaki.svg',
  'Soda Baridi': '/food/soda.svg',
  'Juice ya Embe': '/food/juice.svg',
};

function couponCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function ledgerLinesForPayment(amount: number, txnId: string, universityId: string) {
  const f = fees(amount);
  return [
    { transactionId: txnId, universityId, account: 'STUDENT_WALLET', debit: amount, credit: 0 },
    {
      transactionId: txnId,
      universityId,
      account: 'VENDOR_PENDING',
      debit: 0,
      credit: f.vendorSettlement,
    },
    {
      transactionId: txnId,
      universityId,
      account: 'UNIVERSITY_REVENUE',
      debit: 0,
      credit: f.universityRevenue,
    },
    {
      transactionId: txnId,
      universityId,
      account: 'AGGREGATOR_PAYABLE',
      debit: 0,
      credit: f.aggregatorFee,
    },
    {
      transactionId: txnId,
      universityId,
      account: 'PLATFORM_REVENUE',
      debit: 0,
      credit: f.platformNet,
    },
  ];
}

function ledgerLinesForTopUp(amount: number, txnId: string, universityId: string) {
  return [
    { transactionId: txnId, universityId, account: 'CASH_TRUST', debit: amount, credit: 0 },
    { transactionId: txnId, universityId, account: 'STUDENT_WALLET', debit: 0, credit: amount },
  ];
}

function dayAt(daysAgo: number, hour: number, minute: number) {
  const base = subDays(new Date(), daysAgo);
  return setMinutes(setHours(base, hour), minute);
}

type UniSeed = {
  code: string;
  name: string;
  route: string;
  city: string;
  saasFee: number;
  brandColor: string;
  admin: { name: string; phone: string };
  students: {
    name: string;
    phone: string;
    email: string;
    studentId: string;
    course: string;
    year: number;
    opening: number;
  }[];
  vendors: {
    name: string;
    owner: string;
    phone: string;
    code: string;
    pin: string;
    description: string;
    settlementAccount: string;
  }[];
  menu: { vendor: number; name: string; price: number; emoji: string; category: string }[];
};

const UDSM: UniSeed = {
  code: 'UDSM',
  name: 'University of Dar es Salaam',
  route: '555111',
  city: 'Dar es Salaam',
  saasFee: 350000,
  brandColor: '#10B981',
  admin: { name: 'Dr. Salma Mwinyi', phone: '+255745000001' },
  students: [
    {
      name: 'Amina Hassan Mwinyi',
      phone: '+255712345678',
      email: 'amina.mwinyi@udsm.ac.tz',
      studentId: 'UDSM/2024/CS/001',
      course: 'Computer Science',
      year: 2,
      opening: 145000,
    },
    {
      name: 'Juma Omary Kileo',
      phone: '+255713456789',
      email: 'juma.kileo@udsm.ac.tz',
      studentId: 'UDSM/2024/ENG/014',
      course: 'Civil Engineering',
      year: 2,
      opening: 120000,
    },
    {
      name: 'Neema Godfrey Mushi',
      phone: '+255714567890',
      email: 'neema.mushi@udsm.ac.tz',
      studentId: 'UDSM/2023/EDU/032',
      course: 'Education',
      year: 3,
      opening: 165000,
    },
    {
      name: 'Baraka Emmanuel Mwakyusa',
      phone: '+255715678901',
      email: 'baraka.mwakyusa@udsm.ac.tz',
      studentId: 'UDSM/2024/LAW/007',
      course: 'Law',
      year: 2,
      opening: 132000,
    },
    {
      name: 'Zainab Salum Juma',
      phone: '+255716789012',
      email: 'zainab.juma@udsm.ac.tz',
      studentId: 'UDSM/2023/MED/021',
      course: 'Medicine',
      year: 4,
      opening: 190000,
    },
  ],
  vendors: [
    {
      name: 'Mama Asha Café',
      owner: 'Asha Mtenga',
      phone: '+255754000001',
      code: 'V-UDSM-001',
      pin: '1234',
      description: 'Home-style Tanzanian meals beside the main library',
      settlementAccount: 'CRDB Bank •••• 9001',
    },
    {
      name: 'Kilimanjaro Bites',
      owner: 'Joseph Mrema',
      phone: '+255754000002',
      code: 'V-UDSM-002',
      pin: '2345',
      description: 'Grilled chicken, chips and fresh juice',
      settlementAccount: 'NMB Bank •••• 4412',
    },
    {
      name: 'Mazoezi Canteen',
      owner: 'Grace Kimaro',
      phone: '+255754000003',
      code: 'V-UDSM-003',
      pin: '3456',
      description: 'Quick bites for the sports grounds crowd',
      settlementAccount: 'Tigo Pesa •••• 7361',
    },
  ],
  menu: [
    { vendor: 0, name: 'Ugali & Nyama', price: 3500, emoji: '🍲', category: 'Main' },
    { vendor: 0, name: 'Wali Maharage', price: 2000, emoji: '🍛', category: 'Main' },
    { vendor: 0, name: 'Chapati & Mchicha', price: 1500, emoji: '🫓', category: 'Light meal' },
    { vendor: 0, name: 'Chips Mayai', price: 3000, emoji: '🍳', category: 'Popular' },
    { vendor: 0, name: 'Pilau Beef', price: 4000, emoji: '🍚', category: 'Main' },
    { vendor: 0, name: 'Ndizi Nyama', price: 3500, emoji: '🍌', category: 'Main' },
    { vendor: 0, name: 'Mchemsho wa Samaki', price: 4500, emoji: '🐟', category: 'Special' },
    { vendor: 0, name: 'Soda Baridi', price: 1000, emoji: '🥤', category: 'Drink' },
    { vendor: 1, name: 'Kuku Kwa Chipsi', price: 5500, emoji: '🍗', category: 'Special' },
    { vendor: 1, name: 'Wali Kuku', price: 5000, emoji: '🍛', category: 'Main' },
    { vendor: 1, name: 'Mishkaki', price: 2500, emoji: '🍢', category: 'Snack' },
    { vendor: 1, name: 'Chapati', price: 500, emoji: '🫓', category: 'Snack' },
    { vendor: 1, name: 'Juice ya Embe', price: 1500, emoji: '🧃', category: 'Drink' },
    { vendor: 1, name: 'Chips Mayai', price: 3000, emoji: '🍳', category: 'Popular' },
    { vendor: 1, name: 'Ugali Sukuma', price: 2000, emoji: '🥬', category: 'Light meal' },
    { vendor: 2, name: 'Pilau Kuku', price: 4500, emoji: '🍛', category: 'Special' },
    { vendor: 2, name: 'Wali Maharage', price: 2000, emoji: '🍚', category: 'Main' },
    { vendor: 2, name: 'Ndizi', price: 1000, emoji: '🍌', category: 'Snack' },
    { vendor: 2, name: 'Chips Mayai', price: 3000, emoji: '🍳', category: 'Popular' },
    { vendor: 2, name: 'Mchicha wa Nazi', price: 2000, emoji: '🥬', category: 'Light meal' },
  ],
};

const MUST: UniSeed = {
  code: 'MUST',
  name: 'Mbeya University of Science and Technology',
  route: '555222',
  city: 'Mbeya',
  saasFee: 250000,
  brandColor: '#0EA5E9',
  admin: { name: 'Prof. Daniel Mwakyusa', phone: '+255745000002' },
  students: [
    {
      name: 'Kelvin Peter Mwakalinga',
      phone: '+255717890123',
      email: 'kelvin.mwakalinga@must.ac.tz',
      studentId: 'MUST/2024/ICT/009',
      course: 'Information Technology',
      year: 2,
      opening: 128000,
    },
    {
      name: 'Rehema John Mwakyusa',
      phone: '+255718901234',
      email: 'rehema.mwakyusa@must.ac.tz',
      studentId: 'MUST/2023/ENG/003',
      course: 'Electrical Engineering',
      year: 3,
      opening: 155000,
    },
    {
      name: 'Salim Abdallah Msuya',
      phone: '+255719012345',
      email: 'salim.msuya@must.ac.tz',
      studentId: 'MUST/2024/BUS/018',
      course: 'Business Administration',
      year: 2,
      opening: 118000,
    },
    {
      name: 'Halima Rajabu Mwambe',
      phone: '+255720123456',
      email: 'halima.mwambe@must.ac.tz',
      studentId: 'MUST/2023/SCI/025',
      course: 'Applied Chemistry',
      year: 3,
      opening: 172000,
    },
    {
      name: 'Daudi Josephat Mbwambo',
      phone: '+255721234567',
      email: 'daudi.mbwambo@must.ac.tz',
      studentId: 'MUST/2024/ICT/011',
      course: 'Information Technology',
      year: 2,
      opening: 140000,
    },
  ],
  vendors: [
    {
      name: 'Mbeya Spice Hub',
      owner: 'Fatuma Mwinyi',
      phone: '+255754000011',
      code: 'V-MUST-001',
      pin: '1234',
      description: 'Spiced pilau and grilled meat near Hostel B',
      settlementAccount: 'CRDB Bank •••• 1201',
    },
    {
      name: 'Rift Valley Kitchen',
      owner: 'Elias Mwaipopo',
      phone: '+255754000012',
      code: 'V-MUST-002',
      pin: '2345',
      description: 'Fresh kuku, chips and local juices',
      settlementAccount: 'NMB Bank •••• 8804',
    },
    {
      name: 'Tukuyu Grill',
      owner: 'Janeth Mwambe',
      phone: '+255754000013',
      code: 'V-MUST-003',
      pin: '3456',
      description: 'Evening grill and quick student combos',
      settlementAccount: 'Airtel Money •••• 5520',
    },
  ],
  menu: [
    { vendor: 0, name: 'Ugali & Nyama', price: 3500, emoji: '🍲', category: 'Main' },
    { vendor: 0, name: 'Wali Maharage', price: 2000, emoji: '🍚', category: 'Main' },
    { vendor: 0, name: 'Chips Mayai', price: 3000, emoji: '🍳', category: 'Popular' },
    { vendor: 0, name: 'Pilau Beef', price: 4000, emoji: '🍛', category: 'Main' },
    { vendor: 0, name: 'Chapati & Mchicha', price: 1500, emoji: '🫓', category: 'Light meal' },
    { vendor: 0, name: 'Soda Baridi', price: 1000, emoji: '🥤', category: 'Drink' },
    { vendor: 0, name: 'Mchemsho wa Samaki', price: 4500, emoji: '🐟', category: 'Special' },
    { vendor: 1, name: 'Kuku Kwa Chipsi', price: 5500, emoji: '🍗', category: 'Special' },
    { vendor: 1, name: 'Wali Kuku', price: 5000, emoji: '🍛', category: 'Main' },
    { vendor: 1, name: 'Mishkaki', price: 2500, emoji: '🍢', category: 'Snack' },
    { vendor: 1, name: 'Chapati', price: 500, emoji: '🫓', category: 'Snack' },
    { vendor: 1, name: 'Juice ya Embe', price: 1500, emoji: '🧃', category: 'Drink' },
    { vendor: 1, name: 'Chips Mayai', price: 3000, emoji: '🍳', category: 'Popular' },
    { vendor: 1, name: 'Ndizi Nyama', price: 3500, emoji: '🍌', category: 'Main' },
    { vendor: 2, name: 'Pilau Kuku', price: 4500, emoji: '🍛', category: 'Special' },
    { vendor: 2, name: 'Wali Maharage', price: 2000, emoji: '🍚', category: 'Main' },
    { vendor: 2, name: 'Ndizi', price: 1000, emoji: '🍌', category: 'Snack' },
    { vendor: 2, name: 'Chips Mayai', price: 3000, emoji: '🍳', category: 'Popular' },
    { vendor: 2, name: 'Ugali Sukuma', price: 2000, emoji: '🥬', category: 'Light meal' },
    { vendor: 2, name: 'Mchicha wa Nazi', price: 2000, emoji: '🥬', category: 'Light meal' },
  ],
};

async function reset() {
  await prisma.auditLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.paymentToken.deleteMany();
  await prisma.refundRequest.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.saasInvoice.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.user.deleteMany();
  await prisma.university.deleteMany();
}

async function main() {
  // This seed is intentionally destructive for demo data, but it must never
  // silently wipe real Google-created accounts during testing. `db:reset`
  // clears the database first, so this guard only trips when someone runs the
  // demo seed against a live/dev database with real signups.
  const googleAccounts = await prisma.user.count({
    where: { googleId: { not: null } },
  });
  if (googleAccounts > 0 && process.env.FORCE_DESTRUCTIVE_SEED !== '1') {
    console.error(
      `Refusing to run the destructive demo seed: ${googleAccounts} account(s) exist. ` +
        'Use `pnpm db:reset` only when you intend to delete them, or set FORCE_DESTRUCTIVE_SEED=1.',
    );
    process.exit(1);
  }

  console.log('🌱 Resetting Kupon demo database…');
  await reset();

  const adminPassword = await bcrypt.hash('admin1234', 10);
  const superPassword = await bcrypt.hash('super1234', 10);
  const pinHashes = {
    '1234': await bcrypt.hash('1234', 10),
    '2345': await bcrypt.hash('2345', 10),
    '3456': await bcrypt.hash('3456', 10),
  } as Record<string, string>;

  const superAdmin = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: 'Bubaa Comp Admin',
      phone: '+255745000000',
      role: 'SUPER_ADMIN',
      passwordHash: superPassword,
    },
  });

  const allTransactions: any[] = [];
  const allLedger: any[] = [];
  const allRefundRequests: any[] = [];
  const allAuditLogs: any[] = [];
  let totalPayments = 0;

  for (const uniSeed of [UDSM, MUST]) {
    const university = await prisma.university.create({
      data: {
        id: randomUUID(),
        name: uniSeed.name,
        code: uniSeed.code,
        paymentRouteCode: uniSeed.route,
        city: uniSeed.city,
        saasFee: uniSeed.saasFee,
        brandColor: uniSeed.brandColor,
      },
    });

    const admin = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: uniSeed.admin.name,
        phone: uniSeed.admin.phone,
        role: 'ADMIN',
        universityId: university.id,
        passwordHash: adminPassword,
      },
    });

    // Three vendors per university.
    const vendors = [];
    for (let v = 0; v < uniSeed.vendors.length; v += 1) {
      const vSeed = uniSeed.vendors[v];
      const owner = await prisma.user.create({
        data: {
          id: randomUUID(),
          name: vSeed.owner,
          phone: vSeed.phone,
          role: 'VENDOR',
          universityId: university.id,
        },
      });
      const vendor = await prisma.vendor.create({
        data: {
          id: randomUUID(),
          userId: owner.id,
          universityId: university.id,
          name: vSeed.name,
          code: vSeed.code,
          pin: pinHashes[vSeed.pin],
          description: vSeed.description,
          settlementAccount: vSeed.settlementAccount,
        },
      });
      vendors.push(vendor);
    }

    // 20 menu items per university, with a few awaiting admin approval.
    const menuItems = [];
    for (let m = 0; m < uniSeed.menu.length; m += 1) {
      const item = uniSeed.menu[m];
      const created = await prisma.menuItem.create({
        data: {
          id: randomUUID(),
          vendorId: vendors[item.vendor].id,
          universityId: university.id,
          name: item.name,
          description: `${item.category} • prepared fresh at ${vendors[item.vendor].name}`,
          price: item.price,
          category: item.category,
          emoji: item.emoji,
          // Every seeded dish has a real local photo; the UI never falls back to
          // an emoji. Vendors upload their own photos through the menu dialog.
          imageUrl: FOOD_IMAGES[item.name] ?? '/food/ugali-nyama.svg',
          available: m !== 6,
          // Vendor-owned food is live immediately; admin vets vendors, not dishes.
          approvalStatus: 'APPROVED',
        },
      });
      menuItems.push(created);
    }

    // Five students per university, each with an opening balance from two weeks ago.
    const students = [];
    for (let s = 0; s < uniSeed.students.length; s += 1) {
      const sSeed = uniSeed.students[s];
      const user = await prisma.user.create({
        data: {
          id: randomUUID(),
          name: sSeed.name,
          phone: sSeed.phone,
          email: sSeed.email.toLowerCase(),
          role: 'STUDENT',
          universityId: university.id,
        },
      });
      const student = await prisma.studentProfile.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          universityId: university.id,
          studentId: sSeed.studentId,
          course: sSeed.course,
          year: sSeed.year,
          walletBalance: sSeed.opening,
        },
      });
      const wallet = await prisma.wallet.create({
        data: {
          id: randomUUID(),
          studentId: student.id,
          balance: sSeed.opening,
          currency: 'TZS',
        },
      });

      const openingTxnId = randomUUID();
      allTransactions.push({
        id: openingTxnId,
        reference: ref('TOP'),
        universityId: university.id,
        studentId: student.id,
        amount: sSeed.opening,
        fee: 0,
        // Opening balances are demo capital, not a real mobile-money collection.
        aggregatorFee: 0,
        type: 'TOPUP',
        status: 'SETTLED',
        network: pick(['M-PESA', 'TIGO_PESA', 'AIRTEL_MONEY', 'HALOTEL']),
        phone: sSeed.phone,
        routeCode: university.paymentRouteCode,
        metadata: JSON.stringify({
          provider: 'snippe-mock',
          seed: 'opening-balance',
          routeCode: university.paymentRouteCode,
          lipaNamba: university.paymentRouteCode,
        }),
        createdAt: subDays(new Date(), 14),
        settledAt: subDays(new Date(), 14),
      });
      allLedger.push(...ledgerLinesForTopUp(sSeed.opening, openingTxnId, university.id));

      students.push({ ...student, user, wallet, opening: sSeed.opening });
    }

    // 30 top-ups over the last 7 days (3 per student).
    for (const student of students) {
      const amounts = [5000, 10000, 20000, 5000, 15000];
      for (let t = 0; t < 3; t += 1) {
        const amount = pick(amounts);
        const txnId = randomUUID();
        const createdAt = dayAt(1 + Math.floor(rand() * 6), 7 + Math.floor(rand() * 12), Math.floor(rand() * 60));
        allTransactions.push({
          id: txnId,
          reference: ref('TOP'),
          universityId: university.id,
          studentId: student.id,
          amount,
          fee: 0,
          // The mock provider does not charge a real collection fee. With a live
          // aggregator, decide whether to absorb this or pass it to the student.
          aggregatorFee: 0,
          type: 'TOPUP',
          status: 'SETTLED',
          network: pick(['M-PESA', 'TIGO_PESA', 'AIRTEL_MONEY', 'HALOTEL']),
          phone: student.user.phone,
          routeCode: university.paymentRouteCode,
          metadata: JSON.stringify({
            provider: 'snippe-mock',
            seed: 'recent-topup',
            routeCode: university.paymentRouteCode,
            lipaNamba: university.paymentRouteCode,
          }),
          createdAt,
          settledAt: createdAt,
        });
        allLedger.push(...ledgerLinesForTopUp(amount, txnId, university.id));
        student.opening += amount;
      }
    }

    // 120 payments: 12 per student across the last 7 days. A handful are left
    // PENDING/FAILED so admin status badges and filters have real data.
    const approvedMenu = menuItems.filter((item) => item.available);
    let paymentIndex = 0;
    for (const student of students) {
      for (let p = 0; p < 12; p += 1) {
        const item = pick(approvedMenu);
        const vendor = vendors.find((v) => v.id === item.vendorId)!;
        const daysAgo = (paymentIndex * 3 + p) % 7;
        const hour = daysAgo === 0 ? 7 + Math.floor(rand() * 8) : 7 + Math.floor(rand() * 13);
        const createdAt = dayAt(daysAgo, hour, Math.floor(rand() * 60));
        const txnId = randomUUID();
        const status = paymentIndex % 23 === 0 ? 'FAILED' : paymentIndex % 17 === 0 ? 'PENDING' : 'SETTLED';
        const amount = item.price;
        const f = fees(amount);
        allTransactions.push({
          id: txnId,
          reference: ref('PAY'),
          universityId: university.id,
          studentId: student.id,
          vendorId: vendor.id,
          amount,
          fee: status === 'SETTLED' ? f.platformFee : 0,
          platformFee: status === 'SETTLED' ? f.platformFee : 0,
          aggregatorFee: status === 'SETTLED' ? f.aggregatorFee : money((amount * AGGREGATOR_PERCENT) / 100),
          universityRevenue: status === 'SETTLED' ? f.universityRevenue : 0,
          vendorSettlement: status === 'SETTLED' ? f.vendorSettlement : 0,
          type: 'PAYMENT',
          status,
          routeCode: university.paymentRouteCode,
          metadata: JSON.stringify({
            item: item.name,
            vendorCode: vendor.code,
            vendorName: vendor.name,
            routeCode: university.paymentRouteCode,
            lipaNamba: university.paymentRouteCode,
            universityCode: university.code,
            provider: 'snippe-mock',
          }),
          failureReason: status === 'FAILED' ? 'MOCK_TIMEOUT: aggregator did not confirm in time' : null,
          createdAt,
          settledAt: status === 'SETTLED' ? new Date(createdAt.getTime() + 4000) : null,
        });

        if (status === 'SETTLED') {
          student.opening -= amount;
          vendor.pendingBalance = (vendor.pendingBalance ?? 0) + f.vendorSettlement;
          allLedger.push(...ledgerLinesForPayment(amount, txnId, university.id));
          totalPayments += 1;
        }
        paymentIndex += 1;
      }
    }

    // Persist the final wallet balances (opening + top-ups − settled payments).
    for (const student of students) {
      await prisma.wallet.update({
        where: { id: student.wallet.id },
        data: { balance: Math.max(0, student.opening) },
      });
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: { walletBalance: Math.max(0, student.opening) },
      });
    }

    // Money requests. Everything in this legacy plan is a WITHDRAWAL: the student
    // is cashing out unused wallet balance to mobile money, not reversing an order.
    // Order REFUND examples are created after the order board below, because a
    // refund must point at a real paid + vendor-verified order.
    const refundPlan = [
      { student: students[0], amount: 4000, status: 'PENDING', note: null, reason: 'I am travelling home this weekend and have unused balance.' },
      { student: students[1], amount: 2500, status: 'PENDING', note: null, reason: 'I mostly cook in the hostel now. Please cash out the remaining balance.' },
      { student: students[2], amount: 6000, status: 'APPROVED', note: 'Verified with the student affairs office. Payout queued.', reason: 'Medical leave for the rest of the semester.' },
      { student: students[3], amount: 3000, status: 'PENDING', note: null, reason: 'I am transferring to another university next month.' },
      { student: students[4], amount: 2000, status: 'REJECTED', note: 'Cash-out window closes 14 days after top-up. Please spend or carry over the balance.', reason: 'Change of mind.' },
    ];

    for (const plan of refundPlan) {
      const requestId = randomUUID();
      const createdAt = dayAt(1 + Math.floor(rand() * 5), 9 + Math.floor(rand() * 8), 15);
      const requestRow: Record<string, unknown> = {
        id: requestId,
        reference: ref('WDR'),
        kind: 'WITHDRAWAL',
        studentId: plan.student.id,
        universityId: university.id,
        amount: plan.amount,
        reason: plan.reason,
        status: plan.status,
        adminNote: plan.note,
        reviewedById: plan.status === 'PENDING' ? null : admin.id,
        reviewedAt: plan.status === 'PENDING' ? null : new Date(createdAt.getTime() + 3600_000),
        payoutStatus: plan.status === 'APPROVED' ? 'SETTLED' : null,
        createdAt,
      };
      allRefundRequests.push(requestRow);

      if (plan.status === 'APPROVED') {
        const txnId = randomUUID();
        const txnReference = ref('WDR');
        const createdAtTxn = new Date(createdAt.getTime() + 3900_000);
        allTransactions.push({
          id: txnId,
          reference: txnReference,
          universityId: university.id,
          studentId: plan.student.id,
          amount: plan.amount,
          fee: 0,
          type: 'WITHDRAWAL',
          status: 'SETTLED',
          phone: plan.student.user.phone,
          routeCode: university.paymentRouteCode,
          metadata: JSON.stringify({
            provider: 'snippe-mock',
            kind: 'WITHDRAWAL',
            withdrawalRequestId: requestId,
            reason: plan.reason,
            routeCode: university.paymentRouteCode,
          }),
          createdAt: createdAtTxn,
          settledAt: createdAtTxn,
        });
        requestRow.payoutTransactionId = txnId;
        requestRow.payoutReference = txnReference;
        plan.student.opening -= plan.amount;
        allLedger.push(
          {
            transactionId: txnId,
            universityId: university.id,
            account: 'STUDENT_WALLET',
            debit: plan.amount,
            credit: 0,
          },
          {
            transactionId: txnId,
            universityId: university.id,
            account: 'CASH_TRUST',
            debit: 0,
            credit: plan.amount,
          },
        );
      }
    }

    // Re-persist balances after the approved refund.
    for (const student of students) {
      await prisma.wallet.update({
        where: { id: student.wallet.id },
        data: { balance: Math.max(0, student.opening) },
      });
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: { walletBalance: Math.max(0, student.opening) },
      });
    }

    // One paid settlement per vendor, plus their current pending balance.
    for (const vendor of vendors) {
      const pending = vendor.pendingBalance ?? 0;
      const settledAmount = Math.max(15000, Math.round(pending * 0.18));
      const safeSettled = Math.min(settledAmount, pending);
      await prisma.settlement.create({
        data: {
          id: randomUUID(),
          reference: ref('STL'),
          vendorId: vendor.id,
          universityId: university.id,
          amount: safeSettled,
          status: 'PAID',
          periodStart: subDays(new Date(), 14),
          periodEnd: subDays(new Date(), 7),
          paidAt: subDays(new Date(), 6),
          createdAt: subDays(new Date(), 7),
        },
      });
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: {
          pendingBalance: pending - safeSettled,
          totalSettled: safeSettled,
        },
      });
    }

    // SaaS invoices for the super-admin billing view.
    const currentMonth = new Date();
    for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo -= 1) {
      const issued = subMonths(currentMonth, monthsAgo);
      const period = `${issued.getFullYear()}-${String(issued.getMonth() + 1).padStart(2, '0')}`;
      await prisma.saasInvoice.create({
        data: {
          id: randomUUID(),
          reference: ref('INV'),
          universityId: university.id,
          amount: uniSeed.saasFee,
          period,
          status: monthsAgo === 0 ? 'PENDING' : 'PAID',
          issuedAt: startOfMonth(issued),
          paidAt: monthsAgo === 0 ? null : startOfMonth(issued),
        },
      });
    }

    // Seed some audit history for the admin audit trail.
    allAuditLogs.push(
      {
        actorId: admin.id,
        universityId: university.id,
        action: 'WITHDRAWAL_APPROVED',
        entity: 'RefundRequest',
        entityId: allRefundRequests[allRefundRequests.length - 3]?.id ?? null,
        metadata: JSON.stringify({ kind: 'WITHDRAWAL', amount: 6000, note: 'Redirected to mobile-money payout' }),
        createdAt: subDays(new Date(), 2),
      },
      {
        actorId: admin.id,
        universityId: university.id,
        action: 'VENDOR_APPROVED',
        entity: 'Vendor',
        entityId: vendors[0].id,
        metadata: JSON.stringify({ vendor: vendors[0].name, code: vendors[0].code }),
        createdAt: subDays(new Date(), 1),
      },
      {
        actorId: superAdmin.id,
        universityId: university.id,
        action: 'UNIVERSITY_ONBOARDED',
        entity: 'University',
        entityId: university.id,
        metadata: JSON.stringify({ code: university.code, routeCode: university.paymentRouteCode }),
        createdAt: subDays(new Date(), 20),
      },
    );

    console.log(
      `  ✓ ${university.code}: 5 students, ${vendors.length} vendors, ${menuItems.length} menu items`,
    );
  }

  // Bulk insert keeps the seed fast on SQLite.
  await prisma.transaction.createMany({ data: allTransactions });
  await prisma.ledgerEntry.createMany({ data: allLedger });
  await prisma.refundRequest.createMany({ data: allRefundRequests });
  await prisma.auditLog.createMany({ data: allAuditLogs });

  // Seed a realistic order board. Recent settled payment transactions become
  // meal coupons; the demo student gets one PENDING coupon so the order/coupon
  // screens have something to show immediately, while two vendors get a queue.
  const recentPaid = await prisma.transaction.findMany({
    where: { type: 'PAYMENT', status: 'SETTLED', vendorId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      student: { select: { user: { select: { phone: true } } } },
      vendor: { select: { code: true, userId: true } },
    },
  });

  const demoCandidate = recentPaid.find(
    (txn) =>
      txn.student.user.phone === '+255712345678' &&
      txn.vendor?.code === 'V-UDSM-001',
  );
  const mustCandidate = recentPaid.find((txn) => txn.vendor?.code === 'V-MUST-001');

  const selected: typeof recentPaid = [];
  for (const candidate of [demoCandidate, mustCandidate, ...recentPaid]) {
    if (!candidate || selected.some((txn) => txn.id === candidate.id)) continue;
    selected.push(candidate);
    if (selected.length >= 5) break;
  }

  let orderCount = 0;
  const usedCouponCodes = new Set<string>();
  const createdOrders: Array<{
    id: string;
    reference: string;
    transactionId: string | null;
    studentId: string;
    universityId: string;
    status: string;
    total: number;
  }> = [];
  for (const txn of selected) {
    if (!txn.vendorId || !txn.vendor) continue;
    const metadata = JSON.parse(txn.metadata ?? '{}') as { item?: string; vendorName?: string };
    const item = metadata.item
      ? await prisma.menuItem.findFirst({
          where: { vendorId: txn.vendorId, name: metadata.item },
        })
      : null;
    if (!item) continue;

    let code = couponCode();
    while (usedCouponCodes.has(code)) code = couponCode();
    usedCouponCodes.add(code);

    const isPending = orderCount < 2;
    // Keep the two seeded open coupons fresh so the demo order desk feels live.
    const createdAt = isPending
      ? new Date(Date.now() - (orderCount === 0 ? 4 : 9) * 60 * 1000)
      : txn.createdAt;
    const verifiedAt = isPending ? null : new Date(createdAt.getTime() + 7 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        reference: ref('ORD'),
        universityId: txn.universityId,
        studentId: txn.studentId,
        vendorId: txn.vendorId,
        status: isPending ? 'PENDING' : 'VERIFIED',
        total: txn.amount,
        itemCount: 1,
        couponCode: code,
        transactionId: txn.id,
        verifiedById: isPending ? null : txn.vendor.userId,
        verifiedAt,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt,
        items: {
          create: [
            {
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              quantity: 1,
              emoji: item.emoji,
              imageUrl: item.imageUrl,
            },
          ],
        },
      },
    });
    createdOrders.push({
      id: order.id,
      reference: order.reference,
      transactionId: order.transactionId,
      studentId: order.studentId,
      universityId: order.universityId,
      status: order.status,
      total: order.total,
    });
    orderCount += 1;
  }

  // The demo student gets one extra VERIFIED coupon so the order-refund screen is
  // demonstrable immediately (a PENDING coupon can only be cancelled, not refunded).
  const amina = await prisma.studentProfile.findFirst({
    where: { user: { phone: '+255712345678' } },
    include: { user: true },
  });
  if (amina) {
    const usedTransactionIds = createdOrders
      .map((order) => order.transactionId)
      .filter((id): id is string => Boolean(id));
    const extraTxn = await prisma.transaction.findFirst({
      where: {
        studentId: amina.id,
        type: 'PAYMENT',
        status: 'SETTLED',
        vendorId: { not: null },
        id: { notIn: usedTransactionIds },
      },
      orderBy: { createdAt: 'desc' },
      include: { vendor: { select: { userId: true } } },
    });
    const extraMeta = extraTxn
      ? (JSON.parse(extraTxn.metadata ?? '{}') as { item?: string })
      : {};
    const extraItem = extraTxn?.vendorId
      ? await prisma.menuItem.findFirst({
          where: { vendorId: extraTxn.vendorId, name: extraMeta.item ?? '' },
        })
      : null;
    if (extraTxn && extraTxn.vendorId && extraTxn.vendor && extraItem) {
      let extraCode = couponCode();
      while (usedCouponCodes.has(extraCode)) extraCode = couponCode();
      usedCouponCodes.add(extraCode);
      const extraVerifiedAt = new Date(extraTxn.createdAt.getTime() + 7 * 60 * 1000);
      const extraOrder = await prisma.order.create({
        data: {
          reference: ref('ORD'),
          universityId: extraTxn.universityId,
          studentId: extraTxn.studentId,
          vendorId: extraTxn.vendorId,
          status: 'VERIFIED',
          total: extraTxn.amount,
          itemCount: 1,
          couponCode: extraCode,
          transactionId: extraTxn.id,
          verifiedById: extraTxn.vendor.userId,
          verifiedAt: extraVerifiedAt,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: extraTxn.createdAt,
          items: {
            create: [
              {
                menuItemId: extraItem.id,
                name: extraItem.name,
                price: extraItem.price,
                quantity: 1,
                emoji: extraItem.emoji,
                imageUrl: extraItem.imageUrl,
              },
            ],
          },
        },
      });
      createdOrders.push({
        id: extraOrder.id,
        reference: extraOrder.reference,
        transactionId: extraOrder.transactionId,
        studentId: extraOrder.studentId,
        universityId: extraOrder.universityId,
        status: extraOrder.status,
        total: extraOrder.total,
      });
    }
  }

  // Pending ORDER REFUND examples (kind=REFUND, tied to a verified order + its
  // original PAYMENT transaction) so both admin queues have real work at boot.
  const seededUniversities = await prisma.university.findMany({
    select: { id: true, code: true },
  });
  const orderRefundReasons = [
    'Ordered by mistake; the vendor kept the meal and asked me to raise a refund.',
    'The meal was not available when I reached the counter even though the coupon was verified.',
  ];
  let orderRefundIndex = 0;
  for (const university of seededUniversities) {
    const target = createdOrders.find(
      (order) =>
        order.universityId === university.id &&
        order.status === 'VERIFIED' &&
        order.transactionId &&
        order.studentId !== amina?.id,
    );
    if (!target || !target.transactionId) continue;
    await prisma.refundRequest.create({
      data: {
        reference: ref('RFD'),
        kind: 'REFUND',
        studentId: target.studentId,
        universityId: target.universityId,
        amount: target.total,
        reason: orderRefundReasons[orderRefundIndex % orderRefundReasons.length],
        status: 'PENDING',
        orderId: target.id,
        transactionId: target.transactionId,
      },
    });
    orderRefundIndex += 1;
  }

  const counts = {
    universities: await prisma.university.count(),
    students: await prisma.studentProfile.count(),
    vendors: await prisma.vendor.count(),
    menuItems: await prisma.menuItem.count(),
    transactions: await prisma.transaction.count(),
    payments: totalPayments,
    ledgerEntries: await prisma.ledgerEntry.count(),
    refunds: await prisma.refundRequest.count(),
    withdrawalRequests: await prisma.refundRequest.count({ where: { kind: 'WITHDRAWAL' } }),
    orderRefundRequests: await prisma.refundRequest.count({ where: { kind: 'REFUND' } }),
    orders: await prisma.order.count(),
  };

  console.log('\n✅ Kupon seed complete');
  console.table(counts);
  console.log('\nDemo credentials');
  console.log('  Student : +255712345678  (OTP shown in app)');
  console.log('  Vendor  : V-UDSM-001 / PIN 1234');
  console.log('  Admin   : +255745000001 / admin1234  (UDSM)');
  console.log('  Admin   : +255745000002 / admin1234  (MUST)');
  console.log('  Super   : +255745000000 / super1234');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  Landmark,
  ReceiptText,
  ScanLine,
  ScrollText,
  ShieldCheck,
  Signal,
  Smartphone,
  Store,
  Ticket,
  Wallet,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { env } from '@/lib/env';
import { USSD_ENABLED } from '@/lib/features';
import { getLandingData, type LandingData } from '@/lib/public-data';
import { formatCompactTZS, formatNumber, formatTZS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Kupon | Digital campus wallet for Tanzanian universities' },
  description:
    'Kupon replaces paper coupons and exercise-book ledgers with a mobile-money wallet, QR menu ordering, verified meal coupons and a double-entry ledger for Tanzanian universities.',
};

// Every public metric is a live database aggregate (see lib/public-data.ts).
// Nothing on this page should invent a balance, count, reference or coupon.

const STEPS = [
  {
    title: 'Top up from any phone',
    body: 'M-Pesa, Tigo Pesa, Airtel Money and Halotel cash in to the student wallet. Every top up returns a real SMS receipt.',
  },
  {
    title: 'Scan the counter, pick your meal',
    body: 'Students scan the vendor’s Kupon QR, choose from the live approved menu and pay from the wallet. A verified meal coupon appears instantly on their phone.',
  },
  {
    title: 'Close the books every night',
    body: 'Each sale posts a double-entry journal: vendor settlement, university share and platform fee, split to the shilling.',
  },
];

const SECURITY = [
  {
    icon: ShieldCheck,
    title: 'Tenant isolation',
    body: 'Every query resolves the university scope before it can touch money.',
  },
  {
    icon: Fingerprint,
    title: 'Protected sign-in',
    body: 'httpOnly session cookies, Google OAuth verification and bcrypt staff passwords.',
  },
  {
    icon: ScrollText,
    title: 'Double-entry ledger',
    body: 'Debits and credits must balance to the shilling on every transaction.',
  },
  {
    icon: Zap,
    title: 'Rate-limited rails',
    body: 'Payment and top-up endpoints are throttled per phone and per network.',
  },
];

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Logo />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex"
        >
          <a className="transition-colors hover:text-slate-900" href="#how-it-works">
            How it works
          </a>
          <a className="transition-colors hover:text-slate-900" href="#roles">
            Who it serves
          </a>
          <a className="transition-colors hover:text-slate-900" href="#security">
            Security
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {USSD_ENABLED ? (
            <Link
              href="/ussd"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              Try USSD
            </Link>
          ) : null}
          <Button asChild size="sm" className="h-10 px-4 text-sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Metrics({ stats }: { stats: LandingData['stats'] }) {
  const values = [
    { label: 'Universities live', value: formatNumber(stats.universities) },
    { label: 'Campus vendors', value: formatNumber(stats.vendors) },
    { label: 'Student wallets', value: formatNumber(stats.students) },
    { label: 'Settled meal volume', value: formatCompactTZS(stats.settledVolume) },
  ];

  return (
    <section
      aria-label="Kupon live campus snapshot"
      className="border-y border-slate-200 bg-white"
    >
      <dl className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
        {values.map((stat) => (
          <div key={stat.label} className="bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <dt className="text-xs font-medium text-slate-500">{stat.label}</dt>
            <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-navy lg:text-3xl">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="max-w-2xl">
          <p className="eyebrow">How Kupon works</p>
          <h2
            id="how-it-works-title"
            className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl"
          >
            From the cash queue to one scan.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Three moves replace the coupon book, the cash tin and the exercise-book ledger.
          </p>
        </div>
        <ol className="mt-10 grid gap-8 border-t border-slate-200 pt-8 lg:grid-cols-3 lg:gap-12">
          {STEPS.map((step, index) => (
            <li key={step.title} className="lg:pr-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-medium tabular-nums text-primary-500">
                  0{index + 1}
                </span>
                <span className="h-px flex-1 bg-slate-200" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-navy">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RoleLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group/link mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-current"
    >
      {label}
      <ArrowUpRight className="h-4 w-4 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
    </Link>
  );
}

function Roles({ data }: { data: LandingData }) {
  const balance = data.coupon?.studentBalance ?? data.walletFloat;
  const latestTransaction = data.transactions[0];
  return (
    <section
      id="roles"
      aria-labelledby="roles-title"
      className="scroll-mt-24 border-y border-slate-200 bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2
              id="roles-title"
              className="text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl"
            >
              One system, three points of view.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              A student wallet, a vendor terminal and a university ledger that agree with each
              other by design.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit bg-white">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          <article className="relative overflow-hidden rounded-2xl bg-navy p-6 text-white lg:col-span-7 lg:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-500/25 blur-2xl"
            />
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-primary-300 ring-1 ring-white/10">
                  <Wallet className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <p className="mt-4 text-xs font-medium text-primary-300">For students</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                  A wallet in the phone you already carry.
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" strokeWidth={2} />
                    Top up from M-Pesa, Tigo Pesa, Airtel Money or Halotel.
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" strokeWidth={2} />
                    Scan a vendor QR, pick your meal and show the verified coupon.
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" strokeWidth={2} />
                    Track every meal, refund and top up from one screen.
                  </li>
                </ul>
              </div>
              <div className="w-full max-w-[190px] rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {data.coupon ? 'Latest wallet' : 'Campus wallet float'}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                  {formatTZS(balance)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {data.university
                    ? `${data.university.code} · Lipa Namba ${data.university.paymentRouteCode}`
                    : 'Waiting for an active campus'}
                </p>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-white/10 px-3 py-2">
                  <span className="text-[10px] text-slate-300">
                    {data.mealsToday} meal{data.mealsToday === 1 ? '' : 's'} today
                  </span>
                  <Ticket className="h-5 w-5 text-primary-300" strokeWidth={1.8} />
                </div>
                {latestTransaction ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <ArrowDownLeft className="h-3 w-3" strokeWidth={2} />
                    Latest: {formatTZS(latestTransaction.amount)}
                  </div>
                ) : null}
              </div>
            </div>
            <RoleLink href="/login?role=student" label="Sign in" />
          </article>

          <div className="grid gap-4 lg:col-span-5">
            <article className="rounded-2xl border border-primary-200 bg-primary-50 p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-700 shadow-sm">
                <Store className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="mt-4 text-xs font-medium text-primary-700">For vendors</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-navy">
                Charge the wallet, not the queue.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Today’s sales, pending settlement and the menu in one terminal. No cash drawer to
                reconcile.
              </p>
              <RoleLink href="/login?role=vendor" label="Sign in" />
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Landmark className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="mt-4 text-xs font-medium text-slate-500">For university finance</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-navy">
                See the whole campus, in real time.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Revenue, student wallets, refunds and vendor payouts with an audit trail behind
                every shilling.
              </p>
              <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />
                Staff access is provisioned directly by Bubaa Comp.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

const LEDGER_LABELS: Record<string, string> = {
  STUDENT_WALLET: 'Student wallet',
  VENDOR_PENDING: 'Vendor pending',
  UNIVERSITY_REVENUE: 'University revenue',
  AGGREGATOR_PAYABLE: 'Aggregator payable',
  PLATFORM_REVENUE: 'Platform revenue',
  CASH_TRUST: 'Cash trust',
};

function LedgerCard({ ledger }: { ledger: LandingData['ledger'] }) {
  if (!ledger) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <ReceiptText className="h-4 w-4" strokeWidth={1.8} />
          Journal entry
        </div>
        <p className="mt-4 text-sm text-slate-400">No settled journal yet.</p>
        <p className="mt-1 text-[11px] text-slate-500">
          The first meal payment will post a balanced double-entry journal here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <ReceiptText className="h-4 w-4" strokeWidth={1.8} />
          Journal entry
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-300">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
          {ledger.balanced ? 'Balanced' : 'Review'}
        </span>
      </div>
      <div className="mt-4 space-y-2 font-mono text-[11px]">
        {ledger.entries.map((entry) => (
          <div
            key={entry.account}
            className="flex justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0"
          >
            <span className="text-slate-400">
              {LEDGER_LABELS[entry.account] ?? entry.account.replace(/_/g, ' ').toLowerCase()}
            </span>
            <span className="tabular-nums text-slate-200">
              {entry.debit > 0
                ? `${formatNumber(entry.debit)}.00 Dr`
                : `${formatNumber(entry.credit)}.00 Cr`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-[11px]">
        <span className="text-slate-400">
          {ledger.balanced ? 'Debits equal credits' : 'Out of balance'}
        </span>
        <span className="font-mono font-semibold tabular-nums text-primary-300">
          {formatTZS(ledger.totalDebit)}
        </span>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        {ledger.university
          ? `${ledger.university.code} · Lipa Namba ${ledger.university.paymentRouteCode}`
          : 'Tenant ledger'}{' '}
        · Ref {ledger.reference}
      </p>
    </div>
  );
}

function Security({ ledger }: { ledger: LandingData['ledger'] }) {
  return (
    <section
      id="security"
      aria-labelledby="security-title"
      className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-navy px-5 py-10 text-white sm:px-8 lg:px-12 lg:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-primary-400/10 blur-3xl"
          />
          <div className="relative grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-300/90">
                Security and trust
              </p>
              <h2
                id="security-title"
                className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
              >
                Money you can audit, tenant by tenant.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
                Each university is a separate ledger boundary with its own Lipa Namba, sessions and
                fee split. Isolation is enforced in code, not in a spreadsheet.
              </p>
              <dl className="mt-8 grid gap-5 sm:grid-cols-2">
                {SECURITY.map((item) => (
                  <div key={item.title}>
                    <dt className="flex items-center gap-2 text-sm font-semibold text-white">
                      <item.icon className="h-4 w-4 text-primary-300" strokeWidth={1.9} />
                      {item.title}
                    </dt>
                    <dd className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <LedgerCard ledger={ledger} />
          </div>
        </div>
      </div>
    </section>
  );
}

function UssdBand({ data, shortCode }: { data: LandingData; shortCode: string }) {
  const coupon = data.coupon;
  const vendorNumber = coupon?.vendor.code.split('-').at(-1) ?? '';

  return (
    <section
      id="ussd"
      aria-labelledby="ussd-title"
      className="scroll-mt-24 border-y border-slate-200 bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <h2
            id="ussd-title"
            className="text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl"
          >
            No smartphone? Dial the short code.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600">
            Every student number works as a wallet on a feature phone. Same balance, same vendors,
            same ledger, no data bundle required.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            <li className="flex gap-2.5">
              <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" strokeWidth={1.9} />
              Check the wallet balance in one reply.
            </li>
            <li className="flex gap-2.5">
              <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" strokeWidth={1.9} />
              Pay a canteen by its three-digit vendor number.
            </li>
            <li className="flex gap-2.5">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" strokeWidth={1.9} />
              Top up from M-Pesa, Tigo Pesa, Airtel Money or Halotel.
            </li>
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/ussd">
                Try USSD
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <span className="text-sm text-slate-500">
              Short code{' '}
              <span className="font-mono font-semibold tracking-wide text-slate-800">{shortCode}</span>
            </span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-3 shadow-lift">
            <div className="rounded-2xl bg-[#0a1f14] p-4 font-mono text-[11px] leading-relaxed text-primary-300/90 ring-1 ring-black/40">
              <div className="flex items-center justify-between text-[9px] text-primary-500/70">
                <span>KUPON</span>
                <span className="flex items-center gap-1">
                  <Signal className="h-2.5 w-2.5" strokeWidth={2.2} />
                  {shortCode}
                </span>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-primary-100">KUPON MENU</p>
                <p>1. Balance</p>
                <p>2. Pay vendor</p>
                <p>3. Top up</p>
                <p>4. Exit</p>
                {coupon ? (
                  <>
                    <p className="pt-2 text-primary-500/80">Reply: 2</p>
                    <p className="text-primary-100">Vendor number: {vendorNumber}</p>
                    <p className="pt-1 text-primary-500/80">Reply: {vendorNumber}</p>
                    <p>
                      Lipa {formatTZS(coupon.total)} kwa {coupon.vendor.name}?
                    </p>
                    <p>1. NDIYO 2. HAPANA</p>
                    <p className="text-primary-500/80">Reply: 1</p>
                    {coupon.status === 'VERIFIED' ? (
                      <>
                        <p className="pt-2 text-primary-100">Malipo yamekamilika.</p>
                        <p>Salio: {formatTZS(coupon.studentBalance)}</p>
                      </>
                    ) : (
                      <p className="pt-2 text-primary-100">
                        Inasubiri uthibitisho wa vendor.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="pt-2 text-primary-500/80">No recent meal order yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-3xl border border-primary-200 bg-primary-50 px-6 py-10 sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-14 lg:py-14">
        <div className="max-w-xl">
          <h2
            id="final-cta-title"
            className="text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl"
          >
            Retire the coupon book this term.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Sign in with Google, pay a campus vendor and watch the ledger update. No card, no
            download.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/login">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {USSD_ENABLED ? (
            <Button asChild size="lg" variant="outline" className="w-full bg-white sm:w-auto">
              <Link href="/ussd">Try USSD</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <ul className="mt-3 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="inline-flex items-center gap-1 text-slate-600 transition-colors hover:text-slate-900"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiteFooter({ stats }: { stats: LandingData['stats'] }) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Campus money for Tanzanian universities. Scan, order and verify meals, settle through
              mobile money, audit everything.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-400">
              <ChevronRight className="h-3 w-3" strokeWidth={2.2} />
              Demo environment. No real money moves.
            </p>
          </div>
          <FooterColumn
            title="Product"
            links={[
              { label: 'Sign in', href: '/login' },
              ...(USSD_ENABLED ? [{ label: 'Try USSD', href: '/ussd' }] : []),
              { label: 'How it works', href: '/#how-it-works' },
            ]}
          />
          <FooterColumn
            title="Who it serves"
            links={[
              { label: 'Students', href: '/login?role=student' },
              { label: 'Vendors', href: '/login?role=vendor' },
            ]}
          />
          <FooterColumn
            title="Trust"
            links={[
              { label: 'Security', href: '/#security' },
              { label: 'Live campus data', href: '/#roles' },
              { label: 'Contact', href: 'mailto:hello@kupon.co.tz' },
            ]}
          />
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Kupon. Built by Bubaa Comp in Dar es Salaam.</p>
          <p>
            {formatNumber(stats.universities)} active campus
            {stats.universities === 1 ? '' : 'es'} · {formatNumber(stats.students)} wallets
          </p>
        </div>
      </div>
    </footer>
  );
}

export default async function HomePage() {
  const data = await getLandingData();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="dot-grid absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black_5%,transparent_75%)]" />
            <div className="absolute -right-24 -top-32 h-[460px] w-[460px] rounded-full bg-primary-200/30 blur-3xl" />
            <div className="absolute -left-32 top-40 h-[360px] w-[360px] rounded-full bg-slate-200/50 blur-3xl" />
          </div>
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-14 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
            <div className="motion-safe:animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden />
                Live on {formatNumber(data.stats.universities)} campuses
              </span>
              <h1
                id="hero-title"
                className="mt-6 text-[clamp(2.9rem,7.2vw,4.75rem)] font-semibold leading-[0.94] tracking-[-0.045em] text-navy"
              >
                Paper coupons
                <br />
                end here<span className="text-primary-500">.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                A digital wallet for Tanzanian universities. Scan the counter QR, choose your meal,
                pay from your wallet and get a vendor-verified coupon — all on one auditable ledger.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/login">
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                {USSD_ENABLED ? (
                  <Button asChild size="lg" variant="outline" className="w-full bg-white sm:w-auto">
                    <Link href="/ussd">
                      <Smartphone className="h-4 w-4" />
                      Try USSD
                    </Link>
                  </Button>
                ) : null}
              </div>
              <p className="sr-only">
                An illustration of the Kupon student wallet shows a live campus wallet float, the
                latest meal coupon and recent wallet activity from the database.
              </p>
            </div>
            <div className="motion-safe:animate-fade-up [animation-delay:120ms]">
              <Image
                src="/marketing/kupon-campus-food-wallet.webp"
                alt="Kupon Campus Food Wallet: campus wallet balance, a pending meal coupon and recent vendor payments"
                width={1300}
                height={1210}
                priority
                sizes="(max-width: 1024px) 100vw, 560px"
                className="h-auto w-full rounded-[1.75rem] border border-slate-200/70 shadow-[0_40px_90px_-45px_rgba(15,23,42,0.55)]"
              />
            </div>
          </div>
        </section>

        <Metrics stats={data.stats} />
        <HowItWorks />
        <Roles data={data} />
        <Security ledger={data.ledger} />
        {USSD_ENABLED ? <UssdBand data={data} shortCode={env.USSD_SHORTCODE} /> : null}
        <FinalCta />
      </main>
      <SiteFooter stats={data.stats} />
    </div>
  );
}

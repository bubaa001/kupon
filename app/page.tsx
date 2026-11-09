import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Check,
  ClipboardCheck,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { MarketingReveal } from '@/components/marketing/marketing-reveal';
import { PaymentStory } from '@/components/marketing/payment-story';
import { getLandingData, type LandingData } from '@/lib/public-data';
import { formatCompactTZS, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Kupon | Clear, trusted cafeteria sales' },
  description:
    'Kupon replaces paper cafeteria records with searchable orders, payment records and meal coupons issued after gateway confirmation. Payments in this test build are simulated.',
};

const PROBLEMS = [
  {
    icon: ClipboardCheck,
    title: 'Records disappear',
    body: 'Paper books fill up, get misplaced, or are difficult to search when a detail needs checking.',
  },
  {
    icon: ShieldCheck,
    title: 'Left money is hard to verify',
    body: 'When a customer leaves change or advance money with the cafeteria, a missing or changed notebook makes the record uncertain.',
  },
  {
    icon: Banknote,
    title: 'Cash gets in the way',
    body: 'Students should not need to find an ATM or carry a large amount of cash just to buy lunch.',
  },
  {
    icon: ListChecks,
    title: 'Sales are hard to understand',
    body: 'Without dependable records, owners cannot easily see what sells, what does not, or explain the numbers.',
  },
];

function SiteHeader() {
  return (
    <header className="landing-nav sticky top-0 z-40 border-b border-slate-200/70 bg-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[76px] lg:px-8">
        <Logo variant="light" />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex"
        >
          <a className="transition-colors hover:text-navy" href="#why-kupon">
            Why Kupon
          </a>
          <a className="transition-colors hover:text-navy" href="#how-it-works">
            How it works
          </a>
          <a className="transition-colors hover:text-navy" href="#for-cafeterias">
            For cafeterias
          </a>
        </nav>
        <Button asChild size="sm" className="h-10 rounded-full px-5 text-sm">
          <Link href="/login">Student sign in</Link>
        </Button>
      </div>
    </header>
  );
}

function Metrics({ stats, liveTotalsAvailable }: LandingData) {
  const values = [
    { label: 'Universities', value: formatNumber(stats.universities) },
    { label: 'Active cafeterias', value: formatNumber(stats.vendors) },
    { label: 'Registered students', value: formatNumber(stats.students) },
    { label: 'Value of meals served', value: formatCompactTZS(stats.mealSales) },
  ];

  return (
    <section
      aria-label="Live Kupon platform totals"
      className="landing-ledger border-y border-slate-200 bg-white"
    >
      <dl className="mx-auto grid w-full max-w-7xl grid-cols-2 sm:grid-cols-4">
        {values.map((stat, index) => (
          <div
            key={stat.label}
            className={`landing-ledger__item px-5 py-6 sm:px-6 lg:px-8 lg:py-8 ${
              index % 2 === 1 ? 'border-l border-slate-200 sm:border-l-0' : ''
            } ${index > 1 ? 'border-t border-slate-200 sm:border-t-0' : ''} ${
              index > 0 ? 'sm:border-l sm:border-slate-200' : ''
            }`}
          >
            <dt className="text-xs font-medium text-slate-500">{stat.label}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.04em] text-navy sm:text-3xl">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="landing-ledger__caption mx-auto max-w-7xl px-5 pb-4 text-[11px] text-slate-400 sm:px-6 lg:px-8">
        {liveTotalsAvailable
          ? 'Live totals from Kupon records. Meal value includes verified orders only.'
          : 'Live totals are unavailable in this Preview because no Preview database is connected.'}
      </p>
    </section>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="landing-hero relative isolate overflow-hidden">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="landing-enter">
          <p className="eyebrow landing-hero__eyebrow flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full bg-primary-500" />
            A clearer way to run campus food
          </p>
          <h1
            id="hero-title"
            className="landing-hero__title mt-6 max-w-3xl text-[2.9rem] font-semibold leading-[0.98] tracking-[-0.065em] text-navy sm:text-6xl lg:text-[4.65rem]"
          >
            Every meal.
            <br />
            <span className="font-normal">
              A record you can trust.
            </span>
          </h1>
          <p className="landing-hero__lede mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Replace handwritten sales books with searchable orders. Kupon is designed for direct
            mobile-money checkout, with coupons issued after gateway confirmation. This test build
            simulates payment events and does not charge a phone.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="landing-hero__primary h-12 w-full rounded-full px-6 sm:w-auto">
              <Link href="/vendor-apply">
                Apply as a cafeteria
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="landing-hero__secondary h-12 w-full rounded-full border-slate-300 bg-white px-6 sm:w-auto"
            >
              <Link href="#account-access">Choose your access</Link>
            </Button>
          </div>
          <p className="landing-hero__note mt-5 text-xs leading-relaxed text-slate-500">
            Test gateway only · simulated payments · no real money is collected.
          </p>
        </div>
        <PaymentStory />
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <MarketingReveal>
      <section
        id="why-kupon"
        aria-labelledby="problem-title"
        className="scroll-mt-24 bg-[#f0f5f2] px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div className="max-w-lg">
            <p className="eyebrow text-primary-800">The problem is the record</p>
            <h2
              id="problem-title"
              className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.05em] text-navy sm:text-5xl"
            >
              A notebook shouldn’t decide what happened.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Cafeteria teams deserve records that are easy to find and fair to everyone. Kupon
              brings daily sales and payment confirmation into one dependable flow—without blaming
              the people behind the counter.
            </p>
          </div>
          <div className="grid gap-x-10 sm:grid-cols-2">
            {PROBLEMS.map((problem) => (
              <article
                key={problem.title}
                className="border-t border-slate-300 py-6 first:pt-6 sm:[&:nth-child(-n+2)]:border-t sm:[&:nth-child(-n+2)]:pt-6"
              >
                <problem.icon
                  aria-hidden
                  className="h-5 w-5 text-primary-800"
                  strokeWidth={1.8}
                />
                <h3 className="mt-4 text-base font-semibold tracking-tight text-navy sm:text-lg">
                  {problem.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{problem.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingReveal>
  );
}

function CafeteriaSection() {
  const outcomes = [
    {
      label: 'For students',
      title: 'Pay for what you choose.',
      body: 'Browse today’s available food, then show the coupon Kupon issues after its test gateway confirms your order.',
    },
    {
      label: 'For cafeteria teams',
      title: 'Serve against a verified order.',
      body: 'Keep availability current and scan a student’s coupon before handing over the meal.',
    },
    {
      label: 'For owners',
      title: 'See the sales, not just the cash.',
      body: 'Review recorded transactions and sales patterns across the cafeterias you manage.',
    },
  ];

  return (
    <MarketingReveal>
      <section
        id="for-cafeterias"
        aria-labelledby="cafeteria-title"
        className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div className="max-w-lg">
            <p className="eyebrow">One dependable flow</p>
            <h2
              id="cafeteria-title"
              className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.05em] text-navy sm:text-5xl"
            >
              Clear for the person buying. Clear for the team serving.
            </h2>
            <Link
              href="/vendor-apply"
              className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary-800"
            >
              Apply as a cafeteria
              <ArrowUpRight
                aria-hidden
                className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {outcomes.map((outcome) => (
              <article
                key={outcome.label}
                className="grid gap-2 py-6 sm:grid-cols-[10rem_1fr] sm:gap-6 sm:py-7"
              >
                <p className="eyebrow pt-1 text-primary-800">{outcome.label}</p>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-navy sm:text-xl">
                    {outcome.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    {outcome.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingReveal>
  );
}

function TrustSection() {
  const checks = [
    'The Kupon test gateway records payment stages automatically.',
    'A meal coupon becomes redeemable only after successful payment.',
    'Staff scan the coupon before handing over the meal.',
    'Students pay at checkout, so no funds need to be held at the cafeteria.',
  ];

  return (
    <MarketingReveal>
      <section
        id="how-it-works"
        aria-labelledby="trust-title"
        className="scroll-mt-24 px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 overflow-hidden rounded-[2rem] bg-navy px-6 py-10 text-white sm:px-10 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-20 lg:px-14 lg:py-14">
          <div>
            <p className="eyebrow text-primary-200">Payment first. Coupon second.</p>
            <h2
              id="trust-title"
              className="mt-4 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-5xl"
            >
              A meal coupon is proof—not a promise.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Kupon waits for the mobile-money payment to be confirmed before it makes an order
              ready to redeem. That gives the student and the cafeteria team the same clear record.
            </p>
          </div>
          <ul className="space-y-5 border-t border-white/15 pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {checks.map((check) => (
              <li key={check} className="flex gap-3 text-sm leading-6 text-slate-200">
                <Check
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary-300"
                  strokeWidth={2}
                />
                {check}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingReveal>
  );
}

function FinalCta() {
  return (
    <MarketingReveal>
      <section
        aria-labelledby="final-cta-title"
        className="px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24"
      >
        <div className="mx-auto w-full max-w-7xl border-t border-slate-200 pt-10 sm:flex sm:items-end sm:justify-between sm:gap-10">
          <div className="max-w-2xl">
            <p className="eyebrow text-primary-800">Make the next meal simpler</p>
            <h2
              id="final-cta-title"
              className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.05em] text-navy sm:text-4xl"
            >
              Give every order a record that lasts.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Bring direct mobile-money checkout and verified meal coupons to your cafeteria.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="mt-6 h-12 w-full rounded-full px-6 sm:mt-0 sm:w-auto"
          >
            <Link href="/vendor-apply">
              Apply as a cafeteria
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingReveal>
  );
}

function AccountAccessSection() {
  const options = [
    {
      href: '/login',
      title: 'Student',
      description: 'Sign in with Google to browse meals, pay, and see your coupons.',
      action: 'Student sign in',
    },
    {
      href: '/vendor-apply',
      title: 'Cafeteria owner',
      description: 'Submit your cafeteria for review. Google sign-in starts after approval.',
      action: 'Apply as a cafeteria',
      signInHref: '/vendor/login',
    },
    {
      href: '/staff/login',
      title: 'Cafeteria staff',
      description: 'Open your invited account to verify coupons and manage today’s menu.',
      action: 'Staff sign in',
    },
  ];

  return (
    <MarketingReveal>
      <section
        id="account-access"
        aria-labelledby="account-access-title"
        className="scroll-mt-24 bg-[#f0f5f2] px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="mx-auto w-full max-w-7xl">
          <p className="eyebrow text-primary-800">Choose your access</p>
          <h2
            id="account-access-title"
            className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.05em] text-navy sm:text-4xl"
          >
            One platform, the right doorway for each role.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {options.map((option) => (
              <article
                key={option.title}
                className="flex min-h-48 flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <h3 className="text-lg font-semibold tracking-tight text-navy">{option.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{option.description}</p>
                <Link
                  href={option.href}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-800 hover:underline"
                >
                  {option.action}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                {'signInHref' in option ? (
                  <Link
                    href={option.signInHref ?? '/vendor/login'}
                    className="mt-2 text-xs font-medium text-slate-500 hover:text-primary-800"
                  >
                    Already approved? Sign in
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingReveal>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Searchable cafeteria orders, direct mobile-money checkout and verified meal coupons.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
          <Link className="transition-colors hover:text-navy" href="#why-kupon">
            Why Kupon
          </Link>
          <Link className="transition-colors hover:text-navy" href="#how-it-works">
            How it works
          </Link>
          <Link className="transition-colors hover:text-navy" href="/login">
            Student sign in
          </Link>
          <Link className="transition-colors hover:text-navy" href="/vendor/login">
            Vendor access
          </Link>
          <Link className="transition-colors hover:text-navy" href="/staff/login">
            Staff access
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default async function HomePage() {
  const landingData = await getLandingData();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Metrics {...landingData} />
        <ProblemSection />
        <CafeteriaSection />
        <TrustSection />
        <FinalCta />
        <AccountAccessSection />
      </main>
      <SiteFooter />
    </div>
  );
}

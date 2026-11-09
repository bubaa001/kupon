import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

function LandingBrand() {
  return (
    <Link href="/" className="landing-brand" aria-label="Kupon home">
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M4 5h20a1 1 0 0 1 1 1v5.2a2.8 2.8 0 0 0 0 5.6V22a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5.2a2.8 2.8 0 0 0 0-5.6V6a1 1 0 0 1 1-1Z" fill="#E3C36F" />
        <path d="M10 9v10M10 14l6-5M10 14l6 5" stroke="#0A1730" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span>Kupon</span>
    </Link>
  );
}

const PROBLEMS = [
  {
    title: 'Records disappear',
    body: 'Paper books fill up, get misplaced, or are difficult to search when a detail needs checking.',
  },
  {
    title: 'Left money is hard to verify',
    body: 'When a customer leaves change or advance money with the cafeteria, a missing or changed notebook makes the record uncertain.',
  },
  {
    title: 'Cash gets in the way',
    body: 'Students should not need to find an ATM or carry a large amount of cash just to buy lunch.',
  },
  {
    title: 'Sales are hard to understand',
    body: 'Without dependable records, owners cannot easily see what sells, what does not, or explain the numbers.',
  },
];

function SiteHeader() {
  return (
    <header className="landing-nav sticky top-0 z-40 border-b border-slate-200/70 bg-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[75rem] items-center justify-between gap-3 px-4 sm:px-6 lg:h-[76px] lg:px-8">
        <LandingBrand />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex"
        >
          <a className="transition-colors hover:text-navy" href="#why-kupon">
            Why Kupon
          </a>
          <a className="transition-colors hover:text-navy" href="#how-it-works">
            How it works
          </a>
          <a className="transition-colors hover:text-navy" href="#account-access">
            Access
          </a>
        </nav>
        <div className="landing-nav__actions">
          <Link className="landing-nav__signin" href="/login">Student sign in</Link>
          <Link className="landing-nav__apply" href="/vendor-apply">Apply as a cafeteria</Link>
        </div>
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
      <dl className="landing-ledger__grid mx-auto w-full max-w-[75rem]">
        {values.map((stat) => (
          <div
            key={stat.label}
            className="landing-ledger__item"
          >
            <dt>{stat.label}</dt>
            <dd>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="landing-ledger__caption mx-auto max-w-[75rem] px-5 pb-4 text-[11px] text-slate-400 sm:px-6 lg:px-8">
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
      <div className="mx-auto grid w-full max-w-[75rem] items-center gap-12 px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="landing-enter">
          <h1
            id="hero-title"
            className="landing-hero__title max-w-3xl text-[clamp(2.7rem,6.6vw,5.4rem)] font-semibold leading-[1.02] tracking-[-0.065em] text-navy"
          >
            Every meal.
            <br />
            <span className="font-normal">A record you can trust.</span>
          </h1>
          <p className="landing-hero__lede mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Replace handwritten sales books with searchable orders. Kupon is designed for direct
            mobile-money checkout, with coupons issued after gateway confirmation.
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
        className="landing-section landing-section--mist scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto grid w-full max-w-[75rem] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div className="landing-problem__head max-w-lg">
            <h2
              id="problem-title"
              className="landing-section-title mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-5xl"
            >
              A notebook shouldn’t decide what happened.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Cafeteria teams deserve records that are easy to find and fair to everyone. Kupon
              brings daily sales and payment confirmation into one dependable flow—without blaming
              the people behind the counter.
            </p>
          </div>
          <div className="landing-problem-list">
            {PROBLEMS.map((problem) => (
              <article
                key={problem.title}
                className="landing-problem-item"
              >
                <h3 className="text-base font-semibold tracking-tight text-navy sm:text-lg">
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

function HowItWorksSection() {
  const steps = [
    { number: '01', title: 'Choose a meal', body: 'Scan the outlet QR and pick from what is available today.' },
    { number: '02', title: 'Pay through Kupon', body: 'Kupon records each payment stage and confirms the order after the gateway responds.' },
    { number: '03', title: 'Collect your meal', body: 'Show the coupon issued after payment confirmation.' },
  ];

  return (
    <MarketingReveal>
      <section id="how-it-works" aria-labelledby="how-title" className="landing-how scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto w-full max-w-[75rem]">
          <h2 id="how-title" className="landing-section-title max-w-2xl">From menu to meal.</h2>
          <div className="landing-steps mt-12">
            {steps.map((step) => (
              <article className="landing-step" key={step.number}>
                <span className="landing-step__number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          <p className="landing-how__tag">Your coupon is ready only when your payment is.</p>
          <p className="landing-how__note">Payment events in this build are simulated.</p>
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
        className="landing-roles landing-section--mist scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto grid w-full max-w-[75rem] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div className="max-w-lg">
            <h2
              id="cafeteria-title"
              className="landing-section-title mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-5xl"
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
          <div className="landing-role-list">
            {outcomes.map((outcome) => (
              <article
                key={outcome.label}
                className="landing-role"
              >
                <p className="eyebrow landing-eyebrow">{outcome.label}</p>
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
        id="payment-proof"
        aria-labelledby="trust-title"
        className="landing-proof scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto grid w-full max-w-[75rem] gap-10 text-white lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-20">
          <div>
            <h2
              id="trust-title"
              className="landing-section-title mt-4 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-5xl"
            >
              A meal coupon is proof, not a promise.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Kupon waits for the mobile-money payment to be confirmed before it makes an order
              ready to redeem. That gives the student and the cafeteria team the same clear record.
            </p>
          </div>
          <ul className="landing-proof__checks">
            {checks.map((check) => (
              <li key={check} className="landing-proof__check flex gap-3 text-sm leading-6 text-slate-200">
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
        className="landing-final px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="mx-auto grid w-full max-w-[75rem] gap-8 sm:grid-cols-[1.2fr_0.8fr] sm:items-end sm:gap-10">
          <div className="max-w-2xl">
            <h2
              id="final-cta-title"
              className="landing-section-title mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-4xl"
            >
              Give every order a record that lasts.
            </h2>
            <p className="landing-final__copy mt-3 text-sm leading-relaxed sm:text-base">
              Bring direct mobile-money checkout and verified meal coupons to your cafeteria.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="landing-final__button mt-2 h-12 w-full rounded-full px-6 sm:mt-0 sm:w-auto"
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
        className="landing-section landing-access landing-section--mist scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="mx-auto w-full max-w-[75rem]">
          <h2
            id="account-access-title"
            className="landing-section-title mt-3 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-4xl"
          >
            One platform, the right doorway for each role.
          </h2>
          <div className="landing-access__grid mt-8 grid gap-3">
            {options.map((option) => (
              <article
                key={option.title}
                className="landing-access__item flex min-h-48 flex-col p-5 sm:p-6"
              >
                <h3 className="text-lg font-semibold tracking-tight text-navy">{option.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{option.description}</p>
                <Link
                  href={option.href}
                  className="landing-access__link mt-5 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                >
                  {option.action}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                {'signInHref' in option ? (
                  <Link
                    href={option.signInHref ?? '/vendor/login'}
                    className="landing-access__secondary mt-2 text-xs font-medium hover:text-primary-800"
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
    <footer className="landing-footer border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <LandingBrand />
          <p className="landing-footer__tag mt-3 max-w-md text-sm leading-relaxed">
            Searchable cafeteria orders, direct mobile-money checkout and verified meal coupons.
          </p>
        </div>
        <div className="landing-footer__nav flex flex-wrap gap-x-6 gap-y-3 text-sm">
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
      <p className="landing-footer__legal mx-auto w-full max-w-[75rem] px-4 pb-6 text-xs sm:px-6 lg:px-8">Test gateway only. Payments are simulated and no real money is collected. <span>© 2026 Kupon</span></p>
    </footer>
  );
}

export default async function HomePage() {
  const landingData = await getLandingData();

  return (
    <div className="flex min-h-dvh flex-col">
      <a className="landing-skip" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <Metrics {...landingData} />
        <ProblemSection />
        <HowItWorksSection />
        <CafeteriaSection />
        <TrustSection />
        <AccountAccessSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

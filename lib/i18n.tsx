'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Buyer-facing language switch: English or simple, everyday Kiswahili.
 * The choice is remembered on this phone. Only buyer screens are translated;
 * cafeteria and Kupon screens stay in English.
 */
export type Lang = 'en' | 'sw';
const STORAGE_KEY = 'kupon:lang';

const en = {
  'nav.home': 'Home',
  'nav.order': 'Scan & order',
  'nav.orderShort': 'Order',
  'nav.history': 'Order history',
  'nav.historyShort': 'History',
  'nav.credit': 'Credit & help',
  'nav.creditShort': 'Credit',
  'nav.profile': 'Profile',
  'role.student': 'Student',
  'role.guest': 'Campus guest',
  'lang.label': 'Language',
  'home.greetMorning': 'Good morning',
  'home.greetAfternoon': 'Good afternoon',
  'home.greetEvening': 'Good evening',
  'home.lead': 'Pick a meal, pay at checkout and show your coupon at the counter once payment is confirmed.',
  'home.heroEyebrow': 'Order · Pay · Collect',
  'home.heroTitle': 'Good food, a clear order.',
  'home.heroBody': 'Scan the cafeteria QR, choose what is available today and pay at checkout. Your coupon appears once the payment is confirmed.',
  'home.scan': 'Scan cafeteria QR',
  'home.history': 'Order history',
  'home.latestCoupon': 'Your latest coupon',
  'home.allCoupons': 'All coupons',
  'home.recent': 'Recent orders and payments',
  'home.recentLead': 'Your latest meal purchases',
  'home.allHistory': 'All history',
  'home.empty': 'Nothing here yet',
  'home.emptyLead': 'Once you pay for an order, the payment and your coupon status show up here.',
  'home.orderMeal': 'Order a meal',
  'stats.today': 'Spent today',
  'stats.week': 'Last 7 days',
  'stats.meals': 'Meals this week',
  'stats.coupons': 'Coupons used',
  'menu.change': 'Change',
  'menu.dishesToday': 'dishes today',
  'menu.all': 'All',
  'menu.review': 'Review order',
  'history.title': 'Orders and payments',
  'history.lead': 'Your meal orders and payment status for the period you choose.',
  'push.title': 'Get order updates on this phone',
  'push.body': 'Know the moment your order is accepted and your coupon is ready, even with Kupon closed.',
  'push.on': 'Turn on updates',
};

type Key = keyof typeof en;

const sw: Record<Key, string> = {
  'nav.home': 'Mwanzo',
  'nav.order': 'Changanua na uagize',
  'nav.orderShort': 'Agiza',
  'nav.history': 'Oda zangu',
  'nav.historyShort': 'Oda',
  'nav.credit': 'Salio na msaada',
  'nav.creditShort': 'Msaada',
  'nav.profile': 'Akaunti',
  'role.student': 'Mwanafunzi',
  'role.guest': 'Mgeni wa chuo',
  'lang.label': 'Lugha',
  'home.greetMorning': 'Habari za asubuhi',
  'home.greetAfternoon': 'Habari za mchana',
  'home.greetEvening': 'Habari za jioni',
  'home.lead': 'Chagua chakula, lipa, kisha onyesha kuponi yako kaunta malipo yakithibitishwa.',
  'home.heroEyebrow': 'Agiza · Lipa · Chukua',
  'home.heroTitle': 'Chakula kizuri, oda rahisi.',
  'home.heroBody': 'Changanua QR ya mkahawa, chagua chakula kilichopo leo na ulipe. Kuponi yako itaonekana malipo yakithibitishwa.',
  'home.scan': 'Changanua QR ya mkahawa',
  'home.history': 'Oda zangu',
  'home.latestCoupon': 'Kuponi yako ya karibuni',
  'home.allCoupons': 'Kuponi zote',
  'home.recent': 'Oda na malipo ya karibuni',
  'home.recentLead': 'Chakula ulichonunua karibuni',
  'home.allHistory': 'Zote',
  'home.empty': 'Bado hakuna kitu',
  'home.emptyLead': 'Ukilipia oda, malipo na kuponi yako vitaonekana hapa.',
  'home.orderMeal': 'Agiza chakula',
  'stats.today': 'Leo',
  'stats.week': 'Siku 7',
  'stats.meals': 'Milo wiki hii',
  'stats.coupons': 'Kuponi zilizotumika',
  'menu.change': 'Badilisha',
  'menu.dishesToday': 'vyakula leo',
  'menu.all': 'Vyote',
  'menu.review': 'Angalia oda',
  'history.title': 'Oda na malipo',
  'history.lead': 'Oda zako za chakula na hali ya malipo.',
  'push.title': 'Pata taarifa za oda kwenye simu',
  'push.body': 'Jua mara moja oda ikikubaliwa na kuponi ikiwa tayari, hata Kupon ikiwa imefungwa.',
  'push.on': 'Washa taarifa',
};

const DICTS: Record<Lang, Record<Key, string>> = { en, sw };

type I18n = { lang: Lang; setLang: (lang: Lang) => void; t: (key: Key) => string };

const I18nContext = createContext<I18n>({
  lang: 'en',
  setLang: () => undefined,
  t: (key) => en[key],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'sw' || saved === 'en') setLangState(saved);
    } catch {
      /* Default to English when storage is unavailable. */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* The choice just won't be remembered. */
    }
  }, []);

  const t = useCallback((key: Key) => DICTS[lang][key] ?? en[key], [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}

/** English / Kiswahili switch. */
export function LanguageToggle() {
  const { lang, setLang, t } = useT();
  return (
    <div>
      <p className="eyebrow mb-1.5">{t('lang.label')}</p>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1" role="group" aria-label={t('lang.label')}>
        {(
          [
            ['en', 'English'],
            ['sw', 'Kiswahili'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            aria-pressed={lang === value}
            className={
              lang === value
                ? 'min-h-10 rounded-lg bg-white text-sm font-semibold text-navy shadow-sm'
                : 'min-h-10 rounded-lg text-sm font-medium text-ink-muted'
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

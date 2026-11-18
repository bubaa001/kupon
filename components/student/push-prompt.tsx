'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { enablePush, pushSupported } from '@/lib/push-client';
import { useT } from '@/lib/i18n';

const DISMISS_KEY = 'kupon:push-prompt-dismissed';

/**
 * Invites a buyer to get order updates on their phone (accepted, coupon ready,
 * verified) even when Kupon is closed. Hidden once answered or dismissed.
 */
export function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useT();

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* Storage can be unavailable; show the prompt. */
    }
    setVisible(pushSupported() && Notification.permission === 'default' && !dismissed);
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* Optional. */
    }
    setVisible(false);
  }

  async function turnOn() {
    setBusy(true);
    try {
      const result = await enablePush();
      if (result === 'granted') toast.success('Order updates are on for this phone');
      setVisible(false);
    } catch {
      toast.error('Could not turn on updates. Try again from your profile later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-50 p-4">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">{t('push.title')}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t('push.body')}
        </p>
        <Button size="sm" className="mt-3" onClick={() => void turnOn()} loading={busy}>
          {t('push.on')}
        </Button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-gold-100"
        aria-label="Not now"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

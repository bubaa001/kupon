'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/client-api';
import { enablePush, pushSupported, refreshPushSubscription, sendTestPush } from '@/lib/push-client';

type State = 'loading' | 'on' | 'off' | 'blocked' | 'iphone-install' | 'unsupported';

function isIphoneBrowser(): boolean {
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return iOS && !standalone;
}

/**
 * Lets anyone turn on alerts that reach their phone even with Kupon closed,
 * and send themselves a test alert to prove it works on this device.
 */
export function NotificationSettings() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState<'enable' | 'test' | null>(null);

  useEffect(() => {
    if (isIphoneBrowser()) return setState('iphone-install');
    if (!pushSupported()) return setState('unsupported');
    setState(
      Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'blocked' : 'off',
    );
  }, []);

  async function turnOn() {
    setBusy('enable');
    try {
      const result = await enablePush();
      setState(result === 'granted' ? 'on' : result === 'denied' ? 'blocked' : 'off');
      if (result === 'granted') toast.success('Alerts are on for this phone');
    } catch {
      toast.error('Could not turn on alerts. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    try {
      await refreshPushSubscription();
      const result = await sendTestPush();
      if (result.sent > 0) {
        toast.success('Test alert sent', {
          description: 'Lock your phone or close Kupon: it should still arrive with sound.',
        });
      } else {
        toast.error('No alert could be sent to this phone', {
          description: 'Turn alerts off and on again, then retry.',
        });
      }
    } catch (cause) {
      toast.error(cause instanceof ApiClientError ? cause.message : 'Could not send a test alert.');
    } finally {
      setBusy(null);
    }
  }

  if (state === 'loading') return null;

  return (
    <div>
      <p className="eyebrow mb-1.5">Notifications</p>
      <div className="rounded-xl bg-navy-50 p-3">
        {state === 'on' ? (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-navy">
              <BellRing className="h-4 w-4 text-primary-600" aria-hidden />
              Alerts are on for this phone
            </p>
            <p className="mt-1 text-xs text-ink-muted">They arrive even when Kupon is closed.</p>
            <Button size="sm" variant="outline" className="mt-2.5 w-full" onClick={() => void test()} loading={busy === 'test'}>
              Send a test alert
            </Button>
          </>
        ) : state === 'off' ? (
          <>
            <p className="text-sm font-semibold text-navy">Get alerts even with Kupon closed</p>
            <Button size="sm" className="mt-2.5 w-full" onClick={() => void turnOn()} loading={busy === 'enable'}>
              Turn on alerts
            </Button>
          </>
        ) : state === 'blocked' ? (
          <p className="flex items-start gap-2 text-xs text-ink-muted">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Alerts are blocked. Open your browser&rsquo;s site settings for Kupon, allow
            notifications, then come back here.
          </p>
        ) : state === 'iphone-install' ? (
          <p className="text-xs text-ink-muted">
            On iPhone, alerts only work from the installed app: tap <b>Share</b> then{' '}
            <b>Add to Home Screen</b>, open Kupon from your home screen, and turn alerts on here.
          </p>
        ) : (
          <p className="text-xs text-ink-muted">This browser cannot receive alerts. Try Chrome.</p>
        )}
      </div>
    </div>
  );
}

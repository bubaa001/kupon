'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SOUND_KEY = 'kupon:order-sound';

function readSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * New-order alerts for the counter, built so staff cannot miss an order on a
 * phone or a PC: a short two-tone chime (Web Audio, no file to download), a
 * flashing tab title while the tab is in the background, and a system
 * notification when the browser allows it. Browsers only allow sound after a
 * tap, so the first tap anywhere on the page unlocks it.
 */
export function useOrderAlerts() {
  const [soundOn, setSoundOn] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const audioRef = useRef<AudioContext | null>(null);
  const titleTimerRef = useRef<number | null>(null);
  const baseTitleRef = useRef<string>('');

  useEffect(() => {
    setSoundOn(readSoundPreference());
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    baseTitleRef.current = document.title;

    const unlock = () => {
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!audioRef.current && Ctx) audioRef.current = new Ctx();
        void audioRef.current?.resume();
      } catch {
        /* Sound is optional. */
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    const stopFlash = () => {
      if (document.visibilityState !== 'visible') return;
      if (titleTimerRef.current) window.clearInterval(titleTimerRef.current);
      titleTimerRef.current = null;
      if (baseTitleRef.current) document.title = baseTitleRef.current;
    };
    document.addEventListener('visibilitychange', stopFlash);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', stopFlash);
      if (titleTimerRef.current) window.clearInterval(titleTimerRef.current);
    };
  }, []);

  const chime = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [880, 1318.5].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      const start = now + index * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }, []);

  /** Call with a short message whenever new orders arrive. */
  const announce = useCallback(
    (title: string, body: string) => {
      if (soundOn) chime();
      try {
        navigator.vibrate?.([30, 40, 30]);
      } catch {
        /* Vibration is optional. */
      }
      if (document.visibilityState === 'hidden') {
        if (!titleTimerRef.current) {
          baseTitleRef.current = baseTitleRef.current || document.title;
          let on = false;
          titleTimerRef.current = window.setInterval(() => {
            on = !on;
            document.title = on ? `● ${title}` : baseTitleRef.current;
          }, 1000);
        }
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const notice = new Notification(title, { body, tag: 'kupon-orders', icon: '/icons/icon-192.png' });
            notice.onclick = () => {
              window.focus();
              notice.close();
            };
          } catch {
            /* Some mobile browsers only notify through a service worker. */
          }
        }
      }
    },
    [chime, soundOn],
  );

  const toggleSound = useCallback(() => {
    setSoundOn((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
      } catch {
        /* Preference is per browser and optional. */
      }
      if (next) chime();
      return next;
    });
  }, [chime]);

  const enableNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      /* Ignore: the page keeps sound and title alerts. */
    }
  }, []);

  return { soundOn, toggleSound, permission, enableNotifications, announce };
}

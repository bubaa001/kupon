'use client';

import { postJson } from '@/lib/client-api';

/** True when this browser can receive push notifications from Kupon. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined' &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

/**
 * Asks permission (must be called from a tap) and registers this browser so
 * order updates arrive even when Kupon is closed. Returns the permission.
 */
export async function enablePush(): Promise<NotificationPermission | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  const registration =
    (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
    }));
  await postJson('/api/push/subscribe', subscription.toJSON());
  return permission;
}

/**
 * Keeps this device subscribed for whoever is signed in. If notifications were
 * already allowed (for example before push existed) but there is no push
 * subscription yet, it creates one silently: no prompt is needed once allowed.
 */
export async function refreshPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
      }));
    await postJson('/api/push/subscribe', subscription.toJSON());
  } catch {
    /* Best effort. */
  }
}

/** Asks the server to send a test notification to this account's devices. */
export async function sendTestPush(): Promise<{ devices: number; sent: number; failed: number; lastError: string | null }> {
  return postJson('/api/push/test', {});
}

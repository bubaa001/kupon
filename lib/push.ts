import webpush from 'web-push';
import { prisma } from '@/lib/db';

/**
 * Server-side web push. Keys come from the environment:
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. Without
 * them push is simply off and every call is a no-op, so the app never fails
 * because a notification could not be sent.
 */
let configured: boolean | null = null;

function ready(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'https://kupon-rust.vercel.app';
  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return configured;
}

export type PushMessage = {
  title: string;
  body: string;
  /** Where tapping the notification opens. */
  url: string;
  /** Same tag replaces the previous notification instead of stacking. */
  tag?: string;
};

/** Sends to every device of these users. Never throws. */
export async function pushToUsers(userIds: string[], message: PushMessage): Promise<void> {
  if (!userIds.length || !ready()) return;
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: Array.from(new Set(userIds)) } },
    });
    const gone: string[] = [];
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(message),
            { TTL: 60 * 60, urgency: 'high' },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // The browser unsubscribed or the subscription expired.
          if (status === 404 || status === 410) gone.push(sub.id);
        }
      }),
    );
    if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  } catch (error) {
    console.warn('[kupon] push failed', error);
  }
}

/** The owner and every active staff and Finance member of a cafeteria. */
export async function cafeteriaTeamIds(vendorId: string, roles: string[] = ['STAFF']): Promise<string[]> {
  const [vendor, team] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { userId: true } }),
    prisma.user.findMany({
      where: { managedVendorId: vendorId, role: { in: roles } },
      select: { id: true },
    }),
  ]);
  return [...(vendor ? [vendor.userId] : []), ...team.map((member) => member.id)];
}

/** The user behind a buyer profile. */
export async function buyerUserId(studentProfileId: string): Promise<string | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: { userId: true },
  });
  return profile?.userId ?? null;
}

/** Waits for the sends, but never longer than this, so a slow push service never slows checkout. */
const SEND_BUDGET_MS = 1500;

function withinBudget(work: Promise<unknown>): Promise<void> {
  return Promise.race([
    work.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, SEND_BUDGET_MS)),
  ]);
}

/** Notify a buyer about their order. Never throws. */
export function notifyBuyer(studentProfileId: string, message: PushMessage): Promise<void> {
  return withinBudget(
    buyerUserId(studentProfileId).then((id) => (id ? pushToUsers([id], message) : undefined)),
  );
}

/** Notify a cafeteria's counter team and owner. Never throws. */
export function notifyCafeteria(vendorId: string, message: PushMessage): Promise<void> {
  return withinBudget(cafeteriaTeamIds(vendorId).then((ids) => pushToUsers(ids, message)));
}

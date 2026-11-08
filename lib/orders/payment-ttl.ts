export const TEST_PAYMENT_TTL_MS = 60_000;
export const TEST_PAYMENT_RECEIVE_DELAY_MS = 1_000;

export function testPaymentSecondsRemaining(createdAt: string, now = Date.now()): number {
  const expiresAt = Date.parse(createdAt) + TEST_PAYMENT_TTL_MS;
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

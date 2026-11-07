import { env } from '@/lib/env';
import type { PaymentProvider } from './types';
import snippeMock from './snippe';

let cached: PaymentProvider | null = null;

/**
 * Selects the legacy mock rail. Real providers are intentionally unsupported
 * while order payments use the Finance-operated internal test API.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  switch (env.PAYMENT_PROVIDER) {
    case 'mock':
      cached = snippeMock;
      return cached;
    case 'selcom':
    case 'azampay':
    case 'ncard':
      // Deliberately fail loudly rather than silently charging with the mock
      // provider in an environment that expects real money to move.
      throw new Error(
        `PAYMENT_PROVIDER=${env.PAYMENT_PROVIDER} is configured but not implemented. ` +
          'Real provider payments are not enabled in this build.',
      );
    default:
      cached = snippeMock;
      return cached;
  }
}

export type { PaymentProvider } from './types';

import { env } from '@/lib/env';

/**
 * Product feature switches.
 *
 * USSD is intentionally disabled for now because Kupon is not supporting
 * offline/feature-phone payments in this phase. The simulator, API and payment
 * implementation remain in the codebase behind this server-side flag so they
 * can be re-enabled when the telco channel is ready.
 */
export const USSD_ENABLED = env.USSD_ENABLED;

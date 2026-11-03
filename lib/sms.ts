/**
 * Mock SMS gateway. Messages are printed to the server log (and therefore the
 * Vercel function log) instead of being delivered.
 *
 * Replace with a real Beem Africa / NextSMS / Africa's Talking client:
 *   await fetch('https://api.beem.africa/v1/send', { ... })
 */
export type SmsResult = {
  id: string;
  to: string;
  message: string;
  provider: 'mock';
  sentAt: string;
};

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const result: SmsResult = {
    id: `SM-${Date.now().toString(36).toUpperCase()}`,
    to,
    message,
    provider: 'mock',
    sentAt: new Date().toISOString(),
  };
  console.info(`[sms:mock] → ${to}: ${message}`);
  return result;
}

export function topUpSms(amount: number, reference: string): string {
  return `KUPON: Umepokea TZS ${amount.toLocaleString('en-US')}. Salio lako limeongezeka. Ref: ${reference}. Karibu tena!`;
}

export function paymentSms(amount: number, vendor: string, balance: number): string {
  return `KUPON: Umelipa TZS ${amount.toLocaleString('en-US')} kwa ${vendor}. Salio jipya: TZS ${balance.toLocaleString('en-US')}. Asante!`;
}

export function refundSms(amount: number, status: string, note?: string): string {
  return `KUPON: Ombi la refund ya TZS ${amount.toLocaleString('en-US')} ni ${status}. ${
    note ? `Maelezo: ${note}. ` : ''
  }`;
}

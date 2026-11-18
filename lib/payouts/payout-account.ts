import { z } from 'zod';

/**
 * Where a cafeteria's withdrawals are sent. Stored as JSON in
 * Vendor.settlementAccount; older free-text values are still shown as-is but
 * cannot receive live Snippe payouts until the owner saves real details.
 */
export const SNIPPE_BANKS = [
  'CRDB',
  'NMB',
  'NBC',
  'ABSA',
  'EQUITY',
  'STANBIC',
  'TCB',
  'EXIM',
  'DTB',
  'AZANIA',
  'KCB',
  'SELCOMPESA',
] as const;

export const payoutAccountSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('mobile'),
    name: z.string().trim().min(2).max(80),
    phone: z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ''))
      .transform((digits) => (digits.startsWith('0') ? `255${digits.slice(1)}` : digits))
      .refine((digits) => /^255[67]\d{8}$/.test(digits), 'Use a Tanzanian mobile money number, e.g. 0712 345 678.'),
  }),
  z.object({
    method: z.literal('bank'),
    name: z.string().trim().min(2).max(80),
    bank: z.enum(SNIPPE_BANKS),
    account: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z]{6,20}$/, 'Enter the account number without spaces.'),
  }),
]);

export type PayoutAccount = z.infer<typeof payoutAccountSchema>;

export function parsePayoutAccount(raw: string | null | undefined): PayoutAccount | null {
  if (!raw || !raw.trim().startsWith('{')) return null;
  try {
    const result = payoutAccountSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function mask(value: string) {
  return value.length <= 4 ? value : `•••• ${value.slice(-4)}`;
}

/** Human label, never the full number: "M-Pesa / mobile •••• 5678 · Juma" or "CRDB •••• 0000 · Mama Asha". */
export function formatPayoutAccount(raw: string | null | undefined): string {
  const account = parsePayoutAccount(raw);
  if (!account) return raw?.trim() || 'No payout details yet';
  return account.method === 'mobile'
    ? `Mobile money ${mask(account.phone)} · ${account.name}`
    : `${account.bank} ${mask(account.account)} · ${account.name}`;
}

/** The recipient fields Snippe's POST /v1/payouts/send expects. */
export function snippeRecipient(account: PayoutAccount): Record<string, unknown> {
  return account.method === 'mobile'
    ? { channel: 'mobile', recipient_phone: account.phone, recipient_name: account.name }
    : {
        channel: 'bank',
        recipient_bank: account.bank,
        recipient_account: account.account,
        recipient_name: account.name,
      };
}

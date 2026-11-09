import { z } from 'zod';
import {
  MAX_TOPUP,
  MAX_WITHDRAWAL,
  MIN_TOPUP,
  MIN_REQUEST_REASON,
  MIN_WITHDRAWAL,
  MOBILE_NETWORKS,
  REFUND_STATUSES,
} from '@/lib/constants';
import { normalizePhone } from '@/lib/utils';

export const phoneSchema = z
  .string()
  .trim()
  .min(9, 'Enter a valid Tanzanian phone number')
  .transform(normalizePhone)
  .refine((value) => /^\+255[67]\d{8}$/.test(value), {
    message: 'Use a valid Tanzanian number, e.g. +255 712 345 678',
  });

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  universityId: z.string().min(1, 'Select your university'),
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  universityId: z.string().min(1),
});

export const vendorLoginSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Enter your vendor code')
    .transform((value) => value.toUpperCase()),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export const vendorPasswordLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1)
    .max(254)
    .transform((value) => (value.includes('@') ? value.toLowerCase() : normalizePhone(value)))
    .refine(
      (value) =>
        value.includes('@')
          ? z.string().email().safeParse(value).success
          : /^\+255[67]\d{8}$/.test(value),
      'Enter a valid email or Tanzanian phone number.',
    ),
  password: z.string().min(8).max(128),
});

export const staffLoginSchema = z.object({
  identifier: z.string().trim().min(1).max(254).optional(),
  phone: phoneSchema.optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((value) => Boolean(value.identifier ?? value.phone), {
  path: ['identifier'],
  message: 'Enter your username or phone number.',
});

export const topUpSchema = z.object({
  amount: z
    .number()
    .int('Amount must be a whole number')
    .min(MIN_TOPUP, `Minimum top up is TZS ${MIN_TOPUP}`)
    .max(MAX_TOPUP, `Maximum top up is TZS ${MAX_TOPUP}`),
  paymentMethod: z.enum(['mobile_money', 'card']).default('mobile_money'),
  network: z
    .enum(MOBILE_NETWORKS.map((network) => network.id) as [string, ...string[]])
    .default('M-PESA'),
  phone: phoneSchema.optional(),
});

export const paymentTokenSchema = z.object({
  // no body required; endpoint derives everything from the session
}).default({});

export const chargeSchema = z.object({
  token: z.string().min(10).max(2048).optional(),
  code: z.string().regex(/^\d{6}$/).optional(),
  amount: z.number().int().positive().max(200_000),
  vendorId: z.string().optional(),
  note: z.string().max(160).optional(),
});

export const validateTokenSchema = z.object({
  token: z.string().min(10).max(2048).optional(),
  code: z.string().regex(/^\d{6}$/).optional(),
});

/**
 * LEGACY: this used to describe the cash-out form that was mislabelled "refund".
 * It is retained for backward compatibility with older clients; new cash-out
 * requests must use `withdrawalRequestSchema` and new order refunds must use
 * `orderRefundRequestSchema` (the amount is derived from the order, never typed
 * by the student).
 */
export const refundRequestSchema = z.object({
  amount: z.number().int().min(1000, 'Minimum refund is TZS 1,000'),
  reason: z.string().trim().min(5, 'Tell us why you need the refund').max(300),
});

/** Cash-out of available wallet balance to mobile money (no order involved). */
export const withdrawalRequestSchema = z.object({
  amount: z
    .number()
    .int('Amount must be a whole number')
    .min(MIN_WITHDRAWAL, `Minimum withdrawal is TZS ${MIN_WITHDRAWAL}`)
    .max(MAX_WITHDRAWAL, `Maximum withdrawal is TZS ${MAX_WITHDRAWAL}`),
  reason: z
    .string()
    .trim()
    .min(MIN_REQUEST_REASON, 'Tell us why you are cashing out')
    .max(300, 'Keep the reason under 300 characters'),
});

/**
 * Refund of one specific paid, vendor-verified order. The amount always comes
 * from the order server-side so a client can never claim more than it paid.
 */
export const orderRefundRequestSchema = z.object({
  orderId: z.string().min(1, 'Choose the order you want refunded'),
  reason: z
    .string()
    .trim()
    .min(MIN_REQUEST_REASON, 'Tell us what went wrong with this order')
    .max(300, 'Keep the reason under 300 characters'),
});

export const refundDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().trim().max(300).optional(),
});

/** Withdrawal review uses the same decision envelope as an order refund. */
export const withdrawalDecisionSchema = refundDecisionSchema;
export const orderRefundDecisionSchema = refundDecisionSchema;

export const menuItemSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.number().int().min(500).max(100_000),
  category: z.string().trim().min(2).max(30).default('Main'),
  description: z.string().trim().max(160).optional().default(''),
  // Real food photography is required; there is no emoji or illustrated fallback.
  imageUrl: z
    .string()
    .trim()
    .min(1, 'Upload a food photo')
    .max(500)
    .transform((value) => value),
}).strict();

export const menuPatchSchema = menuItemSchema.partial().strict();

export const adminAdjustmentSchema = z.object({
  studentProfileId: z.string().min(1),
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().int().min(100).max(500_000),
  reason: z.string().trim().min(5, 'A reason is required for the audit log').max(300),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .regex(/^V-[A-Z]{2,10}-\d{3}$/i, 'Use the format V-CAMPUS-004')
    .transform((value) => value.toUpperCase()),
  pin: z.string().regex(/^\d{4}$/),
  ownerName: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  description: z.string().trim().max(160).optional().default('Campus cafeteria'),
  settlementAccount: z.string().trim().max(120).optional().default('CRDB Bank •••• 0000'),
});

export const vendorStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']),
});

export const vendorMenuScanSchema = z
  .object({
    token: z.string().min(10).max(4096).optional(),
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .refine((value) => Boolean(value.token || value.code), {
    message: 'Scan the vendor QR or enter their vendor code.',
  });

export const placeOrderSchema = z.object({
  vendorId: z.string().min(1),
  useCredit: z.boolean().optional().default(false),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1, 'Choose at least one meal')
    .max(20),
  note: z.string().trim().max(160).optional(),
});

export const verifyCouponSchema = z
  .object({
    token: z.string().min(10).max(4096).optional(),
    code: z.string().regex(/^\d{6}$/).optional(),
    orderId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.token || value.code), {
    message: 'Scan the coupon QR or enter the 6-digit coupon code.',
  });

export const universitySchema = z.object({
  name: z.string().trim().min(4).max(120),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,10}$/, 'Use a short uppercase code like UDSM')
    .transform((value) => value.toUpperCase()),
  paymentRouteCode: z.string().regex(/^\d{6}$/, 'Lipa Namba must be 6 digits'),
  city: z.string().trim().min(2).max(60).default('Dar es Salaam'),
  saasFee: z.number().int().min(0).max(10_000_000).default(250000),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#10B981'),
  adminName: z.string().trim().min(2).max(80),
  adminPhone: phoneSchema,
  adminPassword: z.string().min(8, 'Use at least 8 characters'),
});

export const ussdPaySchema = z.object({
  phone: phoneSchema,
  vendorCode: z.string().trim().min(3).max(30).transform((v) => v.toUpperCase()),
  amount: z.number().int().min(500).max(100_000),
  pin: z.string().regex(/^\d{4}$/),
  universityId: z.string().optional(),
});

export const reviewSchema = z.object({
  status: z.enum(REFUND_STATUSES),
});

export const reportQuerySchema = z.object({
  range: z.enum(['today', '7d', '30d', 'mtd']).default('7d'),
});

export type TopUpInput = z.infer<typeof topUpSchema>;
export type ChargeInput = z.infer<typeof chargeSchema>;

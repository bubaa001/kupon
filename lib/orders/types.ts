/**
 * Client-safe order/coupon DTOs.
 *
 * Kept free of Prisma/server imports so student pages, vendor pages and shared
 * coupon components can all use exactly the same shapes.
 */
export type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'PENDING'
  | 'VERIFIED'
  | 'CANCELLED'
  | 'EXPIRED';

export type OrderItemView = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
  imageUrl: string | null;
};

export type OrderVendorView = {
  id: string;
  name: string;
  code: string;
  description: string;
};

export type OrderStudentView = {
  name: string;
  studentId: string;
  phone: string;
};

export type OrderView = {
  id: string;
  reference: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  couponCode: string;
  /** @deprecated Legacy signed coupon QR. New coupons use KPN:C:<code>. */
  couponToken: string | null;
  note: string | null;
  createdAt: string;
  verifiedAt: string | null;
  expiresAt: string;
  paymentTest: boolean;
  paymentStage: string | null;
  creditApplied: number;
  vendor: OrderVendorView;
  student: OrderStudentView;
  items: OrderItemView[];
};

export type VendorMenuData = {
  vendor: OrderVendorView & {
    universityId: string;
    universityName: string;
  };
  student: {
    name: string;
    studentId: string;
    cafeteriaCreditBalance: number;
  };
  items: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    emoji: string;
    imageUrl: string | null;
    available: boolean;
  }>;
};

export type VendorQrData = {
  payload: string;
  vendor: {
    id: string;
    name: string;
    code: string;
    description: string;
  };
  university: {
    name: string;
    code: string;
  };
  menuHint: string;
};

export type VendorOrdersData = {
  orders: OrderView[];
  counts: {
    pending: number;
    verified: number;
    today: number;
  };
};

export type StudentOrdersData = {
  orders: OrderView[];
  active: OrderView | null;
};

/**
 * Why a student may cancel their own unverified coupon. Kept client-safe so the
 * cancel dialog, the API schema and the audit trail all speak the same language.
 */
export const ORDER_CANCEL_REASONS = [
  'VENDOR_CLOSED',
  'ITEM_UNAVAILABLE',
  'ORDERED_BY_MISTAKE',
  'OTHER',
] as const;

export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number];

export const ORDER_CANCEL_REASON_LABEL: Record<OrderCancelReason, string> = {
  VENDOR_CLOSED: 'Vendor alifunga / Vendor closed',
  ITEM_UNAVAILABLE: 'Chakula hakipo / Item unavailable',
  ORDERED_BY_MISTAKE: 'Niliagiza kimakosa / Ordered by mistake',
  OTHER: 'Sababu nyingine / Other reason',
};

/** Response of `POST /api/student/orders/[id]/cancel`. */
export type CancelOrderResult = {
  order: OrderView;
  balance: number;
  /** `true` only on the request that actually reversed the money. */
  refunded: boolean;
  /** `true` when a replay found the order already cancelled (no money moved). */
  alreadyCancelled: boolean;
  /** Reference of the reversal transaction, when this call created one. */
  reversalReference: string | null;
  message: string;
};


export type PlaceOrderInput = {
  vendorId: string;
  useCredit?: boolean;
  items: Array<{ menuItemId: string; quantity: number }>;
  note?: string;
};

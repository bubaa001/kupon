/**
 * Client-safe order/coupon DTOs.
 *
 * Kept free of Prisma/server imports so student pages, vendor pages and shared
 * coupon components can all use exactly the same shapes.
 */
export type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'AWAITING_ACCEPTANCE'
  | 'AWAITING_PAYMENT'
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
  amountPaid: number;
  apiFee: number;
  kuponFee: number;
  creditApplied: number;
  useCafeteriaCredit: boolean;
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
    awaitingAcceptance: number;
    awaitingPayment: number;
    pending: number;
    verified: number;
    today: number;
  };
};

export type StudentOrdersData = {
  orders: OrderView[];
  active: OrderView | null;
};

export type PlaceOrderInput = {
  vendorId: string;
  useCredit?: boolean;
  items: Array<{ menuItemId: string; quantity: number }>;
  note?: string;
};

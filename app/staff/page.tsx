import type { Metadata } from 'next';
import { VendorQrCard } from '@/components/orders/vendor-qr-card';
import { OrderDeskView } from '@/app/vendor/_components/order-desk-view';

export const metadata: Metadata = {
  title: 'Orders & coupons',
};

export default function StaffOrdersPage() {
  return (
    <div className="space-y-5">
      <VendorQrCard compact />
      <OrderDeskView basePath="/staff" />
    </div>
  );
}

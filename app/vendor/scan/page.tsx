import type { Metadata } from 'next';
import { OrderDeskView } from '../_components/order-desk-view';

export const metadata: Metadata = {
  title: 'Orders & coupons',
};

export default function VendorOrdersPage() {
  return <OrderDeskView />;
}

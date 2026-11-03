import type { Metadata } from 'next';
import { SalesView } from '../_components/sales-view';

export const metadata: Metadata = {
  title: 'Sales',
};

export default function VendorSalesPage() {
  return <SalesView />;
}

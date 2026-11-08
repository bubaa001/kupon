import type { Metadata } from 'next';
import { VendorApplicationsView } from './view';

export const metadata: Metadata = { title: 'Vendor applications' };

export default function VendorApplicationsPage() {
  return <VendorApplicationsView />;
}

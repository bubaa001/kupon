import type { Metadata } from 'next';
import { RevenueView } from '../_components/revenue-view';

export const metadata: Metadata = {
  title: 'Platform revenue',
  description:
    'Fee waterfall, SaaS billing, rail costs and the double-entry ledger check across every Kupon tenant.',
};

export default function SuperAdminRevenuePage() {
  return <RevenueView />;
}

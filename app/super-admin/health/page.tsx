import type { Metadata } from 'next';
import { HealthView } from '../_components/health-view';

export const metadata: Metadata = {
  title: 'System health',
  description:
    'Ledger invariants, payment success rate, incidents and service status for the Kupon platform.',
};

export default function SuperAdminHealthPage() {
  return <HealthView />;
}

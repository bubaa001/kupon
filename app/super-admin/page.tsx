import type { Metadata } from 'next';
import { OverviewView } from './_components/overview-view';

export const metadata: Metadata = {
  title: 'Platform overview',
  description:
    'Live GMV, platform fee revenue, SaaS MRR and tenant health across every Kupon university.',
};

export default function SuperAdminOverviewPage() {
  return <OverviewView />;
}

import type { Metadata } from 'next';
import { TenantsView } from '../_components/tenants-view';

export const metadata: Metadata = {
  title: 'Universities',
  description: 'Onboard, bill and manage every university on the Kupon platform.',
};

export default function SuperAdminTenantsPage() {
  return <TenantsView />;
}

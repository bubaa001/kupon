import type { Metadata } from 'next';
import { CreditRequestsView } from './view';

export const metadata: Metadata = {
  title: 'Cafeteria credit requests',
  description: 'Review cafeteria requests to issue student credit for unfulfilled orders.',
};

export default function CreditRequestsPage() {
  return <CreditRequestsView />;
}

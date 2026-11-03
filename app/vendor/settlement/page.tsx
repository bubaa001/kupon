import type { Metadata } from 'next';
import { SettlementView } from '../_components/settlement-view';

export const metadata: Metadata = {
  title: 'Settlement',
};

export default function VendorSettlementPage() {
  return <SettlementView />;
}

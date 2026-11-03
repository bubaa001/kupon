import type { Metadata } from 'next';
import { VendorHome } from './_components/home-view';

export const metadata: Metadata = {
  title: 'Today',
};

export default function VendorHomePage() {
  return <VendorHome />;
}

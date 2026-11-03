import type { Metadata } from 'next';
import { MenuView } from '../_components/menu-view';

export const metadata: Metadata = {
  title: 'Menu management',
};

export default function VendorMenuPage() {
  return <MenuView />;
}

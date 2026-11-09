import type { Metadata } from 'next';
import { MenuView } from '@/app/vendor/_components/menu-view';

export const metadata: Metadata = {
  title: 'Today’s menu',
};

export default function StaffMenuPage() {
  return <MenuView audience="staff" />;
}

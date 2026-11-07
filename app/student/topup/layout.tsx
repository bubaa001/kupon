import { redirect } from 'next/navigation';

export default function LegacyTopUpLayout({ children }: { children: React.ReactNode }) {
  void children;
  redirect('/student/pay');
}

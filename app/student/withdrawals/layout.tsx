import { redirect } from 'next/navigation';

export default function LegacyWithdrawalsLayout({ children }: { children: React.ReactNode }) {
  void children;
  redirect('/student');
}

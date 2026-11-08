import { redirect } from 'next/navigation';

export default function LegacyUssdPage() {
  redirect('/student/pay');
}

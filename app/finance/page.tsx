import Link from 'next/link';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export default function FinancePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Finance operations"
        title="Finance workspace"
        description="Review payment activity and assigned cafeteria credit cases. Payment confirmation is automatic."
      />

      <Alert variant="warning">
        Kupon&apos;s test gateway simulates payment events for development. It does not collect or
        hold real money, and Finance cannot approve a student&apos;s checkout.
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/finance/test-payments" className="group">
          <Card className="h-full p-5 transition-colors hover:border-primary-300">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Payment activity · view only</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Inspect the initiated, received and confirmed events recorded automatically by
                  Kupon&apos;s test gateway.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>

        <Link href="/finance/requests" className="group">
          <Card className="h-full p-5 transition-colors hover:border-primary-300">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Assigned credit & support cases</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Review payment activity and escalated support tickets. Platform admins approve
                  cafeteria credit requests.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        Finance is a separate least-privilege role; it does not grant admin access to vendors,
        menus, or platform settings.
      </Alert>
    </div>
  );
}

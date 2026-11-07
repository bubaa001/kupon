import Link from 'next/link';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

export default function FinancePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform-wide operations"
        title="Finance workspace"
        description="Review cafeteria credit requests and escalations, and advance internal test-payment events."
      />

      <Alert variant="warning">
        Kupon is currently using an internal test API. Test confirmations do not collect mobile
        money or represent cash received.
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/finance/test-payments" className="group">
          <Card className="h-full p-5 transition-colors hover:border-primary-300">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Test payment lifecycle</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Record initiated, received, confirmed, failed, and expired events through
                  Kupon&apos;s API.
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
                <p className="text-sm font-semibold text-slate-900">Credit & support cases</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Review finance-approved cafeteria credits and escalated support tickets.
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

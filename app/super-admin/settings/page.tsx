'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError, patchJson } from '@/lib/client-api';
import { formatTZS } from '@/lib/utils';
import { FormField } from '../_components/form-field';
import { useApiData } from '../_components/use-api-data';

type FeeSettings = { kuponFeePercent: number; withdrawalFee: number; minWithdrawal: number };
type SettingsData = {
  settings: FeeSettings;
  defaults: FeeSettings;
  limits: Record<keyof FeeSettings, { min: number; max: number }>;
  fixed: { snippeCollectionPercent: number; snippePayoutFee: number };
  kuponPayoutShare: number;
};

const SAMPLE_MEAL = 3_000;

export default function PlatformSettingsPage() {
  const { data, error, loading, reload } = useApiData<SettingsData>('/api/super-admin/settings');
  const [form, setForm] = useState({ kuponFeePercent: '', withdrawalFee: '', minWithdrawal: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      kuponFeePercent: String(data.settings.kuponFeePercent),
      withdrawalFee: String(data.settings.withdrawalFee),
      minWithdrawal: String(data.settings.minWithdrawal),
    });
  }, [data]);

  const parsed = useMemo(
    () => ({
      kuponFeePercent: Number(form.kuponFeePercent),
      withdrawalFee: Number(form.withdrawalFee),
      minWithdrawal: Number(form.minWithdrawal),
    }),
    [form],
  );

  const preview = useMemo(() => {
    if (!data) return null;
    const snippe = Math.round((SAMPLE_MEAL * data.fixed.snippeCollectionPercent) / 100);
    const kupon = Math.round((SAMPLE_MEAL * (parsed.kuponFeePercent || 0)) / 100);
    return {
      studentPays: SAMPLE_MEAL + snippe,
      snippe,
      kupon,
      cafeteria: SAMPLE_MEAL - kupon,
      kuponPerWithdrawal: Math.max(0, (parsed.withdrawalFee || 0) - data.fixed.snippePayoutFee),
    };
  }, [data, parsed]);

  const dirty =
    data !== null &&
    (parsed.kuponFeePercent !== data.settings.kuponFeePercent ||
      parsed.withdrawalFee !== data.settings.withdrawalFee ||
      parsed.minWithdrawal !== data.settings.minWithdrawal);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      await patchJson('/api/super-admin/settings', parsed);
      toast.success('Fees saved', { description: 'New orders and withdrawals use these values.' });
      await reload();
    } catch (cause) {
      setFormError(cause instanceof ApiClientError ? cause.message : 'Could not save the fees.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform"
        title="Fees and limits"
        description="What Kupon earns and what cafeterias pay to withdraw. Changes apply to new orders and withdrawals; orders already paid keep the fee they were charged."
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading || !data || !preview ? (
        <Card className="space-y-4 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Card className="space-y-5 p-5">
            <FormField
              id="kupon-fee"
              label="Kupon fee per order (%)"
              hint={`Taken from the cafeteria's share of the food price. Allowed ${data.limits.kuponFeePercent.min}–${data.limits.kuponFeePercent.max}%.`}
            >
              <Input
                id="kupon-fee"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={data.limits.kuponFeePercent.min}
                max={data.limits.kuponFeePercent.max}
                value={form.kuponFeePercent}
                onChange={(event) => setForm((f) => ({ ...f, kuponFeePercent: event.target.value }))}
              />
            </FormField>
            <FormField
              id="withdrawal-fee"
              label="Withdrawal charge (TZS)"
              hint={`Charged to the cafeteria per withdrawal. Snippe keeps ${formatTZS(data.fixed.snippePayoutFee)}; Kupon keeps the rest.`}
            >
              <Input
                id="withdrawal-fee"
                type="number"
                inputMode="numeric"
                step="100"
                min={data.limits.withdrawalFee.min}
                value={form.withdrawalFee}
                onChange={(event) => setForm((f) => ({ ...f, withdrawalFee: event.target.value }))}
              />
            </FormField>
            <FormField
              id="min-withdrawal"
              label="Minimum withdrawal (TZS)"
              hint="The smallest amount a cafeteria can take out at once."
            >
              <Input
                id="min-withdrawal"
                type="number"
                inputMode="numeric"
                step="5000"
                min={data.limits.minWithdrawal.min}
                value={form.minWithdrawal}
                onChange={(event) => setForm((f) => ({ ...f, minWithdrawal: event.target.value }))}
              />
            </FormField>

            {formError ? <Alert variant="danger">{formError}</Alert> : null}

            <Button onClick={() => void save()} loading={saving} disabled={!dirty || saving}>
              <Save aria-hidden />
              Save fees
            </Button>
          </Card>

          <Card className="space-y-3 p-5 text-sm">
            <p className="eyebrow">Example: a {formatTZS(SAMPLE_MEAL)} meal</p>
            <dl className="space-y-2">
              <Row label="Student pays" value={formatTZS(preview.studentPays)} strong />
              <Row label={`Snippe (${data.fixed.snippeCollectionPercent}%, fixed)`} value={formatTZS(preview.snippe)} />
              <Row label="Kupon earns" value={formatTZS(preview.kupon)} strong />
              <Row label="Cafeteria receives" value={formatTZS(preview.cafeteria)} />
            </dl>
            <div className="border-t border-navy/10 pt-3">
              <Row
                label="Kupon earns per withdrawal"
                value={formatTZS(preview.kuponPerWithdrawal)}
                strong
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={strong ? 'font-semibold tabular text-navy' : 'tabular text-navy/80'}>{value}</dd>
    </div>
  );
}

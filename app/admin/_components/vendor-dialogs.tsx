'use client';

import { useEffect, useState } from 'react';
import { Loader2, Store, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, postJson } from '@/lib/client-api';
import { formatTZS, isValidTzPhone } from '@/lib/utils';
import type { TxListData, VendorRow } from './types';
import { useApiData } from './hooks';
import { DataTableSkeleton, MiniStat } from './ui-bits';
import { TransactionTable } from './transaction-table';

type VendorForm = {
  name: string;
  code: string;
  pin: string;
  ownerName: string;
  phone: string;
  description: string;
  settlementAccount: string;
};

const EMPTY_FORM: VendorForm = {
  name: '',
  code: '',
  pin: '',
  ownerName: '',
  phone: '',
  description: '',
  settlementAccount: '',
};

export function AddVendorDialog({
  open,
  onOpenChange,
  universityCode,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universityCode: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const prefix = `V-${universityCode}-`;

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, code: prefix });
      setError(null);
      setFieldErrors({});
      setSubmitting(false);
    }
  }, [open, prefix]);

  function update<K extends keyof VendorForm>(key: K, value: VendorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Give the cafeteria a name.';
    if (!new RegExp(`^V-${universityCode}-\\d{3}$`).test(form.code.toUpperCase())) {
      next.code = `Use the format ${prefix}001.`;
    }
    if (!/^\d{4}$/.test(form.pin)) next.pin = 'The POS PIN must be 4 digits.';
    if (form.ownerName.trim().length < 2) next.ownerName = 'Add the owner’s full name.';
    if (!isValidTzPhone(form.phone)) next.phone = 'Use a valid number like 0712 345 678.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await postJson<{ vendor: VendorRow; message: string }>('/api/admin/vendors', {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        pin: form.pin,
        ownerName: form.ownerName.trim(),
        phone: form.phone.trim(),
        description: form.description.trim() || undefined,
        settlementAccount: form.settlementAccount.trim() || undefined,
      });
      toast.success(data.message);
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      const message =
        caught instanceof ApiClientError ? caught.message : 'Could not create the vendor.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <UserPlus className="h-5 w-5" />
          </span>
          <DialogTitle>Add a cafeteria vendor</DialogTitle>
          <DialogDescription>
            Creates a vendor POS account in {universityCode}. The owner signs in with their own
            phone and password, then uses the vendor code + PIN at the till.
          </DialogDescription>
        </DialogHeader>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cafeteria name" error={fieldErrors.name}>
            <Input
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Mama Asha Café"
              error={Boolean(fieldErrors.name)}
            />
          </Field>
          <Field label="Vendor code" error={fieldErrors.code}>
            <Input
              value={form.code}
              onChange={(event) => update('code', event.target.value.toUpperCase())}
              placeholder={`${prefix}004`}
              className="font-mono"
              error={Boolean(fieldErrors.code)}
            />
          </Field>
          <Field label="POS PIN (4 digits)" error={fieldErrors.pin}>
            <Input
              value={form.pin}
              onChange={(event) => update('pin', event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              inputMode="numeric"
              type="password"
              error={Boolean(fieldErrors.pin)}
            />
          </Field>
          <Field label="Owner name" error={fieldErrors.ownerName}>
            <Input
              value={form.ownerName}
              onChange={(event) => update('ownerName', event.target.value)}
              placeholder="Asha Mtenga"
              error={Boolean(fieldErrors.ownerName)}
            />
          </Field>
          <Field
            label="Owner phone"
            error={fieldErrors.phone}
            hint="Used for the vendor account login."
          >
            <Input
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              placeholder="0712 345 678"
              inputMode="tel"
              error={Boolean(fieldErrors.phone)}
            />
          </Field>
          <Field label="Settlement account" hint="Optional — bank or mobile wallet.">
            <Input
              value={form.settlementAccount}
              onChange={(event) => update('settlementAccount', event.target.value)}
              placeholder="CRDB Bank •••• 0000"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="Home-style meals beside the main library"
                className="min-h-[72px]"
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" loading={submitting} onClick={() => void submit()}>
            {submitting ? 'Creating…' : 'Create vendor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function VendorSalesDialog({
  vendor,
  open,
  onOpenChange,
}: {
  vendor: VendorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const url =
    open && vendor
      ? `/api/admin/transactions?q=${encodeURIComponent(vendor.code)}&range=7d&pageSize=10`
      : null;
  const { data, error, loading } = useApiData<TxListData>(url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Store className="h-5 w-5" />
          </span>
          <DialogTitle>{vendor ? vendor.name : 'Vendor sales'}</DialogTitle>
          <DialogDescription>
            {vendor ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px]">{vendor.code}</span>
                <Badge variant={vendor.status === 'ACTIVE' ? 'success' : 'danger'} dot>
                  {vendor.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                </Badge>
                <span>Last 7 days of settled and attempted payments.</span>
              </span>
            ) : (
              'Select a vendor to inspect their sales.'
            )}
          </DialogDescription>
        </DialogHeader>

        {vendor ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Sales today" value={formatTZS(vendor.salesToday)} tone="emerald" />
            <MiniStat label="Transactions today" value={String(vendor.transactionsToday)} />
            <MiniStat label="Pending settlement" value={formatTZS(vendor.pendingBalance)} />
            <MiniStat label="Lifetime settled" value={formatTZS(vendor.totalSettled)} />
          </div>
        ) : null}

        {error ? (
          <Alert variant="danger">{error}</Alert>
        ) : loading ? (
          <div className="py-2">
            <DataTableSkeleton rows={5} columns={5} />
          </div>
        ) : data && data.rows.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-600">
              <span>
                Gross <strong className="tabular text-slate-900">{formatTZS(data.summary.gross)}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Fees <strong className="tabular text-slate-900">{formatTZS(data.summary.fees)}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Payout <strong className="tabular text-slate-900">{formatTZS(data.summary.net)}</strong>
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-slate-400">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {data.total} matching records
              </span>
            </div>
            <div className="-mx-1 overflow-x-auto rounded-xl border border-slate-200">
              <TransactionTable rows={data.rows} dense />
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Store}
            title="No payments in the last 7 days"
            description="Once this vendor starts charging students by QR or code, their sales will appear here."
            compact
          />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

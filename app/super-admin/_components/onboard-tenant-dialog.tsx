'use client';

import { useEffect, useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiClientError, postJson } from '@/lib/client-api';
import { cn, formatDate, formatTZS } from '@/lib/utils';
import type { TenantMutationResult } from './types';
import { FormField } from './form-field';
import { zodFieldErrors, zodFormError } from './form-errors';

type FormState = {
  name: string;
  code: string;
  paymentRouteCode: string;
  city: string;
  saasFee: string;
  adminName: string;
  adminPhone: string;
  adminPassword: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  code: '',
  paymentRouteCode: '',
  city: 'Dar es Salaam',
  saasFee: '250000',
  adminName: '',
  adminPhone: '',
  adminPassword: '',
};

const FEE_PRESETS = [250_000, 350_000, 500_000];

export function OnboardTenantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setFormError(null);
      setSubmitting(false);
    }
  }, [open]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  const fee = Number(form.saasFee.replace(/[^\d]/g, '')) || 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setErrors({});

    try {
      const result = await postJson<TenantMutationResult>('/api/super-admin/tenants', {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        paymentRouteCode: form.paymentRouteCode.trim(),
        city: form.city.trim(),
        saasFee: fee,
        adminName: form.adminName.trim(),
        adminPhone: form.adminPhone.trim(),
        adminPassword: form.adminPassword,
      });

      toast.success(`${result.university.name} is live on Kupon`, {
        description: `First SaaS invoice ${result.invoice?.reference ?? ''} issued · admin login ${
          result.admin?.phone ?? form.adminPhone.trim()
        }`,
      });
      onCreated();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrors(zodFieldErrors(error.details));
        setFormError(zodFormError(error.details) ?? error.message);
        toast.error(error.message);
      } else {
        setFormError('Could not onboard the university. Please try again.');
        toast.error('Could not onboard the university.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Onboard a university</DialogTitle>
          <DialogDescription>
            Creates the tenant, its first university admin, the first SaaS invoice and an audit
            entry — all in one transaction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? (
            <Alert variant="danger" title="Could not create this tenant">
              {formError}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="tenant-name"
              label="University name"
              error={errors.name}
              className="sm:col-span-2"
            >
              <Input
                id="tenant-name"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="e.g. Ardhi University"
                error={Boolean(errors.name)}
                autoComplete="organization"
                required
              />
            </FormField>

            <FormField
              id="tenant-code"
              label="University code"
              error={errors.code}
              hint="2–10 uppercase letters, used across the product."
            >
              <Input
                id="tenant-code"
                value={form.code}
                onChange={(event) => update('code', event.target.value.toUpperCase())}
                placeholder="UDSM"
                maxLength={10}
                className="uppercase"
                error={Boolean(errors.code)}
                required
              />
            </FormField>

            <FormField
              id="tenant-route"
              label="Lipa Namba route code"
              error={errors.paymentRouteCode}
              hint="Exactly 6 digits. Must be unique across the platform."
            >
              <Input
                id="tenant-route"
                value={form.paymentRouteCode}
                onChange={(event) =>
                  update('paymentRouteCode', event.target.value.replace(/[^\d]/g, ''))
                }
                placeholder="555333"
                inputMode="numeric"
                maxLength={6}
                className="tabular tracking-[0.14em]"
                error={Boolean(errors.paymentRouteCode)}
                required
              />
            </FormField>

            <FormField id="tenant-city" label="City" error={errors.city}>
              <Input
                id="tenant-city"
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                placeholder="Dar es Salaam"
                error={Boolean(errors.city)}
                required
              />
            </FormField>

            <FormField
              id="tenant-fee"
              label="SaaS fee (TZS / month)"
              error={errors.saasFee}
              hint={`Invoiced from ${formatDate(new Date(), 'MMMM yyyy')}.`}
            >
              <Input
                id="tenant-fee"
                value={form.saasFee}
                onChange={(event) => update('saasFee', event.target.value.replace(/[^\d]/g, ''))}
                placeholder="250000"
                inputMode="numeric"
                className="tabular"
                error={Boolean(errors.saasFee)}
                required
              />
            </FormField>

            <div className="sm:col-span-2 -mt-1 flex flex-wrap items-center gap-2">
              {FEE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => update('saasFee', String(preset))}
                  className={cn(
                    'inline-flex min-h-[30px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                    fee === preset
                      ? 'border-primary-200 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700',
                  )}
                >
                  {fee === preset ? <Check className="h-3 w-3" /> : null}
                  {formatTZS(preset)}
                </button>
              ))}
              <span className="text-[11px] text-slate-400">per month</span>
            </div>

            <div className="sm:col-span-2 mt-1 flex items-center gap-2 border-t border-slate-100 pt-4">
              <ShieldCheck className="h-4 w-4 text-primary-600" />
              <p className="text-xs font-semibold text-slate-700">University admin account</p>
            </div>

            <FormField
              id="tenant-admin-name"
              label="Admin full name"
              error={errors.adminName}
            >
              <Input
                id="tenant-admin-name"
                value={form.adminName}
                onChange={(event) => update('adminName', event.target.value)}
                placeholder="Dr. Neema Mushi"
                error={Boolean(errors.adminName)}
                autoComplete="name"
                required
              />
            </FormField>

            <FormField
              id="tenant-admin-phone"
              label="Admin phone"
              error={errors.adminPhone}
              hint="Used to sign in to the university dashboard."
            >
              <Input
                id="tenant-admin-phone"
                value={form.adminPhone}
                onChange={(event) => update('adminPhone', event.target.value)}
                placeholder="+255 7XX XXX XXX"
                inputMode="tel"
                error={Boolean(errors.adminPhone)}
                autoComplete="tel"
                required
              />
            </FormField>

            <FormField
              id="tenant-admin-password"
              label="Temporary password"
              error={errors.adminPassword}
              hint="At least 8 characters. Hand this to the university admin once."
              className="sm:col-span-2"
            >
              <Input
                id="tenant-admin-password"
                type="password"
                value={form.adminPassword}
                onChange={(event) => update('adminPassword', event.target.value)}
                placeholder="••••••••"
                error={Boolean(errors.adminPassword)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </FormField>
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
            <Button type="submit" loading={submitting}>
              Create university
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

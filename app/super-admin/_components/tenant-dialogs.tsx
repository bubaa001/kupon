'use client';

import { useEffect, useState } from 'react';
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
import { ApiClientError, patchJson } from '@/lib/client-api';
import { formatTZS } from '@/lib/utils';
import type { TenantMutationResult, TenantSummary } from './types';
import { FormField } from './form-field';
import { zodFieldErrors, zodFormError } from './form-errors';

export function EditTenantDialog({
  tenant,
  open,
  onOpenChange,
  onUpdated,
}: {
  tenant: TenantSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [routeCode, setRouteCode] = useState('');
  const [saasFee, setSaasFee] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tenant) {
      setRouteCode(tenant.routeCode);
      setSaasFee(String(tenant.saasFee));
    }
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  }, [tenant, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant) return;

    const fee = Number(saasFee.replace(/[^\d]/g, '')) || 0;
    const body: { paymentRouteCode?: string; saasFee?: number } = {};
    if (routeCode !== tenant.routeCode) body.paymentRouteCode = routeCode;
    if (fee !== tenant.saasFee) body.saasFee = fee;

    if (Object.keys(body).length === 0) {
      toast.info('Nothing to update', {
        description: 'Change the Lipa Namba code or the SaaS fee first.',
      });
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      await patchJson<TenantMutationResult>(
        `/api/super-admin/tenants/${encodeURIComponent(tenant.id)}`,
        body,
      );
      toast.success(`${tenant.name} updated`, {
        description: 'The change is recorded in the platform audit log.',
      });
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrors(zodFieldErrors(error.details));
        setFormError(zodFormError(error.details) ?? error.message);
        toast.error(error.message);
      } else {
        setFormError('Could not update this tenant. Please try again.');
        toast.error('Could not update this tenant.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {tenant?.name ?? 'tenant'}</DialogTitle>
          <DialogDescription>
            Reassign the Lipa Namba route code or change the monthly SaaS subscription. Route code
            changes are audit-logged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? (
            <Alert variant="danger" title="Could not save changes">
              {formError}
            </Alert>
          ) : null}

          <FormField
            id="edit-route-code"
            label="Lipa Namba route code"
            error={errors.paymentRouteCode}
            hint={`Currently ${tenant?.routeCode ?? '—'}. Must stay unique across all universities.`}
          >
            <Input
              id="edit-route-code"
              value={routeCode}
              onChange={(event) => setRouteCode(event.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              maxLength={6}
              className="tabular tracking-[0.14em]"
              error={Boolean(errors.paymentRouteCode)}
              required
            />
          </FormField>

          <FormField
            id="edit-saas-fee"
            label="SaaS fee (TZS / month)"
            error={errors.saasFee}
            hint={`Currently ${formatTZS(tenant?.saasFee ?? 0)} per month.`}
          >
            <Input
              id="edit-saas-fee"
              value={saasFee}
              onChange={(event) => setSaasFee(event.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              className="tabular"
              error={Boolean(errors.saasFee)}
              required
            />
          </FormField>

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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TenantStatusDialog({
  tenant,
  targetStatus,
  open,
  onOpenChange,
  onUpdated,
}: {
  tenant: TenantSummary | null;
  targetStatus: 'ACTIVE' | 'SUSPENDED';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(null);
    setSubmitting(false);
  }, [open, targetStatus]);

  const suspending = targetStatus === 'SUSPENDED';

  async function apply() {
    if (!tenant) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await patchJson<TenantMutationResult>(
        `/api/super-admin/tenants/${encodeURIComponent(tenant.id)}`,
        { status: targetStatus },
      );
      toast.success(`${tenant.name} ${suspending ? 'suspended' : 'reactivated'}`, {
        description: suspending
          ? 'Removed from active SaaS MRR. Campus data is retained, and the change is audited.'
          : 'Included in active SaaS MRR again. The change is audited.',
      });
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : 'Could not update the tenant status.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {suspending ? 'Suspend' : 'Reactivate'} {tenant?.name ?? 'tenant'}?
          </DialogTitle>
          <DialogDescription>
            {suspending
              ? 'Suspending flags the tenant across the platform console and excludes it from active SaaS MRR. Existing campus data is retained and can be reactivated at any time.'
              : 'Reactivating restores the tenant to active SaaS MRR and removes the suspended flag from the console.'}
          </DialogDescription>
        </DialogHeader>

        {formError ? (
          <Alert variant="danger" title="Status change failed">
            {formError}
          </Alert>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Current status</span>
            <span className="font-semibold text-slate-900">{tenant?.status ?? '—'}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-slate-500">New status</span>
            <span className="font-semibold text-slate-900">{targetStatus}</span>
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
          <Button
            type="button"
            variant={suspending ? 'destructive' : 'default'}
            onClick={() => void apply()}
            loading={submitting}
          >
            {suspending ? 'Suspend tenant' : 'Reactivate tenant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

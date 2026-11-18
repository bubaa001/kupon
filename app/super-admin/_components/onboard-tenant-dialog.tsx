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
import { ApiClientError, postJson } from '@/lib/client-api';
import type { TenantMutationResult } from './types';
import { FormField } from './form-field';
import { zodFieldErrors, zodFormError } from './form-errors';

type FormState = {
  name: string;
  code: string;
  city: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  code: '',
  city: 'Dar es Salaam',
};

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setErrors({});

    try {
      const result = await postJson<TenantMutationResult>('/api/super-admin/tenants', {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        city: form.city.trim(),
      });

      toast.success(`${result.university.name} added`, {
        description: 'Cafeterias at this campus can now be approved and assigned to it.',
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
            Adds a campus where cafeterias can operate. Universities get no account or fee:
            Kupon works with the cafeterias directly.
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
                placeholder="CAMPUS"
                maxLength={10}
                className="uppercase"
                error={Boolean(errors.code)}
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

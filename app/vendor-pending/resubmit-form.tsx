'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, patchJson } from '@/lib/client-api';

type Props = {
  businessName: string;
  description: string;
  businessRegistrationNumber: string;
  physicalAddress: string;
  registrationDocumentUrl: string;
};

export function ResubmitForm(initial: Props) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: keyof Props, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await patchJson('/api/vendor/application', values);
      toast.success('Your updated documents have been resubmitted.');
      window.location.reload();
    } catch (reason) {
      setError(
        reason instanceof ApiClientError ? reason.message : 'Could not resubmit your application.',
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 p-4">
      {error ? <Alert variant="danger" title="Resubmission failed">{error}</Alert> : null}
      <div className="space-y-1.5">
        <Label htmlFor="resubmit-business-name">Business name</Label>
        <Input
          id="resubmit-business-name"
          value={values.businessName}
          onChange={(event) => update('businessName', event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="resubmit-description">What do you sell?</Label>
        <Textarea
          id="resubmit-description"
          value={values.description}
          onChange={(event) => update('description', event.target.value)}
          minLength={10}
          maxLength={500}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="resubmit-registration">Business registration number</Label>
        <Input
          id="resubmit-registration"
          value={values.businessRegistrationNumber}
          onChange={(event) => update('businessRegistrationNumber', event.target.value)}
          minLength={3}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="resubmit-address">Cafeteria location</Label>
        <Textarea
          id="resubmit-address"
          value={values.physicalAddress}
          onChange={(event) => update('physicalAddress', event.target.value)}
          minLength={8}
          maxLength={250}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="resubmit-document">Registration document link</Label>
        <Input
          id="resubmit-document"
          type="url"
          value={values.registrationDocumentUrl}
          onChange={(event) => update('registrationDocumentUrl', event.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" loading={saving} disabled={saving}>
        Resubmit for review
      </Button>
    </form>
  );
}

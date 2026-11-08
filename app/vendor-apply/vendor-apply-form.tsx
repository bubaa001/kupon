'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { isValidTzPhone, normalizePhone } from '@/lib/utils';

type ApplicationForm = {
  ownerName: string;
  nidaNumber: string;
  email: string;
  phone: string;
  businessName: string;
  universityName: string;
  institutionPhone: string;
};

type FieldErrors = Partial<Record<keyof ApplicationForm | 'tinDocument' | 'confirm', string>>;

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const isValidInstitutionPhone = (value: string) => /^\+255\d{9}$/.test(normalizePhone(value));

export function VendorApplyForm() {
  const [values, setValues] = useState<ApplicationForm>({
    ownerName: '',
    nidaNumber: '',
    email: '',
    phone: '',
    businessName: '',
    universityName: '',
    institutionPhone: '',
  });
  const [tinDocument, setTinDocument] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof ApplicationForm, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validate() {
    const next: FieldErrors = {};
    if (values.ownerName.trim().length < 2) next.ownerName = 'Enter your name.';
    if (!/^\d{20}$/.test(values.nidaNumber.trim())) {
      next.nidaNumber = 'Enter the 20-digit NIDA number.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = 'Enter the Google email you will use after approval.';
    }
    if (!isValidTzPhone(values.phone)) next.phone = 'Use a valid Tanzanian number.';
    if (values.businessName.trim().length < 2) next.businessName = 'Enter your business name.';
    if (values.universityName.trim().length < 2) {
      next.universityName = 'Enter the university or campus where you operate.';
    }
    if (!isValidInstitutionPhone(values.institutionPhone)) {
      next.institutionPhone = 'Use a reliable Tanzanian institution phone number.';
    }
    if (!tinDocument) next.tinDocument = 'Upload the TIN/TRA document for review.';
    else if (!ACCEPTED_DOCUMENT_TYPES.includes(tinDocument.type)) {
      next.tinDocument = 'Choose a PDF, JPG or PNG document.';
    } else if (tinDocument.size > MAX_DOCUMENT_BYTES || tinDocument.size === 0) {
      next.tinDocument = 'Keep the document under 5 MB.';
    }
    if (!confirm) next.confirm = 'Confirm that you are authorised to apply for this business.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!validate() || !tinDocument) return;

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set('ownerName', values.ownerName.trim());
      body.set('nidaNumber', values.nidaNumber.trim());
      body.set('email', values.email.trim().toLowerCase());
      body.set('phone', normalizePhone(values.phone));
      body.set('businessName', values.businessName.trim());
      body.set('universityName', values.universityName.trim());
      body.set('institutionPhone', normalizePhone(values.institutionPhone));
      body.set('tinDocument', tinDocument);
      body.set('confirm', 'true');
      await apiFetch('/api/vendor/applications', {
        method: 'POST',
        body,
      });
      setSubmitted(true);
    } catch (error) {
      setFormError(
        error instanceof ApiClientError
          ? error.message
          : 'Could not submit your vendor application. Check the details and try again.',
      );
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5 rounded-3xl border border-primary-100 bg-white p-6 shadow-card sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-navy">Application received</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The platform administrator will review your business details and verify the cafeteria
            location. After approval, return here and continue with Google using{' '}
            <strong>{values.email.trim().toLowerCase()}</strong>.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/vendor/login">Go to vendor sign in</Link>
        </Button>
      </div>
    );
  }

  function field(key: keyof ApplicationForm, label: string, placeholder: string, type = 'text') {
    const id = `vendor-application-${key}`;
    const error = errors[key];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type={type}
          inputMode={key === 'nidaNumber' ? 'numeric' : undefined}
          value={values[key]}
          onChange={(event) => update(key, event.target.value)}
          placeholder={placeholder}
          maxLength={key === 'nidaNumber' ? 20 : undefined}
          autoComplete={key === 'email' ? 'email' : key === 'ownerName' ? 'name' : undefined}
          aria-invalid={Boolean(error) || undefined}
        />
        {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card sm:p-7"
    >
      {formError ? (
        <Alert variant="danger" title="Could not submit the application">
          {formError}
        </Alert>
      ) : null}
      <p className="text-sm leading-6 text-slate-600">
        Apply from any university or campus. No account or Google sign-in is needed until your
        application has been approved.
      </p>
      {field('ownerName', 'Vendor owner full name', 'Your full name')}
      {field('nidaNumber', 'Owner NIDA number', '20-digit NIDA number')}
      {field('phone', 'Owner reliable phone number', '+255 712 345 678', 'tel')}
      {field('email', 'Email for Google sign-in after approval', 'you@example.com', 'email')}
      {field('businessName', 'Cafeteria / vendor name', 'Name of your cafeteria')}
      {field('universityName', 'Institution name', 'University or institution name')}
      {field('institutionPhone', 'Institution reliable phone number', '+255 712 345 678', 'tel')}
      <div className="space-y-1.5">
        <Label htmlFor="vendor-application-tinDocument">TIN / TRA document</Label>
        <Input
          id="vendor-application-tinDocument"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setTinDocument(event.target.files?.[0] ?? null)
          }
          aria-invalid={Boolean(errors.tinDocument) || undefined}
        />
        <p className="text-xs text-slate-500">
          Upload a PDF, JPG or PNG (up to 5 MB). Only Kupon administrators can access it for review.
        </p>
        {errors.tinDocument ? (
          <p className="text-xs font-medium text-red-600">{errors.tinDocument}</p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="checkbox"
          checked={confirm}
          onChange={(event) => setConfirm(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600"
        />
        <span className="text-xs leading-relaxed text-slate-600">
          I am the cafeteria owner, these details are correct, and Kupon may review my NIDA and
          TIN/TRA document for onboarding.
          {errors.confirm ? (
            <span className="mt-1 block font-medium text-red-600">{errors.confirm}</span>
          ) : null}
        </span>
      </label>

      <Button type="submit" size="lg" loading={submitting} disabled={submitting} className="w-full">
        Submit for review
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Button>
      <p className="text-center text-xs text-slate-500">
        Already approved?{' '}
        <Link href="/vendor/login" className="font-semibold text-primary-700 hover:underline">
          Continue with Google
        </Link>
      </p>
    </form>
  );
}

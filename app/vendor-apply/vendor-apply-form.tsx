'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, postJson } from '@/lib/client-api';
import { isValidTzPhone, normalizePhone } from '@/lib/utils';

type ApplicationForm = {
  ownerName: string;
  email: string;
  phone: string;
  applicantRole: 'OWNER' | 'AUTHORIZED_REPRESENTATIVE';
  authorizationDocumentUrl: string;
  businessName: string;
  universityName: string;
  city: string;
  description: string;
  businessRegistrationNumber: string;
  physicalAddress: string;
  registrationDocumentUrl: string;
};

type FieldErrors = Partial<Record<keyof ApplicationForm | 'confirm', string>>;

export function VendorApplyForm() {
  const [values, setValues] = useState<ApplicationForm>({
    ownerName: '',
    email: '',
    phone: '',
    applicantRole: 'OWNER',
    authorizationDocumentUrl: '',
    businessName: '',
    universityName: '',
    city: '',
    description: '',
    businessRegistrationNumber: '',
    physicalAddress: '',
    registrationDocumentUrl: '',
  });
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = 'Enter the Google email you will use after approval.';
    }
    if (!isValidTzPhone(values.phone)) next.phone = 'Use a valid Tanzanian number.';
    if (
      values.applicantRole === 'AUTHORIZED_REPRESENTATIVE' &&
      !/^https:\/\//i.test(values.authorizationDocumentUrl.trim())
    ) {
      next.authorizationDocumentUrl =
        'Provide a secure link showing that you can represent this business.';
    }
    if (values.businessName.trim().length < 2) next.businessName = 'Enter your business name.';
    if (values.universityName.trim().length < 2) {
      next.universityName = 'Enter the university or campus where you operate.';
    }
    if (values.city.trim().length < 2) next.city = 'Enter the city or town.';
    if (values.description.trim().length < 10) {
      next.description = 'Describe what you sell (at least 10 characters).';
    }
    if (values.businessRegistrationNumber.trim().length < 3) {
      next.businessRegistrationNumber = 'Enter the business registration number.';
    }
    if (values.physicalAddress.trim().length < 8) {
      next.physicalAddress = 'Enter the cafeteria location.';
    }
    try {
      if (new URL(values.registrationDocumentUrl).protocol !== 'https:') {
        next.registrationDocumentUrl = 'Use a secure HTTPS document link.';
      }
    } catch {
      next.registrationDocumentUrl = 'Enter a valid secure document link.';
    }
    if (!confirm) next.confirm = 'Confirm that you are authorised to apply for this business.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await postJson('/api/vendor/applications', {
        ...values,
        email: values.email.trim().toLowerCase(),
        phone: normalizePhone(values.phone),
        confirm: true,
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

  function field(
    key: keyof ApplicationForm,
    label: string,
    placeholder: string,
    options: { type?: string; maxLength?: number; multiline?: boolean } = {},
  ) {
    const id = `vendor-application-${key}`;
    const error = errors[key];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        {options.multiline ? (
          <Textarea
            id={id}
            value={values[key]}
            onChange={(event) => update(key, event.target.value)}
            placeholder={placeholder}
            maxLength={options.maxLength}
            aria-invalid={Boolean(error) || undefined}
          />
        ) : (
          <Input
            id={id}
            type={options.type ?? 'text'}
            value={values[key]}
            onChange={(event) => update(key, event.target.value)}
            placeholder={placeholder}
            maxLength={options.maxLength}
            autoComplete={key === 'email' ? 'email' : key === 'ownerName' ? 'name' : undefined}
            aria-invalid={Boolean(error) || undefined}
          />
        )}
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
      {field('ownerName', 'Owner / manager name', 'Your name')}
      {field('email', 'Email for Google sign-in after approval', 'you@example.com', {
        type: 'email',
      })}
      {field('phone', 'Business phone number', '+255 712 345 678', { type: 'tel' })}
      <div className="space-y-1.5">
        <Label htmlFor="vendor-application-applicantRole">Your role in the business</Label>
        <select
          id="vendor-application-applicantRole"
          value={values.applicantRole}
          onChange={(event) =>
            update(
              'applicantRole',
              event.target.value === 'AUTHORIZED_REPRESENTATIVE'
                ? 'AUTHORIZED_REPRESENTATIVE'
                : 'OWNER',
            )
          }
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
        >
          <option value="OWNER">Owner</option>
          <option value="AUTHORIZED_REPRESENTATIVE">Authorised representative or manager</option>
        </select>
        <p className="text-xs leading-relaxed text-slate-500">
          If you are applying on behalf of the owner, provide proof that you are authorised to
          represent the business.
        </p>
      </div>
      {values.applicantRole === 'AUTHORIZED_REPRESENTATIVE'
        ? field(
            'authorizationDocumentUrl',
            'Proof of authority (secure document link)',
            'https://…',
            { type: 'url', maxLength: 500 },
          )
        : null}
      {field('businessName', 'Business name', 'e.g. Campus Kitchen')}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('universityName', 'University / campus', 'Enter your institution')}
        {field('city', 'City / town', 'e.g. Arusha')}
      </div>
      {field('physicalAddress', 'Cafeteria location', 'Building, floor, or nearby landmark')}
      {field('description', 'What will you sell?', 'Describe your food and drinks', {
        multiline: true,
        maxLength: 500,
      })}
      {field(
        'businessRegistrationNumber',
        'Business registration number',
        'Registration or licence number',
      )}
      {field(
        'registrationDocumentUrl',
        'Registration document link',
        'https://…',
        { type: 'url', maxLength: 500 },
      )}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="checkbox"
          checked={confirm}
          onChange={(event) => setConfirm(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600"
        />
        <span className="text-xs leading-relaxed text-slate-600">
          I am authorised to apply for this business and the details are correct.
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

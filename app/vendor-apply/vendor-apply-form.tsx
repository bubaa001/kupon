'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, patchJson, postJson } from '@/lib/client-api';
import { isValidTzPhone, normalizePhone } from '@/lib/utils';

type ApplicationDetails = {
  businessName: string;
  phone: string;
  description: string;
  businessRegistrationNumber: string;
  physicalAddress: string;
  registrationDocumentUrl: string;
};

type FieldErrors = Partial<Record<keyof ApplicationDetails | 'confirm' | 'password', string>>;

export function VendorApplyForm({
  email,
  name,
  university,
  initialApplication,
}: {
  email: string;
  name: string;
  university: { name: string; code: string; city: string };
  initialApplication?: ApplicationDetails;
}) {
  const [ownerName, setOwnerName] = useState(name);
  const [businessName, setBusinessName] = useState(initialApplication?.businessName ?? '');
  const [phone, setPhone] = useState(initialApplication?.phone ?? '');
  const [password, setPassword] = useState('');
  const [description, setDescription] = useState(initialApplication?.description ?? '');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(
    initialApplication?.businessRegistrationNumber ?? '',
  );
  const [physicalAddress, setPhysicalAddress] = useState(initialApplication?.physicalAddress ?? '');
  const [registrationDocumentUrl, setRegistrationDocumentUrl] = useState(
    initialApplication?.registrationDocumentUrl ?? '',
  );
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const next: FieldErrors = {};
    if (businessName.trim().length < 2) next.businessName = 'Enter your business name.';
    if (!isValidTzPhone(phone)) next.phone = 'Use a valid Tanzanian number.';
    if (
      !initialApplication &&
      (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}/.test(password))
    ) {
      next.password = 'Use at least 12 characters with lowercase, uppercase, and a number.';
    }
    if (description.trim().length < 10) {
      next.description = 'Tell students what you sell (at least 10 characters).';
    }
    if (businessRegistrationNumber.trim().length < 3) {
      next.businessRegistrationNumber = 'Enter the business registration number.';
    }
    if (physicalAddress.trim().length < 8) {
      next.physicalAddress = 'Enter the cafeteria location on campus.';
    }
    try {
      if (new URL(registrationDocumentUrl).protocol !== 'https:') {
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
      const body = {
        ownerName: ownerName.trim(),
        businessName: businessName.trim(),
        phone: normalizePhone(phone),
        description: description.trim(),
        businessRegistrationNumber: businessRegistrationNumber.trim(),
        physicalAddress: physicalAddress.trim(),
        registrationDocumentUrl: registrationDocumentUrl.trim(),
        ...(initialApplication ? {} : { password }),
        confirm: true,
      };
      const result = initialApplication
        ? await patchJson<{ redirectTo?: string }>('/api/vendor/application', body)
        : await postJson<{ redirectTo?: string }>('/api/auth/google/vendor-apply', body);
      if (result.redirectTo) window.location.assign(result.redirectTo);
      else window.location.reload();
    } catch (error) {
      setFormError(
        error instanceof ApiClientError
          ? error.message
          : 'Could not submit your vendor request. Check the details and try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)]"
    >
      <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.12),transparent_45%)] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm ring-1 ring-slate-200">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary-800">
              Google verified
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            </p>
            <p className="truncate text-sm font-medium text-slate-800">{email}</p>
          </div>
          <ShieldCheck className="ml-auto h-5 w-5 shrink-0 text-primary-500" aria-hidden />
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          No SMS code is needed. The platform admin reviews your documents and verifies the cafeteria location.
        </p>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {formError ? (
          <Alert variant="danger" title="Could not submit the request">
            {formError}
          </Alert>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="vendor-business-name">Business name</Label>
          <Input
            id="vendor-business-name"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            placeholder="e.g. Mama Asha Café"
            error={Boolean(errors.businessName)}
            aria-describedby={errors.businessName ? 'vendor-business-error' : undefined}
          />
          {errors.businessName ? (
            <p id="vendor-business-error" className="text-[11px] font-medium text-red-600">
              {errors.businessName}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-owner-name">Owner / manager name</Label>
          <Input
            id="vendor-owner-name"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            autoComplete="name"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-apply-phone">Business phone number</Label>
          <Input
            id="vendor-apply-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'vendor-apply-phone-error' : undefined}
            placeholder="+255 712 345 678"
          />
          {errors.phone ? (
            <p id="vendor-apply-phone-error" className="text-[11px] font-medium text-red-600">
              {errors.phone}
            </p>
          ) : null}
        </div>

        {!initialApplication ? (
          <div className="space-y-1.5">
            <Label htmlFor="vendor-apply-password">Create your sign-in password</Label>
            <Input
              id="vendor-apply-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              error={Boolean(errors.password)}
              aria-describedby={errors.password ? 'vendor-password-error' : undefined}
              required
            />
            <p
              id={errors.password ? 'vendor-password-error' : undefined}
              className={errors.password ? 'text-[11px] font-medium text-red-600' : 'text-[11px] text-slate-500'}
            >
              {errors.password ?? 'Use 12+ characters with lowercase, uppercase, and a number.'}
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="vendor-description">What will you sell?</Label>
          <Textarea
            id="vendor-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Home-style Tanzanian meals, chips mayai, pilau and cold drinks near the main library."
            maxLength={500}
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={errors.description ? 'vendor-description-error' : undefined}
            className={errors.description ? 'border-red-400 focus-visible:border-red-500' : undefined}
          />
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>{errors.description ?? 'Keep it short and clear for students.'}</span>
            <span className="tabular">{description.length}/500</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor-registration-number">Business registration number</Label>
            <Input
              id="vendor-registration-number"
              value={businessRegistrationNumber}
              onChange={(event) => setBusinessRegistrationNumber(event.target.value)}
              error={Boolean(errors.businessRegistrationNumber)}
              aria-describedby={errors.businessRegistrationNumber ? 'vendor-registration-error' : undefined}
              placeholder="Registration or licence number"
            />
            {errors.businessRegistrationNumber ? (
              <p id="vendor-registration-error" className="text-[11px] font-medium text-red-600">
                {errors.businessRegistrationNumber}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor-location">Cafeteria location</Label>
            <Textarea
              id="vendor-location"
              value={physicalAddress}
              onChange={(event) => setPhysicalAddress(event.target.value)}
              placeholder={`Building, floor or landmark at ${university.name}`}
              maxLength={250}
              aria-invalid={Boolean(errors.physicalAddress) || undefined}
            />
            {errors.physicalAddress ? (
              <p className="text-[11px] font-medium text-red-600">{errors.physicalAddress}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor-registration-document">Registration document link</Label>
            <Input
              id="vendor-registration-document"
              type="url"
              inputMode="url"
              value={registrationDocumentUrl}
              onChange={(event) => setRegistrationDocumentUrl(event.target.value)}
              placeholder="https://…"
              error={Boolean(errors.registrationDocumentUrl)}
              aria-describedby={
                errors.registrationDocumentUrl ? 'vendor-document-error' : 'vendor-document-help'
              }
            />
            <p
              id={errors.registrationDocumentUrl ? 'vendor-document-error' : 'vendor-document-help'}
              className={errors.registrationDocumentUrl ? 'text-[11px] font-medium text-red-600' : 'text-[11px] text-slate-500'}
            >
              {errors.registrationDocumentUrl ?? 'Share a secure, view-only link the platform admin can open.'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <UtensilsCrossed className="h-4 w-4 text-primary-600" aria-hidden />
            {university.code} · {university.name}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            After approval you can add dishes with photos, see incoming student orders and verify
            meal coupons from your phone.
          </p>
        </div>

        <label
          className={
            errors.confirm
              ? 'flex cursor-pointer items-start gap-2.5 rounded-xl border border-red-300 bg-red-50/50 p-3'
              : 'flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition-colors hover:bg-slate-50'
          }
        >
          <input
            type="checkbox"
            checked={confirm}
            onChange={(event) => setConfirm(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
          />
          <span className="text-[11px] leading-relaxed text-slate-600">
            I am authorised to apply for this food business and the details are correct.
            {errors.confirm ? (
              <span className="mt-1 block font-medium text-red-600">{errors.confirm}</span>
            ) : null}
          </span>
        </label>

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Submit vendor request
          <ArrowRight aria-hidden />
        </Button>

        <p className="flex items-center justify-center gap-1 text-center text-[11px] text-slate-500">
          Already approved?
          <Link
            href="/vendor/login"
            className="font-semibold text-primary-700 underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}

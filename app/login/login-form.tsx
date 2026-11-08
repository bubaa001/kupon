'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch, postJson } from '@/lib/client-api';
import { cn, isValidTzPhone, normalizePhone } from '@/lib/utils';

export type LoginRole = 'student' | 'vendor' | 'staff';

// OTP login is intentionally disabled for now. Keep the complete implementation
// here so it can be re-enabled when SMS delivery is ready.
const OTP_LOGIN_ENABLED = false;

type University = {
  id: string;
  name: string;
  code: string;
  city: string;
  brandColor: string;
};

type UniversitiesPayload = { universities: University[] };
type OtpRequestPayload = {
  phone: string;
  universityId: string;
  expiresIn: number;
  demoOtp?: string;
  message: string;
};
type AuthSuccessPayload = { user: { name: string }; redirectTo: string };

function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-600">
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured:
    'Google sign-in is not configured on this deployment yet. Contact your university admin.',
  google_university: 'Select your university before continuing with Google.',
  google_denied: 'Google sign-in was cancelled. Start again when you are ready.',
  google_state:
    'Your Google sign-in session expired. Please start again from the login page.',
  google_exchange:
    'Google could not complete the sign-in. Check your connection and try again.',
  google_unverified:
    'Your Google email is not verified. Verify it in your Google account and try again.',
  google_signup_expired:
    'Your Google signup session expired. Start again and we will take you back to the signup form.',
  google_vendor_expired:
    'Your vendor application session expired. Start again from the Vendor tab.',
  google_student_only:
    'Google sign-in is available for students. Vendors and staff should use their normal credentials.',
  google_conflict:
    'This Google account is already linked to another Kupon identity. Contact your university admin.',
  google_suspended: 'Your university account is suspended. Contact your university admin.',
  google_role_conflict:
    'This Google account belongs to a different Kupon role. Use the correct sign-in tab.',
  google_vendor_missing:
    'This Google account has no vendor application yet. Submit a vendor request from the Vendor tab.',
  google_vendor_suspended:
    'This vendor account is suspended. Contact your university admin.',
  google_staff_only:
    'This Google email is not linked to an invited staff or administrator account.',
};

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.61-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.76Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.12A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.21 7.21 0 0 1 0-4.54V6.61H1.26a12 12 0 0 0 0 10.78l4.01-3.12Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.78l3.44-3.44C17.95 1.08 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.12C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

/** Six-box OTP input: auto-advance, paste fill, backspace walk-back. */
function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const focusAt = useCallback((index: number) => {
    const target = Math.min(5, Math.max(0, index));
    const input = refs.current[target];
    input?.focus();
    input?.select();
  }, []);

  const commit = (next: string[]) => onChange(next.join(''));

  function changeDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    commit(next);
    if (digit && index < 5) focusAt(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        commit(next);
      } else if (index > 0) {
        next[index - 1] = '';
        commit(next);
        focusAt(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      const next = [...digits];
      next[index] = '';
      commit(next);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = Array.from({ length: 6 }, (_, index) => pasted[index] ?? '');
    commit(next);
    focusAt(Math.min(pasted.length, 5));
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Six digit sign in code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          onChange={(event) => changeDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={() => {
            // Keep entry left to right so the code never has a hole in it.
            const firstEmpty = digits.findIndex((item) => !item);
            if (firstEmpty !== -1 && index > firstEmpty) refs.current[firstEmpty]?.focus();
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of 6`}
          disabled={disabled}
          className={cn(
            'h-12 w-full min-w-0 rounded-lg border bg-white text-center font-mono text-lg font-semibold tabular-nums text-slate-900 shadow-sm transition-colors focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70',
            invalid ? 'border-red-300' : 'border-slate-200',
          )}
        />
      ))}
    </div>
  );
}
export function LoginForm({
  initialRole,
  audience = 'public',
}: {
  initialRole: LoginRole;
  audience?: 'public' | 'student' | 'vendor' | 'staff';
}) {
  const router = useRouter();

  const [role, setRole] = useState<LoginRole>(
    audience === 'staff' ? 'staff' : audience === 'vendor' ? 'vendor' : initialRole,
  );

  // Public university directory for the student picker.
  const [universities, setUniversities] = useState<University[]>([]);
  const [universitiesLoading, setUniversitiesLoading] = useState(true);
  const [universitiesError, setUniversitiesError] = useState<string | null>(null);

  // Student state
  const [universityId, setUniversityId] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [otpPhase, setOtpPhase] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [googleStarting, setGoogleStarting] = useState(false);

  // Vendor state
  const [vendorCode, setVendorCode] = useState('');
  const [vendorPin, setVendorPin] = useState('');
  const [showVendorPin, setShowVendorPin] = useState(false);
  const [showVendorPinLogin, setShowVendorPinLogin] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorError, setVendorError] = useState<string | null>(null);

  // Staff state
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  const loadUniversities = useCallback(async () => {
    setUniversitiesLoading(true);
    setUniversitiesError(null);
    try {
      const data = await apiFetch<UniversitiesPayload>('/api/universities');
      setUniversities(data.universities);
      setUniversityId(
        (current) =>
          current ||
          data.universities[0]?.id ||
          '',
      );
    } catch (error) {
      setUniversitiesError(
        error instanceof Error ? error.message : 'Could not load the university list.',
      );
    } finally {
      setUniversitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUniversities();
  }, [loadUniversities]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error');
    const errorRole =
      params.get('role') === 'vendor'
        ? 'vendor'
        : params.get('role') === 'staff'
          ? 'staff'
          : 'student';
    if (errorCode && GOOGLE_ERRORS[errorCode]) {
      if (errorRole === 'vendor') setVendorError(GOOGLE_ERRORS[errorCode]);
      else if (errorRole === 'staff') setStaffError(GOOGLE_ERRORS[errorCode]);
      else setStudentError(GOOGLE_ERRORS[errorCode]);
      window.history.replaceState(
        {},
        '',
        errorRole === 'staff' ? '/staff/login' : errorRole === 'vendor' ? '/vendor/login' : '/login',
      );
    }
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function resetStudentFlow() {
    setOtpPhase('phone');
    setOtp('');
    setDemoOtp(null);
    setOtpMessage('');
    setResendIn(0);
    setStudentError(null);
  }

  function startGoogleSignIn(targetRole: 'student' | 'vendor' | 'staff' = 'student') {
    if (targetRole !== 'staff' && !universityId) {
      const message = 'Select your university before continuing with Google.';
      if (targetRole === 'vendor') setVendorError(message);
      else setStudentError(message);
      return;
    }
    setGoogleStarting(true);
    const params = new URLSearchParams({ role: targetRole });
    if (universityId) params.set('universityId', universityId);
    window.location.assign(`/api/auth/google/start?${params.toString()}`);
  }

  function finishLogin(data: AuthSuccessPayload, description: string) {
    toast.success(`Welcome back, ${data.user.name}`, { description });
    router.push(data.redirectTo);
    router.refresh();
  }

  async function requestOtp() {
    if (!universityId) {
      setStudentError('Select your university first.');
      return;
    }
    if (!isValidTzPhone(studentPhone)) {
      setStudentError('Enter a valid Tanzanian number, for example +255 712 345 678.');
      toast.error('That phone number is not valid');
      return;
    }

    setRequestingOtp(true);
    setStudentError(null);
    try {
      const phone = normalizePhone(studentPhone);
      const data = await postJson<OtpRequestPayload>('/api/auth/request-otp', {
        phone,
        universityId,
      });
      setStudentPhone(phone);
      setOtpPhase('otp');
      setOtp('');
      setDemoOtp(data.demoOtp ?? null);
      setOtpMessage(data.message);
      setResendIn(30);
      if (data.demoOtp) {
        toast.success('Demo code ready', {
          description: `Demo OTP ${data.demoOtp}. Use Autofill below.`,
        });
      } else {
        toast.success('Code sent', { description: data.message });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not request a code. Please try again.';
      setStudentError(message);
      toast.error('Could not send the code', { description: message });
    } finally {
      setRequestingOtp(false);
    }
  }

  async function verifyOtp() {
    if (!universityId) {
      setStudentError('Select your university first.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setStudentError('Enter the six-digit code from the SMS.');
      return;
    }

    setVerifying(true);
    setStudentError(null);
    try {
      const data = await postJson<AuthSuccessPayload>('/api/auth/verify-otp', {
        phone: normalizePhone(studentPhone),
        code: otp,
        universityId,
      });
      finishLogin(data, 'Opening your Kupon account.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'That code could not be verified. Try again.';
      setStudentError(message);
      setOtp('');
      toast.error('Sign in failed', { description: message });
    } finally {
      setVerifying(false);
    }
  }

  async function handleStudentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otpPhase === 'phone') {
      await requestOtp();
      return;
    }
    await verifyOtp();
  }

  async function handleVendorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vendorCode.trim().length < 3) {
      setVendorError('Enter your Kupon vendor code, for example V-CAMPUS-001.');
      return;
    }
    if (!/^\d{4}$/.test(vendorPin)) {
      setVendorError('Your terminal PIN must be four digits.');
      return;
    }

    setVendorLoading(true);
    setVendorError(null);
    try {
      const data = await postJson<AuthSuccessPayload>('/api/auth/vendor-login', {
        code: vendorCode.trim().toUpperCase(),
        pin: vendorPin,
      });
      finishLogin(data, 'Opening the vendor terminal.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Vendor login failed. Please try again.';
      setVendorError(message);
      toast.error('Sign in failed', { description: message });
    } finally {
      setVendorLoading(false);
    }
  }

  async function handleStaffSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidTzPhone(staffPhone)) {
      setStaffError('Enter the phone number on your staff account, for example +255 745 000 001.');
      return;
    }
    if (staffPassword.length < 6) {
      setStaffError('Your password is at least six characters.');
      return;
    }

    setStaffLoading(true);
    setStaffError(null);
    try {
      const data = await postJson<AuthSuccessPayload>('/api/auth/staff-login', {
        phone: normalizePhone(staffPhone),
        password: staffPassword,
      });
      finishLogin(data, 'Opening the management dashboard.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sign in failed. Please try again.';
      setStaffError(message);
      toast.error('Sign in failed', { description: message });
    } finally {
      setStaffLoading(false);
    }
  }

  return (
    <div>
      <Tabs value={role} onValueChange={(value) => setRole(value as LoginRole)}>
        {audience === 'public' ? (
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger value="student" className="w-full">
              Student
            </TabsTrigger>
            <TabsTrigger value="vendor" className="w-full">
              Vendor
            </TabsTrigger>
          </TabsList>
        ) : null}

        {audience !== 'staff' ? (
          <>
        <TabsContent value="student" className="mt-5 focus-visible:outline-none">
          <form onSubmit={handleStudentSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="university">University</Label>
              {universitiesLoading ? (
                <Skeleton className="h-11 w-full" />
              ) : universitiesError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-medium leading-relaxed text-red-700">
                    {universitiesError}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 bg-white"
                    onClick={() => void loadUniversities()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              ) : universities.length === 0 ? (
                <Alert variant="warning" title="No active universities">
                  Kupon has no active university yet. The platform administrator must set up a
                  campus before student sign-in is available.
                </Alert>
              ) : (
                <Select
                  id="university"
                  name="university"
                  value={universityId}
                  onChange={(event) => setUniversityId(event.target.value)}
                  disabled={otpPhase === 'otp'}
                  aria-label="University"
                >
                  <option value="" disabled>
                    Select your university
                  </option>
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.name} ({university.code})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {OTP_LOGIN_ENABLED ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="student-phone">Phone number</Label>
              <Input
                id="student-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+255 712 345 678"
                value={studentPhone}
                onChange={(event) => setStudentPhone(event.target.value)}
                disabled={otpPhase === 'otp'}
                aria-describedby="student-phone-help"
                error={Boolean(studentError) && otpPhase === 'phone'}
              />
              <p id="student-phone-help" className="text-xs text-slate-500">
                The number registered with your Kupon student account.
              </p>
            </div>

            {otpPhase === 'otp' ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Enter the six-digit code</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      Sent to {studentPhone || 'your phone'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void requestOtp()}
                    disabled={requestingOtp || resendIn > 0}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
                  >
                    {requestingOtp ? 'Sending...' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                </div>

                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  disabled={verifying}
                  invalid={Boolean(studentError)}
                  autoFocus
                />

                {demoOtp ? (
                  <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" strokeWidth={1.9} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-primary-900">
                        Demo mode: the SMS gateway is mocked
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-primary-800">
                        Your code is{' '}
                        <span className="font-mono font-semibold tracking-wider">{demoOtp}</span>. No
                        text was sent.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="subtle"
                      size="sm"
                      className="shrink-0 bg-white"
                      onClick={() => {
                        setOtp(demoOtp);
                        setStudentError(null);
                        toast.success('Demo code filled');
                      }}
                    >
                      Autofill
                    </Button>
                  </div>
                ) : otpMessage ? (
                  <p className="text-xs leading-relaxed text-slate-500">{otpMessage}</p>
                ) : null}
              </div>
            ) : null}

            {studentError ? <InlineError>{studentError}</InlineError> : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={requestingOtp || verifying}
              disabled={
                !universityId || universities.length === 0 || (otpPhase === 'otp' && otp.length !== 6)
              }
            >
              {otpPhase === 'phone' ? (
                <>
                  Request OTP
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Verify and sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {otpPhase === 'otp' ? (
              <button
                type="button"
                onClick={resetStudentFlow}
                className="mx-auto block text-xs font-medium text-slate-500 underline-offset-4 transition-colors hover:text-slate-800 hover:underline"
              >
                Use a different number
              </button>
            ) : null}
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
                  <p className="text-xs font-semibold text-emerald-900">
                    Student sign-in is Google-only for now.
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/80">
                    OTP is temporarily disabled. Existing student accounts need their Google email linked by
                    an admin; new students can create an account with Google.
                  </p>
                </div>
                {studentError ? <InlineError>{studentError}</InlineError> : null}
              </div>
            )}
          </form>

          <div className="mt-5">
            {OTP_LOGIN_ENABLED ? (
              <div className="relative flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  or
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            ) : null}
            <Button
              type="button"
              variant={OTP_LOGIN_ENABLED ? 'outline' : 'default'}
              size="lg"
              className={OTP_LOGIN_ENABLED ? 'mt-4 w-full bg-white' : 'w-full'}
              onClick={() => startGoogleSignIn('student')}
              loading={googleStarting}
              disabled={googleStarting || universities.length === 0}
            >
              {!googleStarting ? <GoogleGlyph className="h-[18px] w-[18px]" /> : null}
              Continue with Google
            </Button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
              Google is the student sign-in method now. Existing students sign in if their Google
              email is linked; new students can create an account in 30 seconds.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="vendor" className="mt-5 focus-visible:outline-none">
          {showVendorPinLogin ? (
          <form onSubmit={handleVendorSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="vendor-code">Vendor code</Label>
              <Input
                id="vendor-code"
                name="vendorCode"
                placeholder="V-CAMPUS-001"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                value={vendorCode}
                onChange={(event) => setVendorCode(event.target.value.toUpperCase())}
                error={Boolean(vendorError)}
              />
              <p className="text-xs text-slate-500">Printed on your Kupon terminal card.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-pin">Terminal PIN</Label>
              <div className="relative">
                <Input
                  id="vendor-pin"
                  name="pin"
                  type={showVendorPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={4}
                  placeholder="4 digits"
                  value={vendorPin}
                  onChange={(event) =>
                    setVendorPin(event.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  className="pr-11 tracking-[0.3em]"
                />
                <button
                  type="button"
                  onClick={() => setShowVendorPin((visible) => !visible)}
                  aria-label={showVendorPin ? 'Hide PIN' : 'Show PIN'}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                >
                  {showVendorPin ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.9} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.9} />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Seeded demo credentials are listed in the project README.
              </p>
            </div>

            {vendorError ? <InlineError>{vendorError}</InlineError> : null}

            <Button type="submit" size="lg" className="w-full" loading={vendorLoading}>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-university">University</Label>
                {universitiesLoading ? (
                  <Skeleton className="h-11 w-full" />
                ) : universitiesError ? (
                  <Alert variant="danger" title="Could not load universities">
                    {universitiesError}
                  </Alert>
                ) : (
                  <Select
                    id="vendor-university"
                    value={universityId}
                    onChange={(event) => setUniversityId(event.target.value)}
                    aria-label="Vendor university"
                  >
                    <option value="" disabled>
                      Select your campus
                    </option>
                    {universities.map((university) => (
                      <option key={university.id} value={university.id}>
                        {university.name} ({university.code})
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3.5">
                <p className="text-xs font-semibold text-primary-900">Vendors sign in with Google</p>
                <p className="mt-1 text-[11px] leading-relaxed text-primary-800/80">
                  Already approved? Google signs you into your terminal. New vendor? Google starts
                  your application for admin review.
                </p>
              </div>

              {vendorError ? <InlineError>{vendorError}</InlineError> : null}

              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => startGoogleSignIn('vendor')}
                loading={googleStarting}
                disabled={googleStarting || universities.length === 0}
              >
                {!googleStarting ? <GoogleGlyph className="h-[18px] w-[18px]" /> : null}
                Continue with Google
              </Button>
              <p className="text-center text-[11px] leading-relaxed text-slate-500">
                New applications are reviewed by your university admin before the terminal goes
                live.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setVendorError(null);
              setShowVendorPinLogin((visible) => !visible);
            }}
            className="mx-auto mt-4 block text-xs font-medium text-slate-500 underline-offset-4 transition-colors hover:text-slate-800 hover:underline"
          >
            {showVendorPinLogin
              ? 'Use Google sign-in instead'
              : 'Use an existing terminal code (demo)'}
          </button>
        </TabsContent>
          </>
        ) : null}

        {audience === 'staff' ? (
        <TabsContent value="staff" className="mt-5 focus-visible:outline-none">
          <form onSubmit={handleStaffSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="staff-phone">Phone number</Label>
              <Input
                id="staff-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="+255 745 000 001"
                value={staffPhone}
                onChange={(event) => setStaffPhone(event.target.value)}
                error={Boolean(staffError)}
              />
              <p className="text-xs text-slate-500">
                Use the phone number linked to your Kupon staff invitation.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-password">Password</Label>
              <div className="relative">
                <Input
                  id="staff-password"
                  name="password"
                  type={showStaffPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={staffPassword}
                  onChange={(event) => setStaffPassword(event.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowStaffPassword((visible) => !visible)}
                  aria-label={showStaffPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                >
                  {showStaffPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.9} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.9} />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                University admins see one campus. Platform admins see every tenant.
              </p>
            </div>

            {staffError ? <InlineError>{staffError}</InlineError> : null}

            <Button type="submit" size="lg" className="w-full" loading={staffLoading}>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <div className="my-5 relative flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              or
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full bg-white"
            onClick={() => startGoogleSignIn('staff')}
            loading={googleStarting}
            disabled={googleStarting}
          >
            {!googleStarting ? <GoogleGlyph className="h-[18px] w-[18px]" /> : null}
            Continue with Google
          </Button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
            Use the Google email your cafeteria owner or platform admin added to your account.
          </p>
        </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

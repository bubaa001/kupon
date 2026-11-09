'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, LockKeyhole, QrCode, RotateCcw, TicketCheck } from 'lucide-react';

const steps = [
  'Order placed',
  'Payment requested',
  'Payment confirmed',
  'Coupon issued',
];

/** An illustrative sequence only: it never creates an order or contacts the payment gateway. */
export function PaymentStory() {
  const [step, setStep] = useState(-1);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setStep(3);
      return;
    }

    let timers: number[] = [];
    let cycle: number;
    const run = () => {
      timers.forEach(window.clearTimeout);
      setStep(-1);
      timers = [0, 1, 2, 3].map((next, index) =>
        window.setTimeout(() => setStep(next), 900 + index * 1100),
      );
      cycle = window.setTimeout(run, 7200);
    };

    run();
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(cycle);
    };
  }, [runId]);

  const replay = () => setRunId((current) => current + 1);

  return (
    <div className="payment-story landing-enter landing-enter-delayed">
      <div className="payment-story__ticket">
        <div className="payment-story__ticket-head">
          <span className="payment-story__brand"><TicketCheck aria-hidden className="h-5 w-5" /> Kupon</span>
          <span className={`payment-story__status ${step >= 2 ? 'is-confirmed' : ''}`}>
            {step < 0 ? 'Awaiting payment' : step < 2 ? 'Payment requested' : 'Payment confirmed'}
          </span>
        </div>
        <p className="payment-story__overline">SAMPLE MEAL COUPON</p>
        <h2 className="payment-story__meal">Lunch order</h2>
        <div className={`payment-story__details ${step >= 2 ? 'is-unlocked' : ''}`}>
          <div className="payment-story__qr" aria-hidden="true"><QrCode strokeWidth={1.35} /></div>
          <div>
            <p className="payment-story__code-label">Coupon code</p>
            <p className="payment-story__code">{step >= 2 ? 'KPN-4F9A-27QX' : 'KPN-••••-••••'}</p>
            <p className="payment-story__hint">Show this to cafeteria staff before collecting your meal.</p>
          </div>
          {step < 2 ? <div className="payment-story__lock"><LockKeyhole aria-hidden /> Locked until payment confirms</div> : null}
        </div>
        <div className="payment-story__ticket-foot">
          <strong>{step >= 3 ? 'Ready to collect' : 'Payment unlocks your coupon'}</strong>
          <span>Sample only · not redeemable</span>
        </div>
      </div>

      <ol className="payment-story__tracker" aria-label="Illustrative order and payment stages" aria-live="off">
        {steps.map((label, index) => (
          <li key={label} className={step >= index ? 'is-done' : ''}>
            <span className="payment-story__tracker-dot" aria-hidden="true">
              {step >= index ? <CircleCheck className="h-4 w-4" /> : null}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <div className="payment-story__caption">
        <span>Simulated with the test gateway. No payment is made.</span>
        <button type="button" onClick={replay} aria-label="Replay the sample payment sequence">
          <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Replay
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { CircleCheck, LockKeyhole, RotateCcw, TicketCheck } from 'lucide-react';

const steps = [
  'Order placed',
  'Payment requested',
  'Payment confirmed',
  'Coupon issued',
];

function DecorativeQr() {
  const side = 25;
  const cells = Array.from({ length: side * side }, (_, index) => {
    const x = index % side;
    const y = Math.floor(index / side);
    const finder =
      (x < 8 && y < 8) ||
      (x >= side - 8 && y < 8) ||
      (x < 8 && y >= side - 8);
    if (finder) {
      const originX = x >= side - 8 ? side - 8 : 0;
      const originY = y >= side - 8 ? side - 8 : 0;
      const ring = Math.max(Math.abs(x - originX - 3), Math.abs(y - originY - 3));
      return ring === 3 || ring <= 1;
    }
    return ((x * 17 + y * 29 + x * y * 7) % 100) > 49;
  });

  return (
    <span
      className="payment-story__qr-grid"
      aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${side}, minmax(0, 1fr))` }}
    >
      {cells.map((filled, index) => (
        <i
          key={index}
          className={filled ? 'is-filled' : ''}
          style={{ '--cell-delay': index % 320 } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** An illustrative sequence only: it never creates an order or contacts the payment gateway. */
export function PaymentStory() {
  const [step, setStep] = useState(-1);
  const [runId, setRunId] = useState(0);
  const [couponCode, setCouponCode] = useState('KPN-••••-••••');
  const ticketRef = useRef<HTMLDivElement>(null);
  const isUnlocked = step >= 2;

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

  useEffect(() => {
    const finalCode = 'KPN-4F9A-27QX';
    if (!isUnlocked) {
      setCouponCode('KPN-••••-••••');
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCouponCode(finalCode);
      return;
    }

    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const startedAt = Date.now();
    const scramble = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / 1100);
      setCouponCode(
        Array.from(finalCode, (character, index) => {
          if (character === '-' || index / finalCode.length < progress) return character;
          return alphabet[Math.floor(Math.random() * alphabet.length)];
        }).join(''),
      );
      if (progress >= 1) window.clearInterval(scramble);
    }, 45);

    return () => window.clearInterval(scramble);
  }, [isUnlocked]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const node = ticketRef.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const horizontal = x / bounds.width - 0.5;
    const vertical = y / bounds.height - 0.5;
    node.style.setProperty('--tilt-x', `${-vertical * 5}deg`);
    node.style.setProperty('--tilt-y', `${horizontal * 5}deg`);
    node.style.setProperty('--gx', `${x}px`);
    node.style.setProperty('--gy', `${y}px`);
  };

  const resetPointerTilt = () => {
    const node = ticketRef.current;
    node?.style.setProperty('--tilt-x', '0deg');
    node?.style.setProperty('--tilt-y', '0deg');
  };

  const replay = () => setRunId((current) => current + 1);

  return (
    <div className="payment-story landing-enter landing-enter-delayed">
      <div
        ref={ticketRef}
        className="payment-story__tilt"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointerTilt}
      >
      <div className={`payment-story__ticket ${isUnlocked ? 'is-unlocked' : ''}`}>
        <div className="payment-story__ticket-head">
          <span className="payment-story__brand"><TicketCheck aria-hidden className="h-5 w-5" /> Kupon</span>
          <span role="status" aria-live="polite" className={`payment-story__status ${isUnlocked ? 'is-confirmed' : ''}`}>
            {step < 1 ? 'Awaiting payment' : step < 2 ? 'Payment requested' : 'Payment confirmed'}
          </span>
        </div>
        <h2 className="payment-story__meal">Meal coupon</h2>
        <div className={`payment-story__details ${isUnlocked ? 'is-unlocked' : ''}`}>
          <div className="payment-story__qr"><DecorativeQr /></div>
          <div>
            <p className="payment-story__code-label">Coupon code</p>
            <p className="payment-story__code">{couponCode}</p>
            <p className="payment-story__hint">Show this to cafeteria staff before collecting your meal.</p>
          </div>
          {step < 2 ? <div className="payment-story__lock"><LockKeyhole aria-hidden /> Locked until payment confirms</div> : null}
        </div>
        <div className="payment-story__ticket-foot">
          <strong>Your coupon is ready only when your payment is.</strong>
          <span>Sample coupon, not redeemable.</span>
        </div>
        <span className="payment-story__glare" aria-hidden="true" />
        <span className="payment-story__sheen" aria-hidden="true" />
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

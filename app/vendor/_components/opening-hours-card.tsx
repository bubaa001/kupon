'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiFetch } from '@/lib/client-api';

type Hours = { openTime: string | null; closeTime: string | null; label: string | null; openNow: boolean };

/**
 * Staff and owners set when the cafeteria is open. At closing time, unpaid
 * requests and uncollected coupons expire automatically.
 */
export function OpeningHoursCard() {
  const [hours, setHours] = useState<Hours | null>(null);
  const [openTime, setOpenTime] = useState('07:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Hours>('/api/cafeteria/hours')
      .then((result) => {
        setHours(result);
        if (result.openTime) setOpenTime(result.openTime);
        if (result.closeTime) setCloseTime(result.closeTime);
      })
      .catch(() => setHours({ openTime: null, closeTime: null, label: null, openNow: true }));
  }, []);

  async function save(next: { openTime: string | null; closeTime: string | null }) {
    setSaving(true);
    try {
      const result = await apiFetch<Hours>('/api/cafeteria/hours', {
        method: 'PUT',
        body: JSON.stringify(next),
        headers: { 'Content-Type': 'application/json' },
      });
      setHours(result);
      toast.success(result.label ? `Hours saved: ${result.label}` : 'Opening hours cleared');
    } catch (cause) {
      toast.error(cause instanceof ApiClientError ? cause.message : 'Could not save opening hours.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
          <Clock className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Opening hours</h2>
            {hours?.label ? (
              <span
                className={
                  hours.openNow
                    ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'
                    : 'rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700'
                }
              >
                {hours.openNow ? 'Open now' : 'Closed now'}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {hours?.label
              ? `Open ${hours.label}. At closing, orders not yet paid and coupons not collected expire automatically, and students see why.`
              : 'No hours set: students can order any time and coupons last 24 hours.'}
          </p>
        </div>
      </div>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save({ openTime, closeTime });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="hours-open">Opens</Label>
          <Input
            id="hours-open"
            type="time"
            value={openTime}
            onChange={(event) => setOpenTime(event.target.value)}
            className="w-32"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hours-close">Closes</Label>
          <Input
            id="hours-close"
            type="time"
            value={closeTime}
            onChange={(event) => setCloseTime(event.target.value)}
            className="w-32"
            required
          />
        </div>
        <Button type="submit" loading={saving}>
          Save hours
        </Button>
        {hours?.label ? (
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => void save({ openTime: null, closeTime: null })}
          >
            Clear
          </Button>
        ) : null}
      </form>
    </Card>
  );
}

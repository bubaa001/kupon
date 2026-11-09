'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CircleOff, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ApiClientError, apiFetch, patchJson } from '@/lib/client-api';

type MenuItem = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  available: boolean;
  autoAccept: boolean;
};

export default function StaffMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoAcceptBusy, setAutoAcceptBusy] = useState(false);
  const autoAcceptAll = items.length > 0 && items.every((item) => item.autoAccept);

  const load = useCallback(async () => {
    try {
      const payload = await apiFetch<{ items: MenuItem[] }>('/api/staff/menu');
      setItems(payload.items);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not load today’s menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleAvailability(item: MenuItem) {
    setBusyId(item.id);
    try {
      const payload = await patchJson<{ item: MenuItem }>(`/api/staff/menu/${item.id}`, {
        available: !item.available,
      });
      setItems((current) =>
        current.map((currentItem) => (currentItem.id === item.id ? payload.item : currentItem)),
      );
      toast.success(`${item.name} is ${payload.item.available ? 'available' : 'unavailable'} today.`);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not update availability.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAutoAccept(enabled: boolean) {
    setAutoAcceptBusy(true);
    try {
      await patchJson<{ enabled: boolean }>('/api/staff/menu/auto-accept', { enabled });
      setItems((current) => current.map((item) => ({ ...item, autoAccept: enabled })));
      toast.success(
        enabled
          ? 'All new meal requests will be accepted automatically.'
          : 'New meal requests will wait for staff approval.',
      );
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not update order acceptance.');
    } finally {
      setAutoAcceptBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Daily operations"
        title="Today’s menu"
        description="Set which of the owner’s menu items are in stock today. The owner manages dishes and prices."
      />
      <Alert variant="info">
        You are responsible for today’s availability: mark dishes available or unavailable as the
        kitchen changes. Updates take effect immediately for students. Staff cannot change dishes,
        prices or payment records.
      </Alert>
      {!loading && items.length > 0 ? (
        <Card className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Automatically accept all meal requests</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              When on, new requests are accepted automatically and students can then pay. When off,
              staff confirm each request before the student can pay.
            </p>
          </div>
          <Switch
            checked={autoAcceptAll}
            onCheckedChange={(enabled) => void toggleAutoAccept(enabled)}
            disabled={autoAcceptBusy}
            aria-label="Automatically accept all meal requests"
          />
        </Card>
      ) : null}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No menu items yet"
          description="Ask the cafeteria owner to add menu items before updating availability."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="flex items-center gap-3 p-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl"
                aria-hidden
              >
                {item.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.category}</p>
                <p
                  className={
                    item.available
                      ? 'mt-1 text-[10px] font-semibold text-emerald-700'
                      : 'mt-1 text-[10px] font-semibold text-slate-500'
                  }
                >
                  {item.available ? 'In stock for students' : 'Not available to students today'}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={item.available ? 'outline' : 'default'}
                disabled={busyId === item.id}
                loading={busyId === item.id}
                aria-pressed={item.available}
                onClick={() => void toggleAvailability(item)}
              >
                {item.available ? (
                  <>
                    <CircleOff className="h-3.5 w-3.5" />
                    Mark unavailable
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Mark available
                  </>
                )}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

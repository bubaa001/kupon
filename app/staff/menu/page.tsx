'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, CircleOff, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ApiClientError, apiFetch, deleteJson, patchJson, postJson } from '@/lib/client-api';
import { formatTZS } from '@/lib/utils';

type MenuItem = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  price: number;
  available: boolean;
  autoAccept: boolean;
};

export default function StaffMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoAcceptBusy, setAutoAcceptBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Main');
  const [emoji, setEmoji] = useState('🍲');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<MenuItem | null>(null);
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

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingItem(true);
    try {
      const payload = await postJson<{ item: MenuItem }>('/api/staff/menu', {
        name,
        price: Number(price),
        category,
        emoji,
      });
      setItems((current) =>
        [...current, payload.item].sort(
          (left, right) =>
            left.category.localeCompare(right.category) || left.name.localeCompare(right.name),
        ),
      );
      setName('');
      setPrice('');
      setCategory('Main');
      setEmoji('🍲');
      setAddOpen(false);
      toast.success(`${payload.item.name} added and available to students.`);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not add food.');
    } finally {
      setSavingItem(false);
    }
  }

  async function removeItem(item: MenuItem) {
    setRemovingId(item.id);
    try {
      await deleteJson(`/api/staff/menu/${encodeURIComponent(item.id)}`);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setRemovalTarget(null);
      toast.success(`${item.name} removed from the menu.`);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not remove food.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Daily operations"
        title="Today’s menu"
        description="Add foods sold today, remove unavailable items, and keep the student menu current. Owners can review the menu remotely."
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add food
          </Button>
        }
      />
      <Alert variant="info">
        You run the food menu on site: add a dish with its price, mark it available or unavailable
        as stock changes, and remove items that are no longer sold. Students see menu changes
        immediately. Payment records cannot be changed here.
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
          description="Add the food being served today. Students can request it as soon as it is listed."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add the first food
            </Button>
          }
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
                <p className="mt-0.5 text-xs text-slate-500">
                  {item.category} · {formatTZS(item.price)}
                </p>
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
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={removingId === item.id || busyId === item.id}
                loading={removingId === item.id}
                aria-label={`Remove ${item.name} from the menu`}
                onClick={() => setRemovalTarget(item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!savingItem) setAddOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add food to today’s menu</DialogTitle>
            <DialogDescription>
              New food is listed as available immediately. Students can request it, and requests
              still wait for staff approval before payment.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void addItem(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="staff-menu-name">Food name</Label>
              <Input
                id="staff-menu-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="staff-menu-price">Price (TZS)</Label>
                <Input
                  id="staff-menu-price"
                  type="number"
                  inputMode="numeric"
                  min={500}
                  max={100000}
                  step={100}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-menu-category">Category</Label>
                <Input
                  id="staff-menu-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  minLength={2}
                  maxLength={30}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-menu-emoji">Food icon</Label>
              <Input
                id="staff-menu-emoji"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                maxLength={16}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={savingItem}>
                <Plus className="h-4 w-4" />
                Add food
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removalTarget !== null}
        onOpenChange={(open) => {
          if (!open && removingId === null) setRemovalTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removalTarget?.name}?</DialogTitle>
            <DialogDescription>
              This food will no longer appear on the student menu. Past order records will remain
              unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={removingId !== null}
              onClick={() => setRemovalTarget(null)}
            >
              Keep food
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={removingId === removalTarget?.id}
              disabled={!removalTarget || removingId !== null}
              onClick={() => {
                if (removalTarget) void removeItem(removalTarget);
              }}
            >
              Remove food
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

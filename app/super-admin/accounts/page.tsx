'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { ApiClientError, deleteJson } from '@/lib/client-api';
import { formatDateTime } from '@/lib/utils';
import { useApiData } from '../_components/use-api-data';

type Account = {
  id: string;
  name: string;
  contact: string;
  role: string;
  roleLabel: string;
  cafeteria: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

export default function AccountsPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, error, loading, reload } = useApiData<{ accounts: Account[] }>(
    `/api/super-admin/accounts?q=${encodeURIComponent(debounced)}`,
  );

  async function remove(account: Account) {
    const extra =
      account.role === 'VENDOR' ? ' Their cafeteria will be suspended too.' : '';
    if (
      !window.confirm(
        `Remove ${account.name}? They can never sign in again.${extra} Orders, payments and records stay.`,
      )
    ) {
      return;
    }
    setRemoving(account.id);
    try {
      await deleteJson(`/api/super-admin/accounts?userId=${encodeURIComponent(account.id)}`);
      toast.success(`${account.name} removed`);
      await reload();
    } catch (cause) {
      toast.error(cause instanceof ApiClientError ? cause.message : 'Could not remove this account.');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Access"
        title="Accounts"
        description="Find anyone on Kupon and remove their access. Removing keeps their orders and money records so the books still balance."
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, phone or cafeteria"
          className="pl-9"
          aria-label="Search accounts"
        />
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Card className="divide-y divide-navy/[0.07]">
        {loading && !data ? (
          <p className="p-5 text-sm text-ink-muted">Loading…</p>
        ) : !data?.accounts.length ? (
          <p className="p-5 text-sm text-ink-muted">No accounts match.</p>
        ) : (
          data.accounts.map((account) => (
            <div key={account.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-navy">{account.name}</p>
                  <Badge variant={account.role === 'ADMIN' ? 'warning' : 'neutral'}>
                    {account.roleLabel}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {account.contact}
                  {account.cafeteria ? ` · ${account.cafeteria}` : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Joined {formatDateTime(account.createdAt)}
                  {account.lastLoginAt ? ` · last sign-in ${formatDateTime(account.lastLoginAt)}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={removing === account.id}
                loading={removing === account.id}
                onClick={() => void remove(account)}
              >
                <UserX aria-hidden />
                Remove
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

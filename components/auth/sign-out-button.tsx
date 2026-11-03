'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/logout';

export function SignOutButton({
  label = 'Sign out',
  destination = '/login',
  className,
}: {
  label?: string;
  destination?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    await signOut(destination);
  }

  return (
    <Button
      type="button"
      variant="outline"
      loading={busy}
      onClick={() => void handleSignOut()}
      className={className}
    >
      <LogOut className="h-4 w-4" />
      {label}
    </Button>
  );
}

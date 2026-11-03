'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { postJson } from '@/lib/client-api';

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await postJson('/api/auth/logout', {});
    } finally {
      window.location.assign('/login?role=vendor');
    }
  }

  return (
    <Button type="button" variant="outline" loading={busy} onClick={() => void signOut()}>
      Switch account
    </Button>
  );
}

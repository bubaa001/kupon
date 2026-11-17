'use client';

import { useEffect } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

/** Error boundary for the student area — keeps the shell usable after a page error. */
export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[student] page error', error);
  }, [error]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Student account"
        title="Kuna hitilafu"
        description="We could not show this page. Your order details have not changed."
      />
      <Alert variant="danger" title="This page did not load">
        {error.message || 'Try again. If the problem continues, sign out and sign back in.'}
      </Alert>
      <Button className="w-full" size="lg" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

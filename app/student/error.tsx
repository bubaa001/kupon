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
        description="Hatukuweza kuonyesha ukurasa huu. Maelezo ya oda yako hayajabadilika."
      />
      <Alert variant="danger" title="Imeshindikana kupakia ukurasa">
        {error.message || 'Jaribu tena. Kama tatizo linaendelea, toka na uingie tena.'}
      </Alert>
      <Button className="w-full" size="lg" onClick={reset}>
        Jaribu tena
      </Button>
    </div>
  );
}

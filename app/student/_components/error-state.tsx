'use client';

import { AlertCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** Consistent, non-technical failure panel used by every student data screen. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="space-y-3">
      <Alert variant="danger" title="Imeshindikana kupakia taarifa">
        {message}
      </Alert>
      {onRetry ? (
        <Button variant="outline" className="w-full" onClick={onRetry}>
          <AlertCircle aria-hidden />
          Jaribu tena
        </Button>
      ) : null}
    </div>
  );
}

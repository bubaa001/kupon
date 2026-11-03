'use client';

import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border border-slate-200 shadow-lift font-sans',
          title: 'text-sm font-semibold',
          description: 'text-xs text-slate-500',
        },
      }}
    />
  );
}

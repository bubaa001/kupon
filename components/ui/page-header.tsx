import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  eyebrow,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-3 inline-flex min-h-[32px] items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        ) : null}
        {eyebrow ? <p className="eyebrow mb-2 text-[#A87B22]">{eyebrow}</p> : null}
        <h1 className="text-balance text-[1.6rem] font-medium leading-tight tracking-[-0.045em] text-[#0A1730] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

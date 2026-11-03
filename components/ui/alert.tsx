import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const styles = {
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-800', icon: Info },
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
  warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-800', icon: AlertCircle },
  danger: { wrap: 'border-red-200 bg-red-50 text-red-800', icon: ShieldAlert },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: keyof typeof styles;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const config = styles[variant];
  const Icon = config.icon;
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', config.wrap, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn('leading-relaxed', title && 'mt-0.5')}>{children}</div>
      </div>
    </div>
  );
}

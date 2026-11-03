import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE, REFUND_BADGE } from '@/lib/constants';

export function StatusBadge({ status, dot = true }: { status: string; dot?: boolean }) {
  const config =
    STATUS_BADGE[status as keyof typeof STATUS_BADGE] ?? {
      label: status.charAt(0) + status.slice(1).toLowerCase(),
      variant: 'neutral' as const,
    };
  return (
    <Badge variant={config.variant} dot={dot}>
      {config.label}
    </Badge>
  );
}

export function RefundStatusBadge({ status }: { status: string }) {
  const config =
    REFUND_BADGE[status as keyof typeof REFUND_BADGE] ?? {
      label: status,
      variant: 'neutral' as const,
    };
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

export function ApprovalBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <Badge variant="success" dot>Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="danger" dot>Rejected</Badge>;
  return <Badge variant="warning" dot>Needs review</Badge>;
}

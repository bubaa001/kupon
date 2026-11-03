import { Badge } from '@/components/ui/badge';
import type { ServiceStatus, TenantHealth } from './types';

const badgeVariant = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  neutral: 'neutral',
} as const;

type Variant = (typeof badgeVariant)[keyof typeof badgeVariant];

export function UniversityStatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') {
    return (
      <Badge variant="success" dot>
        Active
      </Badge>
    );
  }
  if (status === 'SUSPENDED') {
    return (
      <Badge variant="danger" dot>
        Suspended
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" dot>
      {status}
    </Badge>
  );
}

const HEALTH: Record<TenantHealth, { label: string; variant: Variant }> = {
  OPERATIONAL: { label: 'Healthy', variant: 'success' },
  DEGRADED: { label: 'Degraded', variant: 'warning' },
  SUSPENDED: { label: 'Paused', variant: 'neutral' },
};

export function TenantHealthBadge({ health }: { health: TenantHealth }) {
  const config = HEALTH[health] ?? HEALTH.OPERATIONAL;
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === 'PAID') return <Badge variant="success">Paid</Badge>;
  if (status === 'OVERDUE') return <Badge variant="danger">Overdue</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

const SERVICE: Record<ServiceStatus, { label: string; variant: Variant }> = {
  OPERATIONAL: { label: 'Operational', variant: 'success' },
  DEGRADED: { label: 'Degraded', variant: 'warning' },
  OUTAGE: { label: 'Outage', variant: 'danger' },
};

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const config = SERVICE[status] ?? SERVICE.OPERATIONAL;
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

export function IncidentSeverityBadge({
  severity,
}: {
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
}) {
  if (severity === 'CRITICAL') {
    return (
      <Badge variant="danger" dot>
        Critical
      </Badge>
    );
  }
  if (severity === 'MAJOR') {
    return (
      <Badge variant="warning" dot>
        Major
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" dot>
      Minor
    </Badge>
  );
}

export function MockBadge() {
  return (
    <Badge variant="outline" className="text-[10px] font-medium">
      Mock metric
    </Badge>
  );
}

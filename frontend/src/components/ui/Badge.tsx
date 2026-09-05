import { HTMLAttributes, ReactNode } from 'react';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
type Size = 'sm' | 'md';

const base = 'inline-flex items-center rounded-full font-medium';

const sizeClasses: Record<Size, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
};

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-muted',
  primary: 'bg-primary-soft text-primary-700',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
}

export const Badge = ({
  tone = 'neutral',
  size = 'md',
  className = '',
  children,
  ...rest
}: BadgeProps) => (
  <span
    className={`${base} ${sizeClasses[size]} ${toneClasses[tone]} ${className}`.trim()}
    {...rest}
  >
    {children}
  </span>
);

// --- StatusPill: enum-aware variant ---

type StatusKind = 'event' | 'ticket' | 'payment' | 'sale' | 'role';

type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
type SaleStatus = 'on' | 'off';
type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';

const eventMap: Record<EventStatus, { tone: Tone; label: string }> = {
  DRAFT: { tone: 'neutral', label: 'Draft' },
  PUBLISHED: { tone: 'success', label: 'Published' },
  CANCELLED: { tone: 'danger', label: 'Cancelled' },
  COMPLETED: { tone: 'info', label: 'Completed' },
};

const ticketMap: Record<string, { tone: Tone; label: string }> = {
  VALID: { tone: 'success', label: 'Valid' },
  USED: { tone: 'info', label: 'Used' },
  CANCELLED: { tone: 'danger', label: 'Cancelled' },
  UNKNOWN: { tone: 'danger', label: 'Unknown' },
};

const paymentMap: Record<string, { tone: Tone; label: string }> = {
  SUCCEEDED: { tone: 'success', label: 'Paid' },
  FAILED: { tone: 'danger', label: 'Failed' },
  PENDING: { tone: 'warning', label: 'Pending' },
};

const saleMap: Record<SaleStatus, { tone: Tone; label: string }> = {
  on: { tone: 'success', label: 'On Sale' },
  off: { tone: 'neutral', label: 'Not On Sale' },
};

const roleMap: Record<Role, { tone: Tone; label: string }> = {
  ATTENDEE: { tone: 'info', label: 'Attendee' },
  ORGANIZER: { tone: 'primary', label: 'Organizer' },
  ADMIN: { tone: 'danger', label: 'Admin' },
};

interface StatusPillProps {
  kind: StatusKind;
  value: string;
  size?: Size;
}

export const StatusPill = ({ kind, value, size = 'md' }: StatusPillProps) => {
  let tone: Tone = 'neutral';
  let label: string = value;

  if (kind === 'event' && value in eventMap) {
    ({ tone, label } = eventMap[value as EventStatus]);
  } else if (kind === 'ticket') {
    ({ tone, label } = ticketMap[value] ?? ticketMap.UNKNOWN);
  } else if (kind === 'payment') {
    ({ tone, label } = paymentMap[value] ?? { tone: 'neutral' as Tone, label: value });
  } else if (kind === 'sale') {
    ({ tone, label } = saleMap[value as SaleStatus] ?? saleMap.off);
  } else if (kind === 'role' && value in roleMap) {
    ({ tone, label } = roleMap[value as Role]);
  }

  return (
    <Badge tone={tone} size={size}>
      {label}
    </Badge>
  );
};

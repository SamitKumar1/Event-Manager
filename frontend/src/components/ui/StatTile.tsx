import { ReactNode } from 'react';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const toneAccent: Record<Tone, string> = {
  neutral: 'before:bg-text-subtle',
  primary: 'before:bg-primary',
  success: 'before:bg-success',
  warning: 'before:bg-warning',
  danger: 'before:bg-danger',
  info: 'before:bg-info',
};

const toneText: Record<Tone, string> = {
  neutral: 'text-text',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: Tone;
  caption?: string;
}

export const StatTile = ({ label, value, icon, tone = 'neutral', caption }: StatTileProps) => {
  return (
    <div
      className={
        'relative bg-surface border border-border rounded-xl shadow-sm p-6 ' +
        'before:content-[""] before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:rounded-r ' +
        toneAccent[tone]
      }
    >
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-text-muted">{label}</h3>
        {icon && <span className="text-text-subtle">{icon}</span>}
      </div>
      <p className={`mt-2 text-3xl font-bold ${toneText[tone]}`}>{value}</p>
      {caption && <p className="mt-1 text-xs text-text-subtle">{caption}</p>}
    </div>
  );
};

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

const defaultIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="py-12 px-6 text-center flex flex-col items-center">
    <div className="text-text-subtle mb-4">{icon ?? defaultIcon}</div>
    <h3 className="text-lg font-semibold text-text">{title}</h3>
    {description && <p className="mt-1 text-sm text-text-muted max-w-sm">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

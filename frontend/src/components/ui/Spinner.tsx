type Size = 'sm' | 'md' | 'lg';

const sizeClasses: Record<Size, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-12 w-12 border-4',
};

interface SpinnerProps {
  size?: Size;
  className?: string;
}

export const Spinner = ({ size = 'md', className = '' }: SpinnerProps) => (
  <span
    role="status"
    aria-label="Loading"
    className={`inline-block animate-spin rounded-full border-primary border-t-transparent ${sizeClasses[size]} ${className}`.trim()}
  />
);

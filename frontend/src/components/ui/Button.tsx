import { forwardRef, ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'transition-colors';

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-700',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-2',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-danger text-on-danger hover:bg-danger/90',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    as?: 'button';
    to?: never;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | 'href'> & {
    as: 'a';
    to: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const classes = (
  variant: Variant,
  size: Size,
  fullWidth: boolean,
  extra?: string
): string =>
  [
    base,
    sizeClasses[size],
    variantClasses[variant],
    fullWidth ? 'w-full' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      children,
      className,
      disabled,
      ...rest
    } = props as ButtonProps & { className?: string; disabled?: boolean };

    const computed = classes(variant, size, fullWidth, className);
    const content = (
      <>
        {loading && <Spinner size="sm" />}
        {children}
      </>
    );

    if ((props as ButtonAsLink).as === 'a' && (props as ButtonAsLink).to) {
      const { to, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
        to: string;
      };
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          to={to}
          className={computed}
          {...anchorRest}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={computed}
        disabled={disabled || loading}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    );
  }
);

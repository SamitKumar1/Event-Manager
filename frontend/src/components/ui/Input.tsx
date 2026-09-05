import { InputHTMLAttributes, ReactNode } from 'react';

interface LabelProps {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export const Label = ({ htmlFor, children, className = '' }: LabelProps) => (
  <label
    htmlFor={htmlFor}
    className={`text-sm font-medium text-text block mb-1 ${className}`.trim()}
  >
    {children}
  </label>
);

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

const baseInput =
  'w-full px-3 py-2 rounded-md border bg-surface text-text ' +
  'placeholder:text-text-subtle ' +
  'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'transition-colors';

export const Input = ({ invalid = false, className = '', ...rest }: InputProps) => {
  const stateClasses = invalid
    ? 'border-danger focus:ring-danger focus:border-danger'
    : 'border-border';
  return <input className={`${baseInput} ${stateClasses} ${className}`.trim()} {...rest} />;
};

interface FieldErrorProps {
  children?: ReactNode;
}

export const FieldError = ({ children }: FieldErrorProps) => {
  if (!children) return null;
  return <p className="text-sm text-danger mt-1">{children}</p>;
};

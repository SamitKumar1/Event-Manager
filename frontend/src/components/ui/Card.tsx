import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flush';
  children: ReactNode;
}

export const Card = ({ variant = 'default', className = '', children, ...rest }: CardProps) => {
  const base = variant === 'flush'
    ? 'bg-surface border border-border'
    : 'bg-surface border border-border rounded-xl shadow-sm';
  return (
    <div className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
};

interface HeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const Header = ({ className = '', children, ...rest }: HeaderProps) => (
  <div
    className={`border-b border-border px-6 py-4 flex items-center justify-between ${className}`.trim()}
    {...rest}
  >
    {children}
  </div>
);

interface BodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const Body = ({ className = '', children, ...rest }: BodyProps) => (
  <div className={`p-6 ${className}`.trim()} {...rest}>
    {children}
  </div>
);

interface FooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const Footer = ({ className = '', children, ...rest }: FooterProps) => (
  <div
    className={`border-t border-border px-6 py-3 bg-surface-2 rounded-b-xl ${className}`.trim()}
    {...rest}
  >
    {children}
  </div>
);

Card.Header = Header;
Card.Body = Body;
Card.Footer = Footer;

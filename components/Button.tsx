import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-xl font-semibold tracking-tight transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg shadow-blue-500/30 hover:from-blue-400 hover:to-blue-300 border border-blue-500/70',
    secondary:
      'bg-slate-800 text-slate-100 border border-slate-600 hover:bg-slate-700',
    danger:
      'bg-gradient-to-r from-rose-500 to-rose-400 text-white border border-rose-500/70 shadow-lg shadow-rose-500/30',
    outline:
      'bg-transparent text-slate-100 border border-slate-500 hover:bg-slate-800/60',
  };

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'h-9 px-4 text-xs',
    md: 'h-11 px-5 text-sm',
    lg: 'h-13 px-6 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

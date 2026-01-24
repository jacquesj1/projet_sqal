'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'font-bold rounded-lg transition-colors flex items-center justify-center gap-2';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400',
    secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100',
    success: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400',
    warning: 'bg-orange-500 text-white hover:bg-orange-600 disabled:bg-gray-400',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 disabled:text-gray-400',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-3',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

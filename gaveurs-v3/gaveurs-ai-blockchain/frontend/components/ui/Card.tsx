'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  gradient?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({
  children,
  className = '',
  gradient,
  hover = false,
  onClick,
}: CardProps) {
  const baseClasses = 'rounded-lg shadow-lg p-6';
  const hoverClasses = hover ? 'hover:shadow-xl transition-shadow cursor-pointer' : '';
  const bgClasses = gradient ? `bg-gradient-to-br ${gradient}` : 'bg-white';

  return (
    <div
      className={`${baseClasses} ${bgClasses} ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface KPICardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan';
  subtitle?: string;
}

export function KPICard({ icon, label, value, color, subtitle }: KPICardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    cyan: 'from-cyan-500 to-cyan-600',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-lg p-6 text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">{label}</p>
          <p className="text-4xl font-bold mt-2">{value}</p>
          {subtitle && <p className="text-xs opacity-75 mt-1">{subtitle}</p>}
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </div>
  );
}
